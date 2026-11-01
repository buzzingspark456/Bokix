// Kör: npx vite --port 5199, sedan node scripts/app-harness-periodisering.mjs [bredd] [periodisering|anlaggning]
// Skärmbilder av Periodiseringar och Anläggningstillgångar under Bokföring, ljust och mörkt. Bilderna: test-results/pa-*.
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

const W = Number(process.argv[2] || 1440);
const ONLY = process.argv[3] || '';
const browser = await chromium.launch();
let failed = false;

async function run(dark, steps) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, colorScheme: dark ? 'dark' : 'light', ...(W < 600 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  const p0 = await ctx.newPage();
  await p0.goto(`${BASE}/scripts/ocr-harness.html`);
  const company = await p0.evaluate(async () => {
    const { createDemoSeed } = await import('/src/utils/landingDemoData.js');
    return JSON.parse(JSON.stringify(createDemoSeed()));
  });
  company.company.enabledFeatures = { ...(company.company.enabledFeatures || {}), accruals: true, fixed_assets: true };
  if (!process.env.EMPTY) {
    company.company.accruals = [
      { id: 'a1', kind: 'prepaid_expense', description: 'Hyra januari 2027', date: '2026-12-31', amount: 12000, counterAccount: '5010', reversalDate: '2027-01-01' },
      { id: 'a2', kind: 'accrued_expense', description: 'Revisor, bokslut 2025', date: '2025-12-31', amount: 8500, counterAccount: '6530', reversalDate: '2026-01-01' },
      { id: 'a3', kind: 'accrued_income', description: 'Konsulttimmar december', date: '2025-12-31', amount: 24000, counterAccount: '3001', reversalDate: '2026-01-01' },
    ];
    company.company.fixedAssets = [
      { id: 'f1', name: 'MacBook Pro 14', category: 'dator', acquisitionDate: '2025-03-12', cost: 32000, residualValue: 0, usefulLifeMonths: 36, assetAccount: '1224', accumulatedAccount: '1229', expenseAccount: '7832' },
      { id: 'f2', name: 'Kontorsmöbler', category: 'inventarier', acquisitionDate: '2024-09-01', cost: 48000, residualValue: 0, usefulLifeMonths: 60, assetAccount: '1220', accumulatedAccount: '1229', expenseAccount: '7832' },
      { id: 'f3', name: 'Skrivare', category: 'inventarier', acquisitionDate: '2023-02-01', cost: 9000, residualValue: 0, usefulLifeMonths: 60, assetAccount: '1220', accumulatedAccount: '1229', expenseAccount: '7832', disposedDate: '2026-05-10', disposalProceeds: 2000 },
    ];
    // a1 bokförd, a2 bokförd och återförd, a3 bokförd men återföringen väntar (Att göra).
    const built = await p0.evaluate(async (list) => {
      const m = await import('/src/utils/accruals.js');
      return [m.buildAccrualVerification(list[0]), m.buildAccrualVerification(list[1]), m.buildReversalVerification(list[1]), m.buildAccrualVerification(list[2])];
    }, company.company.accruals);
    company.verifications = [...(company.verifications || []), ...built.map((v, i) => ({ ...v, id: 'accv' + i, series: 'A', number: 900 + i, status: 'booked', createdAt: '2026-01-01T00:00:00Z' }))];
  }
  await p0.close();
  const id = company.company.id;
  const server = { row: { id: 'r1', user_id: UID, state: { activeCompanyId: id, companies: { [id]: company } }, updated_at: newTs(), onboarding_completed: true, onboarding_skipped: false, company_name: company.company.name } };

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && process.env.CONSOLE) Promise.all(m.args().map(a => a.evaluate(v => (v && v.stack) || String(v)).catch(() => '?'))).then(xs => console.log('console:', xs.join(' | ').slice(0, 700))); });
  await page.addInitScript(([key, val, theme]) => {
    sessionStorage.setItem(key, val);
    localStorage.setItem('bokix_tour_done_v3_11111111-1111-4111-8111-111111111111', '1');
    localStorage.setItem('bokix_theme_pref', theme);
  }, [`sb-${REF}-auth-token`, JSON.stringify(session), dark ? 'dark' : 'light']);
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
  await page.goto(BASE + '/?app=1');
  await page.waitForFunction(() => document.body.innerText.includes('Att göra'), null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  const tag = `${W}${dark ? '-dark' : ''}`;
  const shot = async (name, full = true) => { await page.waitForTimeout(900); await page.screenshot({ path: `test-results/pa-${name}-${tag}.png`, fullPage: full }); };
  const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(1400); };
  const tab = async (label) => { await page.locator('button:visible, [role=tab]:visible', { hasText: label }).first().click().catch(() => {}); await page.waitForTimeout(800); };
  await steps({ page, shot, go, tab });
  console.log(dark ? '[mörkt]' : '[ljust]', errors.length ? errors : 'OK');
  if (errors.length) failed = true;
  await ctx.close();
}

for (const dark of [false, true]) {
  await run(dark, async ({ page, shot, go, tab }) => {
    if (!ONLY || ONLY === 'periodisering') {
      await go('verifications'); await page.evaluate((l) => { const b = [...document.querySelectorAll('button, [role=tab]')].find(e => e.textContent.trim() === l && e.offsetParent); b?.scrollIntoView({ inline: 'center' }); b?.click(); }, 'Periodiseringar'); await page.waitForTimeout(900); await shot('periodisering');
      await page.locator('button:visible', { hasText: 'Ny periodisering' }).first().click().catch(() => {}); await shot('periodisering-ny', false);
      await page.keyboard.press('Escape'); await page.locator('button:visible', { hasText: 'Avbryt' }).first().click().catch(() => {});
    }
    if (!ONLY || ONLY === 'anlaggning') {
      await go('verifications'); await page.evaluate((l) => { const b = [...document.querySelectorAll('button, [role=tab]')].find(e => e.textContent.trim() === l && e.offsetParent); b?.scrollIntoView({ inline: 'center' }); b?.click(); }, 'Anläggningstillgångar'); await page.waitForTimeout(900); await shot('anlaggning');
      await page.locator('button:visible', { hasText: 'Ny tillgång' }).first().click().catch(() => {}); await shot('anlaggning-ny');
      await page.locator('button:visible', { hasText: /Tillbaka|Avbryt/ }).first().click().catch(() => {}); await page.waitForTimeout(400);
      await page.getByText('MacBook Pro 14', { exact: true }).first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(600); await shot('anlaggning-detalj');
    }
  });
}
await browser.close();
process.exit(failed ? 1 : 0);
