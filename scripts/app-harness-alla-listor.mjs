// Kör: node scripts/app-harness-alla-listor.mjs (BASE=, WIDTH=, NARROW=1 för Smal, FEW=1 för få kolumner)
// Alla listsidor: luckor mellan kolumner, sidledsskroll och klippta rubriker.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:5199';
const WIDTH = Number(process.env.WIDTH || 1440);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };
let tick = 0;
const newTs = () => new Date(Date.UTC(2026, 9, 10, 12, 0, 0) + (++tick) * 1000).toISOString().replace('Z', '+00:00');

const browser = await chromium.launch();
const logs = [];
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, ...(WIDTH < 600 ? { isMobile: true, hasTouch: true } : {}) });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const p0 = await ctx.newPage();
await p0.goto(`${process.env.SEED_BASE || BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await p0.close();
const now = Date.now();
const img = BASE + "/scripts/guide-assets/exempelkvitto.png";
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
const saved = () => server.row.state.companies[id];

const page = await ctx.newPage();
await page.addInitScript((d) => localStorage.setItem('bokix_theme_pref', d ? 'dark' : 'light'), Boolean(process.env.DARK));
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|posthog|sentry/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
page.on('requestfailed', r => { if (process.env.DBG) console.log('MISSLYCKAD', r.url().slice(0, 120), r.failure()?.errorText); });
await page.addInitScript(([key, val]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
const reply = (route, data, wantsObject) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? data : (data == null ? [] : Array.isArray(data) ? data : [data])) });
await page.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
  if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
  if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
  const table = url.pathname.replace('/rest/v1/', '');
  if (table === 'user_data') {
    if (req.method() === 'GET' || req.method() === 'HEAD') return reply(route, server.row, wantsObject);
    const body = JSON.parse(req.postData() || '{}');
    Object.assign(server.row, Array.isArray(body) ? body[0] : body, { updated_at: newTs() });
    return reply(route, { updated_at: server.row.updated_at }, wantsObject);
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, company_id: '', plan: process.env.PLAN || null, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route("**/api/**", r => r.fulfill({ json: {} }));

const tag = '-' + WIDTH + (process.env.NARROW ? '-smal' : '') + (process.env.FEW ? '-fa' : '');
if (process.env.NARROW) await page.addInitScript(() => {
  for (const k of ['bokix.contacts.prefs2', 'bokix.invoices.prefs', 'bokix.orders.prefs', 'bokix.quotes.prefs', 'bokix.supplierInvoices.prefs', 'bokix.bank.prefs', 'bokix.verifications.prefs', 'bokix.review.prefs', 'bokix.projects.prefs', 'bokix.employees.prefs']) {
    try { const v = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...v, width: 'narrow' })); } catch { /* */ }
  }
});
const PAGES = [['contacts', null, 'kunder'], ['contacts', /^Leverantörer/, 'leverantorer'], ['quotes', null, 'offerter'], ['orders', null, 'order'], ['invoices', null, 'kundfakturor'], ['supplier_invoices', null, 'levfakturor'], ['articles', null, 'artiklar'], ['articles', /^Lager/, 'lager'], ['articles', /^Prissättning/, 'prissattning'], ['expenses', null, 'underlag'], ['bank', null, 'bank'], ['verifications', null, 'bokforing']];
for (const [hash, tab, name] of PAGES) {
  await page.goto(BASE + '/?app=1#' + hash); await page.waitForTimeout(3500);
  if (tab) { await page.locator('.main-content-inner button, .main-content-inner [role=tab]', { hasText: tab }).first().click().catch(() => {}); await page.waitForTimeout(1200); }
  if (process.env.FEW) {
    // Få kolumner: bocka ur allt utom två i Listinställningar, om de finns.
    const gear = page.locator('button[aria-label*=nställning], button[title*=nställning], .ls-trigger').first();
    if (await gear.isVisible().catch(() => false)) { await gear.click(); await page.waitForTimeout(500); const boxes = page.locator('.ls-pop input[type=checkbox]:checked, [role=dialog] input[type=checkbox]:checked'); const n = await boxes.count(); for (let i = n - 1; i >= 2; i--) await boxes.nth(i).uncheck().catch(() => {}); await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
  }
  const m = await page.evaluate(() => {
    const t = document.querySelector('.main-content-inner table');
    if (!t || getComputedStyle(t).display !== 'table') return { info: 'kort/ingen tabell' };
    const wrap = t.parentElement;
    const ths = [...(t.tHead?.rows?.[0]?.cells || [])].filter(c => getComputedStyle(c).display !== 'none');
    const cut = ths.filter(c => c.scrollWidth > c.clientWidth + 2).map(c => c.innerText.trim());
    // största luckan mellan text och nästa kolumns text i första raden
    const r = t.tBodies?.[0]?.rows?.[0];
    let gap = 0;
    if (r) {
      const spans = [...r.cells].filter(c => getComputedStyle(c).display !== 'none').map(c => { const rg = document.createRange(); rg.selectNodeContents(c); const b = rg.getBoundingClientRect(); return b.width ? b : null; });
      for (let i = 0; i < spans.length - 1; i++) if (spans[i] && spans[i + 1]) gap = Math.max(gap, Math.round(spans[i + 1].left - spans[i].right));
    }
    return { cols: ths.length, sx: t.scrollWidth > wrap.clientWidth + 2, cut, gap };
  });
  console.log(name.padEnd(13), JSON.stringify(m));
  await page.screenshot({ path: `test-results/al-${name}${tag}.png` });
}
console.log('fel:', errors.length ? errors : 'inga', consoleErrors.length ? consoleErrors : '');
await browser.close();
