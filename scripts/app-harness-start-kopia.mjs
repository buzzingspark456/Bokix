// Kör: npx vite --port 5199, sedan node scripts/app-harness-start-kopia.mjs
// Start utan att hämta hela kontot (utils/serverStateCache.js): andra
// starten ska bara fråga efter updated_at och visa det som sparades, och
// en ändring från någon annan ska ändå hämtas.
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
const fetches = [];
await page.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
  if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
  if (url.pathname === '/rest/v1/rpc/apply_user_data_delta') {
    const { p_expected_updated_at, p_ops } = JSON.parse(req.postData() || '{}');
    if (p_expected_updated_at !== server.row.updated_at) return route.fulfill({ json: null });
    server.row.state = applyOps(server.row.state, p_ops);
    server.row.updated_at = newTs();
    return route.fulfill({ json: server.row.updated_at });
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
  const table = url.pathname.replace('/rest/v1/', '');
  if (table === 'user_data') {
    if (req.method() === 'GET' || req.method() === 'HEAD') {
      const select = url.searchParams.get('select') || '*';
      const cols = select.split(',');
      fetches.push(cols.includes('state') || select === '*' ? 'state' : 'meta');
      const row = select === '*' ? server.row : Object.fromEntries(cols.filter(c => c in server.row).map(c => [c, server.row[c]]));
      return reply(route, row, wantsObject);
    }
    const body = req.postDataJSON();
    Object.assign(server.row, Array.isArray(body) ? body[0] : body, { updated_at: newTs() });
    return reply(route, { updated_at: server.row.updated_at }, wantsObject);
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));

const pickers = () => page.locator('.rq-account-picker input').count();
const bookOne = async () => {
  const input = page.locator('.rq-account-picker input').first();
  await input.click(); await input.fill('5410'); await page.waitForTimeout(300); await input.press('Enter'); await page.waitForTimeout(300);
  await page.locator('.rq-account-picker button', { hasText: /Bokför med detta konto/ }).first().click();
  await page.waitForTimeout(6500); // sparning + kopian skrivs när webbläsaren är ledig
};
const open = async () => {
  fetches.length = 0;
  if (page.url().startsWith(BASE)) await page.reload(); else await page.goto(BASE + '/?app=1#review');
  await page.waitForSelector('.list-page-header', { timeout: 25000 });
  await page.waitForTimeout(3000);
  return [...fetches];
};

const first = await open();
const n0 = await pickers();
await bookOne();
const vers1 = saved().verifications.length;
const second = await open();
const n1 = await pickers();
// Någon annan (konsult, påminnelse-cronen) ändrar raden.
server.row.state = JSON.parse(JSON.stringify(server.row.state));
saved().company.name = 'Ändrat av någon annan AB';
server.row.updated_at = newTs();
const third = await open();
await page.waitForTimeout(2500);
const nameShown = await page.evaluate(() => Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes('Ändrat av någon annan AB')) ? 1 : 0);
await page.waitForTimeout(3000);
const vers2 = saved().verifications.length;

console.log('Första start:', first, '| andra:', second, '| efter ändring av annan:', third);
console.log('Att granska:', n0, '->', n1, '| verifikationer på servern:', vers1, '->', vers2, '| nytt namn syns:', nameShown > 0);
const ok = first.includes('state') && !second.includes('state') && third.includes('state')
  && n1 === n0 - 1 && vers2 === vers1 && nameShown > 0 && saved().company.name === 'Ändrat av någon annan AB' && errors.length === 0;
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
