// Kör hela kvittoavläsningen i en riktig webbläsare mot SIMULERADE
// telefonfoton: kvittot litet i bilden, snett, oskarpt, mörkt, brusigt och
// JPEG-komprimerat. Ren skärmdump duger inte som test — se minnet
// "ocr-foton-och-oppna-punkter".
import { chromium } from '@playwright/test';

const BASE = process.env.HARNESS_URL || 'http://localhost:5199/scripts/ocr-harness.html';

const RECEIPT = [
  'DOLLARSTORE',
  'Storgatan 4, Uppsala',
  'Org nr 556123-4567',
  '2026-09-14  14:02',
  '',
  'Skal            12',
  'Penna           12',
  '',
  'TOTALT          24',
  'Moms 25%      4,80',
  '',
  'Kort',
  'Kvittonr 100234',
];



// Fler dokumentformer än det korta butikskvittot: ett långt kvitto med många
// rader och en A4-faktura. Bildkedjan (hitta papperet, räta ut, läsa av) ska
// klara formen på det som fotas, inte bara ett format.
const LONG_RECEIPT = [
  'ICA MAXI HAGGVIK',
  'Org nr 556100-1234',
  '2026-09-14  16:20',
  '',
  'Mjolk 1,5l        18,50',
  'Brod grovt        32,90',
  'Kaffe bryggmalet  54,00',
  'Bananer           24,90',
  'Agg 12-pack       39,90',
  'Smor              49,50',
  'Ost herrgard      79,00',
  'Pasta             18,90',
  'Tomater           29,90',
  'Kyckling         109,00',
  '',
  'TOTALT           456,50',
  'Moms 12%          48,91',
  '',
  'KORT MASTERCARD',
  'Kvittonr 884216',
];

const INVOICE = [
  'NORDLUND KONSULT AB',
  'Sveavagen 12, 111 57 Stockholm',
  'Org nr 556700-1234',
  '',
  'FAKTURA',
  'Fakturanummer     2026104',
  'Fakturadatum   2026-09-01',
  'Forfallodatum  2026-09-30',
  '',
  'Konsultarvode september',
  'Summa exkl moms  10 000,00',
  'Moms 25%          2 500,00',
  'Att betala       12 500,00',
  '',
  'Bankgiro 123-4567',
];

const CASES = [
  { name: 'skarpt narbild', opts: { fill: 0.92, blur: 0, angle: 1.5, noise: 6 } },
  { name: 'oskarpt 1px', opts: { fill: 0.85, blur: 1, angle: 2, noise: 8 } },
  { name: 'oskarpt 2px', opts: { fill: 0.85, blur: 2, angle: 2, noise: 8 } },
  { name: 'oskarpt 3,5px', opts: { fill: 0.85, blur: 3.5, angle: 2, noise: 8 } },
  { name: 'oskarpt 5px', opts: { fill: 0.85, blur: 5, angle: 2, noise: 8 } },
  { name: 'kvitto litet i bilden', opts: { fill: 0.34, blur: 0.4, angle: 3, noise: 8 } },
  { name: 'kvitto mycket litet', opts: { fill: 0.18, blur: 0.4, angle: 3, noise: 8, frame: 1000 } },
  { name: 'morkt', opts: { fill: 0.8, blur: 0.5, angle: 2, light: 0.42, noise: 10 } },
  { name: 'mycket morkt', opts: { fill: 0.8, blur: 0.5, angle: 2, light: 0.22, noise: 10 } },
  { name: 'litet OCH oskarpt', opts: { fill: 0.22, blur: 1.6, angle: 4, noise: 12, frame: 900 } },
  // Skärmdump/ljus bakgrund: utklippningen ska inte klippa fel när papperet
  // inte är ljusare än bakgrunden.
  { name: 'ljus bakgrund (skarmdump)', opts: { fill: 0.7, blur: 0, angle: 0, noise: 0, bg: '#f4f4f4', quality: 0.95 } },
  { name: 'vit bakgrund, kvittot rakt', opts: { fill: 0.95, blur: 0, angle: 0, noise: 0, bg: '#ffffff', quality: 0.95 } },
  // Telefonen på lutning: kvittot blir snett OCH keystone-förvrängt. Det är
  // här uträtningen ska göra skillnad.
  { name: 'snett och keystone', opts: { fill: 0.62, blur: 0.5, angle: 7, keystone: 0.45, noise: 8 } },
  { name: 'kraftig keystone, litet', opts: { fill: 0.4, blur: 0.5, angle: -11, keystone: 0.6, noise: 8 } },
  // Andra dokumentformer, fotade på samma sätt.
  { name: 'langt kvitto, snett', lines: LONG_RECEIPT, opts: { fill: 0.86, blur: 0.6, angle: 5, keystone: 0.25, noise: 8 } },
  { name: 'langt kvitto, litet i bilden', lines: LONG_RECEIPT, opts: { fill: 0.45, blur: 0.5, angle: -4, noise: 8 } },
  { name: 'A4-faktura, snett', lines: INVOICE, opts: { fill: 0.55, blur: 0.6, angle: -6, keystone: 0.2, noise: 8, width: 700 } },
  { name: 'A4-faktura, mork miljo', lines: INVOICE, opts: { fill: 0.5, blur: 0.5, angle: 3, light: 0.5, noise: 10, width: 700 } },
];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('  [konsol]', m.text()); });
await page.goto(BASE);
await page.waitForFunction(() => !!window.__ocr, null, { timeout: 30000 });

