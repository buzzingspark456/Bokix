// Kör kvittoavläsningen på RIKTIGA filer i webbläsaren, som appen gör det:
//   npx vite --port 5199        (i ett fönster)
//   node scripts/ocr-check-file.mjs bild1.jpg bild2.jpg
// Skriver ut råtexten, bildens mätvärden och hur tolkningen blev, så att ett
// kvitto som blev fel går att felsöka på samma väg som användaren ser det.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Ange en eller flera bild-/PDF-filer.');
  process.exit(1);
}

const BASE = process.env.HARNESS_URL || 'http://localhost:5199/scripts/ocr-harness.html';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('  [konsol]', m.text()); });
await page.goto(BASE);
await page.waitForFunction(() => !!window.__ocr, null, { timeout: 30000 });

for (const file of files) {
  const buf = fs.readFileSync(file);
  const started = Date.now();
  const out = await page.evaluate(async ({ b64, type }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type });
    const { ocrFile, parseReceiptText } = window.__ocr;
    const { text, confidence, quality } = await ocrFile(blob, () => {});
    const parsed = parseReceiptText(text, { confidence });
    return { text, confidence, quality, parsed };
  }, { b64: buf.toString('base64'), type: file.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' }, { timeout: 300000 });

  const q = out.quality || {};
  const p = out.parsed;
  console.log(`\n══ ${path.basename(file)} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  console.log(`kvalitet: skärpa ${q.sharpness} kontrast ${q.contrast} ljus ${q.brightness} utklippt ${q.cropped} andel ${q.cropRatio && q.cropRatio.toFixed(2)} långsida ${q.longEdge} råd ${q.advice} conf ${out.confidence && Math.round(out.confidence)}`);
  console.log(`tolkning: belopp ${p.amount} (gissat ${p.amountGuessed}, kontrollerat ${p.amountVerified}) moms ${p.vatRate}% belopp ${p.vatAmount} (verifierad ${p.vatVerified}, avvikelse ${p.vatMismatch})`);
  console.log(`          leverantör ${p.supplier} datum ${p.date} nummer ${p.receiptNumber} konto ${p.accountCode} betalt ${p.paymentMethod} ejKvitto ${p.notReceipt}`);
  console.log('── råtext ──');
  console.log(out.text.split('\n').map(l => '   ' + l).join('\n'));
}

await browser.close();
