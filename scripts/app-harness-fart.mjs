// Fart med ett stort företag. Kör produktionsbygget (npm run build, sedan
// npx vite preview --port 4173) och skapa företaget med demons data
// mångdubblad (scripts/big-company-seed.mjs). Sedan:
//   STATE=test-results/big-company.json node scripts/app-harness-fart.mjs
// Mäter för varje sida tiden från bytet tills huvudtråden är ledig igen och
// hur länge den var blockerad (långa uppgifter > 50 ms). CPU=4 stryper
// processorn som en mellanklass-telefon.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.SPEED_URL || 'http://localhost:4173';
const CPU = Number(process.env.CPU || 1);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };

const company = JSON.parse(fs.readFileSync(process.env.STATE || 'test-results/big-company.json', 'utf8'));
const id = company.company.id;
const state = { activeCompanyId: id, companies: { [id]: company } };
let saves = 0; let saveBytes = 0;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: Number(process.env.WIDTH || 1440), height: 900 } });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const page = await ctx.newPage();
if (CPU > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
await page.addInitScript(([key, val, uid]) => {
  sessionStorage.setItem(key, val);
  localStorage.setItem(`bokix_tour_done_v3_${uid}`, '1');
  window.__lt = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
}, [`sb-${REF}-auth-token`, JSON.stringify(session), UID]);
const wantsObj = (req) => (req.headers()['accept'] || '').includes('vnd.pgrst.object');
await page.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
  if (url.pathname.startsWith('/rest/v1/rpc/') || url.pathname.startsWith('/storage/')) return route.fulfill({ json: null });
  const table = url.pathname.replace('/rest/v1/', '');
  let data = null;
  if (table === 'user_data') {
    if (req.method() === 'GET' || req.method() === 'HEAD') data = { id: 'r1', user_id: UID, state, updated_at: '2026-10-08T12:00:00+00:00', onboarding_completed: true, onboarding_skipped: false };
    else { saves++; saveBytes += (req.postData() || '').length; data = { updated_at: `2026-10-08T12:00:${String(saves % 60).padStart(2, '0')}+00:00` }; }
  }
  if (table === 'subscriptions') data = { user_id: UID, status: 'active', current_period_end: '2030-01-01T00:00:00Z', cancel_at_period_end: false };
  const obj = wantsObj(req);
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(obj ? data : (data ? [data] : [])) });
});
await page.route('**/api/**', r => r.fulfill({ json: {} }));
// BLOCK_TRACKERS=1: utan Clarity och Google Analytics, för att se deras del.
if (process.env.BLOCK_TRACKERS) await page.route(/clarity.ms|googletagmanager|google-analytics/, r => r.abort());

// Väntar tills ingen lång uppgift har körts på 700 ms. Svarar med tiden
// från t0 till slutet av den sista långa uppgiften och summan av dem.
async function settle(t0) {
  for (;;) {
    await page.waitForTimeout(250);
    const r = await page.evaluate((t0) => {
      const after = window.__lt.filter(([s]) => s >= t0 - 5);
      const last = after.reduce((m, [s, d]) => Math.max(m, s + d), t0);
      return { now: performance.now(), last, sum: after.reduce((a, [, d]) => a + d, 0), max: after.reduce((a, [, d]) => Math.max(a, d), 0) };
    }, t0);
    if (r.now - r.last > 700) return { tid: Math.round(r.last - t0), blockerad: Math.round(r.sum), langsta: Math.round(r.max) };
  }
}

const out = [];
const t0 = Date.now();
await page.goto(`${BASE}/?app=1#dashboard`);
await page.waitForFunction(() => /Resultat|Räkenskapsåret/.test(document.body.innerText), null, { timeout: 120000 });
const startT = await settle(0);
out.push(`start (inloggad till klar): ${Date.now() - t0} ms totalt, blockerad ${startT.blockerad} ms, längsta ${startT.langsta} ms`);

const PAGES = (process.env.PAGES || 'verifications,invoices,expenses,supplier_invoices,contacts,quotes,bank,projects,payroll,reports,taxes,review,articles,settings,dashboard').split(',');
for (const p of PAGES) {
  const s = await page.evaluate((h) => { const t = performance.now(); location.hash = h; return t; }, p);
  const r = await settle(s);
  out.push(`${p.padEnd(18)} ${String(r.tid).padStart(6)} ms  blockerad ${String(r.blockerad).padStart(5)}  längsta ${String(r.langsta).padStart(5)}`);
}

// Sökning: skriv ett ord tecken för tecken i Bokföringens sökfält.
if (!process.env.NOSEARCH) {
  for (const p of ['verifications', 'invoices', 'contacts', 'expenses']) {
    await page.evaluate((h) => { location.hash = h; }, p);
    await settle(await page.evaluate(() => performance.now()));
    const box = page.locator('input[type=search]:visible, input[placeholder*="Sök"]:visible').first();
    if (!(await box.count())) { out.push(`sök ${p}: inget sökfält`); continue; }
    const s = await page.evaluate(() => performance.now());
    await box.pressSequentially('Exempel', { delay: 60 });
    const r = await settle(s);
    out.push(`sök ${p.padEnd(14)} ${String(r.tid).padStart(6)} ms  blockerad ${String(r.blockerad).padStart(5)}  längsta ${String(r.langsta).padStart(5)}`);
    await box.fill('');
  }
}
out.push(`sparningar: ${saves}, ${Math.round(saveBytes / 1024)} kB`);
console.log(out.join('\n'));
console.log(errors.length ? errors.slice(0, 5) : 'inga fel');
await browser.close();