for (const { name, opts, lines: caseLines } of CASES) {
  const started = Date.now();
  const out = await page.evaluate(async ({ lines, opts }) => {
    const { ocrFile, parseReceiptText, drawReceipt, fakePhoto } = window.__ocr;
    const photo = await fakePhoto(drawReceipt(lines, opts.width ? { width: opts.width } : {}), opts);
    const { text, confidence, weakTokens, quality } = await ocrFile(photo, () => {});
    const parsed = parseReceiptText(text, { confidence, weakTokens });
    return {
      bytes: photo.size,
      confidence: confidence === null ? null : Math.round(confidence),
      quality,
      amount: parsed.amount, amountGuessed: parsed.amountGuessed, amountVerified: parsed.amountVerified,
      vatRate: parsed.vatRate, vatAmount: parsed.vatAmount, vatVerified: parsed.vatVerified, vatMismatch: parsed.vatMismatch,
      supplier: parsed.supplier, date: parsed.date, dateGuessed: parsed.dateGuessed, weak: (weakTokens || []).join(' '), number: parsed.receiptNumber,
      notReceipt: parsed.notReceipt, unreadable: parsed.unreadable,
      text: text.replace(/\n+/g, ' | ').slice(0, 220),
    };
  }, { lines: caseLines || RECEIPT, opts }, { timeout: 180000 });
  const q = out.quality || {};
  console.log(`\n── ${name} (${((Date.now() - started) / 1000).toFixed(1)} s, ${Math.round(out.bytes / 1024)} kB)`);
  console.log(`   kvalitet: skarpa ${q.sharpness} kontrast ${q.contrast} ljus ${q.brightness} utklippt ${q.cropped} uträtad ${q.deskewed === true} andel ${q.cropRatio && q.cropRatio.toFixed(2)} langsida ${q.longEdge} rad ${q.advice}`);
  console.log(`   belopp ${out.amount} (gissat ${out.amountGuessed}, kontrollerat ${out.amountVerified})  moms ${out.vatRate}% ${out.vatAmount} (verifierad ${out.vatVerified}, avvikelse ${out.vatMismatch})`);
  console.log(`   leverantor ${out.supplier}  datum ${out.date} (kontrollera ${out.dateGuessed}, osäkra: ${out.weak})  nummer ${out.number}  ejKvitto ${out.notReceipt} olasbar ${out.unreadable} conf ${out.confidence}`);
  console.log(`   text: ${out.text}`);
}

await browser.close();
