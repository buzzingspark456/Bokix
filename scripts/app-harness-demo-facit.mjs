// Kör: npx vite --port 5199, sedan OUT=mapp node scripts/app-harness-demo-facit.mjs
// Bilder av de riktiga vyerna som marknadssidornas demos ska likna.
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
// Ett "gammalt" företag: före BAS 2026-uppgraderingen.
delete company.basVersion;
company.accounts = company.accounts.filter(a => !['2850', '2610'].includes(a.code)).map(a => a.code === '2611' ? { ...a, name: 'Utgående moms, 25%' } : a);
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

const tag = '-' + WIDTH;
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `test-results/kontoplan-${name}${tag}.png`, fullPage: false }); };


const OUT = process.env.OUT || 'test-results';
const go = async (hash, name, after) => {
  await page.goto(BASE + '/?app=1#' + hash);
  await page.waitForSelector('.app-container', { timeout: 25000 });
  await page.waitForTimeout(1600);
  if (after) { try { await after(); } catch (e) { console.log(name, 'steg:', String(e).slice(0, 90)); } await page.waitForTimeout(900); }
  await page.screenshot({ path: OUT + '/' + name + '.png' });
  console.log('ok', name);
};
const click = (txt) => page.locator('text=' + JSON.stringify(txt) + ' >> visible=true').first().click();
await go('expenses', 'kvitton');
await go('expenses', 'kvitto-detalj', () => page.locator('tbody tr').first().click());
await go('verifications', 'bokforing', () => page.locator('tr', { hasText: 'A034' }).first().click());
await go('review', 'granskning');
await go('invoices', 'kundfakturor');
await go('invoices', 'ny-faktura', () => click('Skapa faktura'));
await go('taxes', 'skatt-moms', () => click('Moms'));
await go('taxes', 'skatt-arsavslut', () => click('Årsavslut'));
await go('payroll', 'lon');
await go('bank', 'bank');
await go('settings/security', 'inst-sakerhet');
await go('settings/users', 'inst-anvandare');
await go('settings/advanced', 'inst-avancerat');
await go('verifications', 'kontoplan', () => click('Kontoplan'));
await go('payroll', 'lonekorningar', () => click('Lönekörningar'));
await go('payroll', 'lonekorning-oppen', async () => { await click('Lönekörningar'); await page.waitForTimeout(800); await page.locator('tbody tr').first().click(); });
await go('expenses', 'kvitto-oppet', () => page.locator('text="Exempelmacken" >> visible=true').first().click());
await go('bank', 'bank-import', () => page.locator('button', { hasText: /Importera|Läs in/ }).first().click());
await go('invoices', 'skicka-faktura', async () => { await page.locator('tbody tr').nth(1).click(); });
await go('payroll', 'lonekorning-steg', async () => { await click('Lönekörningar'); await page.waitForTimeout(800); await page.locator('tbody tr').first().click(); await page.waitForTimeout(600); await click('Skapa lönekörning'); });
console.log(errors.length ? errors : 'inga fel');
await browser.close();
