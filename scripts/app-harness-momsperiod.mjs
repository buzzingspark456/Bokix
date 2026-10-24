// Kör: npx vite --port 5199, sedan node scripts/app-harness-momsperiod.mjs// Momsperiodsfrågan (VatPeriodPrompt.jsx) för befintliga företag som aldrig// valt momsperiod: visas, sparas, visas inte igen, och inte för bekräftade.
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
const results = {};
for (const [theme, confirmed] of [['light', false], ['dark', false], ['light', true]]) {
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
  Object.assign(company.company, { name: 'Testfirmans Nagelstudio', orgNr: '920927-3029', vatRegistered: true, vatNr: 'SE920927302901', fiscalYear: '2026-01-01', firstFiscalYear: null, vatPeriod: 'quarterly', setupConfirmedAt: confirmed ? '2026-10-23T10:00:00Z' : undefined, vatPeriodConfirmedAt: undefined, fSkatt: 'Innehar F-skattsedel', fSkattConfirmedAt: undefined,
    address: 'Storgatan 1', postalCode: '553 36', city: 'Jönköping', email: 'test@example.se', needsSetup: false });
  const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 400)); });
  await page.addInitScript(([key, val, th]) => { sessionStorage.setItem(key, val); localStorage.setItem('bokix_theme_pref', th); localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1'); }, [`sb-${REF}-auth-token`, JSON.stringify(session), theme]);
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

  const tag = `${theme}${confirmed ? '-bekraftad' : ''}${WIDTH < 600 ? '-telefon' : ''}`;
  const co = () => server.row.state.companies[id].company;
  const dialog = page.locator('[role=dialog][aria-labelledby=vpp-title]');
  await page.goto(BASE + '/?app=1');
  await page.waitForSelector('.app-container', { timeout: 25000 });
  await page.waitForTimeout(2500);
  const shown = await dialog.count() > 0;
  results[tag] = { shown };
  if (shown) {
    await page.screenshot({ path: `test-results/momsperiod-${tag}.png` });
    results[tag].sparaInaktiv = await dialog.locator('button:has-text("Spara")').isDisabled();
    results[tag].text = (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 220);
    await dialog.locator('[role=radio]:has-text("En gång per år")').click();
    results[tag].sparaInaktivEfterMoms = await dialog.locator('button:has-text("Spara")').isDisabled();
    await dialog.locator('[role=radio]:has-text("Nej")').click();
    await dialog.locator('button:has-text("Spara")').click();
    await page.waitForTimeout(3000);
    results[tag].sparat = { vatPeriod: co().vatPeriod, confirmed: Boolean(co().vatPeriodConfirmedAt), fSkatt: co().fSkatt, fSkattConfirmed: Boolean(co().fSkattConfirmedAt) };
    await page.reload();
    await page.waitForSelector('.app-container', { timeout: 25000 });
    await page.waitForTimeout(2500);
    results[tag].visasIgenEfterOmladdning = await dialog.count() > 0;
  }
  results[tag].errors = errors;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
