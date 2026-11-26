// Kör: npx vite --port 5173, sedan PLAN=solo_monthly|employer_monthly|trade_monthly node scripts/app-harness-planer.mjs
// Vad varje plan visar: menyn och ord om lön, lager, order och inköp på viktiga sidor.
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
const PLAN = process.env.PLAN || 'solo_monthly';
await page.addInitScript((p) => localStorage.setItem('bokix.devPlan', p), PLAN);
await page.goto(BASE + '/?app=1#dashboard');
await page.waitForTimeout(5000);
const nav = await page.evaluate(() => [...document.querySelectorAll('.sidebar a, .sidebar button')].map(e => e.textContent.trim()).filter(t => t && t.length < 40));
console.log('PLAN', PLAN);
console.log('meny:', nav.join(' | '));
const WORDS = /Lön|lön|AGI|Arbetsgivardeklaration|Lager|lager|Inköp|inköp|Order|order|Prissättning|Inventering/;
const PAGES = ['dashboard', 'taxes', 'supplier_invoices', 'invoices', 'quotes', 'expenses', 'articles', 'settings'];
for (const p of PAGES) {
  await page.evaluate((h) => { location.hash = h; }, p);
  await page.waitForTimeout(1800);
  const hits = await page.evaluate((src) => {
    const re = new RegExp(src);
    const main = document.querySelector('.main-content') || document.body;
    const out = new Set();
    main.querySelectorAll('button, a, h1, h2, h3, [role=tab], th, label').forEach(e => { const t = e.textContent.trim(); if (t && t.length < 60 && re.test(t) && e.offsetParent) out.add(t); });
    return [...out].slice(0, 14);
  }, WORDS.source);
  console.log(p.padEnd(18), hits.length ? hits.join(' | ') : '-');
  await page.screenshot({ path: `test-results/plan-${PLAN}-${p}.png` });
}
console.log('fel:', errors.length ? errors : 'inga');
await browser.close();
