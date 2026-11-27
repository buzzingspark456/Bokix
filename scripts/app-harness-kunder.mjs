// Kör: npx vite --port 5173, sedan node scripts/app-harness-kunder.mjs (MENU=1 meny och flerval, FULL=1 hela sidan)
// Kunder och leverantörer: lista, flikar, ⋮-meny, flerval och nytt kundformulär.
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
await page.addInitScript(() => { localStorage.setItem('bokix.devPlan', 'trade_monthly'); const s = () => { const st = document.createElement('style'); st.textContent = '.dev-plan{display:none!important}'; document.head.appendChild(st); }; if (document.head) s(); else document.addEventListener('DOMContentLoaded', s); });
await page.goto(BASE + '/?app=1#contacts');
await page.waitForTimeout(5000);
const tag = '-' + WIDTH + (process.env.DARK ? '-dark' : '');
const shot = async (n) => { await page.waitForTimeout(600); await page.screenshot({ path: `test-results/kunder-${n}${tag}.png`, fullPage: Boolean(process.env.FULL) }); };
await shot('lista');
const supTab = page.locator('[role=tab], .lph-inline-tab, button', { hasText: /^Leverantörer/ }).first();
if (await supTab.isVisible().catch(() => false)) { await supTab.click(); await shot('leverantorer'); }
const cusTab = page.locator('[role=tab], .lph-inline-tab, button', { hasText: /^Kunder/ }).first();
if (await cusTab.isVisible().catch(() => false)) { await cusTab.click(); await page.waitForTimeout(500); }
if (process.env.MENU) {
  const menu = page.locator('.main-content-inner button[aria-label^="Åtgärder"], .main-content-inner .row-action-trigger, .main-content-inner button[aria-haspopup]').first();
  if (await menu.isVisible().catch(() => false)) { await menu.click(); await shot('meny'); await page.keyboard.press('Escape'); }
  const boxes = page.locator('.main-content-inner tbody input[type=checkbox]');
  if (await boxes.count() > 1) { await boxes.nth(0).check(); await boxes.nth(1).check(); await shot('flerval');
  const del = page.locator('.ct-bulk-del').first();
  if (await del.isVisible().catch(() => false)) { await del.click(); await page.waitForTimeout(500); await shot('bulk-ta-bort'); const dlg = page.locator('.confirm-dialog-overlay').last(); console.log('dialog:', (await dlg.innerText().catch(() => '')).replace(/s+/g, ' ').slice(0, 220)); await dlg.locator('button').last().click().catch(() => {}); await page.waitForTimeout(600); console.log('aktiva kvar:', await page.locator('.cf-chips button.on').first().innerText().catch(() => '?')); await shot('efter-bulk'); }  }
}
const ny = page.locator('button', { hasText: /Ny kund/ }).first();
if (await ny.isVisible().catch(() => false)) { await ny.click(); await shot('ny-kund'); console.log('kund skroll:', await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.querySelector && e.querySelector('form.ctf') && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); return el ? { synligt: el.clientHeight, totalt: el.scrollHeight } : null; })); }
const back = page.locator('.mform-back').first(); if (await back.isVisible().catch(() => false)) { await back.click(); await page.waitForTimeout(500); }
const st = page.locator('[role=tab], .lph-inline-tab, button', { hasText: /^Leverantörer/ }).first();
if (await st.isVisible().catch(() => false)) { await st.click(); await page.waitForTimeout(500); }
const nyl = page.locator('button', { hasText: /Ny leverantör/ }).first();
if (await nyl.isVisible().catch(() => false)) { await nyl.click(); await shot('ny-leverantor'); }
const sh = await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.querySelector && e.querySelector('form.ctf') && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); return el ? { synligt: el.clientHeight, totalt: el.scrollHeight } : null; });
console.log('leverantör skroll:', sh);
console.log('fel:', errors.length ? errors : 'inga');
await browser.close();
