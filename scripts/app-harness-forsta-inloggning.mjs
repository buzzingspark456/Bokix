// Kör: npx vite --port 5199, sedan node scripts/app-harness-forsta-inloggning.mjs
// Första inloggningen efter registreringen (2026-10-24): kontots metadata har
// alla företagssvar (setup_done), så App.jsx ska skapa företaget färdigt och
// gå rakt till startsidan utan onboarding.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const WIDTH = Number(process.env.WIDTH || 1440);
const FIRMA = process.env.SCENARIO === 'firma';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Anna', company_name: 'Abbes Corner AB', org_nr: '559251-8863', company_address: 'Storgatan 1', company_postal_code: '811 30', company_city: 'Sandviken', fiscal_year: '2025-12-01', vat_registered: true, vat_nr: 'SE559251886301', vat_period: 'yearly', f_skatt: 'Godkänd för F-skatt', setup_done: true, setup_done_at: '2026-10-24T12:00:00Z' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };
let tick = 0;
const newTs = () => new Date(Date.UTC(2026, 9, 10, 12, 0, 0) + (++tick) * 1000).toISOString().replace('Z', '+00:00');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.addInitScript(([key, val]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
const server = { row: null };
await page.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  const reply = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wantsObject ? data : (data == null ? [] : [data])) });
  if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: session });
  if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
  if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
  const table = url.pathname.replace('/rest/v1/', '');
  if (table === 'user_data') {
    if (req.method() === 'GET' || req.method() === 'HEAD') return reply(server.row);
    const b = JSON.parse(req.postData() || '{}');
    server.row = { ...(server.row || {}), ...(Array.isArray(b) ? b[0] : b), updated_at: newTs() };
    return reply({ updated_at: server.row.updated_at });
  }
  if (table === 'subscriptions') return reply({ user_id: UID, status: 'trialing', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false });
  return reply(null);
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));
await page.goto(BASE + '/?app=1');
await page.waitForSelector('.app-container, .onb-page', { timeout: 30000 });
await page.waitForTimeout(3000);
const onboardingShown = await page.locator('.onb-page').count();
await page.screenshot({ path: 'test-results/forsta-inloggning.png' });
const state = server.row?.state;
const c = state ? Object.values(state.companies)[0].company : null;
console.log(JSON.stringify({ onboardingShown, onboarding_completed: server.row?.onboarding_completed, company: c && { name: c.name, orgNr: c.orgNr, city: c.city, fiscalYear: c.fiscalYear, vatRegistered: c.vatRegistered, vatPeriod: c.vatPeriod, fSkatt: c.fSkatt, needsSetup: c.needsSetup, setupConfirmedAt: c.setupConfirmedAt }, errors }, null, 1));
await browser.close();
