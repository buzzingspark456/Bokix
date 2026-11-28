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
// (Ovan: samma inloggning som app-harness-plan.mjs.)
// Kvittoavläsningens planspärr (2026-11-28): servern svarar plan_quota →
// meddelande om att fylla i själv eller köpa fler; Köp 100 till syns under
// Prenumeration → Användning först då, och ett köp höjer gränsen.
const browser = await chromium.launch();
const p0 = await (await browser.newContext()).newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => { const { createDemoSeed } = await import('/src/utils/landingDemoData.js'); return JSON.parse(JSON.stringify(createDemoSeed())); });
const id = company.company.id;
const row = { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: '2026-10-10T12:00:00+00:00', onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name };
const sub = { user_id: UID, company_id: '', status: 'active', plan: 'solo_monthly', created_at: '2026-12-01T00:00:00Z', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false };
const problems = [];
let extra = 0; const calls = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const page = await ctx.newPage();
page.on('pageerror', e => problems.push(String(e).slice(0, 200)));
await page.addInitScript(([key, val]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
const reply = (route, data, one) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(one ? data : (data == null ? [] : Array.isArray(data) ? data : [data])) });
await page.route(`${SUPA}/**`, async (route) => {
  const req = route.request(); const url = new URL(req.url()); const one = (req.headers().accept || '').includes('vnd.pgrst.object');
  if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: url.pathname.includes('token') ? session : {} });
  if (url.pathname.startsWith('/storage/') || url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
  const table = url.pathname.replace('/rest/v1/', '');
  if (table === 'user_data') return reply(route, row, one);
  if (table === 'subscriptions') return reply(route, sub, one);
  return reply(route, one ? null : [], one);
});
await page.route('**/api/**', async (r) => {
  const body = JSON.parse(r.request().postData() || '{}'); calls.push(body.action || r.request().url().split('/api/')[1]);
  if (body.action === 'ocr-usage') return r.fulfill({ json: { plan: 'solo', planName: 'Solo', limit: 100, extra, price: 25, reads: 100 } });
  if (body.action === 'ocr-topup') { extra += 100; return r.fulfill({ json: { ok: true, limit: 100, extra } }); }
  return r.fulfill({ json: {} });
});
await page.goto(`${BASE}/?app=1`);
await page.waitForSelector('.app-container', { timeout: 30000 });
await page.waitForTimeout(1500);
const openUsage = async () => {
  await page.getByText('Inställningar', { exact: true }).first().evaluate(el => el.click());
  await page.waitForTimeout(500);
  await page.getByText('Prenumeration', { exact: true }).first().evaluate(el => el.click());
  await page.waitForTimeout(600);
  await page.getByRole('tab', { name: 'Användning' }).first().evaluate(el => el.click());
  await page.waitForTimeout(1200);
};
await openUsage();
const before = await page.locator('.ocr-topup').count();
// Servern säger att gränsen är nådd (samma som ocrCloud.js gör vid plan_quota).
await page.evaluate((cid) => {
  localStorage.setItem(`bokix.ocrQuota.${cid}`, new Date().toISOString().slice(0, 7));
  window.dispatchEvent(new CustomEvent('bokix:ocr-plan-quota', { detail: { limit: 100, plan: 'solo', message: 'Månadens 100 kvittoavläsningar i Solo är använda.' } }));
}, id);
await page.waitForTimeout(700);
const toast = await page.evaluate(() => document.body.innerText.match(/Månadens 100 kvittoavläsningar[^\n]*/)?.[0] || '');
await page.getByRole('tab', { name: 'Betalning' }).first().evaluate(el => el.click()); await page.waitForTimeout(300);
await page.getByRole('tab', { name: 'Användning' }).first().evaluate(el => el.click()); await page.waitForTimeout(1200);
const after = await page.locator('.ocr-topup').count();
const textBefore = after ? (await page.locator('.ocr-topup').innerText()).replace(/\s+/g, ' ') : '';
page.once('dialog', d => d.accept());
if (after) { await page.locator('.ocr-topup-btn').click(); await page.waitForTimeout(800); }
const textAfter = after ? (await page.locator('.ocr-topup').innerText()).replace(/\s+/g, ' ') : '';
await page.screenshot({ path: 'test-results/kvittokvot.png' });
console.log(JSON.stringify({ rutaFore: before, meddelande: toast, rutaEfter: after, fore: textBefore.slice(0, 160), efterKop: textAfter.slice(0, 200), anrop: calls.filter(c => /ocr/.test(c)), problems }, null, 1));
await browser.close();
