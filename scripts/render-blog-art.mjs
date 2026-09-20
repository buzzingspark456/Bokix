// Renderar bloggens omslagsbilder (scripts/blog-art/*.html) till JPG i
// public/blog/. Bilderna används som omslag på artikeln, kort i /blogg och
// delningsbild (og:image), så de ska vara riktiga bilder och inte skärmdumpar.
// Kör: node scripts/render-blog-art.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artDir = path.join(root, 'scripts', 'blog-art');
const outDir = path.join(root, 'public', 'blog');

const wordmarkSrc = fs.readFileSync(path.join(root, 'src/components/shared/BokixWordmark.jsx'), 'utf8');
const wordmarkPath = wordmarkSrc.match(/const PATH_D = "([^"]+)"/)?.[1];
if (!wordmarkPath) throw new Error('Hittade inte PATH_D i BokixWordmark.jsx');

const pages = fs.readdirSync(artDir).filter(f => f.endsWith('.html') && !f.startsWith('.tmp-'));
const browser = await chromium.launch();
for (const file of pages) {
  const html = fs.readFileSync(path.join(artDir, file), 'utf8').replaceAll('{{WORDMARK_PATH}}', wordmarkPath);
  const tmp = path.join(artDir, `.tmp-${file}`);
  fs.writeFileSync(tmp, html);
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const out = path.join(outDir, file.replace('.html', '.jpg'));
  await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
  await ctx.close();
  fs.unlinkSync(tmp);
  console.log('OK', path.relative(root, out), Math.round(fs.statSync(out).size / 1024) + ' kB');
}
await browser.close();
