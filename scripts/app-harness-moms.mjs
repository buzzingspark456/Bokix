// Kör: npx vite --port 5199, sedan node scripts/app-harness-moms.mjs
// Moms-fliken för kvartal, månad och helår (VATP=monthly|yearly).
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
if (process.env.VATP) company.company.vatPeriod = process.env.VATP;
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


const tag = (WIDTH < 600 ? '-telefon' : '') + '-' + (process.env.VATP || 'quarterly');
await page.goto(BASE + '/?app=1#taxes');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1200);
await page.locator('.list-page-header button >> visible=true', { hasText: 'Moms' }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `test-results/moms${tag}.png` });
const title = await page.evaluate(() => document.querySelector('.fp-strip-title')?.innerText || null);
const sub = await page.evaluate(() => document.querySelector('.fp-strip-sub')?.innerText || null);
const options = await page.evaluate(() => [...document.querySelectorAll('.fp-strip select option')].slice(0, 4).map(o => o.textContent));
const errorsShown = await page.evaluate(() => [...document.querySelectorAll('.vat-error')].map(e => e.innerText.replace(/\s+/g, ' ')).slice(0, 2));
console.log(process.env.VATP || 'quarterly', '|', title, '|', sub, '|', JSON.stringify(options), '|', JSON.stringify(errorsShown));
const ok = Boolean(title) && !errors.length;
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
process.exit(ok ? 0 : 1);
