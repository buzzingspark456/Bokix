// Kör: npx vite --port 5199, sedan N=10000 node scripts/app-harness-artiklar-fart.mjs (CPU=4 för telefonfart)
// Hur snabbt Artiklar, Lager och artikelsök på faktura är med många artiklar.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:5199';
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
await p0.goto(`${process.env.SEED_BASE || BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await p0.close();
const N = Number(process.env.N || 10000);
const words = ['Kaffe', 'Mugg', 'Skruv', 'Kabel', 'Lampa', 'Tröja', 'Byxa', 'Sko', 'Väska', 'Penna', 'Block', 'Tejp', 'Batteri', 'Laddare', 'Hörlur'];
company.articles = Array.from({ length: N }, (_, i) => ({ id: 'art_' + i, type: i % 5 ? 'vara' : 'tjanst', articleNumber: 'A-' + String(10000 + i), description: words[i % words.length] + ' modell ' + i, descriptionEn: '', unitPrice: 50 + (i % 900), purchasePrice: 20 + (i % 400), unit: 'st', vatRate: 25, account: '3001', ean: String(7300000000000 + i), rotRut: 'none', notes: '', supplier: 'Lev ' + (i % 40) }));
company.company.stockMovements = Array.from({ length: Math.min(N, 3000) }, (_, i) => ({ id: 'sm_' + i, articleId: 'art_' + ((i * 3) % N), date: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), qty: 5 + (i % 20), unitCost: 20 + (i % 400), type: 'in', note: '' }));
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
await page.route("**/api/**", r => r.request().url().includes("/api/inbox") ? r.fulfill({ json: { address: "kvitto-7k2m9q@inbox.bokix.se", lastReceivedAt: new Date(Date.now() - 12 * 60000).toISOString(), allowedSenders: [] } }) : r.fulfill({ json: {} }));
const tag = "-" + WIDTH + (process.env.DARK ? "-dark" : "");
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `test-results/artfart-${name}${tag}.png`, fullPage: false }); };

const cdp = await ctx.newCDPSession(page);
if (process.env.CPU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU) });
const timed = async (label, fn, waitFn) => { const t = Date.now(); await fn(); await waitFn(); console.log(label.padEnd(34), (Date.now() - t) + ' ms'); };
await page.goto(BASE + '/?app=1#dashboard');
await page.waitForTimeout(5000);
await timed('Artiklar öppnas', () => page.evaluate(() => { location.hash = 'articles'; }), () => page.waitForSelector('text=A-10000', { timeout: 60000 }));
await shot('artiklar');
const search = page.locator('input[type=search], input[placeholder*="Sök"]').first();
if (N >= 10000) await timed('Sök "modell 9876"', () => search.fill('modell 9876'), () => page.waitForSelector('text=A-19876', { timeout: 30000 }));
if (N >= 10000) await timed('Rensa sök', () => search.fill(''), () => page.waitForSelector('text=A-10000', { timeout: 30000 }));
const lagerTab = page.locator('button, a', { hasText: /^Lager$/ }).first();
if (await lagerTab.isVisible().catch(() => false)) {
  await timed('Lager-fliken', () => lagerTab.click(), () => page.waitForTimeout(300));
  await shot('lager');
}
await timed('Kundfakturor öppnas', () => page.evaluate(() => { location.hash = 'invoices'; }), () => page.waitForTimeout(500));
const nyBtn = page.locator('button', { hasText: /Ny faktura|Skapa faktura/ }).first();
if (await nyBtn.isVisible().catch(() => false)) {
  const lineSel = 'input[placeholder*="artikel"], textarea[placeholder*="artikel"], input[placeholder*="Beskrivning"], textarea[placeholder*="Beskrivning"]';
  await timed('Ny faktura öppnas', () => nyBtn.click(), () => page.waitForSelector(lineSel, { timeout: 30000 }));
  const line = page.locator(lineSel).first();
  await line.click();
  const t = Date.now();
  await line.pressSequentially('Lampa 12', { delay: 30 });
  await page.waitForSelector('.acb-list', { timeout: 10000 }).catch(() => console.log('(ingen träfflista syntes)'));
  console.log('Skriv "Lampa 12" + träfflista'.padEnd(34), (Date.now() - t) + ' ms (varav 240 ms skrivpaus)');
  await shot('faktura-sok');
} else console.log('hittade ingen Ny faktura-knapp');
const long = await page.evaluate(() => new Promise(r => { const out = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => out.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); } catch { /* */ } setTimeout(() => r(out), 300); }));
console.log('längsta låsningar (ms):', long.sort((a, b) => b - a).slice(0, 8).join(', '));
console.log('fel:', errors.length ? errors : 'inga');
await browser.close();
