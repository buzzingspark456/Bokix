// Kör: node scripts/app-harness-alla-sidor.mjs (BASE=, SEED_BASE=, WIDTH=390, DARK=1)
// Besöker varje sida och varje flik med demodata och listar krascher och konsolfel.
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

const where = { hash: '' };
const flush = (label) => {
  const out = [...errors.splice(0), ...consoleErrors.splice(0)];
  const crash = out.length ? out : null;
  return crash ? `${label}: ${crash.join(' | ')}` : null;
};
const problems = [];
const boundary = async () => (await page.locator('text=/Något gick fel|Something went wrong|Ett oväntat fel/').count()) > 0;

await page.goto(BASE + '/?app=1#dashboard');
await page.waitForTimeout(5000);
const pages = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-nav-id], .sidebar a[href^="#"], .sidebar button[data-id]')].map(e => e.dataset.navId || e.dataset.id || e.getAttribute('href')?.slice(1)).filter(Boolean))]);
const ids = pages.length ? pages : ['dashboard', 'review', 'contacts', 'quotes', 'orders', 'invoices', 'articles', 'projects', 'expenses', 'supplier_invoices', 'payroll', 'bank', 'verifications', 'accruals', 'reports', 'taxes', 'settings', 'company'];
console.log('sidor:', ids.join(', '));
for (const id of ids) {
  where.hash = id;
  await page.evaluate((h) => { window.location.hash = h; }, id);
  await page.waitForTimeout(1600);
  if (await boundary()) problems.push(`${id}: FELRUTA`);
  const p = flush(id); if (p) problems.push(p);
  // varje flik/segment på sidan
  const tabs = page.locator('.main-content-inner [role=tab], .main-content-inner .ut-nav-side button, .main-content-inner .lt-tabs button, .main-content-inner .chip-filter button');
  const n = Math.min(await tabs.count(), 12);
  const title = await page.locator('.main-content-inner h1, .main-content-inner h2').first().innerText().catch(() => '?');
  console.log(id, '→', (title || '').slice(0, 40), '| flikar', n);
  for (let i = 0; i < n; i++) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const name = ((await tab.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    await tab.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(700);
    if (await boundary()) problems.push(`${id} › ${name}: FELRUTA`);
    const q = flush(`${id} › ${name}`); if (q) problems.push(q);
  }
}
console.log(problems.length ? 'PROBLEM:\n' + problems.join('\n') : 'inga problem');
await browser.close();
