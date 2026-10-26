// Kör: npx vite --port 5199, sedan node scripts/shot-verktyg.mjs [suffix]
// Skärmbilder av /verktyg och varje verktygssida, ljust + mörkt, dator + telefon.
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:5199';
const SUF = process.argv[2] || 'fore';
const pages = ['', '/momskalkylator', '/egenavgifter', '/utdelning', '/rot-rut', '/lonekalkylator', '/drojsmalsranta', '/skanna-kvitto', '/momsdatum', '/arsredovisning'];
const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, 'dator'], [390, 844, 'telefon']]) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, ...(w < 600 ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
    await ctx.addInitScript((t) => { try { localStorage.setItem('bokix_theme_pref', t); } catch {} }, scheme);
    const page = await ctx.newPage();
    for (const p of pages) {
      await page.goto(`${BASE}/verktyg${p}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(500);
      // Skrolla igenom så alla Reveal-block hinner visas.
      for (let y = 0; y < 9000; y += 500) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(700);
      const name = (p.slice(1) || 'hub');
      await page.screenshot({ path: `test-results/verktyg/${name}-${tag}-${scheme}-${SUF}.png`, fullPage: tag === 'dator' });
    }
    await ctx.close();
  }
}
await browser.close();
console.log('klart');
