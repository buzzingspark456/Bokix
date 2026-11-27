// Kör: npx vite --port 5173, sedan node scripts/live-demo.mjs
// Synligt Chrome-fönster med hela appen (admin-läge, exempeldata, fejkad databas).
// Vite laddar om ändringar direkt, så fönstret visar det som byggs. Stäng fönstret för att avsluta.
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

const browser = await chromium.launch({ headless: false, channel: process.env.CHANNEL || 'chrome', args: ['--start-maximized'] });
const ctx = await browser.newContext({ viewport: null, ...(WIDTH < 600 ? { isMobile: true, hasTouch: true } : {}) });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const p0 = await ctx.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await p0.close();
const now = Date.now();
const img = BASE + "/scripts/guide-assets/exempelkvitto.png";
const mk = (n, minAgo, from, subject, fileName, type, seen) => ({ id: "exp_" + (now - minAgo * 60000 + n), type: "receipt", date: new Date(now - minAgo * 60000).toISOString().slice(0, 10), description: "", supplier: "", amount: 0, netAmount: 0, vatAmount: 0, vatRate: 25, costAccount: "", receiptUrl: img, receiptType: type, uploadedBy: { source: "email", name: "", email: from }, inbox: { source: "email", from, subject, fileName, receivedAt: new Date(now - minAgo * 60000 + n).toISOString(), ...(seen ? { seenAt: new Date().toISOString() } : {}) } });
company.expenses.push(
  mk(1, 12, "Gusto Kaffebar <kvitto@gusto.se>", "Ditt kvitto från Gusto Kaffebar", "kvitto-4471.png", "image/png", false),
  mk(2, 90, "Clas Ohlson <order@clasohlson.se>", "Orderbekräftelse 88213 – två kvitton", "kvitto-del1.png", "image/png", false),
  mk(3, 90, "Clas Ohlson <order@clasohlson.se>", "Orderbekräftelse 88213 – två kvitton", "kvitto-del2.png", "image/png", false),
  mk(4, 60 * 30, "anna@telia.se", "Faktura november", "Faktura november.pdf", "application/pdf", true),
);
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
const saved = () => server.row.state.companies[id];

const page = await ctx.newPage();
await page.addInitScript((d) => localStorage.setItem('bokix_theme_pref', d ? 'dark' : 'light'), Boolean(process.env.DARK));
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.addInitScript(([key, val]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
const DEMO_SUB = process.env.NOPAY
  ? { user_id: UID, company_id: '', status: 'active', plan: 'employer_monthly', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false }
  : { user_id: UID, company_id: '', status: 'past_due', plan: 'employer_monthly', created_at: '2026-09-01T00:00:00Z', current_period_end: '2026-12-20T00:00:00Z', cancel_at_period_end: false, payment_failed_at: new Date(Date.now() - 2 * 86400000).toISOString() };
let demoRetries = 0;
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
  if (table === 'subscriptions') return reply(route, DEMO_SUB, wantsObject);
  return reply(route, wantsObject ? null : [], wantsObject);
});
// Betalningsbannern i demon (2026-11-27): kortet nekades för två dagar sedan.
// Försök igen nekas första gången och går igenom andra. NOPAY=1 stänger av.
await page.route("**/api/**", async (r) => {
  const url = r.request().url();
  let body = {};
  try { body = JSON.parse(r.request().postData() || '{}'); } catch { /* inget */ }
  if (url.includes('/api/inbox')) return r.fulfill({ json: { address: 'kvitto-7k2m9q@inbox.bokix.se', lastReceivedAt: new Date(Date.now() - 12 * 60000).toISOString(), allowedSenders: [] } });
  if (url.includes('create-subscription-checkout') && body.action === 'payment-issue') {
    return r.fulfill({ json: { status: DEMO_SUB.status, card: { brand: 'visa', last4: '4242', expMonth: 11, expYear: 2026 }, issue: DEMO_SUB.status === 'active' ? null : { amount: 179, currency: 'sek', attempts: 2, nextAttempt: new Date(Date.now() + 2 * 86400000).toISOString(), requiresAction: false, declineReason: 'Kortet saknar täckning.', hostedUrl: null } } });
  }
  if (url.includes('create-subscription-checkout') && body.action === 'retry-payment') {
    demoRetries += 1;
    if (demoRetries === 1) return r.fulfill({ json: { ok: false, reason: 'Kortet saknar täckning.' } });
    Object.assign(DEMO_SUB, { status: 'active', payment_failed_at: null });
    return r.fulfill({ json: { ok: true, status: 'active' } });
  }
  return r.fulfill({ json: {} });
});
const tag = "-" + WIDTH + (process.env.DARK ? "-dark" : "");
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `test-results/mejl-${name}${tag}.png`, fullPage: false }); };

await page.goto(BASE + "/?app=1#dashboard");
page.on("close", () => process.exit(0));
browser.on("disconnected", () => process.exit(0));
console.log("Demon är öppen:", BASE);
await new Promise(() => {});
