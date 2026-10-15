// Spelar in filmerna överst på funktionssidorna (scripts/hero-video/*.html)
// till public/videos/hero/<namn>.mp4 + <namn>.jpg (omslag). Scenerna är
// CSS-animationer på 10 s; skriptet pausar dem och stegar fram tiden bild
// för bild, så filmen blir jämn oavsett hur snabb datorn är.
// Kör: GUIDE_TOOLS=/c/tmp/guide-tools node scripts/render-hero-videos.mjs [namn]
// (GUIDE_TOOLS = mappen där ffmpeg-static ligger, samma som videoguiderna.)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'scripts', 'hero-video');
const outDir = path.join(root, 'public', 'videos', 'hero');
const tools = process.env.GUIDE_TOOLS || 'C:/tmp/guide-tools';
const ffmpeg = path.join(tools, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
if (!fs.existsSync(ffmpeg)) throw new Error(`Hittade inte ffmpeg i ${ffmpeg} (sätt GUIDE_TOOLS)`);
fs.mkdirSync(outDir, { recursive: true });

// Bokix-loggan fylls i där scenen har {{WORDMARK_PATH}}, som i bloggomslagen.
const wordmarkPath = fs.readFileSync(path.join(root, 'src/components/shared/BokixWordmark.jsx'), 'utf8').match(/const PATH_D = "([^"]+)"/)?.[1];
if (!wordmarkPath) throw new Error('Hittade inte PATH_D i BokixWordmark.jsx');

const FPS = 30;
const DURATION_MS = 10000;
const POSTER_MS = 8200; // allt syns, innan scenen tonar ut

const only = process.argv[2];
const scenes = fs.readdirSync(srcDir).filter(f => f.endsWith('.html') && !f.startsWith('.tmp-') && (!only || f === `${only}.html`));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 800 }, deviceScaleFactor: 1 });
for (const file of scenes) {
  const name = file.replace('.html', '');
  const frameDir = fs.mkdtempSync(path.join(outDir, `.frames-${name}-`));
  const tmp = path.join(srcDir, `.tmp-${file}`);
  fs.writeFileSync(tmp, fs.readFileSync(path.join(srcDir, file), 'utf8').replaceAll('{{WORDMARK_PATH}}', wordmarkPath));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const seek = (t) => page.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, t);
  const frames = Math.round((DURATION_MS / 1000) * FPS);
  for (let i = 0; i < frames; i++) {
    await seek((i * 1000) / FPS);
    await page.screenshot({ path: path.join(frameDir, `${String(i).padStart(4, '0')}.png`) });
  }
  await seek(POSTER_MS);
  const poster = path.join(outDir, `${name}.jpg`);
  await page.screenshot({ path: poster, type: 'jpeg', quality: 86 });
  const mp4 = path.join(outDir, `${name}.mp4`);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frameDir, '%04d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.unlinkSync(tmp);
  console.log('OK', name, Math.round(fs.statSync(mp4).size / 1024) + ' kB', Math.round(fs.statSync(poster).size / 1024) + ' kB omslag');
}
await browser.close();
