// Kör: npx vite --port 5173, sedan node scripts/app-harness-sidbredd.mjs
// Smal/Bred och Kompakt/Normal på varje listsida: bredd och radhöjd före och efter.
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
const tag = "-" + WIDTH + (process.env.DARK ? "-dark" : "");
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `test-results/mejl-${name}${tag}.png`, fullPage: false }); };
await page.route('**/api/**', r => r.fulfill({ json: {} }));
const PAGES = (process.env.PAGES || 'quotes,orders,invoices,contacts,articles,expenses,supplier_invoices,verifications,bank,projects,review,payroll').split(',');
await page.goto(BASE + '/?app=1#dashboard');
await page.waitForTimeout(5000);
const measure = () => page.evaluate(() => {
  const main = document.querySelector('.main-content') || document.body;
  const narrowEl = main.querySelector('.lt-page-narrow');
  const cand = [...main.querySelectorAll('table, .ar-table-wrap, .lt-list, .so-listbody, .ut-table-wrap, .rq-list, .lg-rows')].filter(e => e.offsetParent && e.getBoundingClientRect().width > 200);
  const box = cand[0];
  const row = box ? (box.querySelector('tbody tr:not(.lt-group-row)') || box.querySelector('[class*="row"]:not([class*="head"])')) : null;
  return { narrowClass: Boolean(narrowEl), width: box ? Math.round(box.getBoundingClientRect().width) : null, rowH: row ? Math.round(row.getBoundingClientRect().height) : null, what: box ? (box.className || box.tagName).toString().slice(0, 40) : 'ingen lista' };
});
const clickSeg = async (label) => {
  const b = page.locator('.ar-set .ar-set-seg button', { hasText: new RegExp('^' + label + '$') }).first();
  if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(400); return true; }
  return false;
};
for (const p of PAGES) {
  await page.evaluate((h) => { location.hash = h; }, p);
  await page.waitForTimeout(1800);
  const gear = page.locator('.ar-gear:visible').first();
  if (!(await gear.isVisible().catch(() => false))) { console.log(p.padEnd(18), 'inget kugghjul'); continue; }
  await gear.click(); await page.waitForTimeout(500);
  const hasW = await clickSeg('Bred'); const hasD = await clickSeg('Normal');
  await page.keyboard.press('Escape'); await page.mouse.click(5, 5).catch(() => {}); await page.waitForTimeout(400);
  const before = await measure();
  await page.locator('.ar-gear:visible').first().click(); await page.waitForTimeout(500);
  await clickSeg('Smal'); await clickSeg('Kompakt');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  if (await page.locator('.ar-set').isVisible().catch(() => false)) { await page.locator('.ar-set-overlay').click({ position: { x: 5, y: 5 } }).catch(() => {}); await page.waitForTimeout(300); }
  const after = await measure();
  await page.screenshot({ path: `test-results/bredd-${p}.png` });
  console.log(p.padEnd(18), `knappar: bredd ${hasW ? 'ja' : 'nej'}, täthet ${hasD ? 'ja' : 'nej'} | Bred ${before.width}px rad ${before.rowH} -> Smal ${after.width}px rad ${after.rowH} (smal-klass ${after.narrowClass}) [${after.what}]`);
}
console.log('fel:', errors.length ? errors : 'inga');
await browser.close();
