// Kör: npx vite --port 5199, sedan node scripts/app-harness-plan.mjs <mapp>
// Inställningar → Prenumeration: plankortet och fakturalistan, med fejkad
// prenumeration och fejkade fakturor från servern.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:5199';
const OUT = process.argv[2] || 'test-results/plan';
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };
const subscription = { user_id: UID, status: 'active', plan: 'employer_monthly', trial_ends_at: null, current_period_end: '2026-11-28T10:00:00Z', cancel_at_period_end: false };
const invoices = [...Array(14).keys()].map(i => ({
  id: `in_${i}`, number: `BOKIX-${100 - i}`, created: Date.UTC(2026, 9 - i, 28) / 1000, status: i === 0 ? 'open' : 'paid',
  amount_due: 17900, amount_paid: i === 0 ? 0 : 17900, currency: 'sek', invoice_pdf: 'https://example.test/kvitto.pdf',
}));

// Två betalningar samma månad ska bli en rad.
invoices.push({ ...invoices[1], id: 'in_extra', number: 'BOKIX-EXTRA', created: invoices[1].created + 86400 });

const browser = await chromium.launch();
const first = await browser.newContext();
const p0 = await first.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await first.close();
const id = company.company.id;
const row = { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: '2026-10-10T12:00:00+00:00', onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name };
const problems = [];

async function run(name, viewport, theme) {
  const ctx = await browser.newContext({ viewport, colorScheme: theme });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: ${String(e).slice(0, 200)}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR|CORS|Content Security/.test(m.text())) problems.push(`${name}: konsol: ${m.text().slice(0, 220)}`); });
  await page.addInitScript(([key, val, mode]) => {
    sessionStorage.setItem(key, val);
    localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1');
    localStorage.setItem('bokix_theme', mode);
  }, [`sb-${REF}-auth-token`, JSON.stringify(session), theme]);
  const reply = (route, data, one) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(one ? data : (data == null ? [] : Array.isArray(data) ? data : [data])) });
  await page.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const one = (req.headers().accept || '').includes('vnd.pgrst.object');
    if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (url.pathname.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
    if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
    const table = url.pathname.replace('/rest/v1/', '');
    if (table === 'user_data') return reply(route, row, one);
    if (table === 'subscriptions') return reply(route, subscription, one);
    return reply(route, one ? null : [], one);
  });
  await page.route('**/api/**', r => r.fulfill({ json: r.request().url().includes('stripe') ? { invoices } : {} }));

  await page.goto(`${BASE}/?app=1`);
  await page.waitForSelector('.app-container', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const overlay = page.locator('.modal-overlay');
  if (await overlay.count()) {
    await overlay.first().getByRole('button').last().evaluate(el => el.click());
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => { history.pushState({}, '', '/?app=1&tab=settings'); });
  await page.getByText('Inställningar', { exact: true }).first().evaluate(el => el.click()).catch(() => {});
  await page.waitForTimeout(600);
  await page.getByText('Prenumeration', { exact: true }).first().evaluate(el => el.click());
  await page.waitForSelector('.plan-card', { timeout: 15000 });
  await page.waitForTimeout(700);
  const later = page.getByRole('button', { name: 'Fråga senare' });
  if (await later.count()) await later.first().evaluate(el => el.click());
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await page.locator('.plan-card').screenshot({ path: path.join(OUT, `${name}-kort.png`) });
  console.log(name, await page.locator('.plan-card-head').evaluate(el => getComputedStyle(el).backgroundColor));
  await page.getByRole('button', { name: 'Se fakturor & kvitton' }).evaluate(el => el.click());
  await page.waitForSelector('.plan-invoice');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${name}-fakturor.png`) });
  const rows = await page.locator('.plan-invoice-month').allInnerTexts();
  if (new Set(rows).size !== rows.length) problems.push(`${name}: samma månad två gånger`);
  console.log(name, 'två i samma månad:', await page.locator('.plan-invoice').filter({ hasText: '2 betalningar' }).locator('.plan-invoice-link').count(), 'kvitton');
  console.log(name, (await page.locator('.plan-card-head').innerText()).replace(/\s+/g, ' '), '| rader', await page.locator('.plan-invoice').count());
  await page.locator('.plan-invoice-more').evaluate(el => el.click());
  console.log(name, 'efter Visa alla', await page.locator('.plan-invoice').count());
  if (viewport.width < 700) { await page.screenshot({ path: path.join(OUT, `${name}-slut.png`) }); await ctx.close(); return; }
  await page.getByText('Säkerhet', { exact: true }).first().evaluate(el => el.click());
  await page.waitForTimeout(500);
  const logg = page.getByText('Händelselogg', { exact: true });
  if (!(await logg.count())) problems.push(`${name}: Händelselogg saknas i Säkerhet`);
  else await logg.first().evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${name}-sakerhet.png`) });
  await ctx.close();
}

await run('dator-ljus', { width: 1440, height: 900 }, 'light');
await run('dator-mork', { width: 1440, height: 900 }, 'dark');
await run('telefon', { width: 390, height: 844 }, 'light');
await browser.close();
console.log(problems.length ? `FEL:\n${problems.join('\n')}` : 'Inga fel');
