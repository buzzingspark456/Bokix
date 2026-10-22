// Kör: npx vite --port 5199, sedan node scripts/app-harness-ink3.mjs
// Ideell förening: fliken Inkomstdeklaration 3, frågorna, stegen och SRU-filen med INK3R, INK3S och INK3SUF.
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
company.company.orgNr = "802400-0005";
company.company.postalCode = company.company.postalCode || "12345";
company.company.city = company.company.city || "Stockholm";
// Medlemsavgifter på ett eget konto, som en förening brukar ha.
company.accounts.push({ code: '3010', name: 'Medlemsavgifter', type: 'intakt' });
company.verifications.push({ id: 'ink3-medlem', number: 'A999', series: 'A', date: `${new Date().getFullYear()}-03-01`, description: 'Medlemsavgifter', status: 'booked', rows: [{ account: '1930', debet: 30000, kredit: 0 }, { account: '3010', debet: 0, kredit: 30000 }] });
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
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `test-results/ink3-${name}${tag}.png`, fullPage: false }); };

await page.goto(BASE + '/?app=1#taxes');
await page.waitForSelector('.list-page-header', { timeout: 25000 });
await page.waitForTimeout(1500);
await page.locator('text="Årsavslut" >> visible=true').first().click();
await page.waitForTimeout(1000);
const tab = page.locator('button:visible, [role=tab]:visible', { hasText: 'Inkomstdeklaration 3' }).first();
const hasTab = await tab.count() > 0;
const noInk2 = await page.locator('button:visible, [role=tab]:visible', { hasText: /^Inkomstdeklaration$/ }).count() === 0;
if (hasTab) { await tab.click(); await page.waitForTimeout(1200); }
await page.locator('.stepflow-stepbtn[title*="Föreningen"]').first().click().catch(() => {});
await page.waitForTimeout(400);
const q = (i, text) => page.locator('.ink3-q').nth(i).locator('button', { hasText: text }).click();
await q(0, 'Förening eller trossamfund');
await q(1, 'Ja');
await page.waitForTimeout(300);
await q(2, 'Ja');
await shot('forening');
const orgText = await page.evaluate(() => document.body.innerText);
await page.locator('.stepflow-stepbtn[title*="Räkenskapsschema"]').first().click().catch(() => {});
await page.waitForTimeout(600);
const schema = await page.evaluate(() => document.body.innerText);
// Kiosken: 5 000 kr av nettoomsättningen och 1 000 kr kostnad är skattepliktiga.
const taxInput = (row) => page.locator(`input[aria-label="${row} Skattepliktigt"]`);
await taxInput('6.4').fill('5000');
await taxInput('6.7').fill('1000');
await page.waitForTimeout(500);
await shot('schema');
await page.locator('.stepflow-stepbtn[title*="Skattemässiga"]').first().click().catch(() => {});
await page.waitForTimeout(500);
await page.locator('.ink3-q').nth(0).locator('button', { hasText: 'Nej' }).click();
await page.locator('.ink3-q').nth(1).locator('button', { hasText: 'Nej' }).click();
await shot('justeringar');
const adjust = await page.evaluate(() => document.body.innerText);
await page.locator('.stepflow-stepbtn[title*="Särskild"]').first().click().catch(() => {});
await page.waitForTimeout(500);
await page.locator('.ink3-checks label', { hasText: 'Idrott' }).locator('input').check();
await page.waitForTimeout(300);
await shot('suf');
await page.locator('.stepflow-stepbtn[title*="Ladda ner"]').first().click().catch(() => {});
await page.waitForTimeout(500);
await shot('skicka');
const send = await page.evaluate(() => document.body.innerText);
let sru = '';
try {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.locator('.fp-actions button.primary').click()]);
  sru = fs.readFileSync(await dl.path()).toString('latin1');
} catch (e) { console.log('nedladdning:', String(e).slice(0, 160)); }
await page.waitForTimeout(2500);
const stored = saved()?.company?.ink3 || {};
const nbsp = (s) => s.replace(/[  ]/g, ' ');
const checks = {
  flik: hasTab, ingenInk2: noInk2,
  bilagor: /INK3R, INK3S och INK3SUF/.test(orgText),
  medlemsavgifter: /3010/.test(schema) && /Medlemsavgifter/.test(schema),
  justerat: /4 000 kr/.test(nbsp(adjust)),
  overskott: /1\.1 Överskott 4 000 kr/.test(nbsp(send)),
  ink3r: sru.includes('#BLANKETT INK3R-'), ink3s: sru.includes('#BLANKETT INK3S-'), ink3suf: sru.includes('#BLANKETT INK3SUF-'),
  medlemSru: /#UPPGIFT 8650 30000/.test(sru), idrott: sru.includes('#UPPGIFT 8822 X'),
  skattepliktig: sru.includes('#UPPGIFT 8673 5000') && sru.includes('#UPPGIFT 8685 4000') && sru.includes('#UPPGIFT 8695 4000'),
  sparat: Object.values(stored).some(y => y?.org?.publicBenefit === true && y?.suf?.purposes?.sport === true),
};
console.log(JSON.stringify(checks), errors.length ? errors : '');
await browser.close();
process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
