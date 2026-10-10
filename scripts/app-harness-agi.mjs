// Kör: npx vite --port 5199, sedan node scripts/app-harness-agi.mjs
// AGI-månaden i detalj under Skatt och bokslut → Lön: huvuduppgift,
// individuppgifter, XML-fil, PDF och länk till Skatteverket. Årsöversikt i stället för KU.
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
// Giltiga personnummer (kontrollsiffran måste stämma för XML-filen).
const SSN = ['19900101-0017', '19121212-1212'];
company.employees = company.employees.map((e, i) => ({ ...e, ssn: SSN[i % SSN.length] }));
// En bokförd lönekörning för september och en AGI för samma månad.
company.payrollRuns = [{ id: 'run_sep', period: '2026-09', payDate: '2026-09-25', completedSteps: ['calculated', 'approved', 'paid', 'payslips', 'booked'], createdAt: '2026-09-20',
  rows: company.employees.map(e => ({ employeeId: e.id, period: '2026-09', hoursWorked: 0, additions: 0, absenceDeduction: 0, grossDeduction: 0, benefits: 0, netDeduction: 0, employeeSnapshot: { ...e }, feeRules: 2 })) }];
company.agiReports = [{ id: 'agi_sep', period: '2026-09', payrollRunId: 'run_sep', isZero: false, totals: { gross: 80500, tax: 17101, employerFee: 25293 }, status: 'draft', createdAt: '2026-10-01' }];
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
await page.goto(BASE + '/?app=1#taxes');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1000);
await page.locator('.list-page-header button', { hasText: 'Lön' }).first().click();
await page.waitForTimeout(800);
const steps = await page.evaluate(() => [...document.querySelectorAll('.tax-steps button')].map(b => b.innerText.trim()));
await page.getByRole('button', { name: 'Visa detaljer' }).first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: 'test-results/agi-detaljer.png', fullPage: true });
const text = await page.evaluate(() => document.body.innerText);
const hasMain = text.includes('Att betala till skattekontot') && text.includes('Lämnas och betalas senast');
const hasPeople = /Johanna Exempel[\s\S]*Oskar Test/.test(text);
const link = await page.evaluate(() => [...document.querySelectorAll('a')].find(a => a.innerText.includes('Lämna hos Skatteverket'))?.href);
let xmlName = null;
const xmlBtn = page.getByRole('button', { name: /AGI-fil \(XML\)/ });
if (await xmlBtn.count()) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), xmlBtn.click()]);
  xmlName = dl ? dl.suggestedFilename() : null;
  if (!xmlName) console.log('Efter XML-klick:', JSON.stringify(await page.evaluate(() => document.querySelector('[role="alert"]')?.innerText || 'ingen felruta')));
}
await page.locator('.tax-steps button', { hasText: 'Årsöversikt' }).click();
await page.waitForTimeout(800);
const yearText = await page.evaluate(() => document.body.innerText.includes('ingen kontrolluppgift behöver lämnas'));
await page.screenshot({ path: 'test-results/agi-arsoversikt.png' });
console.log('Steg under Lön:', JSON.stringify(steps));
console.log('Huvuduppgift:', hasMain, '| individuppgifter:', hasPeople, '| länk:', link, '| XML:', xmlName);
console.log('Årsöversikt förklarar att KU inte lämnas:', yearText);
const ok = JSON.stringify(steps) === JSON.stringify(['Arbetsgivardeklaration', 'Årsöversikt']) && hasMain && hasPeople && /lamnaarbetsgivardeklaration/.test(link || '') && yearText;
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
process.exit(ok ? 0 : 1);
