// Komprimerar en bild utan ffmpeg: ritar om den i Chromium (canvas) och
// sparar JPG eller WebP. Används för blogomslag och skärmbilder.
// Kör: node scripts/compress-image.mjs <in> <ut.jpg|ut.webp> [maxbredd] [kvalitet 0-1]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [input, output, maxWidthArg, qualityArg] = process.argv.slice(2);
if (!input || !output) {
  console.error('Användning: node scripts/compress-image.mjs <in> <ut> [maxbredd] [kvalitet]');
  process.exit(1);
}
const maxWidth = Number(maxWidthArg) || 0;
const quality = Number(qualityArg) || 0.72;
const type = output.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
const ext = path.extname(input).slice(1).replace('jpg', 'jpeg');
const dataUrl = `data:image/${ext};base64,${fs.readFileSync(input).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(async ({ dataUrl, maxWidth, quality, type }) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = maxWidth && img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL(type, quality), w: canvas.width, h: canvas.height };
}, { dataUrl, maxWidth, quality, type });
await browser.close();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.from(result.url.split(',')[1], 'base64'));
console.log('OK', output, `${result.w}x${result.h}`, Math.round(fs.statSync(output).size / 1024) + ' kB');
