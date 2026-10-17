// Kör: npx vite --port 5199, sedan node scripts/app-harness-projekt-lager.mjs [bredd]
// Skärmbilder av Projekt, Tidrapportering, Artiklar, Lager och Prissättning
// med demoföretaget, i ljust och mörkt läge. Bilderna hamnar i test-results/pl-*.
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
  await p0.close();
  company.company.enabledFeatures = { ...(company.company.enabledFeatures || {}), articles: true, projects: true };
  // Två varor med inleveranser och uttag, så att lagret och FIFO-partierna syns.
  company.articles = [...(company.articles || []),
    { id: 'kaffe', type: 'vara', description: 'Kaffebönor 1 kg', articleNumber: 'K-100', unitPrice: 189, purchasePrice: 95, unit: 'st', vatRate: 12, account: '3001' },
    { id: 'mugg', type: 'vara', description: 'Termosmugg', articleNumber: 'M-200', unitPrice: 249, purchasePrice: 120, unit: 'st', vatRate: 25, account: '3001' },
    { id: 'test', type: 'vara', description: 'test', unitPrice: 0, unit: 'st', vatRate: 25, account: '3001' }];
  company.company.inventorySettings = { method: 'fifo', accountKind: 'handelsvaror', lowestValue: true, reorderPoints: { kaffe: 20, mugg: 10 } };
  company.company.stockMovements = [
    { id: 'm1', articleId: 'kaffe', type: 'in', date: '2026-08-04', qty: 40, unitCost: 92 },
    { id: 'm2', articleId: 'kaffe', type: 'in', date: '2026-09-15', qty: 30, unitCost: 98 },
    { id: 'm3', articleId: 'kaffe', type: 'out', date: '2026-10-02', qty: 52 },
    { id: 'm4', articleId: 'mugg', type: 'in', date: '2026-09-01', qty: 24, unitCost: 120 },
    { id: 'm5', articleId: 'mugg', type: 'out', date: '2026-10-10', qty: 6 },
    { id: 'm6', articleId: 'test', type: 'out', date: '2026-10-12', qty: 2 }];
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
  await page.waitForFunction(() => document.body.innerText.includes('Räkenskapsåret'), null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  const tag = `${W}${dark ? '-dark' : ''}`;
  const shot = async (name, full = true) => { await page.waitForTimeout(900); await page.screenshot({ path: `test-results/pl-${name}-${tag}.png`, fullPage: full }); };
  const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(1400); };
  const tab = async (label) => { await page.locator('button:visible, [role=tab]:visible', { hasText: label }).first().click().catch(() => {}); await page.waitForTimeout(800); };
  await steps({ page, shot, go, tab });
  console.log(dark ? '[mörkt]' : '[ljust]', errors.length ? errors : 'OK');
  if (errors.length) failed = true;
  await ctx.close();
}

for (const dark of [false, true]) {
  await run(dark, async ({ page, shot, go, tab }) => {
    if (!ONLY || ONLY === 'projekt') {
      await go('projects'); await shot('projekt');
      const open = page.locator('.pj-card:not(.pj-card-new):visible, table.responsive-table tbody tr:visible').first();
      if (await open.count()) { await open.click(); await page.waitForTimeout(1000); await shot('projekt-detalj'); }
    }
    if (!ONLY || ONLY === 'tid') {
      await go('time'); await shot('tid');
      // Skriv 2 timmar i första tomma rutan: veckan ska gå från 40 till 42 h.
      if (W >= 640) {
        const empty = page.locator('input.tt-cell:not(.has)').first();
        await empty.fill('2'); await empty.press('Enter'); await page.waitForTimeout(400);
        const ok = await page.locator('tfoot .tt-sum').innerText();
        console.log('vecka efter inmatning:', ok.trim(), ok.includes('42') ? 'OK' : 'FEL');
        if (!ok.includes('42')) failed = true;
      }
      await page.locator('.ws-seg button:visible', { hasText: 'Månadsrapporter' }).first().click(); await page.waitForTimeout(600); await shot('manad');
      await page.locator('.tr-cal-day.has').first().click(); await shot('manad-dag'); await page.locator('h2', { hasText: 'Godkännande' }).first().scrollIntoViewIfNeeded().catch(() => {}); await shot('godkann', false); await page.locator('.tr-approval .agi-btn.primary').first().click(); await page.waitForTimeout(300); await shot('godkann-steg', false);
    }
    if (!ONLY || ONLY === 'lager') {
      await go('articles'); await shot('artiklar');
      await tab('Lager'); await shot('lager');
      await page.locator('button.lg-row:visible').first().click().catch(() => {}); await shot('lager-detalj', false); await page.locator('.modal-close:visible').first().click().catch(() => {}); await page.locator('button.lg-row:visible', { hasText: 'test' }).first().scrollIntoViewIfNeeded(); await shot('lager-rader', false); await page.locator('button.lg-row:visible', { hasText: 'test' }).first().click(); await shot('lager-test', false); await page.locator('.modal-close:visible').first().click().catch(() => {});
      await page.locator('button:visible', { hasText: 'Inleverans' }).last().click().catch(() => {}); await shot('lager-handelse', false); await page.keyboard.press('Escape'); await page.locator('.modal-close:visible').first().click().catch(() => {});
      await tab('Prissättning'); await shot('pris');
    }
  });
}
await browser.close();
process.exit(failed ? 1 : 0);
