// Kör: npx vite --port 5199, sedan node scripts/app-harness-ink4.mjs
// Handelsbolag: fliken Inkomstdeklaration 4, stegen och SRU-filen med INK4DU per delägare.
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
company.company.orgNr = "969600-0001";
company.company.postalCode = company.company.postalCode || "12345";
company.company.city = company.company.city || "Stockholm";
company.company.partners = [{ id: "p1", name: "Anna Andersson", personnummer: "19800101-1234", sharePct: 50 }, { id: "p2", name: "Bo Berg", personnummer: "19850202-5678", sharePct: 50 }];
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
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `test-results/ink4-${name}${tag}.png`, fullPage: false }); };

await page.goto(BASE + '/?app=1#taxes');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1500);
await page.locator('text="Årsavslut" >> visible=true').first().click();
await page.waitForTimeout(1000);
const tab = page.locator('button:visible, [role=tab]:visible', { hasText: 'Inkomstdeklaration 4' }).first();
const hasTab = await tab.count() > 0;
if (hasTab) { await tab.click(); await page.waitForTimeout(1200); }
await page.locator('.stepflow-rail li', { hasText: 'Räkenskapsschema' }).first().click().catch(() => {});
await page.waitForTimeout(600);
await shot('schema');
const schema = await page.evaluate(() => document.body.innerText);
await page.locator('.stepflow-rail li', { hasText: 'Skattemässiga' }).first().click().catch(() => {});
await page.waitForTimeout(500);
await page.locator('.ink4-q').nth(0).locator('button', { hasText: 'Nej' }).click();
await page.locator('.ink4-q').nth(1).locator('button', { hasText: 'Nej' }).click();
await shot('justeringar');
await page.locator('.stepflow-rail li', { hasText: 'Delägare' }).first().click().catch(() => {});
await page.waitForTimeout(500);
await shot('delagare');
const du = await page.evaluate(() => document.body.innerText);
await page.locator('.stepflow-rail li', { hasText: 'Ladda ner' }).first().click().catch(() => {});
await page.waitForTimeout(500);
await shot('skicka');
let sru = '';
try {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.locator('.fp-actions button.primary').click()]);
  const buf = fs.readFileSync(await dl.path());
  sru = buf.toString('latin1');
} catch (e) { console.log('nedladdning:', String(e).slice(0, 160)); }
const checks = { flik: hasTab, schema: /Räkenskapsschema/.test(schema) && /Ingående kapital|Kassa, bank/.test(schema), delagare: /Anna Andersson/.test(du) && /Bo Berg/.test(du), ink4r: sru.includes("#BLANKETT INK4R-"), ink4du: (sru.match(/INK4DU-/g) || []).length === 2, pnr: /8100 198001011234/.test(sru) };
console.log(JSON.stringify(checks), errors.length ? errors : '');
await browser.close();
process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
