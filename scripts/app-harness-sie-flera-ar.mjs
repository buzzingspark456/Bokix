// Kör: npx vite --port 5199, sedan node scripts/app-harness-sie-flera-ar.mjs <2024.se> <2025.se>
// Flytt i ett steg: två SIE-filer på en gång (i omvänd ordning), förhandsgranskas
// per år, importeras äldst först, och båda åren stängs i sista steget.
// Kollar på servern: inga dubbla ingående balanser, två bokslutsverifikationer,
// båda åren låsta och att 1930/2099 stämmer med filernas saldon.
import { chromium } from '@playwright/test';
import fs from 'fs';

const [FILE_A, FILE_B] = process.argv.slice(2);
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
// Ett företag som just flyttar hit: inga egna verifikationer, AB, kalenderår.
company.verifications = [];
company.company = { ...company.company, orgNr: '556677-8899', fiscalYear: '2026-01-01', lockedFiscalYears: {} };
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
const saved = () => server.row.state.companies[id];

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
    Object.assign(server.row, Array.isArray(body) ? body[0] : body, { updated_at: newTs() });
    return reply(route, { updated_at: server.row.updated_at }, wantsObject);
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));
const fail = async (msg) => {
  await page.screenshot({ path: 'test-results/harness-sie-flera-ar-fel.png' });
  console.log('FEL:', msg, errors);
  await browser.close();
  process.exit(1);
};

await page.goto(BASE + '/?app=1');
await page.waitForFunction(() => document.body.innerText.includes('Att göra'), null, { timeout: 25000 }).catch(() => fail('startsidan laddade inte'));
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, a, [role="button"], li, div')].reverse()
    .find(e => e.children.length <= 3 && e.innerText?.trim() === 'Inställningar');
  (el?.closest('button, a, [role="button"]') || el)?.click();
});
await page.waitForTimeout(800);
await page.getByText('Import och export', { exact: true }).first().click();
await page.waitForTimeout(600);
await page.getByText('Flytta hit bokföringen').first().click();
await page.getByText('Jag har filen, fortsätt').click();
// Nyaste filen först, för att se att Bokix sorterar.
await page.setInputFiles('#sie-import-file', [FILE_B, FILE_A]);
await page.getByRole('button', { name: 'Förhandsgranska' }).click().catch(() => fail('kom inte till förhandsgranskning'));
await page.waitForTimeout(600);
const intro = await page.evaluate(() => (document.querySelector('.modal-content')?.innerText || '').slice(0, 900));
console.log('Förhandsgranskningen:', JSON.stringify(intro.replace(/\n+/g, ' | ').slice(0, 500)));
await page.screenshot({ path: 'test-results/harness-sie-flera-ar-forhand.png', fullPage: true });
const importBtn = page.getByRole('button', { name: /^Importera \d+ verifikationer/ });
if (!(await importBtn.isEnabled())) await fail('importknappen är avstängd');
await importBtn.click();
await page.waitForTimeout(800);
const step4 = await page.evaluate(() => (document.querySelector('.modal-content')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 600));
console.log('Sista steget:', JSON.stringify(step4));
await page.screenshot({ path: 'test-results/harness-sie-flera-ar-stang.png' });
for (let i = 0; i < 40 && (saved().verifications || []).length === 0; i++) await page.waitForTimeout(250);
const afterImport = saved().verifications;
console.log('Efter import:', afterImport.map(v => `${v.number} ${v.date} ${v.description}`).join(' / '));

const closeBtn = page.getByRole('button', { name: /^Stäng / });
if (!(await closeBtn.count())) await fail('inget erbjudande om att stänga åren');
await closeBtn.click();
for (let i = 0; i < 40 && !Object.keys(saved().company.lockedFiscalYears || {}).length; i++) await page.waitForTimeout(250);
await page.waitForTimeout(1200);

const vs = saved().verifications;
const net = (acc) => Math.round(vs.reduce((s, v) => s + (v.rows || []).filter(r => r.account === acc).reduce((t, r) => t + (Number(r.debet) || 0) - (Number(r.kredit) || 0), 0), 0) * 100) / 100;
console.log('Låsta år:', JSON.stringify(Object.keys(saved().company.lockedFiscalYears || {})));
console.log('Bokslutsverifikationer:', vs.filter(v => v.source === 'year_end_close').map(v => `${v.number} ${v.date}`).join(', '));
console.log('Ingående balanser kvar:', vs.filter(v => v.sieOpening).map(v => `${v.date}: ${(v.rows || []).map(r => r.account + ' ' + r.debet + '/' + r.kredit).join(', ')}`).join(' ; '));
console.log('Saldo 1930:', net('1930'), '(väntat 34375) | 2099:', net('2099'), '(väntat -7500) | 3001:', net('3001'), '(väntat 0)');
const ok = net('1930') === 34375 && net('2099') === -7500 && net('3001') === 0 && Object.keys(saved().company.lockedFiscalYears).length === 2;
console.log(ok ? 'OK' : 'FEL');
if (errors.length) console.log('Sidfel:', errors);
await browser.close();
process.exit(ok ? 0 : 1);
