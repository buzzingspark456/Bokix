// Kör: npx vite --port 5199, sedan node scripts/app-harness-startsida-manga.mjs
// Startsidan med många saker: N kundfakturor, N leverantörsfakturor och N kvitton (N=50).
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
{
  const N = Number(process.env.N || 50);
  const pad = (n) => String(n).padStart(2, '0');
  const inv = company.invoices.find(i => i.status === 'sent') || company.invoices[0];
  const names = ['Exempelbygg AB', 'Café Lunden', 'Nordljus Design', 'Bergs Måleri', 'Solsidan Fastigheter'];
  company.invoices = [...company.invoices, ...Array.from({ length: N }, (_, i) => ({ ...inv, id: 'inv_m' + i, invoiceNumber: String(2000 + i), status: 'sent', date: '2026-08-01', dueDate: `2026-${pad(8 + (i % 4))}-${pad(1 + (i % 27))}` }))];
  const sup = company.expenses.find(e => e.type === 'supplier_invoice');
  company.expenses = [...company.expenses,
    ...Array.from({ length: N }, (_, i) => ({ ...(sup || {}), id: 'sup_m' + i, type: 'supplier_invoice', status: 'unpaid', supplier: names[i % 5], description: 'Leverantör ' + i, amount: 1000 + i * 37, date: '2026-09-01', dueDate: `2026-${pad(9 + (i % 3))}-${pad(1 + (i % 27))}` })),
    ...Array.from({ length: N }, (_, i) => ({ id: 'rec_m' + i, type: 'receipt', description: 'Kvitto ' + i, amount: 100 + i, date: `2026-10-0${1 + (i % 9)}`, status: 'pending', account: '' })),
  ];
}
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


const tag = '-' + WIDTH;
if (process.env.DBG) { await page.goto(BASE + '/?app=1#dashboard'); await page.waitForSelector('.dash-outstanding', { timeout: 25000 }); await page.waitForTimeout(2500); console.log(await page.evaluate(() => { const b = document.querySelector('.dash-body'); const t = b.querySelector('.dash-todo-card'); const o = b.querySelector('.dash-outstanding'); const l = o.querySelector('.dash-out-list'); const slot = document.querySelector('.recharts-responsive-container, .recharts-wrapper'); const svgs = [...document.querySelectorAll('.dash-chart-card svg.recharts-surface')].map(x => { const r = x.getBoundingClientRect(); return [x.getAttribute('height'), Math.round(r.top), Math.round(r.height)]; }); const grid = document.querySelector('.dash-chart-card .recharts-cartesian-grid'); const gr = grid && grid.getBoundingClientRect(); return JSON.stringify({ svgs, grid: gr && [Math.round(gr.top), Math.round(gr.height)], body: b.offsetHeight, todo: t && t.offsetHeight, out: o.offsetHeight, list: l && l.offsetHeight, chart: slot && slot.offsetHeight, chartCard: document.querySelector('.dash-chart-card').offsetHeight }); })); process.exit(0); }
await page.goto(BASE + '/?app=1#dashboard');
await page.waitForSelector('.dash-todo-card, .dash-outstanding', { timeout: 25000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `test-results/manga${tag}.png` });
console.log('grid', await page.evaluate(() => { const g = document.querySelector('.dash-chart-card .recharts-cartesian-grid'); return g ? Math.round(g.getBoundingClientRect().height) : null; }));
await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible' && e.querySelector('.dash-outstanding')); if (el) el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(600);
await page.screenshot({ path: `test-results/manga-botten${tag}.png` });
const outMore = page.locator('.dash-out-more:visible');
if (await outMore.count()) { await outMore.first().click(); await page.waitForTimeout(600); await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible' && e.querySelector('.dash-outstanding')); if (el) el.scrollTop = el.scrollHeight; }); await page.waitForTimeout(500); await page.screenshot({ path: `test-results/manga-utestaende-oppen${tag}.png` }); }
const more = page.locator('.dash-todo-more').first();
if (await more.count() && await more.isVisible()) { await more.click(); await page.waitForTimeout(800); await page.screenshot({ path: `test-results/manga-alla${tag}.png`, fullPage: true }); }
const info = await page.evaluate(() => ({
  todoRows: document.querySelectorAll('.dash-todo-card li').length,
  outRowsVisible: [...document.querySelectorAll('.dash-out-list li')].filter(li => li.offsetParent).length,
  outRowsTotal: document.querySelectorAll('.dash-out-list li').length,
  pageHeight: document.scrollingElement.scrollHeight,
}));
console.log(WIDTH, JSON.stringify(info), errors.length ? errors : 'OK');
await browser.close();
