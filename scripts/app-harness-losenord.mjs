// Kör: npx vite --port 5199, sedan node scripts/app-harness-losenord.mjs
// Riktiga appen mot en fejkad Supabase: en klickad återställningslänk ska ge
// rutan för nytt lösenord och kunna spara det, både i en webbläsare som använts
// nyss och i en som inte använts på över 30 dagar (då loggas man annars ut).
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const UID = '11111111-1111-4111-8111-111111111111';
const user = { id: UID, email: 'test@example.se', aud: 'authenticated', role: 'authenticated', user_metadata: { first_name: 'Test' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp, amr: [{ method: 'otp', timestamp: exp - 3600 }] })}.c2lnbmF0dXJl`;
const DAY = 86400000;

const browser = await chromium.launch();
let failed = false;

async function run(name, lastActive, { reload = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
  const page = await ctx.newPage();
  const errors = [];
  const server = { passwordSaved: false, logouts: 0 };
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await page.addInitScript((value) => {
    if (value && !sessionStorage.getItem('harness_seeded')) {
      localStorage.setItem('bokix_last_active', String(value));
      sessionStorage.setItem('harness_seeded', '1');
    }
  }, lastActive);
  await page.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (url.pathname === '/auth/v1/user' && req.method() === 'PUT') { server.passwordSaved = true; return route.fulfill({ json: user }); }
    if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (url.pathname.startsWith('/auth/v1/logout')) { server.logouts++; return route.fulfill({ status: 204, body: '' }); }
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: {} });
    if (url.pathname.startsWith('/storage/')) return route.fulfill({ json: [] });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
    return route.fulfill({ status: 200, contentType: 'application/json', body: wantsObject ? 'null' : '[]' });
  });
  await page.route('**/api/**', r => r.fulfill({ json: {} }));

  await page.goto(`${BASE}/#access_token=${jwt}&refresh_token=r&expires_in=3600&expires_at=${exp}&token_type=bearer&type=recovery`);
  await page.locator('input[autocomplete="new-password"]').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  if (reload) {
    await page.reload();
    await page.locator('input[autocomplete="new-password"]').first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  const fields = page.locator('input[autocomplete="new-password"]');
  const shown = await fields.count() === 2;
  let screenError = '';
  if (shown) {
    await fields.nth(0).fill('nyttlosenord123');
    await fields.nth(1).fill('nyttlosenord123');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(1500);
    if (!server.passwordSaved) screenError = (await page.evaluate(() => document.querySelector('form')?.innerText || '')).split('\n').filter(l => /session|fel|kunde|länk/i.test(l)).join(' | ');
  }
  const ok = server.passwordSaved && !errors.length;
  console.log(`[${name}]`, ok ? 'OK' : 'FEL', JSON.stringify({ rutanVisas: shown, sparat: server.passwordSaved, utloggningar: server.logouts, felPaSkarmen: screenError, sidfel: errors }));
  if (!ok) failed = true;
  await ctx.close();
}

await run('använd nyss', Date.now() - DAY);
await run('oanvänd i 45 dagar', Date.now() - 45 * DAY);
await run('ingen tidsstämpel', null);
await run('laddar om sidan', Date.now() - DAY, { reload: true });

await browser.close();
process.exit(failed ? 1 : 0);
