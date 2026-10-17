// Kör: npx vite --port 5199, sedan node scripts/app-harness-lonekorning.mjs
// Hela lönekörningen i steg: ny körning, Lön och timmar, Granska, Betala,
// Lönebesked, Bokför, AGI och Klart. Skärmbild per steg i test-results/lon-*.png.
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
company.payrollRuns = [];
// MANY=12 ger tolv anställda (för att se hur stegen ser ut med många).
if (process.env.MANY) {
  const first = ['Anna', 'Bo', 'Cecilia', 'David', 'Elin', 'Fredrik', 'Greta', 'Hugo', 'Ida', 'Jonas', 'Klara', 'Leo', 'Maja', 'Nils'];
  const base = company.employees[0];
  company.employees = Array.from({ length: Number(process.env.MANY) }, (_, i) => ({ ...base, id: 'emp_' + i, firstName: first[i % first.length], lastName: 'Exempel' + (i + 1), email: i % 3 === 0 ? '' : 'p' + i + '@exempel.se', monthlySalary: 30000 + i * 1500 }));
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

const tag = (WIDTH < 600 ? '-telefon' : '') + (process.env.MANY ? '-manga' : '');
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `test-results/lon-${name}${tag}.png` }); };
const heading = async () => { await page.waitForSelector('.payroll-stage-head h2', { timeout: 8000 }).catch(() => {}); return page.evaluate(() => document.querySelector('.payroll-stage-head h2')?.innerText || null); };
const click = async (re) => { await page.getByRole('button', { name: re }).first().click(); await page.waitForTimeout(800); };

await page.goto(BASE + '/?app=1#payroll');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1000);
await page.getByText('Lönekörningar', { exact: true }).first().click();
await page.waitForTimeout(600);
await click(/Ny lönekörning/);
await shot('0-ny');
await click(/Skapa lönekörning/);
const seen = [];
for (let i = 0; i < 8; i++) {
  const h = await heading();
  seen.push(h);
  await shot(`${i + 1}-${(h || 'okant').toLowerCase().replace(/[^a-zåäö]+/g, '-')}`);
  if (h === 'Lön och timmar') await click(/Beräkna lönerna/);
  else if (h === 'Granska') await click(/Godkänn lönerna/);
  else if (h === 'Betala') await click(/^Markera som betald$/);
  else if (h === 'Lönebesked') await click(/Klart, vidare till bokföring/);
  else if (h === 'Bokför') await click(/Bokför lönen/);
  else if (h === 'AGI och skatt') { await page.locator('input[type="checkbox"]').last().check(); await page.waitForTimeout(800); }
  else break;
}
for (let i = 0; i < 40 && !(saved().payrollRuns?.[0]?.completedSteps || []).includes('agi'); i++) await page.waitForTimeout(250);
const run = saved().payrollRuns?.[0];
const salaryVers = (saved().verifications || []).filter(v => /Lön /.test(v.description || '') && v.source === 'payroll' || v.sourceId === run?.id).length;
console.log('Stegen som visades:', JSON.stringify(seen));
console.log('Sparade steg:', JSON.stringify(run?.completedSteps), '| lönebokningar:', salaryVers);
const ok = seen.at(-1) === 'Klart' && ['calculated', 'approved', 'paid', 'payslips', 'booked', 'agi'].every(s => run?.completedSteps?.includes(s));
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
process.exit(ok ? 0 : 1);
