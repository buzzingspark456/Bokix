// Kör: npx vite --port 5199, sedan ROLE=owner|revisor|viewer node scripts/app-harness-sie-delete-roller.mjs
// Riktiga appen mot en fejkad Supabase. Företaget har en SIE-import gjord
// FÖRE 2026-10-10 (bara sourceId, ingen sieImportTag). Prövar att den syns
// under Import och export och går att ta bort, för ägaren och för en
// inbjuden revisor (som sparar via /api/company-access). En läsare ska se
// listan men ingen Ta bort-knapp.
import { chromium } from '@playwright/test';
import fs from 'fs';

const ROLE = process.env.ROLE || 'owner';
const BASE = 'http://localhost:5199';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'revisor@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
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

// En import av "Akshay AB 2026.se" gjord före uppdateringen.
const TAG = 'sie_import_Akshay_AB_2026.se_2026-10-08';
const row = (account, debet, kredit) => ({ account, accountName: account, debet: String(debet), kredit: String(kredit) });
const oldImport = [
  { id: 'old_1', number: 'A901', series: 'A', date: '2026-01-01', description: 'Ingående balanser (SIE4-import)', source: 'sie_import', sieOpening: true, status: 'booked', sourceId: `${TAG}_A_3`, rows: [row('1930', 5000, 0), row('2081', 0, 5000)] },
  { id: 'old_2', number: 'A902', series: 'A', date: '2026-02-03', description: 'Gammal import ett', source: TAG, sieNumber: '1', status: 'booked', sourceId: `${TAG}_A_1`, rows: [row('1930', 1250, 0), row('3001', 0, 1000), row('2611', 0, 250)] },
  { id: 'old_3', number: 'A903', series: 'A', date: '2026-03-04', description: 'Gammal import två', source: TAG, sieNumber: '2', status: 'booked', sourceId: `${TAG}_A_2`, rows: [row('1930', 625, 0), row('3001', 0, 500), row('2611', 0, 125)] },
];
company.verifications = [...company.verifications, ...oldImport];
const before = company.verifications.length;

const COMPANY_ID = ROLE === 'owner' ? company.company.id : 'kund1';
if (ROLE !== 'owner') company.company = { ...company.company, id: COMPANY_ID, name: 'Akshay AB' };
const server = {
  row: ROLE === 'owner' ? { id: 'r1', user_id: UID, state: { activeCompanyId: COMPANY_ID, companies: { [COMPANY_ID]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } : null,
  shared: ROLE === 'owner' ? null : company,
  posts: [],
};
const memberRole = ROLE === 'viewer' ? 'viewer' : 'editor';
const MEMBERS = [{ company_id: COMPANY_ID, owner_user_id: 'owner1', role: memberRole }];
const savedVerifications = () => (ROLE === 'owner' ? server.row.state.companies[COMPANY_ID] : server.shared).verifications || [];
const oldLeft = () => savedVerifications().filter(v => v.id.startsWith('old_')).length;

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' && !/GL Driver|OTS/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
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
    if (req.method() === 'PATCH') {
      const cond = url.searchParams.get('updated_at');
      if (cond && server.row && cond !== `eq.${server.row.updated_at}`) return reply(route, [], false);
      Object.assign(server.row, body, { updated_at: newTs() });
      return reply(route, { updated_at: server.row.updated_at }, wantsObject);
    }
    if (req.method() === 'POST') {
      server.row = Object.assign(server.row || {}, Array.isArray(body) ? body[0] : body, { updated_at: newTs() });
      return reply(route, { updated_at: server.row.updated_at }, wantsObject);
    }
  }
  if (table === 'subscriptions') return reply(route, ROLE === 'owner' ? { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false } : null, wantsObject);
  if (table === 'company_members' && url.searchParams.get('member_user_id')) return reply(route, ROLE === 'owner' ? [] : MEMBERS, false);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));
