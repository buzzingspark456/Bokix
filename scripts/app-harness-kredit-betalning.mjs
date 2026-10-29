// Kör: npx vite --port 5199, sedan node scripts/app-harness-kredit-betalning.mjs
// Kreditfaktura reglerar originalet (Krediterad i listan, borta från Hem) och
// rutan Registrera betalning visar datum och kvar att betala.
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
const id = company.company.id;
const cust = company.contacts.find(c => c.type === 'customer')?.id;
const row = (price) => [{ id: 'r' + price, description: 'Konsult', qty: 1, unitPrice: price, vatRate: 25, discount: 0, account: '3001' }];
company.invoices = company.invoices.filter(i => i.type === 'quote');
company.invoices.push(
  { id: 'inv_orig', invoiceNumber: '9001', customerId: cust, date: '2026-10-01', dueDate: '2026-10-31', status: 'sent', type: 'invoice', rows: row(1000) },
  { id: 'inv_kred', invoiceNumber: '9002', customerId: cust, date: '2026-10-20', dueDate: '2026-10-31', status: 'sent', type: 'invoice', creditFor: '9001', rows: row(-1000) },
  { id: 'inv_del', invoiceNumber: '9003', customerId: cust, date: '2026-09-15', dueDate: '2026-10-15', status: 'sent', type: 'invoice', rows: row(4000), paidAmount: 2000 },
);
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name }, storageDeletes: [] };
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
const THEME = process.env.THEME || 'dark';
await page.addInitScript(([key, val, th]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); localStorage.setItem('bokix_theme_pref', th); }, [`sb-${REF}-auth-token`, JSON.stringify(session), THEME]);
const reply = (route, data, wantsObject) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? data : (data == null ? [] : Array.isArray(data) ? data : [data])) });
await page.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
  if (url.pathname.startsWith('/storage/')) {
    if (req.method() === 'DELETE' || (req.method() === 'POST' && /remove|object\/[^/]+$/.test(url.pathname))) server.storageDeletes.push({ method: req.method(), path: url.pathname, body: req.postData() });
    return route.fulfill({ json: [] });
  }
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
const waitFor = async (pred, ms = 10000) => { for (let i = 0; i < ms / 250 && !pred(); i++) await page.waitForTimeout(250); return pred(); };
const flat = (s) => (s || '').split('\n').filter(Boolean).join(' | ');
const out = process.env.OUT || '.';
await page.goto(BASE + '/?app=1#invoices');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1500);
const txt = await page.evaluate(() => document.body.innerText);
console.log('Krediterad i listan:', (txt.match(/Krediterad/g) || []).length);
await page.getByRole('button', { name: 'Fråga senare' }).click().catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: out + '/kb-lista-' + THEME + '.png' });
await page.getByText('9003', { exact: true }).first().click();
await page.waitForTimeout(1000);
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /Registrera betalning/ }).first().click();
await page.waitForTimeout(800);
await page.locator('.modal-content').last().screenshot({ path: out + '/kb-betalning-' + THEME + '.png' });
console.log('Modal:', flat(await page.locator('.modal-content').last().innerText()));
await page.goto(BASE + '/?app=1#dashboard');
await page.waitForTimeout(2500);
await page.screenshot({ path: out + '/kb-hem-' + THEME + '.png' });
console.log('Hem:', flat(await page.evaluate(() => document.querySelector('.dash-outstanding')?.innerText || 'ingen utestående-ruta')));
console.log('Fel:', errors);
await browser.close();
