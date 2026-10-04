// Var på kvittot huvuduppgifterna lästes. Avläsningen (ocrReceipt.js) ger
// raderna med sitt läge på fotot; här letas raden upp där leverantören,
// datumet, beloppet, momsen och kvittonumret står, så att kvittovyn kan
// markera den (Expenses.jsx). Hittas värdet inte på någon rad markeras
// ingenting: en ruta på fel ställe vore värre än ingen ruta.

const ACCENT_FOLD = { 'ö': 'o', 'ä': 'a', 'å': 'a', 'é': 'e', 'è': 'e', 'ü': 'u', 'ø': 'o', 'æ': 'a' };
const fold = (s) => String(s || '').toLowerCase().split('').map(c => ACCENT_FOLD[c] || c).join('').replace(/[^a-z0-9]/g, '');

// Ord som visar vilken rad beloppet hör till, starkast först: "Totalt" före
// "Kort" (samma summa står ofta på betalraden också).
const TOTAL_RES = [/total|att betala|summa|amount due|grand/i, /belopp|amount|betalt|brutto|due/i, /kort|card|sek|kr\b/i];
const VAT_RES = [/moms|vat|mva|tax|varav/i];

// Talen på en rad, i ören: "1 284,00" → 128400, "842.00" → 84200, "64" → 6400.
function amountsOnLine(text) {
  const out = [];
  const re = /\d[\d .,']*\d|\d/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0].replace(/\s+$/, '');
    const dec = /[.,](\d{2})$/.exec(raw);
    const whole = (dec ? raw.slice(0, -3) : raw).replace(/[^\d]/g, '');
    if (!whole || whole.length > 9) continue;
    out.push(Number(whole) * 100 + (dec ? Number(dec[1]) : 0));
    // "1 284,00" kan också läsas som två tal; mellanslag mitt i räknas även
    // som avskiljare, så "64 00" (tappat kommatecken) går att hitta.
    if (/\s/.test(raw)) raw.split(/\s+/).forEach((part) => {
      const d = /[.,](\d{2})$/.exec(part);
      const w = (d ? part.slice(0, -3) : part).replace(/[^\d]/g, '');
      if (w && w.length <= 9) out.push(Number(w) * 100 + (d ? Number(d[1]) : 0));
    });
  }
  return out;
}

function findAmountLine(lines, value, keywordRes) {
  if (!(Number(value) > 0)) return null;
  const target = Math.round(Number(value) * 100);
  const hits = lines.filter(l => amountsOnLine(l.text).includes(target));
  if (hits.length === 0) return null;
  // Raden med ett ord som "Totalt"/"Moms" först, annars den lägsta på kvittot
  // (summan står under raderna).
  let pool = hits;
  for (const re of keywordRes) {
    const keyed = hits.filter(l => re.test(l.text));
    if (keyed.length > 0) { pool = keyed; break; }
  }
  return pool.reduce((a, b) => (b.box.y > a.box.y ? b : a));
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj|may', 'jun', 'jul', 'aug', 'sep', 'okt|oct', 'nov', 'dec'];

function datesOnLine(text) {
  const out = new Set();
  const pad = (n) => String(n).padStart(2, '0');
  const add = (y, m, d) => {
    let year = Number(y);
    if (year < 100) year += 2000;
    if (year < 2000 || year > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return;
    out.add(`${year}-${pad(m)}-${pad(d)}`);
  };
  for (const m of text.matchAll(/\b(\d{2,4})[-./ ](\d{1,2})[-./ ](\d{1,4})\b/g)) {
    const [a, b, c] = [m[1], m[2], m[3]].map(Number);
    if (m[1].length === 4) add(a, b, c);
    else { add(c, b, a); add(c, a, b); }
  }
  for (const m of text.matchAll(/\b(20\d{2})(\d{2})(\d{2})\b|\b(\d{2})(\d{2})(\d{2})\b/g)) {
    if (m[1]) add(m[1], Number(m[2]), Number(m[3]));
    else { add(m[4], Number(m[5]), Number(m[6])); add(m[6], Number(m[5]), Number(m[4])); }
  }
  const lower = text.toLowerCase();
  MONTHS.forEach((names, i) => {
    const re = new RegExp(`\\b(\\d{1,2})\\.?\\s*(?:${names})[a-zé]*\\.?,?\\s*(\\d{2,4})|\\b(?:${names})[a-zé]*\\.?\\s*(\\d{1,2}),?\\s*(\\d{2,4})`, 'g');
    for (const m of lower.matchAll(re)) {
      if (m[1]) add(m[2], i + 1, Number(m[1]));
      else add(m[4], i + 1, Number(m[3]));
    }
  });
  return out;
}

function findDateLine(lines, date) {
  if (!date) return null;
  return lines.find(l => datesOnLine(l.text).has(date)) || null;
}

function findSupplierLine(lines, supplier) {
  const whole = fold(supplier);
  if (whole.length < 2) return null;
  const firstWord = fold(String(supplier).split(/\s+/)[0]);
  const byY = [...lines].sort((a, b) => a.box.y - b.box.y);
  return byY.find(l => fold(l.text).includes(whole))
    || (firstWord.length >= 3 ? byY.find(l => fold(l.text).includes(firstWord)) : null)
    || null;
}

function findTextLine(lines, value) {
  const v = fold(value);
  if (v.length < 3) return null;
  return lines.find(l => fold(l.text).includes(v)) || null;
}

/**
 * Rutor (andelar 0–1 av fotot) för de fält som går att hitta:
 * { supplier, date, amount, vatAmount, receiptNumber }. `parsed` är
 * parseReceiptText-resultatet; `amount` är beloppet SOM DET STOD på kvittot
 * (i utländsk valuta om kvittot var det).
 */
export function locateFieldBoxes(layout, parsed) {
  const lines = (layout || []).filter(l => l && l.box && typeof l.text === 'string');
  if (lines.length === 0 || !parsed) return {};
  const found = {
    supplier: findSupplierLine(lines, parsed.supplier),
    date: findDateLine(lines, parsed.date),
    amount: findAmountLine(lines, parsed.amount, TOTAL_RES),
    vatAmount: findAmountLine(lines, parsed.vatAmount, VAT_RES),
    receiptNumber: findTextLine(lines, parsed.receiptNumber),
  };
  const boxes = {};
  Object.entries(found).forEach(([key, line]) => { if (line) boxes[key] = line.box; });
  return boxes;
}
