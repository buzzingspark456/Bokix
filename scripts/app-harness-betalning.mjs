// Kör: npx vite --port 5173, sedan MODE=failed|action|read|locked node scripts/app-harness-betalning.mjs
// Misslyckad betalning: banner, Försök igen, läsläge (inget sparas) och lås.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:5173';
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
await page.addInitScript((d) => localStorage.setItem('bokix_theme_pref', d ? 'dark' : 'light'), Boolean(process.env.DARK));
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) Promise.all(m.args().map(a => a.jsonValue().catch(() => '?'))).then(v => errors.push('KONSOL ' + JSON.stringify(v).slice(0, 700))); });
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
const MODE = process.env.MODE || 'failed'; // failed | action | read | locked
const DAYS = { failed: 2, action: 1, read: 20, locked: 35 }[MODE];
const SUB = { user_id: UID, company_id: '', status: MODE === 'read' || MODE === 'locked' ? 'unpaid' : 'past_due', plan: 'employer_monthly', created_at: '2026-09-01T00:00:00Z', trial_ends_at: null, current_period_end: '2026-12-20T00:00:00Z', cancel_at_period_end: false, payment_failed_at: new Date(Date.now() - DAYS * 86400000).toISOString() };
let retried = 0;
await page.route('**/api/**', async (r) => {
  const url = r.request().url();
  let body = {};
  try { body = JSON.parse(r.request().postData() || '{}'); } catch { /* */ }
  if (url.includes('create-subscription-checkout') && body.action === 'payment-issue') {
    return r.fulfill({ json: { status: SUB.status, card: { brand: 'visa', last4: '4242', expMonth: 11, expYear: 2026 }, issue: { amount: 179, currency: 'sek', attempts: 2, nextAttempt: new Date(Date.now() + 2 * 86400000).toISOString(), requiresAction: MODE === 'action', declineReason: MODE === 'action' ? 'Banken vill att du bekräftar betalningen.' : 'Kortet saknar täckning.', hostedUrl: 'https://invoice.stripe.com/test' } } });
  }
  if (url.includes('create-subscription-checkout') && body.action === 'billing-invoices') { const d = (m) => Math.floor(new Date(2026, 10 - m, 26).getTime() / 1000); return r.fulfill({ json: { invoices: [0, 1, 2, 3].map(m => ({ id: 'in_' + m, number: 'BOKIX-000' + (4 - m), created: d(m), paid_at: m ? d(m) + 60 : null, status: m ? 'paid' : 'open', amount_due: 17900, amount_paid: m ? 17900 : 0, currency: 'sek', invoice_pdf: 'https://pay.stripe.com/x.pdf', hosted_invoice_url: 'https://invoice.stripe.com/x', period_start: d(m), period_end: d(m - 1), lines: [{ description: '1 × Bokix — Med personal (månadsvis)', amount: 17900 }] })) } }); }
  if (url.includes('create-subscription-checkout') && body.action === 'card-info') return r.fulfill({ json: { card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 }, status: SUB.status } });
  if (url.includes('create-subscription-checkout') && body.action === 'retry-payment') {
    retried += 1;
    return r.fulfill({ json: retried === 1 ? { ok: false, reason: 'Kortet saknar täckning.' } : { ok: true, status: 'active' } });
  }
  return r.fulfill({ json: {} });
});
// prenumerationsraden som appen läser
await page.route(`${SUPA}/rest/v1/subscriptions*`, (route) => {
  const wantsObject = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? SUB : [SUB]) });
});
await page.addInitScript(() => { const s = () => { const st = document.createElement('style'); st.textContent = '.dev-plan{display:none!important}'; document.head.appendChild(st); }; if (document.head) s(); else document.addEventListener('DOMContentLoaded', s); });
await page.goto(BASE + '/?app=1#invoices');
await page.waitForTimeout(6000);
const tag = `${MODE}-${WIDTH}${process.env.DARK ? '-dark' : ''}`;
// NOTIS-KOLL
console.log('klockan plingade:', await page.locator('.bell-ring, [class*=ring]').count(), '| röd prick:', await page.locator('.notif-badge, [class*=badge]').first().innerText().catch(() => '?'));
await page.goto(BASE + '/?app=1#dashboard'); await page.waitForTimeout(3500);
console.log('pling vid start:', await page.locator('.bell-ring').count());
await page.locator('.topbar-icon-btn[title=Notiser]').first().click().catch(() => {}); await page.waitForTimeout(600);
console.log('notisen:', (await page.locator('.np-title').first().innerText().catch(() => '(ingen)')));
await page.screenshot({ path: 'test-results/betalning-' + tag + '-notis.png' }); await page.keyboard.press('Escape');
const banner = await page.locator('.pay-banner').first().innerText().catch(() => '(ingen banner)');
console.log('banner:', banner.replace(/\s+/g, ' ').slice(0, 260));
console.log('betalsidan visas:', await page.locator('text=Din bokföring finns kvar').count() > 0 || await page.locator('.payment-gate, [data-gate]').count() > 0);
await page.screenshot({ path: `test-results/betalning-${tag}.png` });
if (MODE === 'failed') {
  // Notisen leder till Prenumeration, där rutan och flikarna finns.
  if (!(await page.locator('.np-main').first().isVisible().catch(() => false))) { await page.locator('.topbar-icon-btn[title=Notiser]').first().click(); await page.waitForTimeout(500); }
  await page.locator('.np-main').first().click(); await page.waitForTimeout(1500);
  console.log('notisen tog mig till:', await page.locator('.main-content-inner h1, .main-content-inner h2').first().innerText().catch(() => '?'), '| ruta:', await page.locator('.pay-fix').count(), '| flikar:', (await page.locator('.sub-tabs button').allInnerTexts()).join(' / '));
  await page.screenshot({ path: 'test-results/betalning-' + tag + '-prenumeration.png' });
  // PLANVAL
  await page.locator('.plan-card-btn').first().click().catch(() => {}); await page.waitForTimeout(700);
  console.log('planer:', (await page.locator('.pp-name').allInnerTexts()).join(' / '));
  await page.screenshot({ path: 'test-results/betalning-' + tag + '-planer.png' });
  await page.locator('.sub-x').first().click().catch(() => {}); await page.waitForTimeout(400);
  await page.locator('.sub-tabs button', { hasText: 'Betalning' }).click(); await page.waitForTimeout(600);
  console.log('fliken Betalning, kortet:', (await page.locator('.bc-card').innerText().catch(() => '(inget)')).replace(/s+/g, ' '));
  await page.screenshot({ path: 'test-results/betalning-' + tag + '-kort.png' });
  await page.locator('.sub-tabs button', { hasText: 'Kvitton' }).click(); await page.waitForTimeout(800);
  console.log('fliken Kvitton, rader:', await page.locator('.sr-row').count());
  await page.screenshot({ path: 'test-results/betalning-' + tag + '-kvitton.png' });
  await page.locator('.sr-row').nth(1).click().catch(() => {}); await page.waitForTimeout(600);
  console.log('kvitto i appen:', (await page.locator('.sr-paper').innerText().catch(() => '(inget)')).replace(/s+/g, ' ').slice(0, 200));
  await page.screenshot({ path: 'test-results/betalning-' + tag + '-kvitto.png' }); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.locator('.pay-fix-btn.is-primary').click(); await page.waitForTimeout(800);
  console.log('efter första försöket:', (await page.locator('.pay-fix').innerText()).replace(/s+/g, ' ').slice(0, 120));
  await page.locator('.pay-fix-btn.is-primary').click(); await page.waitForTimeout(900);
  console.log('efter andra försöket:', (await page.locator('.pay-fix').innerText().catch(() => '(borta)')).replace(/s+/g, ' ').slice(0, 120));
}
if (MODE === 'read') {
  // Försök ändra: skapa faktura och spara, och ändra en kund
  const before = JSON.stringify(server.row.state).length;
  const ny = page.locator('button', { hasText: /Skapa faktura|Ny faktura/ }).first();
  if (await ny.isVisible().catch(() => false)) { await ny.click(); await page.waitForTimeout(800); }
  const save = page.locator('button', { hasText: /^Skapa faktura$|^Spara/ }).last();
  if (await save.isVisible().catch(() => false)) { await save.click().catch(() => {}); await page.waitForTimeout(1200); }
  const toast = await page.locator('[role=status], .toast, [class*=toast]').allInnerTexts().catch(() => []);
  console.log('notis:', toast.join(' | ').replace(/\s+/g, ' ').slice(0, 200));
  await page.waitForTimeout(2500);
  console.log('sparat till servern i läsläge:', JSON.stringify(server.row.state).length !== before ? 'JA (FEL)' : 'nej');
  await page.screenshot({ path: `test-results/betalning-${tag}-forsok.png` });
}
console.log('fel:', errors.length ? errors : 'inga');
await browser.close();
