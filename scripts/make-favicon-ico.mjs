// Ritar favicon.ico med 16, 32 och 48 px (Bing och Edge vill ha 48 px eller
// en multipel av 48; den gamla filen hade bara 32 px). Bilderna ritas ur
// public/favicon.svg i Chromium och packas som PNG i en .ico.
// Kör: node scripts/make-favicon-ico.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = path.join(root, 'public', 'favicon.svg');
const SIZES = [16, 32, 48];

const browser = await chromium.launch();
const pngs = [];
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  // SVG:n öppnas direkt (width/height 100 %), så den fyller hela rutan.
  await page.goto(pathToFileURL(svg).href);
  pngs.push(await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
  await page.close();
}
await browser.close();

// ICO: 6 byte huvud, 16 byte per bild, sedan PNG-datan.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(SIZES.length, 4);
let offset = 6 + 16 * SIZES.length;
const entries = SIZES.map((size, i) => {
  const e = Buffer.alloc(16);
  e[0] = size; e[1] = size; e[2] = 0; e[3] = 0;
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});
const ico = Buffer.concat([header, ...entries, ...pngs]);
for (const name of ['favicon.ico', 'favicon-v3.ico']) {
  fs.writeFileSync(path.join(root, 'public', name), ico);
  console.log('Skrev', name, ico.length, 'bytes,', SIZES.join('/'), 'px');
}