await page.route('**/api/company-access**', async r => {
  const req = r.request();
  const u = new URL(req.url());
  if (ROLE === 'owner') return r.fulfill({ json: { companies: [] } });
  if (req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '{}');
    server.posts.push({ field: body.field, remove: body.patch?.remove?.length ?? null, upsert: body.patch?.upsert?.length ?? null });
    if (memberRole !== 'editor') return r.fulfill({ status: 403, json: { error: 'läsare' } });
    if (body.patch) {
      const removed = new Set(body.patch.remove.map(String));
      const changed = new Map(body.patch.upsert.map(x => [String(x.id), x]));
      const out = [];
      for (const x of server.shared[body.field] || []) { if (removed.has(String(x.id))) continue; if (changed.has(String(x.id))) { out.push(changed.get(String(x.id))); changed.delete(String(x.id)); } else out.push(x); }
      server.shared[body.field] = [...out, ...changed.values()];
    } else server.shared[body.field] = body.value;
    return r.fulfill({ json: { ok: true } });
  }
  // FAIL429=1: första hämtningen av företaget svarar 429 (för många anrop).
  if (process.env.FAIL429 && !u.searchParams.get('list') && req.method() === 'GET' && !server.failed429) { server.failed429 = true; return r.fulfill({ status: 429, json: { error: 'För många försök.' } }); }
  if (u.searchParams.get('list')) return r.fulfill({ json: { companies: [{ company_id: COMPANY_ID, owner_user_id: 'owner1', company: server.shared.company, role: memberRole, pageAccess: null, ownerPaid: true }] } });
  if (u.searchParams.get('company_id')) return r.fulfill({ json: { company: server.shared, role: memberRole, pageAccess: null, ownerPaid: true } });
  return r.fulfill({ json: { ok: true } });
});

const fail = async (msg) => {
  await page.screenshot({ path: `test-results/harness-sie-roller-${ROLE}-fel.png` });
  console.log('FEL:', msg, errors);
  await browser.close();
  process.exit(1);
};

await page.goto(BASE + '/?app=1');
await page.waitForFunction(() => document.body.innerText.includes('Räkenskapsåret'), null, { timeout: 25000 }).catch(() => fail('startsidan laddade inte'));
await page.waitForTimeout(1500);
console.log(`[${ROLE}] verifikationer på servern: ${before}, varav gammal import: ${oldLeft()}`);

await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, a, [role="button"], li, div')].reverse()
    .find(e => e.children.length <= 3 && e.innerText?.trim() === 'Inställningar');
  (el?.closest('button, a, [role="button"]') || el)?.click();
});
await page.waitForTimeout(800);
await page.getByText('Import och export', { exact: true }).first().click().catch(() => fail('hittar inte Import och export'));
await page.waitForTimeout(800);

const cardText = await page.evaluate(() => {
  const t = document.body.innerText;
  const i = t.toUpperCase().indexOf('IMPORTERADE SIE-FILER');
  return i < 0 ? null : t.slice(i, i + 120).replace(/\n+/g, ' | ');
});
console.log(`[${ROLE}] kortet:`, cardText);
await page.screenshot({ path: `test-results/harness-sie-roller-${ROLE}.png` });
if (!cardText) await fail('kortet syns inte');

const btn = page.getByRole('button', { name: 'Ta bort', exact: true });
const hasButton = await btn.count() > 0;
console.log(`[${ROLE}] Ta bort-knapp:`, hasButton);
if (ROLE === 'viewer') {
  console.log(hasButton ? 'FEL: läsaren ska inte ha knappen' : 'OK: läsaren ser listan utan knapp');
  await browser.close();
  process.exit(hasButton ? 1 : 0);
}
if (!hasButton) await fail('knappen saknas');

await btn.first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Ta bort', exact: true }).last().click();
for (let i = 0; i < 40 && oldLeft() > 0; i++) await page.waitForTimeout(250);
await page.waitForTimeout(800);
console.log(`[${ROLE}] efter borttagning på servern: ${savedVerifications().length} verifikationer, gammal import kvar: ${oldLeft()} (väntat ${before - 3} och 0)`);
if (ROLE !== 'owner') console.log(`[${ROLE}] anrop till company-access:`, JSON.stringify(server.posts));
console.log(`[${ROLE}] kortet borta:`, !(await page.evaluate(() => document.body.innerText.toUpperCase().includes('IMPORTERADE SIE-FILER'))));
if (errors.length) console.log('Sidfel:', errors);
await browser.close();
process.exit(oldLeft() === 0 && savedVerifications().length === before - 3 ? 0 : 1);
