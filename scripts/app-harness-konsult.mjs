// Kör: npx vite --port 5199, sedan node scripts/app-harness-konsult.mjs. Konsult inbjuden av fem kunder.
// Riktiga appen mot en fejkad Supabase (samma villkorade sparning som
// PostgREST: PATCH med updated_at=eq.X träffar bara om tiden stämmer).
// Prövar Bank (säkra matchningar + kända motparter) och att en ändring
// "från konsulten" på servern inte skrivs över av appens sparning.
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
const newTs = () => new Date(Date.UTC(2026, 9, 8, 12, 0, 0) + (++tick) * 1000).toISOString().replace('Z', '+00:00');
const server = { row: null, writes: 0, conflicts: 0 };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);

// Demodatan byggs i webbläsaren (Vite löser importerna).
const p0 = await ctx.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const seed = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  const { invoiceCustomerRemaining } = await import('/src/utils/rotRutConfig.js');
  const s = JSON.parse(JSON.stringify(createDemoSeed()));
  const open = s.invoices.filter(i => i.status !== 'paid' && i.status !== 'draft').map(i => ({ id: i.id, nr: i.invoiceNumber, left: invoiceCustomerRemaining(i) }));
  return { s, open };
});
await p0.close();
const company = seed.s;
// Ett belopp som bara EN obetald faktura har.
const counts = {};
seed.open.forEach(o => { counts[o.left] = (counts[o.left] || 0) + 1; });
const target = seed.open.find(o => counts[o.left] === 1 && o.left > 0);
const day = (n) => `2026-0${n}-15`;
company.bankTransactions = [
  { id: 'bt1', date: day(7), description: 'KORTKÖP TELIA SVERIGE AB', amount: -499, status: 'booked', bookedAccount: '6212' },
  { id: 'bt2', date: day(8), description: 'KORTKÖP TELIA SVERIGE AB', amount: -499, status: 'booked', bookedAccount: '6212' },
  { id: 'bt3', date: day(9), description: 'KORTKÖP TELIA SVERIGE AB', amount: -499, status: 'unmatched' },
  { id: 'bt4', date: day(9), description: 'Inbetalning kund', amount: target.left, status: 'unmatched' },
];
company.vatPeriods = [];
server.row = { id: 'r1', user_id: UID, state: { activeCompanyId: company.company.id, companies: { [company.company.id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name };


// Konsult: inget eget företag, inbjuden till fem.
server.row = null;
const MEMBERS = [1,2,3,4,5].map(n => ({ company_id: 'kund' + n, owner_user_id: 'owner' + n, role: 'editor' }));
const apiCalls = [];
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' && !/GL Driver|OTS/.test(m.text())) errors.push('console: ' + m.text().slice(0, 400)); });
await page.addInitScript(([key, val]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);

const reply = (route, data, wantsObject, extra = {}) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? data : (data == null ? [] : Array.isArray(data) ? data : [data])), ...extra });
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
      if (cond && cond !== `eq.${server.row.updated_at}`) { server.conflicts++; return reply(route, [], false); }
      Object.assign(server.row, body, { updated_at: newTs() }); server.writes++;
      return reply(route, { updated_at: server.row.updated_at }, wantsObject);
    }
    if (req.method() === 'POST') {
      server.row = Object.assign(server.row || {}, Array.isArray(body) ? body[0] : body, { updated_at: newTs() }); server.writes++;
      return reply(route, { updated_at: server.row.updated_at }, wantsObject);
    }
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  if (table === 'company_members' && url.searchParams.get('member_user_id')) return reply(route, MEMBERS, false);
  return reply(route, wantsObject ? null : [], wantsObject);
});

await page.route('**/api/**', r => r.fulfill({ json: {} }));
await page.route('**/api/company-access**', r => {
  const u = new URL(r.request().url()); apiCalls.push(u.search);
  if (u.searchParams.get('list')) return r.fulfill({ json: { companies: MEMBERS.map((m, i) => ({ company_id: m.company_id, owner_user_id: m.owner_user_id, company: { id: m.company_id, name: 'Kundföretag ' + (i + 1) + ' AB', orgNr: '55600000' + i + '0' }, role: 'editor', pageAccess: null, ownerPaid: true })) } });
  const id = u.searchParams.get('company_id');
  if (id) { const c = JSON.parse(JSON.stringify(company)); c.company = { ...c.company, id, name: 'Kundföretag ' + id.slice(4) + ' AB' }; return r.fulfill({ json: { company: c, role: 'editor', pageAccess: null, ownerPaid: true } }); }
  return r.fulfill({ json: { ok: true } });
});
const t0 = Date.now();
await page.goto(BASE + '/?app=1');
await page.waitForFunction(() => document.body.innerText.includes('Att göra'), null, { timeout: 20000 }).catch(async () => { await page.screenshot({ path: 'test-results/harness-konsult.png' }); console.log('TEXT:', (await page.evaluate(() => document.body.innerText)).slice(0, 300)); console.log('API', JSON.stringify(apiCalls), errors); process.exit(1); });
await page.waitForTimeout(2500);
console.log('Inloggad som konsult efter', ((Date.now() - t0) / 1000).toFixed(1), 's');
console.log('Anrop till company-access vid inloggning:', JSON.stringify(apiCalls));
await page.locator('.topbar-profile-trigger').first().click();
await page.waitForTimeout(800);
const menu = await page.evaluate(() => document.body.innerText.match(/Kundföretag d AB/g));
console.log('I menyn:', JSON.stringify(menu));
await page.screenshot({ path: 'test-results/harness-konsult-meny.png' });
const opt = page.getByText('Kundföretag 3 AB').first();
if (await opt.count()) { await opt.click(); await page.waitForTimeout(3000); }
console.log('Anrop efter byte:', JSON.stringify(apiCalls));
console.log('Visar:', (await page.evaluate(() => document.body.innerText.includes('Att göra'))) ? 'startsidan' : 'något annat');
await page.screenshot({ path: 'test-results/harness-konsult.png' });
if (errors.length) console.log('Sidfel:', errors);
await browser.close();
