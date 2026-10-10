// Kör: npx vite --port 5199, sedan node scripts/app-harness-kom-igang.mjs
// Ett helt nytt företag ska få "Kom igång"-rader i Att göra. Raden om moms
// ska öppna Inställningar → Allmänt och försvinna när momsen valts.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'ny@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };
let tick = 0;
const newTs = () => new Date(Date.UTC(2026, 9, 10, 12, 0, 0) + (++tick) * 1000).toISOString().replace('Z', '+00:00');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const p0 = await ctx.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await p0.close();
// Helt nytt: inga kunder, fakturor, kvitton eller verifikationer.
for (const k of ['contacts', 'invoices', 'expenses', 'verifications', 'quotes', 'articles', 'projects', 'timeEntries', 'billableTimeEntries', 'payrollRuns', 'employees', 'bankTransactions']) company[k] = [];
company.company = { id: company.company.id, name: 'Nytt AB', fiscalYear: '2026-01-01', vatPeriod: 'quarterly', vatRegistered: null };
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: 'Nytt AB' } };

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

await page.goto(BASE + '/?app=1');
await page.waitForSelector('.dash-top', { timeout: 25000 });
await page.waitForTimeout(1500);
const todoText = () => page.evaluate(() => document.querySelector('.dash-todo-card')?.innerText.replace(/\n+/g, ' | ') || null);
const before = await todoText();
console.log('Att göra:', JSON.stringify(before));
await page.screenshot({ path: 'test-results/harness-kom-igang.png' });
const hasAll = before && ['Fyll i företagsuppgifterna', 'Välj om företaget har moms', 'Lägg in ditt första kvitto', 'Skicka din första faktura'].every(s => before.includes(s));

await page.getByText('Välj om företaget har moms').first().click();
await page.waitForTimeout(1200);
const onSystem = await page.evaluate(() => document.body.innerText.includes('Momsregistrerat'));
console.log('Momsraden öppnade Allmänt:', onSystem);
if (!onSystem) console.log('  sidan:', JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 300)), 'hash:', await page.evaluate(() => location.hash));
await page.locator('select[aria-label="Momsregistrerat"]').selectOption('yes');
for (let i = 0; i < 40 && server.row.state.companies[id].company.vatRegistered !== true; i++) await page.waitForTimeout(250);
console.log('Sparat vatRegistered:', server.row.state.companies[id].company.vatRegistered);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, a, [role="button"], li, div')].reverse()
    .find(e => e.children.length <= 3 && e.innerText?.trim() === 'Start');
  (el?.closest('button, a, [role="button"]') || el)?.click();
});
await page.waitForSelector('.dash-top', { timeout: 10000 });
await page.waitForTimeout(800);
const after = await todoText();
console.log('Att göra efter:', JSON.stringify(after));
const ok = hasAll && onSystem && after && !after.includes('Välj om företaget har moms') && after.includes('Lägg in ditt första kvitto');
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
process.exit(ok ? 0 : 1);
