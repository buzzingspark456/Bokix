// Ritar alla ikoner ur public/favicon.svg, som har både mörkt och ljust läge.
// Små storlekar får ett större och tjockare B (zoom = B:ets del av rutan,
// tjocklek i SVG:ns enheter), annars blir det för tunt i en webbläsarflik.
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

const ZOOM = { 16: [0.94, 26], 32: [0.88, 14], 48: [0.68, 8], 96: [0.6, 0], 480: [0.6, 0] };
const OUTPUTS = [
  ...[16, 32, 48, 96, 480].flatMap((size) => [
    { name: `favicon-${size}x${size}-v3.png`, size, scheme: 'dark', zoom: ZOOM[size] },
    { name: `favicon-ljus-${size}x${size}.png`, size, scheme: 'light', zoom: ZOOM[size] },
  ]),
  { name: 'apple-touch-icon.png', size: 180, scheme: 'dark', zoom: [0.6, 0] },
  { name: 'icon-192.png', size: 192, scheme: 'dark', zoom: [0.6, 0] },
  { name: 'icon-512.png', size: 512, scheme: 'dark', zoom: [0.6, 0] },
  // Android beskär maskable-ikoner till 80 %, så B:et måste hålla sig innanför.
  { name: 'icon-maskable-512.png', size: 512, scheme: 'dark', zoom: [0.54, 0] },
];

const browser = await chromium.launch();
const render = async ({ size, scheme, zoom: [zoom, stroke] }) => {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1, colorScheme: scheme });
  const scale = (zoom * 1254) / B_SIZE;
  await page.setContent(`<!doctype html><style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.evaluate(({ scale, stroke }) => {
    const b = document.getElementById('bokstav');
    b.setAttribute('transform', `translate(627 627) scale(${scale}) translate(-613.5 -597.5)`);
    b.setAttribute('stroke-width', String(stroke / scale));
  }, { scale, stroke });
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
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

// ICO: 6 byte huvud, 16 byte per bild, sedan PNG-datan. Mörk, eftersom Bing
// bara visar en ikon och den behöver synas på både ljus och mörk sida.
const SIZES = [16, 32, 48];
const pngs = SIZES.map((size) => rendered[`favicon-${size}x${size}-v3.png`]);
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
for (const name of ['favicon.ico', 'favicon-v4.ico']) {
  fs.writeFileSync(pub(name), ico);
  console.log('Skrev', name, ico.length, 'bytes,', SIZES.join('/'), 'px');
}
