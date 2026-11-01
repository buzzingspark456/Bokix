// Kör: npm run dev (eller npx vite --port 5173), sedan node scripts/app-harness-fel.mjs
// Öppnar varje sida i den inloggade appen mot en fejkad Supabase (demots
// exempeldata, Stripe kopplat med tre transaktioner) och listar fel i
// konsolen, krascher och sidor som inte ritas. Bokför sedan Stripe-raderna
// från Granskning och kontrollerar att verifikationerna går jämnt ut.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.HARNESS_URL || 'http://localhost:5199';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };
const PAGES = ['dashboard', 'review', 'contacts', 'articles', 'quotes', 'invoices', 'expenses', 'supplier_invoices', 'bank', 'verifications', 'reports', 'taxes', 'projects', 'payroll', 'settings'];

const browser = await chromium.launch();
const p0 = await browser.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const { company, stripeRows } = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  const seed = JSON.parse(JSON.stringify(createDemoSeed()));
  return { company: seed, stripeRows: seed.stripeLedgerEvents || [] };
});
await p0.close();
const id = company.company.id;
company.company.stripeAccountId = 'acct_test';
const row = { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: '2026-10-10T12:00:00+00:00', onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name };
const ledger = stripeRows.map(r => ({ ...r, user_id: UID, company_id: id }));

const problems = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const page = await ctx.newPage();
let current = 'start';
page.on('console', m => { if (m.type() === 'error') problems.push(`[console] ${current}: ${m.text().slice(0, 200)}`); });
page.on('pageerror', e => problems.push(`[krasch] ${current}: ${e.message.slice(0, 200)}`));
await page.addInitScript(([key, val]) => {
  sessionStorage.setItem(key, val);
  localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1');
  localStorage.setItem('bokix_theme_pref', 'light');
}, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
const reply = (route, data, wantsObject) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? data : (data == null ? [] : Array.isArray(data) ? data : [data])) });
let savedState = null;
await page.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
  if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    try { const body = JSON.parse(req.postData() || '{}'); if (body.p_state || body.p_value) savedState = body; } catch { /* ingen kropp */ }
    return route.fulfill({ json: null });
  }
  const table = url.pathname.replace('/rest/v1/', '');
  if (table === 'user_data') {
    if (req.method() !== 'GET') { try { savedState = JSON.parse(req.postData() || '{}'); } catch { /* */ } }
    return reply(route, row, wantsObject);
  }
  if (table === 'subscriptions') return reply(route, { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }, wantsObject);
  if (table === 'stripe_ledger_events') {
    if (req.method() === 'GET' || req.method() === 'HEAD') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${ledger.length - 1}/${ledger.length}` }, body: JSON.stringify(ledger) });
    return reply(route, [], wantsObject);
  }
  return reply(route, wantsObject ? null : [], wantsObject);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));
await page.goto(BASE + '/?app=1');
await page.waitForSelector('.dash-top', { timeout: 25000 });

for (const tab of PAGES) {
  current = tab;
  await page.evaluate((t) => { window.location.hash = t; }, tab);
  await page.waitForTimeout(1200);
  const text = await page.evaluate(() => document.querySelector('main, .main-content, .app-container')?.innerText?.length || 0);
  if (text < 40) problems.push(`[tom sida] ${tab}`);
}

// Stripe i Granskning: tre rader, två säkra. Bokför alla säkra och sedan försäljningen.
current = 'review/stripe';
await page.evaluate(() => { window.location.hash = 'review'; });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /^Stripe/ }).first().click().catch(() => problems.push('[stripe] fliken saknas'));
await page.waitForTimeout(800);
const bulk = page.getByRole('button', { name: /Bokför alla säkra \(2\)/ });
if (!(await bulk.count())) problems.push('[stripe] Bokför alla säkra (2) saknas');
else {
  await bulk.click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^(OK|Ja|Bekräfta|Fortsätt)$/ }).first().click().catch(() => problems.push('[stripe] bekräftelsen gick inte att klicka'));
  await page.waitForTimeout(800);
}
const saleBtn = page.getByRole('button', { name: 'Bokför försäljning' });
if (!(await saleBtn.count())) problems.push('[stripe] Bokför försäljning saknas');
else { await saleBtn.click(); await page.waitForTimeout(800); }
const left = await page.locator('text=Inga Stripe-transaktioner väntar').count();
if (!left) problems.push('[stripe] raderna försvann inte efter bokföring');

// Verifikationerna som skapades ska gå jämnt ut och använda 1686.
await page.evaluate(() => { window.location.hash = 'verifications'; });
await page.waitForTimeout(2500);
const stripeVers = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(n => n.children.length === 0 && /Stripe-(avgift|utbetalning|försäljning)/.test(n.textContent)).length);
if (stripeVers < 3) problems.push(`[stripe] hittade ${stripeVers} Stripe-verifikationer i Bokföring, väntade 3`);

await browser.close();
console.log([...new Set(problems)].join('\n') || 'Inga fel');
