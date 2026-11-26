// Kör: npx vite --port 5173, sedan WIDTH=1440|1100|390 node scripts/app-harness-granskning.mjs
// Varje sida: knappar utanför skärmen eller sin ruta, klippt text, överlapp, JS- och konsolfel.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:5173';
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
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, ...(WIDTH < 600 ? { isMobile: true, hasTouch: true } : {}) });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const p0 = await ctx.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await p0.close();
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
const saved = () => server.row.state.companies[id];

const page = await ctx.newPage();
await page.addInitScript((d) => localStorage.setItem('bokix_theme_pref', d ? 'dark' : 'light'), Boolean(process.env.DARK));
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
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
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
const PAGES = (process.env.PAGES || 'dashboard,review,contacts,quotes,orders,invoices,articles,projects,expenses,supplier_invoices,payroll,bank,verifications,reports,taxes,settings').split(',');
await page.addInitScript((p) => localStorage.setItem('bokix.devPlan', p), process.env.PLAN || 'trade_monthly');
await page.goto(BASE + '/?app=1#dashboard');
await page.waitForTimeout(5000);
const audit = () => page.evaluate(() => {
  const vw = window.innerWidth;
  const out = [];
  const label = (e) => (e.getAttribute('aria-label') || e.textContent || e.className || e.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 40);
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  if (document.documentElement.scrollWidth > vw + 2) out.push(`sidan rullar i sidled (${document.documentElement.scrollWidth} > ${vw})`);
  const btns = [...document.querySelectorAll('.main-content-inner button, .main-content-inner a.btn, .main-content-inner [role=tab], .main-content-inner input, .main-content-inner select')].filter(visible);
  for (const b of btns) {
    const r = b.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) out.push(`utanför skärmen: "${label(b)}"`);
    // klippt av närmaste förälder med overflow hidden
    let p = b.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (/(hidden|clip)/.test(cs.overflowX) && p.scrollWidth <= p.clientWidth + 1) {
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 2 || r.left < pr.left - 2) { out.push(`klippt: "${label(b)}"`); }
        break;
      }
      if (/(auto|scroll)/.test(cs.overflowX)) break;
      p = p.parentElement;
    }
    if (b.tagName === 'BUTTON' && b.scrollWidth > b.clientWidth + 2 && getComputedStyle(b).textOverflow !== 'ellipsis' && b.clientWidth > 0) out.push(`text sticker ut ur knapp: "${label(b)}"`);
  }
  // överlappande knappar
  const small = btns.filter(b => b.tagName === 'BUTTON').map(b => [b, b.getBoundingClientRect()]);
  for (let i = 0; i < small.length; i++) for (let j = i + 1; j < small.length; j++) {
    const [a, ra] = small[i], [c, rc] = small[j];
    if (a.contains(c) || c.contains(a)) continue;
    const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
    if (ox > 6 && oy > 6) out.push(`överlappar: "${label(a)}" och "${label(c)}"`);
  }
  return [...new Set(out)].slice(0, 12);
});
for (const p of PAGES) {
  await page.evaluate((h) => { location.hash = h; }, p);
  await page.waitForTimeout(1800);
  if (process.env.NARROW) {
    const gear = page.locator('.ar-gear:visible').first();
    if (await gear.isVisible().catch(() => false)) {
      await gear.click(); await page.waitForTimeout(400);
      for (const l of ['Smal', 'Kompakt']) { const b = page.locator('.ar-set .ar-set-seg button', { hasText: new RegExp('^' + l + '$') }).first(); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(250); } }
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      if (await page.locator('.ar-set').isVisible().catch(() => false)) { await page.locator('.ar-set-overlay').click({ position: { x: 5, y: 5 } }).catch(() => {}); await page.waitForTimeout(300); }
    }
  }
  const issues = await audit();
  await page.screenshot({ path: `test-results/granskning-${p}-${WIDTH}${process.env.NARROW ? '-smal' : ''}.png` });
  console.log(p.padEnd(18), issues.length ? '\n   - ' + issues.join('\n   - ') : 'ok');
}
console.log('JS-fel:', errors.length ? errors : 'inga');
console.log('konsolfel:', consoleErrors.length ? [...new Set(consoleErrors)].slice(0, 8) : 'inga');
await browser.close();
