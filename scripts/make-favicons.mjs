// Ritar alla ikoner ur public/favicon.svg. Samma ikon i ljust och mörkt läge:
// mörkgrön ruta med rundade hörn, som den ursprungliga (användaren 2026-10-31).
// Små storlekar får ett något större och tjockare B (zoom = B:ets del av rutan,
// tjocklek i SVG:ns enheter), men bakgrunden ska alltid synas runt det.
// Bing och Edge vill ha 48 px eller en multipel av 48, därför 16/32/48 i .ico.
// Kör: node scripts/make-favicons.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (name) => path.join(root, 'public', name);
const svg = fs.readFileSync(pub('favicon.svg'), 'utf8');
const B_SIZE = 885; // B:ets höjd i SVG:ns enheter

const ZOOM = { 16: [0.72, 14], 32: [0.66, 8], 48: [0.62, 4], 96: [0.58, 0], 480: [0.58, 0] };
const OUTPUTS = [
  ...[16, 32, 48, 96, 480].map((size) => ({ name: `favicon-${size}x${size}-v4.png`, size, zoom: ZOOM[size] })),
  // iOS och Android rundar hörnen själva: en genomskinlig kant hade blivit svart.
  { name: 'apple-touch-icon.png', size: 180, zoom: [0.58, 0], square: true },
  { name: 'icon-192.png', size: 192, zoom: [0.58, 0] },
  { name: 'icon-512.png', size: 512, zoom: [0.58, 0] },
  // Android beskär maskable-ikoner till 80 %, så B:et måste hålla sig innanför.
  { name: 'icon-maskable-512.png', size: 512, zoom: [0.5, 0], square: true },
];

const browser = await chromium.launch();
const render = async ({ size, square, zoom: [zoom, stroke] }) => {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const scale = (zoom * 1254) / B_SIZE;
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.evaluate(({ scale, stroke, square }) => {
    const b = document.getElementById('bokstav');
    b.setAttribute('transform', `translate(627 627) scale(${scale}) translate(-613.5 -597.5)`);
    b.setAttribute('stroke-width', String(stroke / scale));
    if (square) document.getElementById('bakgrund').setAttribute('rx', '0');
  }, { scale, stroke, square });
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: true });
  await page.close();
  return png;
};

const rendered = {};
for (const output of OUTPUTS) {
  rendered[output.name] = await render(output);
  fs.writeFileSync(pub(output.name), rendered[output.name]);
  console.log('Skrev', output.name);
}
await browser.close();

// ICO: 6 byte huvud, 16 byte per bild, sedan PNG-datan.
const SIZES = [16, 32, 48];
const pngs = SIZES.map((size) => rendered[`favicon-${size}x${size}-v4.png`]);
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
for (const name of ['favicon.ico', 'favicon-v5.ico']) {
  fs.writeFileSync(pub(name), ico);
  console.log('Skrev', name, ico.length, 'bytes,', SIZES.join('/'), 'px');
}
