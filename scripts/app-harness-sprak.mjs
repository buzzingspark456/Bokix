// Kör: npx vite --port 5199, sedan node scripts/app-harness-sprak.mjs
// Skärmbilder av Bokföring och en ny leverantörsfaktura, för att se orden.
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
// Exakt en förfallen kundfaktura, så att raden öppnar just den.
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const overdue = company.invoices.find(i => i.status === 'sent');
company.invoices.forEach(i => { if (i.status === 'sent' && i !== overdue) i.dueDate = iso(new Date(today.getTime() + 20 * 86400000)); });
overdue.dueDate = iso(new Date(today.getTime() - 5 * 86400000));
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

const shot = async (hash, file, after) => {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForTimeout(1500);
  if (after) await after();
  await page.screenshot({ path: `test-results/${file}.png` });
  return page.evaluate(() => document.body.innerText);
};
await page.goto(BASE + '/?app=1');
await page.waitForSelector('.dash-top', { timeout: 25000 });
const bok = await shot('verifications', 'sprak-bokforing');
console.log('Bokföring:', JSON.stringify(bok.match(/Bokningar[^\n]*|Ny bokning|Verifikation[^\n]*/g)));
const lev = await shot('supplier_invoices', 'sprak-leverantor', async () => {
  await page.getByRole('button', { name: /Ny leverantörsfaktura/ }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
});
console.log('Leverantörsfaktura:', JSON.stringify(lev.match(/Konton[^\n]*|Kontering[^\n]*|omvänd[^\n]*/gi)));
const kv = await shot('expenses', 'sprak-kvitto', async () => {
  await page.locator('.list-table-row, tr').filter({ hasText: /kr/ }).nth(1).click().catch(() => {});
  await page.waitForTimeout(1200);
});
console.log('Kvitto:', JSON.stringify(kv.split('\n').filter(l => /underlag|Kvitto eller fil|Läs av|kontering/i.test(l))));
console.log(errors.length ? errors : 'inga sidfel');
await browser.close();
