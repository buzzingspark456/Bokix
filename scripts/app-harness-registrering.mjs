// Kör: npx vite --port 5199, sedan node scripts/app-harness-registrering.mjs
// Registreringen (Auth.jsx) efter 2026-10-24: tre steg (uppgifter, kod,
// lösenord), koden kontrolleras av sig själv vid sjätte siffran, och inget
// företag frågas (det gör onboardingen). Kodutskicket, Supabase och Stripe
// är låtsade; kollar vad som skickas till signUp. WIDTH=390 för telefon.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const WIDTH = Number(process.env.WIDTH || 1440);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).map(l => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
const SUPA = env.VITE_SUPABASE_URL.replace(/\/$/, '');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, ...(WIDTH < 600 ? { isMobile: true, hasTouch: true } : {}) });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
const page = await ctx.newPage();
const errors = [];
const calls = [];
let signUpBody = null;
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
await page.route('**/challenges.cloudflare.com/**', r => r.abort());
await page.route(`${SUPA}/**`, async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/auth/v1/signup') {
    signUpBody = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ json: { id: '22222222-2222-4222-8222-222222222222', email: signUpBody.email, user_metadata: signUpBody.data } });
  }
  return route.fulfill({ json: {} });
});
await page.route('**/api/**', async (r) => {
  const body = JSON.parse(r.request().postData() || '{}');
  calls.push(body.action || r.request().url().replace(/^.*\/api\//, ''));
  if (body.action === 'send-signup-code') return r.fulfill({ json: { token: 'signerad' } });
  if (body.action === 'verify-signup-code') {
    await new Promise(res => setTimeout(res, 300));
    return body.code === '123456' ? r.fulfill({ json: { ok: true } }) : r.fulfill({ status: 400, json: { error: 'Fel kod. Försök igen.' } });
  }
  if (r.request().url().includes('/api/stripe/')) return r.fulfill({ json: { session: { url: `${BASE}/?stripe=klart` } } });
  return r.fulfill({ json: {} });
});

const shot = async (name) => { await page.waitForTimeout(400); await page.screenshot({ path: `test-results/reg-${name}${WIDTH < 600 ? '-telefon' : ''}.png`, fullPage: true }); };
const result = {};

await page.goto(BASE + '/?app=1');
await page.locator('button:has-text("Nytt konto")').click();
result.steg = (await page.locator('form').locator('xpath=..').locator('span').allInnerTexts()).filter(s => /^(Personlig info|Bekräfta e-post|Företag|Lösenord)$/.test(s));
await page.locator('input[name="given-name"]').fill('Anna');
await page.locator('input[name="family-name"]').fill('Svensson');
await page.locator('input[type="email"]').fill('anna@example.se');
await shot('1-uppgifter');
await page.locator('button[type="submit"]').click();
await page.waitForSelector('input[autocomplete="one-time-code"]', { timeout: 8000 });
await shot('2-kod');
// Fel kod först: ska visa felet och stanna kvar.
await page.locator('input[autocomplete="one-time-code"]').pressSequentially('111111', { delay: 40 });
await page.waitForTimeout(1200);
result.felKod = await page.locator('form').innerText().then(s => /Fel kod/.test(s));
await page.locator('input[autocomplete="one-time-code"]').fill('');
await page.locator('input[autocomplete="one-time-code"]').pressSequentially('123456', { delay: 40 });
await page.waitForSelector('input[name="new-password"]', { timeout: 8000 });
result.autoVidareEfterKod = true;
await shot('3-losenord');
await page.locator('input[name="new-password"]').fill('Langt-losenord-2026');
await page.locator('input[name="confirm-password"]').fill('Langt-losenord-2026');
await page.locator('input[type="checkbox"]').check();
await page.locator('button[type="submit"]').click();
await page.waitForURL(/stripe=klart/, { timeout: 30000 }).catch(() => {});
result.tillStripe = page.url().includes('stripe=klart');
result.metadata = signUpBody?.data;
result.anrop = calls;
result.errors = errors;
await browser.close();
console.log(JSON.stringify(result, null, 2));
