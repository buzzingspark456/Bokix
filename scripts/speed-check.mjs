// Mäter laddtider på produktionsbygget (npx vite preview --port 4173) i en
// webbläsare strypt till ungefär en mellanklass-telefon på 4G: 4x långsammare
// processor, 9 Mbit/s, 150 ms fördröjning. Databasen är fejkad (som i
// app-harness-bank.mjs), så bara appens egen tid mäts.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.SPEED_URL || 'http://localhost:4173';
const RUNS = Number(process.env.RUNS || 3);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };

const browser = await chromium.launch();

async function throttled(ctx) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let jsBytes = 0;
  cdp.on('Network.loadingFinished', (e) => { if (jsReq.has(e.requestId)) jsBytes += e.encodedDataLength; });
  const jsReq = new Set();
  cdp.on('Network.responseReceived', (e) => { if (e.type === 'Script') jsReq.add(e.requestId); });
  return { page, js: () => jsBytes };
}

// Kontots data: demons ett år bokföring, skapad av app-harness (se nedan).
const state = JSON.parse(fs.readFileSync('test-results/speed-state.json', 'utf8'));

async function measureApp() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  const { page, js } = await throttled(ctx);
  await page.addInitScript(([key, val, uid]) => { sessionStorage.setItem(key, val); localStorage.setItem(`bokix_tour_done_v3_${uid}`, '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session), UID]);
  const wantsObj = (req) => (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  await page.route(`${SUPA}/**`, async (route) => {
    // Som en riktig tur-och-retur till Supabase i Stockholm från en telefon.
    await new Promise(r => setTimeout(r, Number(process.env.DB_MS || 80)));
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
    if (url.pathname.startsWith('/rest/v1/rpc/') || url.pathname.startsWith('/storage/')) return route.fulfill({ json: null });
    const table = url.pathname.replace('/rest/v1/', '');
    let data = null;
    if (table === 'user_data') data = req.method() === 'GET' ? { state, updated_at: '2026-10-08T12:00:00+00:00', onboarding_completed: true, onboarding_skipped: false } : { updated_at: '2026-10-08T12:00:01+00:00' };
    if (table === 'subscriptions') data = { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false };
    const obj = wantsObj(req);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(obj ? data : (data ? [data] : [])) });
  });
  await page.route('**/api/**', r => r.fulfill({ json: {} }));
  const t0 = Date.now();
  await page.goto(`${BASE}/?app=1`);
  await page.waitForFunction(() => document.body.innerText.includes('Räkenskapsåret') || document.body.innerText.includes('Resultat'), null, { timeout: 120000 });
  const ready = Date.now() - t0;
  const t1 = Date.now();
  await page.evaluate(() => { window.location.hash = 'verifications'; });
  await page.waitForFunction(() => /Verifikation|Bokföring/.test(document.querySelector('main, .main-content, body').innerText) && !document.body.innerText.includes('Räkenskapsåret'), null, { timeout: 60000 }).catch(() => {});
  const nav = Date.now() - t1;
  const bytes = js();
  await ctx.close();
  return { ready, nav, bytes };
}

async function measureLanding() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  const { page, js } = await throttled(ctx);
  await page.route('**/api/**', r => r.fulfill({ json: {} }));
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const load = Date.now() - t0;
  const lcp = await page.evaluate(() => new Promise(res => { new PerformanceObserver(l => { const e = l.getEntries(); res(Math.round(e[e.length - 1].startTime)); }).observe({ type: 'largest-contentful-paint', buffered: true }); setTimeout(() => res(null), 3000); }));
  const bytes = js();
  await ctx.close();
  return { load, lcp, bytes };
}

const med = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const app = []; const land = [];
for (let i = 0; i < RUNS; i++) { app.push(await measureApp()); land.push(await measureLanding()); }
console.log(`APP  klar att använda: ${med(app.map(r => r.ready))} ms, byte till Bokföring: ${med(app.map(r => r.nav))} ms, JS hämtat: ${Math.round(med(app.map(r => r.bytes)) / 1024)} kB`);
console.log(`SAJT laddad: ${med(land.map(r => r.load))} ms, LCP: ${med(land.map(r => r.lcp))} ms, JS hämtat: ${Math.round(med(land.map(r => r.bytes)) / 1024)} kB`);
await browser.close();
