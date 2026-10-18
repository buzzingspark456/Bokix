// Kör: npx vite --port 5199, sedan node scripts/app-harness-ne-sida2.mjs
// NE-bilagans sida 2 för en enskild firma: fliken visar R12–R47, R43 som
// förslag (25 %), och en avsättning över 30 % av R33 ger en varning.
//
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
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
const saved = () => server.row.state.companies[id];

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.addInitScript(([key, val]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
const reply = (route, data, wantsObject) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? data : (data == null ? [] : Array.isArray(data) ? data : [data])) });
// Samma regler som apply_user_data_delta (supabase-2026-10-17-delta-sparning.sql).
const { applyRecordPatch } = await import('../src/utils/stateMerge.js');
const applyOps = (state, ops) => {
  const out = JSON.parse(JSON.stringify(state));
  for (const op of ops) {
    const parent = op.path.length > 1 ? op.path.slice(0, -1).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), out) : out;
    if (!parent || typeof parent !== 'object' || Array.isArray(parent)) throw new Error('missing parent');
    const key = op.path.at(-1);
    if (op.op === 'set') parent[key] = op.value;
    else if (op.op === 'unset') delete parent[key];
    else if (op.op === 'patch' || op.op === 'patch_by') parent[key] = applyRecordPatch(parent[key], op, op.op === 'patch_by' ? op.key : 'id');
  }
  return out;
};
saved().company.orgNr = '850315-1234';
saved().company.vatRegistered = true;
await page.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
  if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
  if (url.pathname === '/rest/v1/rpc/apply_user_data_delta') {
    const { p_ops } = JSON.parse(req.postData() || '{}');
    server.row.state = applyOps(server.row.state, p_ops);
    server.row.updated_at = newTs();
    return route.fulfill({ json: server.row.updated_at });
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
  const table = url.pathname.replace('/rest/v1/', '');
  if (table === 'user_data') {
    if (req.method() === 'GET' || req.method() === 'HEAD') return reply(route, server.row, wantsObject);
    const body = req.postDataJSON();
    Object.assign(server.row, Array.isArray(body) ? body[0] : body, { updated_at: newTs() });
    return reply(route, { updated_at: server.row.updated_at }, wantsObject);
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));

await page.goto(BASE + '/?app=1#taxes');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1500);
await page.getByText('Årsavslut', { exact: true }).first().click();
await page.waitForTimeout(800);
await page.locator('button', { hasText: 'NE-bilaga' }).first().click({ force: true });
await page.waitForTimeout(1200);
const heading = await page.getByText('Sida 2: skattemässiga justeringar').count();
const rowText = async (r) => (await page.locator(`text=${r}`).first().locator('xpath=..').innerText().catch(() => '')).replace(/\s+/g, ' ');
const r42 = await rowText('R42'); const r43 = await rowText('R43');
await page.screenshot({ path: process.env.SHOT || 'ne-sida2.png', fullPage: true });
const r34input = page.locator('div', { has: page.locator('span', { hasText: /^R34$/ }) }).last().locator('input');
await r34input.fill('99999999'); await page.waitForTimeout(500);
const warn = await page.getByText(/Högst .* kr \(30 % av R33\)/).count();
await r34input.fill('10000'); await page.waitForTimeout(300);
// SRU-filen: ett NE-block med personnummer och avsättningen på 7709.
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Ladda ner SRU-fil/ }).click()]);
const zipBuf = fs.readFileSync(await dl.path());
const sruText = zipBuf.toString('latin1');
const sruOk = /#BLANKETT NE-20\d\dP4/.test(sruText) && /#IDENTITET 198503151234 /.test(sruText) && /#UPPGIFT 7709 10000/.test(sruText) && /#UPPGIFT 7714 \d+/.test(sruText);
console.log('SRU:', dl.suggestedFilename(), sruOk, (sruText.match(/#UPPGIFT 7[0-9]{3} -?\d+/g) || []).join(' '));
await r34input.fill('99999999'); await page.waitForTimeout(300);
await page.screenshot({ path: process.env.SHOT || 'ne-sida2.png', fullPage: true });
await page.waitForTimeout(7000);
const storedTax = saved().company.ne ? Object.values(saved().company.ne).map(y => y.tax).filter(Boolean) : [];
console.log({ heading, warn, storedTax: JSON.stringify(storedTax) });
console.log(heading > 0 && warn > 0 && sruOk && storedTax.some(t => t.r34 === '99999999') && errors.length === 0 ? 'OK' : 'FEL', errors);
await browser.close();
