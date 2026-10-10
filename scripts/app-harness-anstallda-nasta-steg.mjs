// Kör: npx vite --port 5199, sedan node scripts/app-harness-anstallda-nasta-steg.mjs <anstallda.csv>
// Efter en import av anställda ska Anställda visa nästa steg (hämta
// skattetabeller), säga hur många som saknar tabell, och knappen ska öppna
// Skatteverket-rutan.
import { chromium } from '@playwright/test';
import fs from 'fs';

const CSV = process.argv[2];
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
company.employees = [];
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

await page.goto(BASE + '/?app=1#payroll');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1200);
await page.locator('.list-page-header button', { hasText: 'Importera' }).first().click();
await page.waitForTimeout(400);
await page.setInputFiles('.modal-content input[type="file"]', CSV);
await page.waitForTimeout(600);
await page.locator('.modal-content button', { hasText: /^\s*Importera \d+/ }).click();
await page.waitForTimeout(1000);
const box = await page.evaluate(() => document.querySelector('[role="status"]')?.innerText.replace(/\n+/g, ' | ') || null);
console.log('Nästa steg:', JSON.stringify(box));
await page.screenshot({ path: 'test-results/harness-anstallda-nasta-steg.png' });
await page.locator('[role="status"] button', { hasText: 'Hämta skattetabeller' }).click();
await page.waitForTimeout(600);
const fos = await page.evaluate(() => document.querySelector('.modal-content')?.innerText.includes('Skattetabell från Skatteverket'));
console.log('Skatteverket-rutan öppnades:', fos);
for (let i = 0; i < 40 && !(server.row.state.companies[id].employees || []).length; i++) await page.waitForTimeout(250);
const saved = server.row.state.companies[id].employees || [];
console.log('Sparade anställda:', saved.map(e => `${e.firstName} tabell ${e.taxTable?.tabellnr || '–'}`).join(', '));
const ok = box && box.includes('2 anställda importerade') && fos && saved.length === 2;
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
process.exit(ok ? 0 : 1);
