// Tolkningen av riktiga Google-läsningar jämförd med facit. Körs bara när
// OCR_EVAL_DIR pekar på en mapp som scripts/ocr-google-eval.mjs har läst:
//   OCR_EVAL_DIR=<mapp> npx vitest run src/utils/ocrGoogleEval.test.js
// Facit: <mapp>/key/<namn>.json med { total, date, company } (SROIE-formatet)
// eller <mapp>/facit.json med { "<fil>": { total, date, company, vat } }.
// Skriver en rapport till <mapp>/rapport.txt med varje fel.
import { it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeReceipt } from './receiptScan';

const dir = process.env.OCR_EVAL_DIR;
const toIso = (raw) => {
  const s = String(raw || '').trim();
  let m = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/.exec(s);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(s);
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  if (m && months[m[2].toLowerCase()]) return `${m[3]}-${String(months[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
};
const fold = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9åäö]/g, '');

it.skipIf(!dir)('riktiga kvitton genom Google', async () => {
  const cacheDir = path.join(dir, process.env.VISION_CACHE || '.vision');
  const facitFile = path.join(dir, 'facit.json');
  const facitAll = fs.existsSync(facitFile) ? JSON.parse(fs.readFileSync(facitFile, 'utf8')) : {};
  const stats = { total: [0, 0], date: [0, 0], company: [0, 0], vat: [0, 0], number: [0, 0] };
  const rows = [];
  for (const f of fs.readdirSync(cacheDir).filter(x => x.endsWith('.json')).sort()) {
    const file = f.replace(/\.json$/, '');
    const name = file.replace(/\.\w+$/, '');
    const keyFile = path.join(dir, 'key', `${name}.json`);
    const facit = facitAll[file] || (fs.existsSync(keyFile) ? JSON.parse(fs.readFileSync(keyFile, 'utf8')) : null);
    const { text, lines } = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf8'));
    const a = await analyzeReceipt({ text, layout: lines || null });
    const r = a.parsed;
    const errors = [];
    const check = (field, ok, got, want) => { stats[field][1]++; if (ok) stats[field][0]++; else errors.push(`${field}: fick ${got}, rätt ${want}`); };
    if (facit?.total !== undefined) {
      const want = Number(String(facit.total).replace(/[^\d.,-]/g, '').replace(',', '.'));
      check('total', r.amount !== null && Math.abs(r.amount - want) < 0.011, r.amount, want);
    }
    if (facit?.date) check('date', r.date === toIso(facit.date), r.date, toIso(facit.date));
    if (facit?.company) {
      const got = fold(a.supplierName); const want = fold(facit.company);
      check('company', Boolean(got) && (want.includes(got.slice(0, 6)) || got.includes(want.slice(0, 6))), a.supplierName, facit.company);
    }
    if (facit?.vat !== undefined) check('vat', r.vatAmount !== null && Math.abs(r.vatAmount - Number(facit.vat)) < 0.011, r.vatAmount, facit.vat);
    if (facit?.number) check('number', String(r.receiptNumber || '') === String(facit.number), r.receiptNumber, facit.number);
    rows.push(errors.length ? `${file}\n  ${errors.join('\n  ')}` : `${file} OK`);
  }
  const pct = ([ok, n]) => (n ? `${ok}/${n} = ${Math.round((ok / n) * 1000) / 10} %` : '-');
  const summary = Object.entries(stats).filter(([, s]) => s[1]).map(([k, s]) => `${k.padEnd(8)} ${pct(s)}`).join('\n');
  fs.writeFileSync(path.join(dir, 'rapport.txt'), `${summary}\n\n${rows.join('\n')}\n`);
  console.log(summary);
}, 600000);
