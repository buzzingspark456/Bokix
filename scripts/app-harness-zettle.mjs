// Kör: npx vite --port 5199, sedan node scripts/app-harness-zettle.mjs
// Zettle i Granskning: kortköp på 1686, kontant på 1910, öresbelopp och
// Zettles moms, dagens avgifter 6570/1686 och utbetalningen 1930/1686.
// "Bokför alla säkra" mot en fejkad databas, konteringen läses ur det sparade.
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
company.company.zettleAccessToken = 'x';
const id = company.company.id;
const zettleRows = [
  { id: 'z1', kind: 'purchase', amount: 449.5, vat_amount: 89.9, currency: 'SEK', is_refund: false, payment_type: 'IZETTLE_CARD', purchase_number: 1, created_at_zettle: '2026-10-14T10:00:00Z', reviewed_at: null },
  { id: 'z2', kind: 'purchase', amount: 120, vat_amount: 12.86, currency: 'SEK', is_refund: false, payment_type: 'CASH', purchase_number: 2, created_at_zettle: '2026-10-14T11:00:00Z', reviewed_at: null },
  { id: 'z3', kind: 'fee', amount: 12.4, vat_amount: 0, currency: 'SEK', is_refund: false, payment_type: null, created_at_zettle: '2026-10-14T12:00:00Z', reviewed_at: null },
  { id: 'z4', kind: 'payout', amount: 437.1, vat_amount: 0, currency: 'SEK', is_refund: false, payment_type: null, created_at_zettle: '2026-10-15T06:00:00Z', reviewed_at: null },
];
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
  if (table === 'zettle_ledger_events') return reply(route, req.method() === 'GET' ? zettleRows : [], wantsObject);
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));

await page.goto(BASE + '/?app=1#review');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(2500);
await page.locator('button, [role=tab]').filter({ hasText: /^Zettle/ }).first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Bokför alla säkra/ }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/zettle-harness.png' });
await page.locator('.modal-content button').filter({ hasText: /Bekräfta/ }).last().click();
await page.waitForTimeout(4500);
const vers = (saved().verifications || []).filter(v => v.source === 'zettle_ledger');
for (const v of vers) console.log(v.description, '|', v.rows.map(r => r.account + ' ' + (r.debet ? 'D ' + r.debet : 'K ' + r.kredit)).join(', '));
const by = (re) => vers.find(v => re.test(v.description));
const rowsOf = (v) => Object.fromEntries((v?.rows || []).map(r => [r.account, r.debet || -r.kredit]));
const kort = rowsOf(vers.find(v => v.description.endsWith('kvitto 1')));
const kontant = rowsOf(vers.find(v => v.description.endsWith('kvitto 2')));
const avg = rowsOf(by(/avgifter/)); const ut = rowsOf(by(/utbetalning/i));
const ok = kort['1686'] === 449.5 && kort['2611'] === -89.9 && kort['3001'] === -359.6
  && kontant['1910'] === 120 && kontant['2621'] === -12.86 && kontant['3002'] === -107.14
  && avg['6570'] === 12.4 && avg['1686'] === -12.4 && ut['1930'] === 437.1 && ut['1686'] === -437.1 && errors.length === 0;
console.log(JSON.stringify({ kort, kontant, avg, ut, errors }));
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
