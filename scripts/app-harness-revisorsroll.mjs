// Kör: npx vite --port 5199, sedan node scripts/app-harness-revisorsroll.mjs
// Bjuder in med rollen "Revisor / redovisningskonsult" och kollar att
// inbjudan sparas som redigerare med alla sidor, även lön, på "edit".
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'agare@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
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
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name }, invites: [] };

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
  if (table === 'company_members' && req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '{}');
    const row = { ...(Array.isArray(body) ? body[0] : body), id: 'm1', invite_token: 'tok', status: 'pending' };
    server.invites.push(row);
    return reply(route, row, wantsObject);
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));

await page.goto(BASE + '/?app=1');
await page.waitForFunction(() => document.body.innerText.includes('Räkenskapsåret'), null, { timeout: 25000 });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, a, [role="button"], li, div')].reverse()
    .find(e => e.children.length <= 3 && e.innerText?.trim() === 'Inställningar');
  (el?.closest('button, a, [role="button"]') || el)?.click();
});
await page.waitForTimeout(800);
await page.getByText('Användare', { exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Bjud in användare/ }).first().click();
await page.waitForTimeout(400);
await page.locator('input[type="email"]').first().fill('revisor@example.se');
await page.locator('select').filter({ has: page.locator('option[value="accountant"]') }).first().selectOption('accountant');
await page.waitForTimeout(400);
await page.screenshot({ path: 'test-results/harness-revisorsroll.png', fullPage: true });
await page.getByRole('button', { name: /Skapa länk i stället/ }).click();
for (let i = 0; i < 20 && server.invites.length === 0; i++) await page.waitForTimeout(250);
const inv = server.invites[0];
console.log('Sparad inbjudan:', JSON.stringify({ role: inv?.role, page_access: inv?.page_access }));
const ok = inv?.role === 'editor' && inv?.page_access && Object.values(inv.page_access).every(v => v === 'edit') && inv.page_access.payroll === 'edit';
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
process.exit(ok ? 0 : 1);
