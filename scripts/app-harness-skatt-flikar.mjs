// Kör: npx vite --port 5199, sedan node scripts/app-harness-skatt-flikar.mjs
// Skatt och bokslut: fyra flikar (Översikt, Moms, Lön, Årsavslut) och bara
// de steg under Årsavslut som gäller för bolagsformen.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
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

const CASES = [
  { name: 'Aktiebolag', orgNr: '556677-8899', payroll: true, tabs: ['Översikt', 'Moms', 'Lön', 'Årsavslut'], steps: ['1. Årsbokslut', '2. Årsredovisning', '3. Inkomstdeklaration', '4. Utdelning'] },
  { name: 'Enskild firma', orgNr: '850315-1234', payroll: false, tabs: ['Översikt', 'Moms', 'Årsavslut'], steps: ['1. Årsbokslut', '2. NE-bilaga'] },
  { name: 'Handelsbolag', orgNr: '969712-3456', payroll: false, tabs: ['Översikt', 'Moms', 'Årsavslut'], steps: ['1. Årsbokslut', '2. Delägare'] },
  { name: 'Ekonomisk förening', orgNr: '769612-3456', payroll: false, tabs: ['Översikt', 'Moms', 'Årsavslut'], steps: ['1. Årsbokslut', '2. Inkomstdeklaration'] },
  { name: 'Ideell förening', orgNr: '802412-3456', payroll: false, tabs: ['Översikt', 'Moms', 'Årsavslut'], steps: [] },
];

const browser = await chromium.launch();
let failed = false;
for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  const p0 = await ctx.newPage();
  await p0.goto(`${BASE}/scripts/ocr-harness.html`);
  const company = await p0.evaluate(async () => {
    const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
    return JSON.parse(JSON.stringify(createDemoSeed()));
  });
  await p0.close();
  company.company.orgNr = c.orgNr;
  company.company.vatRegistered = true;
  if (!c.payroll) { company.employees = []; company.payrollRuns = []; }
  else if (!company.employees?.length) company.employees = [{ id: 'e1', firstName: 'Anna', lastName: 'A', taxTable: { tabellnr: '33', kolumn: 1 } }];
  const id = company.company.id;
  const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
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
  await page.goto(BASE + '/?app=1#taxes');
  await page.waitForSelector('.list-page-header', { timeout: 25000 });
  await page.waitForTimeout(1200);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.list-page-header [aria-current], .list-page-header button')].map(b => b.innerText.trim()).filter(t => ['Översikt', 'Moms', 'Lön', 'Årsavslut'].includes(t)));
  await page.locator('.list-page-header button', { hasText: 'Årsavslut' }).first().click();
  await page.waitForTimeout(800);
  const steps = await page.evaluate(() => [...document.querySelectorAll('.tax-steps button')].map(b => b.innerText.trim()));
  const checklist = await page.evaluate(() => document.body.innerText.includes('Gör årets sista lönekörning'));
  await page.screenshot({ path: `test-results/skatt-${c.name.replace(/\s+/g, '-').toLowerCase()}.png` });
  const ok = checklist === c.payroll && JSON.stringify(tabs) === JSON.stringify(c.tabs) && JSON.stringify(steps) === JSON.stringify(c.steps) && errors.length === 0;
  console.log(`[${c.name}] flikar ${JSON.stringify(tabs)} | Årsavslut ${JSON.stringify(steps)} | lönesteg i bokslutet: ${checklist} ${ok ? 'OK' : 'FEL'}`, errors.length ? errors : '');
  if (!ok) failed = true;
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
