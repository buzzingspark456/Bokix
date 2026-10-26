// Kör: npx vite --port 5199, sedan node scripts/app-harness-skanna-kvitto.mjs
// Gratisverktyget Skanna kvitto: första kvittot går till /api/ocr-free
// (fejkat Google-svar med radernas läge), andra kvittot läses i webbläsaren
// utan något anrop. Skärmbilder i test-results/skanna-*.png.
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5199';
const THEME = process.env.THEME || 'light';
fs.mkdirSync('test-results', { recursive: true });

const RECEIPT_LINES = [
  ['ICA Nära Solna', 0.22, 0.06, 0.56, 0.05],
  ['Org.nr 556123-4567', 0.25, 0.12, 0.5, 0.03],
  ['Kvitto nr 4711', 0.1, 0.2, 0.4, 0.03],
  ['Datum 2026-10-20 14:32', 0.1, 0.25, 0.6, 0.03],
  ['Mjölk 1,5 l        19,90', 0.1, 0.36, 0.8, 0.03],
  ['Kaffe 450 g        79,90', 0.1, 0.41, 0.8, 0.03],
  ['Bröd               23,20', 0.1, 0.46, 0.8, 0.03],
  ['TOTALT            123,00', 0.1, 0.56, 0.8, 0.04],
  ['Moms 12 %          13,18', 0.1, 0.63, 0.8, 0.03],
  ['Netto             109,82', 0.1, 0.68, 0.8, 0.03],
  ['Kort              123,00', 0.1, 0.75, 0.8, 0.03],
];

const browser = await browser0();
async function browser0() { return chromium.launch(); }

// 1. Ett kvitto att ladda upp: ritat i HTML och fotograferat.
const pr = await browser.newPage({ viewport: { width: 420, height: 640 } });
await pr.setContent(`<body style="margin:0;background:#fff;font:22px 'Courier New',monospace;color:#111">${RECEIPT_LINES.map(([t, x, y]) => `<div style="position:absolute;left:${x * 420}px;top:${y * 640}px;white-space:pre">${t}</div>`).join('')}</body>`);
const receiptPath = 'test-results/skanna-kvitto-in.png';
await pr.screenshot({ path: receiptPath });
await pr.close();

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: 'bokix_cookie_consent', value: 'denied', url: BASE }]);
await ctx.addInitScript(t => { try { localStorage.setItem('bokix_theme_pref', t); } catch { /* privat läge */ } }, THEME);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
let calls = 0;
await page.route('**/api/ocr-free', async route => {
  calls++;
  const body = JSON.parse(route.request().postData() || '{}');
  if (calls > 1) return route.fulfill({ status: 429, json: { code: 'used' } });
  if (!body.image && !body.pdf) return route.fulfill({ status: 400, json: {} });
  // VISION_MOCK: en JSON-fil med { text, lines } i stället för det ritade kvittots text.
  if (process.env.VISION_MOCK) return route.fulfill({ json: JSON.parse(fs.readFileSync(process.env.VISION_MOCK, 'utf8')) });
  return route.fulfill({ json: { text: RECEIPT_LINES.map(l => l[0]).join('\n'), lines: RECEIPT_LINES.map(([text, x, y, w, h]) => ({ text, box: { x, y, w, h } })) } });
});

await page.goto(`${BASE}/verktyg/skanna-kvitto`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('bokix_free_ocr_used'));
await page.reload({ waitUntil: 'networkidle' });
const foot1 = await page.locator('.bx-scan-foot').innerText();

const upload = async () => {
  await page.locator('.bx-scan-drop input[type=file]').setInputFiles(receiptPath);
  await page.waitForSelector('.bx-scan-engine', { timeout: 90000 });
  await page.waitForTimeout(500);
};

await upload();
const engine1 = await page.locator('.bx-scan-engine').innerText();
const values1 = await page.locator('.bx-scan-row').allInnerTexts();
await page.locator('.bx-scan-grid, .bx-tool-grid').first().screenshot({ path: `test-results/skanna-1-google-${THEME}.png` });
await page.locator('.bx-scan-row', { hasText: 'Belopp' }).hover();
await page.waitForTimeout(400);
const markVisible = await page.locator('.bx-scan-mark').isVisible().catch(() => false);
await page.locator('.bx-tool-grid').first().screenshot({ path: `test-results/skanna-2-markering-${THEME}.png` });
const used = await page.evaluate(() => localStorage.getItem('bokix_free_ocr_used'));

await upload();
const engine2 = await page.locator('.bx-scan-engine').innerText();
await page.locator('.bx-tool-grid').first().screenshot({ path: `test-results/skanna-3-webblasare-${THEME}.png` });
const foot2 = await page.locator('.bx-scan-foot').innerText();

console.log('Före:', foot1);
console.log('1:', engine1.replace(/\n/g, ' '));
console.log('Fält:', values1.map(v => v.replace(/\n/g, ' | ')).join('  //  '));
console.log('Markering vid hovring:', markVisible, '| ihågkommen:', used);
console.log('2:', engine2.replace(/\n/g, ' '));
console.log('Efter:', foot2);
console.log('Anrop till /api/ocr-free:', calls);
const ok = calls === 1 && /Google/.test(engine1) && /webbläsare/.test(engine2) && markVisible && used === '1';
console.log(ok ? 'OK' : 'FEL', errors.length ? errors : '');
await browser.close();
process.exit(ok ? 0 : 1);
