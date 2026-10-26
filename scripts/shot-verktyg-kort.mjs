// Kör: npx vite --port 5199, sedan node scripts/shot-verktyg-kort.mjs <slug> <light|dark> [suffix]
// Skärmbild av bara räknaren (överst på verktygssidan), i full storlek.
import { chromium } from '@playwright/test';
const [slug = 'momskalkylator', scheme = 'light', suf = 'kort'] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: 'http://localhost:5199' }]);
await ctx.addInitScript((t) => { try { localStorage.setItem('bokix_theme_pref', t); } catch {} }, scheme);
const page = await ctx.newPage();
await page.goto(`http://localhost:5199/verktyg/${slug}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `test-results/verktyg/${slug}-${scheme}-${suf}.png` });
await browser.close();
