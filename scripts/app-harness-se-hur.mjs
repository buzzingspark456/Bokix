// Kör: npx vite --port 5199, sedan node scripts/app-harness-se-hur.mjs
// "Se hur" ska finnas på Kunder och Kundfakturor (tre filmer), spela rätt
// film, och saknas för gömda Artiklar. Kontakta support ska skicka med sidan
// och företaget under meddelandet.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const p0 = await ctx.newPage();
await p0.goto(`${BASE}/scripts/ocr-harness.html`);
const company = await p0.evaluate(async () => {
  const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
  return JSON.parse(JSON.stringify(createDemoSeed()));
});
await p0.close();
company.company.features = { articles: false };
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name }, contact: null };

const page = await ctx.newPage();
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
await page.route('**/api/**', r => {
  if (r.request().url().includes('/api/contact')) server.contact = JSON.parse(r.request().postData() || '{}');
  return r.fulfill({ json: { ok: true } });
});

const go = async (tab) => { await page.evaluate((t) => { window.location.hash = t; }, tab); await page.waitForTimeout(1200); };
await page.goto(BASE + '/?app=1');
await page.waitForSelector('.dash-top', { timeout: 25000 });
await page.waitForTimeout(1000);
let ok = true;

await go('contacts');
const btn = page.getByRole('button', { name: 'Se hur' });
console.log('Kunder har Se hur:', await btn.count() > 0);
await btn.first().click();
await page.waitForTimeout(800);
const src = await page.evaluate(() => document.querySelector('.modal-content video')?.getAttribute('src'));
const videoOk = src ? (await page.request.get(BASE + src)).status() : null;
console.log('Film:', src, 'svarar', videoOk);
ok = ok && ['/videos/lagg-upp-kund.mp4', '/videos/lagg-upp-kund-dark.mp4'].includes(src) && videoOk === 200;
await page.screenshot({ path: 'test-results/harness-se-hur.png' });
await page.keyboard.press('Escape');
await page.locator('.modal-close').first().click().catch(() => {});
await page.waitForTimeout(300);

await go('invoices');
await page.getByRole('button', { name: 'Se hur' }).first().click();
await page.waitForTimeout(500);
const tabs = await page.evaluate(() => [...document.querySelectorAll('.modal-content [role="tab"]')].map(b => b.innerText));
console.log('Kundfakturor, filmer:', JSON.stringify(tabs));
ok = ok && tabs.length === 3;
await page.locator('.modal-close').first().click();
await page.waitForTimeout(300);

await go('articles');
const artBtn = await page.getByRole('button', { name: 'Se hur' }).count();
console.log('Gömda Artiklar har Se hur:', artBtn > 0);
ok = ok && artBtn === 0;

// Support från Kundfakturor.
await go('invoices');
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, a, [role="button"]')].find(e => e.innerText?.trim() === 'Hjälp och support');
  el?.click();
});
await page.waitForTimeout(600);
await page.locator('a', { hasText: 'Kontakta support' }).first().click();
await page.waitForTimeout(500);
const info = await page.evaluate(() => document.querySelector('.modal-content')?.innerText.match(/Följer med[^\n]*/)?.[0]);
console.log('I rutan:', info);
await page.locator('.modal-content textarea').fill('Testmeddelande');
await page.locator('.modal-content button[type="submit"]').click();
for (let i = 0; i < 20 && !server.contact; i++) await page.waitForTimeout(250);
console.log('Skickat meddelande:', JSON.stringify(server.contact?.message));
ok = ok && /Kundfakturor/.test(server.contact?.message || '') && (server.contact?.message || '').includes(company.company.name);

console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
process.exit(ok ? 0 : 1);
