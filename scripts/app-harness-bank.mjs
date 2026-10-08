// Kör: npx vite --port 5199, sedan node scripts/app-harness-bank.mjs (ingen riktig databas används).
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
      Object.assign(server.row, Array.isArray(body) ? body[0] : body, { updated_at: newTs() }); server.writes++;
      return reply(route, { updated_at: server.row.updated_at }, wantsObject);
    }
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));

await page.goto(`${BASE}/?app=1#bank`);
await page.waitForTimeout(4000);
await page.evaluate(() => { window.location.hash = 'bank'; });
await page.waitForTimeout(2000);
const header = await page.locator('button').allInnerTexts();
const matchBtn = header.find(t => /Matcha \d+ säkra/.test(t));
const bookBtn = header.find(t => /Bokför \d+ kända/.test(t));
console.log('Knappar:', matchBtn, '|', bookBtn);
await page.screenshot({ path: 'test-results/harness-bank.png' });

// "Konsulten" lägger till en verifikation direkt på servern medan appen är öppen.
const cid = company.company.id;
server.row = { ...server.row, state: JSON.parse(JSON.stringify(server.row.state)), updated_at: newTs() };
server.row.state.companies[cid].verifications.push({ id: 'from_accountant', series: 'A', number: 999, date: day(9), description: 'Konsultens rättelse', rows: [{ account: '6570', debet: 10, kredit: 0 }, { account: '1930', debet: 0, kredit: 10 }] });

if (matchBtn) {
  await page.getByRole('button', { name: matchBtn }).click();
  await page.locator('.confirm-dialog-overlay .btn-primary').click();
}
await page.waitForTimeout(500);
const btn2 = (await page.locator('button').allInnerTexts()).find(t => /Bokför \d+ kända/.test(t));
if (btn2) {
  await page.getByRole('button', { name: btn2 }).click();
  await page.locator('.confirm-dialog-overlay .btn-primary').click();
}
await page.waitForTimeout(5000);

const s = server.row.state.companies[cid];
const bt = Object.fromEntries(s.bankTransactions.map(t => [t.id, t.status]));
const inv = s.invoices.find(i => i.id === target.id);
console.log('Bankrader på servern:', JSON.stringify(bt));
console.log('Fakturan betald på servern:', inv.status, inv.paidAmount);
console.log('Telia bokförd mot 6212:', s.verifications.some(v => v.sourceId === 'bt3' && v.rows.some(r => String(r.account) === '6212')));
console.log('Konsultens verifikation kvar:', s.verifications.some(v => v.id === 'from_accountant'));
console.log('Sparningar:', server.writes, 'krockar som slogs ihop:', server.conflicts);
await page.evaluate(() => { window.location.hash = 'verifications'; }); await page.waitForTimeout(2500);
const visible = await page.evaluate(() => document.body.innerText.includes('Konsultens rättelse'));
console.log('I appens lokala kopia:', await page.evaluate(() => (localStorage.getItem('bokix_data') || Object.keys(localStorage).map(k => localStorage.getItem(k)).join('')).includes('from_accountant')));
await page.screenshot({ path: 'test-results/harness-ver.png' });
console.log('(Konsultens verifikation syns i appen efter sammanslagning:', visible, '- bara om Bokföring-listan är öppen)');
if (errors.length) console.log('Sidfel:', errors);
await browser.close();
