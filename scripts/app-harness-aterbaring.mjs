// Kör: npx vite --port 5199, sedan node scripts/app-harness-aterbaring.mjs
// Ekonomisk förening: Återbäring under Årsavslut, medlemmar ur kundfakturorna, beslut, INK2 och årsredovisningen.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
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
company.company.orgNr = "769600-0005";
company.company.postalCode = company.company.postalCode || "12345";
company.company.city = company.company.city || "Stockholm";
const id = company.company.id;
const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
const saved = () => server.row.state.companies[id];

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
await page.route('**/api/**', r => r.fulfill({ json: {} }));

const tag = '-' + WIDTH;
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `test-results/aterbaring-${name}${tag}.png`, fullPage: false }); };
const year = new Date().getFullYear();
await page.goto(BASE + '/?app=1#taxes');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1500);
await page.locator('text="Årsavslut" >> visible=true').first().click();
await page.waitForTimeout(1000);
const steps = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && /^\d\. /.test(b.innerText.trim())).map(b => b.innerText.trim()));
await page.locator('button:visible', { hasText: /^\d\. Återbäring$/ }).first().click();
await page.waitForTimeout(800);
await page.locator('button:visible', { hasText: 'Ny återbäring' }).first().click();
await page.waitForTimeout(400);
await page.locator('button:visible', { hasText: 'Hämta från kundfakturor' }).click();
await page.waitForTimeout(400);
const memberCount = await page.locator('.rf-m:not(.head) input[aria-label="Medlem"]').count();
await page.locator('label:has-text("Belopp, kr") + input').fill('10000');
await page.locator('label:has-text("Beslutsdatum") + input').fill(`${year + 1}-04-20`);
await page.waitForTimeout(400);
await shot('formular');
const formText = await page.evaluate(() => document.body.innerText);
await page.locator('button:visible', { hasText: 'Spara förslaget' }).click();
await page.waitForTimeout(600);
await shot('lista');
const listText = await page.evaluate(() => document.body.innerText);
await page.locator('button:visible', { hasText: 'Bokför beslut' }).first().click();
await page.waitForTimeout(400);
await page.locator('button:visible', { hasText: 'Bekräfta' }).last().click();
await page.waitForTimeout(1200);
const afterBook = await page.evaluate(() => document.body.innerText);
await page.locator('button:visible', { hasText: /^\d\. Inkomstdeklaration 2$/ }).first().click();
await page.waitForTimeout(1200);
await shot('ink2');
const ink2 = await page.evaluate(() => document.body.innerText);
await page.waitForTimeout(2500);
const state = saved();
const ver = (state.verifications || []).find(v => v.source === 'patronage_refund');
const nb = (s) => s.replace(/[\u00a0\u202f]/g, ' ');
const checks = {
  ordning: steps.join('|') === '1. Årsbokslut|2. Årsredovisning|3. Återbäring|4. Inkomstdeklaration 2',
  medlemmar: memberCount > 0,
  tidpunkt: /Beslutet fattas efter årets slut/.test(formText),
  summa: /Återbäring 10 000 kr/.test(nb(formText)),
  forslag: /Förslag/.test(listText),
  sparat: (state.company.patronageRefunds || []).length === 1,
  verifikation: Boolean(ver) && ver.rows.some(r => r.account === '8840' && r.debet === 10000) && ver.rows.some(r => r.account === '2890' && r.kredit === 10000),
  beslutad: /Beslutad, ej utbetald/.test(afterBook),
  ink2: /10 000/.test(nb(ink2)) && /ej bokförda kostnader/i.test(ink2),
};
console.log(JSON.stringify({ steps, ...checks }), errors.length ? errors : '');
await browser.close();
process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
