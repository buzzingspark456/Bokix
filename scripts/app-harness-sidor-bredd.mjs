// Kör: npx vite --port 5199, sedan node scripts/app-harness-sidor-bredd.mjs
// Alla sidor i en bredd (WIDTH), bild och mått på sidhuvud och filterrad.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
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
// Ett 2025-år så att årsväljaren syns.
const mkRun = (period, payDate, steps) => ({ id: 'run_' + period, period, payDate, completedSteps: steps, createdAt: '2026-01-01T00:00:00Z',
  rows: company.employees.map(e => ({ id: 'row_' + period + e.id, employeeId: e.id, period, employeeSnapshot: { ...e }, hoursWorked: 0, lines: [] })) });
company.payrollRuns = [mkRun('2025-12', '2025-12-23', ['calculated', 'approved', 'paid', 'booked', 'agi']), mkRun('2026-08', '2026-08-25', ['calculated', 'approved', 'paid', 'booked', 'agi']), mkRun('2026-09', '2026-09-25', ['calculated', 'approved', 'paid', 'booked'])];
company.agiReports = [{ id: 'agi1', period: '2026-08', status: 'submitted' }];
// MANY=12 ger tolv anställda (för att se hur stegen ser ut med många).
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
const saved = () => server.row.state.companies[id];

const page = await ctx.newPage();
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


// Går igenom sidorna och tar en bild av överdelen i vald bredd. Mäter också
// hur långt ner sidans första rad med innehåll (tabell/lista) börjar.
const PAGES = (process.env.PAGES || 'bank,verifications,invoices,expenses,supplier_invoices,contacts,quotes,articles,projects,payroll,reports,taxes,review,settings').split(',');
const out = [];
await page.goto(BASE + '/?app=1#dashboard');
await page.waitForSelector('.dash-todo-card, .dash-outstanding, .list-page-header', { timeout: 25000 });
await page.waitForTimeout(1500);
for (const p of PAGES) {
  await page.evaluate((h) => { location.hash = h; }, p);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `test-results/oversikt-${WIDTH}-${p}.png` });
  if (process.env.CLICK) {
    const more = page.locator('.lph-more:visible').first();
    if (await more.count()) { await more.click(); await page.waitForTimeout(500); await page.screenshot({ path: `test-results/oversikt-${WIDTH}-${p}-meny.png` }); out.push(p + ' meny-rader: ' + await page.locator('.lph-more-sheet button').count()); await page.mouse.click(5, 5); await page.waitForTimeout(400); out.push(p + ' meny stängd: ' + !(await page.locator('.lph-more-sheet').count())); }
    const fl = page.locator('.lfb-toggle:visible, .rc-tb-toggle:visible').first();
    if (await fl.count()) { await fl.click(); await page.waitForTimeout(500); await page.screenshot({ path: `test-results/oversikt-${WIDTH}-${p}-filter.png` }); await fl.click(); }
  }
  const m = await page.evaluate(() => {
    const first = document.querySelector('.list-table tbody tr, .mobile-list li, .ml-row, table tbody tr, .vat-error, .fp-strip');
    const head = document.querySelector('.list-page-header');
    const filter = document.querySelector('.lfb');
    const overflowX = document.scrollingElement.scrollWidth > window.innerWidth + 2;
    return {
      firstRowTop: first ? Math.round(first.getBoundingClientRect().top) : null,
      headH: head ? Math.round(head.getBoundingClientRect().height) : null,
      filterH: filter ? Math.round(filter.getBoundingClientRect().height) : null,
      overflowX,
    };
  });
  out.push(`${p}: ${JSON.stringify(m)}`);
}
console.log(out.join('\n'));
console.log(errors.length ? errors.slice(0, 5) : 'OK');
await browser.close();
