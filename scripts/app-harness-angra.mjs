// Kör: npx vite --port 5199, sedan node scripts/app-harness-angra.mjs
// Ångra i stället för "Är du säker?": en offert tas bort direkt och kommer
// tillbaka med Ångra; utan Ångra är den borta även efter att notisen
// försvunnit. Ett obokfört kvitto tas bort direkt, och bildfilen raderas
// först när ångra-tiden gått ut.
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
// Ett obokfört kvitto med en bildfil i lagringen.
company.expenses.push({ id: 'kv_test', type: 'receipt', supplier: 'Testkiosken', description: 'Testkiosken', date: '2026-10-09', amount: 99, status: 'draft', receiptUrl: `${SUPA}/storage/v1/object/public/receipts/${UID}/kv_test.jpg` });
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name }, storageDeletes: [] };
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
const toastText = () => page.evaluate(() => document.querySelector('.app-toast')?.innerText.replace(/\n+/g, ' | ') || null);
let ok = true;

await page.goto(BASE + '/?app=1#quotes');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1200);
const quotesBefore = saved().quotes.length;

// 1. Ta bort en offert, Ångra.
await page.locator('button[title="Ta bort"]').first().click();
await page.waitForTimeout(300);
const dialog = await page.evaluate(() => Boolean(document.querySelector('.modal-overlay')));
console.log('Frågade först:', dialog, '| notis:', JSON.stringify(await toastText()));
await waitFor(() => saved().quotes.length === quotesBefore - 1);
console.log('Offerter efter borttagning:', saved().quotes.length, '(före', quotesBefore + ')');
await page.locator('.app-toast button', { hasText: 'Ångra' }).click();
const restored = await waitFor(() => saved().quotes.length === quotesBefore);
console.log('Tillbaka efter Ångra:', restored);
ok = ok && !dialog && restored;

// 2. Ta bort, låt notisen gå ut: offerten ska vara borta på riktigt.
await page.locator('button[title="Ta bort"]').first().click();
await page.waitForTimeout(9000);
console.log('Notis kvar efter 9 s:', JSON.stringify(await toastText()), '| offerter:', saved().quotes.length);
ok = ok && saved().quotes.length === quotesBefore - 1 && !(await toastText());

// 3. Kvittot: bort direkt, bildfilen raderas först när tiden gått ut.
await page.evaluate(() => { window.location.hash = 'expenses'; });
await page.waitForTimeout(1500);
await page.getByText('Testkiosken').first().click();
await page.waitForTimeout(1200);
await page.locator('.rc-form-foot button', { hasText: 'Ta bort' }).click();
await waitFor(() => !saved().expenses.some(e => e.id === 'kv_test'));
const deletesRightAway = server.storageDeletes.length;
console.log('Kvitto borta:', !saved().expenses.some(e => e.id === 'kv_test'), '| filraderingar direkt:', deletesRightAway, '| notis:', JSON.stringify(await toastText()));
await page.waitForTimeout(9000);
console.log('Filraderingar efter ångra-tiden:', server.storageDeletes.length, JSON.stringify(server.storageDeletes.map(d => d.path)));
ok = ok && deletesRightAway === 0 && server.storageDeletes.length >= 1;

console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
process.exit(ok ? 0 : 1);
