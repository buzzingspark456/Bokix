// Renderar scripts/blog-art/<name>.html till public/blog/<name>.jpg, 1200x630
// (2x deviceScaleFactor för skärpa) — samma mönster som enkel-bokforing-,
// sie4- och uf-heroerna. Kör: node scripts/blog-art/render-hero.cjs <namn> [ut-namn]
// Kräver Playwright (redan en devDependency, npx playwright install chromium
// vid behov).
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ROOT = 'C:/Users/alwak/OneDrive/code/code/bokforing-app';

async function main() {
  const [, , name, outName] = process.argv;
  if (!name) { console.error('usage: node render-hero.cjs <html-basename> [out-basename]'); process.exit(1); }
  const htmlPath = path.join(ROOT, 'scripts', 'blog-art', `${name}.html`);
  const outPath = path.join(ROOT, 'public', 'blog', `${outName || name}.jpg`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));
  await page.waitForTimeout(300); // låt Google Fonts hinna ladda
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });
  await browser.close();
  console.log('Skrev', outPath, fs.statSync(outPath).size, 'bytes');
}
main();
