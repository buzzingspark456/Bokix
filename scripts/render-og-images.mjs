// Ritar en delningsbild (og:image, 1200×630) per marknadssida till
// public/og/<namn>.jpg, utifrån src/content/marketing/ogImages.js.
// Samma stil på alla: mörkgrön bakgrund, Bokix-loggan, sidans rubrik till
// vänster och ett kort med sidans viktigaste punkter till höger.
// Kör: node scripts/render-og-images.mjs [sökväg] (utan argument ritas alla om)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'og');
fs.mkdirSync(outDir, { recursive: true });
const { OG_PAGES } = await import(pathToFileURL(path.join(root, 'src/content/marketing/ogImages.js')).href);

const wordmarkSrc = fs.readFileSync(path.join(root, 'src/components/shared/BokixWordmark.jsx'), 'utf8');
const wordmarkPath = wordmarkSrc.match(/const PATH_D = "([^"]+)"/)?.[1];
if (!wordmarkPath) throw new Error('Hittade inte PATH_D i BokixWordmark.jsx');

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function html({ eyebrow, title, items }) {
  // Lång rubrik: mindre text, så att den alltid får plats på tre rader.
  const size = title.length > 44 ? 50 : title.length > 30 ? 58 : 66;
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body { font-family: 'Inter', 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
.art { position: relative; width: 1200px; height: 630px; overflow: hidden; background: linear-gradient(135deg, #0a1912 0%, #0e2018 55%, #0c1c2a 100%); }
.blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.22; }
.b1 { width: 520px; height: 520px; left: -160px; top: -200px; background: #0ea5e9; }
.b2 { width: 560px; height: 560px; right: -180px; bottom: -260px; background: #84cc16; }
.b3 { width: 380px; height: 380px; right: 260px; top: -180px; background: #14b8a6; opacity: 0.16; }
.wm { position: absolute; left: 72px; top: 64px; height: 50px; width: auto; }
.left { position: absolute; left: 72px; top: 168px; width: 560px; }
.eyebrow { font-size: 17px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8fd99a; margin-bottom: 18px; }
h1 { font-family: Georgia, 'Times New Roman', serif; font-size: ${size}px; line-height: 1.08; font-weight: 700; color: #f2f6ef; letter-spacing: -0.01em; }
.site { position: absolute; left: 72px; bottom: 58px; font-size: 19px; font-weight: 600; color: rgba(242, 246, 239, 0.62); }
.card { position: absolute; right: 72px; top: 50%; transform: translateY(-50%); width: 430px; padding: 30px 30px 24px; border-radius: 26px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.13); box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.6); }
.row { display: flex; align-items: center; gap: 15px; padding: 15px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 21px; font-weight: 600; color: #eef3ea; line-height: 1.25; }
.row:first-child { border-top: 0; padding-top: 4px; }
.row i { flex: none; width: 30px; height: 30px; border-radius: 50%; background: rgba(132, 204, 22, 0.18) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.5 12.5l3.6 3.6 7.4-8' fill='none' stroke='%239be37a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/70% no-repeat; }
</style></head><body><div class="art">
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<svg class="wm" viewBox="0 0 125 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0ea5e9"/><stop offset="50%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#84cc16"/></linearGradient></defs><path d="${wordmarkPath}" fill="url(#g)"/></svg>
<div class="left"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1></div>
<div class="site">www.bokix.se</div>
<div class="card">${items.map(it => `<div class="row"><i></i>${esc(it)}</div>`).join('')}</div>
</div></body></html>`;
}

const only = process.argv[2];
const entries = Object.entries(OG_PAGES).filter(([p]) => !only || p === only);
if (!entries.length) throw new Error(`Ingen sida i ogImages.js matchar ${only}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const tmp = path.join(outDir, '.tmp-og.html');
for (const [p, cfg] of entries) {
  fs.writeFileSync(tmp, html(cfg));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Rubriken får inte gå utanför sin yta: krymp tills den ryms.
  await page.evaluate(() => {
    const h = document.querySelector('h1');
    let size = parseFloat(getComputedStyle(h).fontSize);
    while (h.getBoundingClientRect().bottom > 520 && size > 34) { size -= 2; h.style.fontSize = size + 'px'; }
  });
  const out = path.join(outDir, `${cfg.file}.jpg`);
  await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
  console.log('OK', p, '->', path.relative(root, out), Math.round(fs.statSync(out).size / 1024) + ' kB');
}
fs.unlinkSync(tmp);
await browser.close();
