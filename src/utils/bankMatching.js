// Säkra matchningar mellan bankrader och obetalda fakturor, så att Bank kan
// förvälja rätt faktura och stämma av alla säkra på en gång. Egen fil (inte
// bankImport.js) eftersom den filen drar in papaparse och xlsx.
//
// "Säker" betyder att bara EN obetald faktura har det beloppet (±1 kr), eller
// att fakturanumret/OCR-numret står i bankraden. Två fakturor på samma
// belopp utan nummer i texten lämnas åt användaren.
import { invoiceCustomerRemaining } from './rotRutConfig';

const AMOUNT_TOLERANCE = 1;

const textOf = (row) => `${row.description || ''} ${row.reference || ''}`;
const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

// Fakturanumret som eget tal i texten (inte "12" inuti "2026-12-01").
function mentions(text, number) {
  const n = digitsOnly(number);
  if (n.length < 3) return false;
  return new RegExp(`(^|\\D)${n}(\\D|$)`).test(text);
}

function customerInvoices(invoices) {
  return (invoices || [])
    .filter(inv => inv.status !== 'paid' && inv.status !== 'draft')
    .map(inv => ({ inv, amount: invoiceCustomerRemaining(inv), number: inv.ocrNumber || inv.invoiceNumber, alt: inv.invoiceNumber, foreign: (inv.currency || 'SEK') !== 'SEK' }))
    .filter(c => c.amount > 0);
}

function supplierInvoices(expenses) {
  return (expenses || [])
    .filter(e => e.type === 'supplier_invoice' && e.status !== 'paid' && !e.paidByOwnerPrivately)
    .map(inv => ({ inv, amount: Number(inv.amount) || 0, number: inv.ocrNumber, alt: inv.invoiceNumber }))
    .filter(c => c.amount > 0);
}

function pick(row, candidates) {
  const amount = Math.abs(row.amount);
  const sameAmount = candidates.filter(c => Math.abs(c.amount - amount) <= AMOUNT_TOLERANCE);
  if (!sameAmount.length) return null;
  const text = textOf(row);
  const byNumber = sameAmount.filter(c => mentions(text, c.number) || mentions(text, c.alt));
  // En faktura i annan valuta har sitt belopp i den valutan, inte i kronor
  // som banken: aldrig säker, bara ett förslag.
  if (byNumber.length === 1) return { id: byNumber[0].inv.id, sure: !byNumber[0].foreign, reason: 'number' };
  if (sameAmount.length === 1) return { id: sameAmount[0].inv.id, sure: !sameAmount[0].foreign, reason: 'amount' };
  return { id: sameAmount[0].inv.id, sure: false, reason: 'amount' };
}

/** Bästa förslaget för en rad: { id, type: 'invoice'|'supplier_invoice', sure } eller null. */
export function suggestMatch(row, { invoices, expenses }) {
  if (!row || !row.amount) return null;
  const isInflow = row.amount > 0;
  const hit = pick(row, isInflow ? customerInvoices(invoices) : supplierInvoices(expenses));
  return hit ? { ...hit, type: isInflow ? 'invoice' : 'supplier_invoice' } : null;
}

/** Alla säkra matchningar bland ohanterade rader. En faktura matchas aldrig
 * mot två rader: blir samma faktura säker för flera rader tas ingen av dem. */
export function findSureMatches(rows, { invoices, expenses }) {
  const hits = (rows || [])
    .filter(r => r.status === 'unmatched')
    .map(row => ({ row, match: suggestMatch(row, { invoices, expenses }) }))
    .filter(h => h.match?.sure);
  const count = new Map();
  hits.forEach(h => count.set(h.match.id, (count.get(h.match.id) || 0) + 1));
  return hits.filter(h => count.get(h.match.id) === 1);
}

// ── Kvitton ──────────────────────────────────────────────────────────────
// Ett kvitto bokförs mot bankkontot (1930), så kortköpet på kontoutdraget är
// redan med i bokföringen när kvittot är bokfört. Bankraden ska då kopplas
// till kvittot, inte bokföras en gång till. Kortköp dras oftast 0–3 dagar
// efter köpet; sju dagar åt båda hållen täcker helger och utlandsköp.
const RECEIPT_DAYS = 7;
const dayDiff = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);

/**
 * Kvitton som kan höra till en utgående bankrad: samma belopp (±1 kr),
 * datum inom en vecka, inte redan kopplade till en annan bankrad. Närmast i
 * datum först. Svarar [{ id, supplier, amount, date, booked }].
 */
export function receiptCandidates(row, expenses, bankTransactions = []) {
  if (!row || !(row.amount < 0) || !row.date) return [];
  const amount = Math.abs(row.amount);
  const taken = new Set((bankTransactions || [])
    .filter(t => t.id !== row.id && t.matchedType === 'receipt' && t.matchedId)
    .map(t => t.matchedId));
  return (expenses || [])
    .filter(e => e.type !== 'supplier_invoice' && !taken.has(e.id) && e.date
      && Math.abs((Number(e.amount) || 0) - amount) <= AMOUNT_TOLERANCE
      && dayDiff(e.date, row.date) <= RECEIPT_DAYS)
    .sort((a, b) => dayDiff(a.date, row.date) - dayDiff(b.date, row.date))
    .map(e => ({ id: e.id, supplier: e.supplier || e.description || '', amount: Number(e.amount) || 0, date: e.date, booked: Boolean(e.costAccount) }));
}
