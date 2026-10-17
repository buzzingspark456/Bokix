// Kör: npx vite --port 5199, sedan node scripts/app-harness-delta-sparning.mjs
// Sparning av bara ändringarna (apply_user_data_delta): den fejkade databasen
// kör samma regler som SQL-funktionen. Ett kvitto bokförs i Granskning, och
// sparningen ska vara några kB, inte hela kontot, och ge exakt samma innehåll.
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
const writes = [];
await page.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
  if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
  if (url.pathname === '/rest/v1/rpc/apply_user_data_delta') {
    const body = req.postData() || '';
    const { p_expected_updated_at, p_ops } = JSON.parse(body);
    writes.push({ kind: 'delta', bytes: body.length, ops: p_ops.length, paths: p_ops.map(o => o.op + ':' + o.path.join('.') + ':' + JSON.stringify(o.value ?? o.upsert ?? null).length) });
    if (p_expected_updated_at !== server.row.updated_at) return route.fulfill({ json: null });
    server.row.state = applyOps(server.row.state, p_ops);
    server.row.updated_at = newTs();
    return route.fulfill({ json: server.row.updated_at });
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
  const table = url.pathname.replace('/rest/v1/', '');
  if (table === 'user_data') {
    if (req.method() === 'GET' || req.method() === 'HEAD') return reply(route, server.row, wantsObject);
    const body = req.postDataJSON();
    writes.push({ kind: 'full', bytes: (req.postData() || '').length });
    Object.assign(server.row, Array.isArray(body) ? body[0] : body, { updated_at: newTs() });
    return reply(route, { updated_at: server.row.updated_at }, wantsObject);
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));

await page.goto(BASE + '/?app=1#review');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(3500); // första sparningen efter inloggningen
const afterLoad = writes.length;
const pendingBefore = saved().expenses.filter(e => !e.costAccount).length;
const versBefore = (saved().verifications || []).length;
const input = page.locator('.rq-account-picker input').first();
await input.click(); await input.fill('5410'); await page.waitForTimeout(300); await input.press('Enter'); await page.waitForTimeout(300);
await page.locator('.rq-account-picker button', { hasText: /Bokför med detta konto/ }).first().click();
await page.waitForTimeout(4500);
const ours = writes.slice(afterLoad);
console.log('Sparningar efter inloggningen:', JSON.stringify(writes.slice(0, afterLoad)));
console.log('Sparningar efter bokföringen:', JSON.stringify(ours));
const pendingAfter = saved().expenses.filter(e => !e.costAccount).length;
const versAfter = (saved().verifications || []).length;
console.log('Kvitton utan konto på servern:', pendingBefore, '->', pendingAfter, '| verifikationer:', versBefore, '->', versAfter);
// Servern ska ha exakt det appen har: ladda om och jämför med en ny hämtning.
const fullSize = JSON.stringify(server.row.state).length;
const ok = ours.length > 0 && ours.every(w => w.kind === 'delta') && ours.every(w => w.bytes < 20000)
  && pendingAfter === pendingBefore - 1 && versAfter === versBefore + 1 && errors.length === 0;
console.log(`Hela kontot är ${Math.round(fullSize / 1024)} kB, sparningen ${ours.map(w => w.bytes).join(' + ')} byte`);
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
