// Kör: npx vite --port 5199, sedan DATA=svar.json node scripts/app-harness-internal.mjs
// /internal mot fejkad inloggning; DATA är en JSON-fil { overview, users, customer, ... }
// med svaren som api/admin ska ge. STEPS="shot:x|tap:.css|click:Text|esc", WIDTH, THEME, FULL=1.
import { chromium } from '@playwright/test';
import fs from 'fs';
const BASE = 'http://localhost:5199';
const WIDTH = Number(process.env.WIDTH || 1440);
const DATA = JSON.parse(fs.readFileSync(process.env.DATA, 'utf8'));
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const REF = new URL(SUPA).hostname.split('.')[0];
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'alwakiabdullah1@gmail.com', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.c2lnbmF0dXJl`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, ...(WIDTH < 600 ? { isMobile: true, hasTouch: true } : {}), colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light' });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => { errors.push(String(e).slice(0, 300)); console.log('PAGEERROR', String(e.stack || e).slice(0, 600)); });
page.on('console', async m => { if (m.type() === 'error') { const a = await Promise.all(m.args().map(x => x.evaluate(v => v instanceof Error ? v.stack : String(v)).catch(() => '?'))); console.log('CONSOLE', a.join(' ').slice(0, 800)); } });
await page.addInitScript(([key, val, th]) => { sessionStorage.setItem(key, val); localStorage.setItem(key, val); localStorage.setItem('bokix_theme_pref', th); }, [`sb-${REF}-auth-token`, JSON.stringify(session), process.env.THEME || 'light']);
await page.route(`${SUPA}/**`, r => { const p = new URL(r.request().url()).pathname; if (p.startsWith('/auth/v1/user')) return r.fulfill({ json: user }); if (p.startsWith('/auth/v1/token')) return r.fulfill({ json: session }); return r.fulfill({ json: {} }); });
await page.route('**/api/**', r => r.fulfill({ json: {} }));
await page.route('**/api/admin**', r => { const q = new URL(r.request().url()).searchParams.get('resource'); r.fulfill({ json: DATA[q] || {} }); });
await page.goto(BASE + '/internal');
await page.waitForTimeout(3000);
const tag = `${WIDTH}-${process.env.THEME || 'light'}`;
for (const step of (process.env.STEPS || 'shot:ix').split('|')) {
  const [cmd, ...rest] = step.split(':'); const arg = rest.join(':');
  if (cmd === 'click') { await page.getByText(arg, { exact: false }).locator('visible=true').first().click(); await page.waitForTimeout(1200); }
  else if (cmd === 'tap') { await page.locator(arg).locator('visible=true').first().click(); await page.waitForTimeout(1200); }
  else if (cmd === 'shot') await page.screenshot({ path: `test-results/ix-${tag}-${arg}.png`, fullPage: process.env.FULL === '1' });
  else if (cmd === 'esc') { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
}
console.log(JSON.stringify({ errors }));
await browser.close();
