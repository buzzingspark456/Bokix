// Verifikationslista (grundbok) och reskontra med åldersanalys (2026-11-13).
//
// Grundboken visar bokföringen i datumordning, som bokföringslagen kräver
// att den kan visas (huvudboken visar den i kontoordning). Den kontrollerar
// också två saker som revisorn tittar på: att varje verifikation balanserar
// och att nummerserierna inte har luckor.
//
// Reskontran visar vad kunderna är skyldiga och vad företaget är skyldigt
// leverantörerna vid ett datum, sorterat efter hur länge det varit förfallet.
// Den stäms av mot bokföringen (1510 Kundfordringar och 2440
// Leverantörsskulder vid samma datum), så att en skillnad syns direkt.
import { getDebet, getKredit } from './verificationAmounts';
import { invoiceCustomerDue } from './rotRutConfig';

const round2 = (n) => Math.round(n * 100) / 100;
const isBooked = (v) => (v?.status || 'booked') !== 'draft';
const day = (s) => String(s || '').slice(0, 10);

/** Date eller ISO-sträng → "ÅÅÅÅ-MM-DD" i lokal tid. */
export function isoDay(d) {
  if (!d) return '';
  if (typeof d === 'string') return day(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function splitNumber(number) {
  const m = /^([A-Za-z]*)(\d+)$/.exec(String(number || '').trim());
  return m ? { series: m[1] || 'A', n: Number(m[2]) } : null;
}

// Verifikationer som Bokix själv skapar ur något som redan är underlaget
// (fakturan, lönebeskedet, momsdeklarationen, Stripe/Zettle, avskrivningen,
// bokslutet) eller som kommer från ett annat program (underlaget finns där).
const SYSTEM_SOURCES = new Set([
  'invoice', 'invoice_payment', 'payroll', 'payroll_reversal', 'vat_declaration',
  'stripe', 'stripe_ledger', 'zettle', 'zettle_ledger', 'rotrut_import', 'rotrut_payout', 'rotrut_rejected',
  'accrual', 'depreciation', 'asset_disposal', 'dividend', 'year_end_close', 'year_open_transfer',
  'equity_reclass', 'partner_allocation', 'patronage_refund', 'inventory', 'skattekonto_import',
  'bank_import', 'expense_reversal', 'supplier_invoice_payment', 'sie_import',
]);

/**
 * Har verifikationen ett underlag? En bifogad fil, en uppgift om var
 * underlaget finns (BFL 5 kap. 7 §), en rättelse av en annan verifikation,
 * eller en verifikation som Bokix skapat ur själva underlaget.
 */
export function hasUnderlag(v) {
  if (!v) return false;
  if (v.attachmentUrl || (Array.isArray(v.attachments) && v.attachments.length)) return true;
  if (String(v.originalLocation || '').trim()) return true;
  if (/^Rätta:/.test(String(v.description || ''))) return true;
  return SYSTEM_SOURCES.has(v.source);
}

/**
 * Verifikationslistan för perioden [start, end]. Varje verifikation med sina
 * rader, i datum- och nummerordning, plus kontroller:
 *  - unbalanced: verifikationer där debet och kredit inte är lika
 *  - gaps: saknade nummer inom varje serie (räknat över HELA bokföringen,
 *    så att en lucka syns även om den ligger mellan två perioder)
 */
export function computeJournal(verifications, accounts, start, end) {
  const from = isoDay(start); const to = isoDay(end);
  const names = new Map((accounts || []).map(a => [String(a.code), a.name || '']));
  const booked = (verifications || []).filter(v => isBooked(v) && v.date);
  const inPeriod = booked
    .filter(v => day(v.date) >= from && day(v.date) <= to)
    .sort((a, b) => day(a.date).localeCompare(day(b.date)) || String(a.number || '').localeCompare(String(b.number || ''), 'sv', { numeric: true }));

  let totalDebet = 0; let totalKredit = 0;
  const unbalanced = [];
  const entries = inPeriod.map(v => {
    const rows = (v.rows || [])
      .filter(r => r.account || getDebet(r) || getKredit(r))
      .map(r => ({ account: String(r.account || ''), name: r.accountName || names.get(String(r.account)) || '', debet: round2(getDebet(r)), kredit: round2(getKredit(r)), text: r.desc || '' }));
    const debet = round2(rows.reduce((s, r) => s + r.debet, 0));
    const kredit = round2(rows.reduce((s, r) => s + r.kredit, 0));
    totalDebet += debet; totalKredit += kredit;
    if (Math.abs(debet - kredit) > 0.005) unbalanced.push({ number: v.number || '', date: day(v.date), diff: round2(debet - kredit) });
    return { id: v.id, number: v.number || '', date: day(v.date), description: v.description || '', rows, debet, kredit };
  });

  // Luckor per serie över hela bokföringen, men bara de som ligger inom
  // periodens nummerintervall rapporteras här.
  const bySeries = new Map();
  for (const v of booked) {
    const p = splitNumber(v.number);
    if (!p) continue;
    if (!bySeries.has(p.series)) bySeries.set(p.series, new Set());
    bySeries.get(p.series).add(p.n);
  }
  const periodRange = new Map();
  for (const e of entries) {
    const p = splitNumber(e.number);
    if (!p) continue;
    const r = periodRange.get(p.series) || { min: p.n, max: p.n };
    periodRange.set(p.series, { min: Math.min(r.min, p.n), max: Math.max(r.max, p.n) });
  }
  const gaps = [];
  for (const [series, { min, max }] of periodRange) {
    const nums = bySeries.get(series);
    const missing = [];
    for (let n = min; n <= max; n++) if (!nums.has(n)) missing.push(n);
    if (missing.length) gaps.push({ series, missing });
  }

  const missingUnderlag = inPeriod.filter(v => !hasUnderlag(v)).map(v => ({ id: v.id, number: v.number || '', date: day(v.date), description: v.description || '' }));
  return { entries, totalDebet: round2(totalDebet), totalKredit: round2(totalKredit), unbalanced, gaps, missingUnderlag, count: entries.length };
}

/** Saldo på ett konto (debet − kredit) till och med ett datum. */
export function accountBalanceAt(verifications, account, date) {
  const to = isoDay(date);
  let s = 0;
  for (const v of verifications || []) {
    if (!isBooked(v) || !v.date || day(v.date) > to) continue;
    for (const r of v.rows || []) if (String(r.account) === String(account)) s += getDebet(r) - getKredit(r);
  }
  return round2(s);
}

export const AGE_BUCKETS = [
  { key: 'notDue', max: 0 },
  { key: 'd30', max: 30 },
  { key: 'd60', max: 60 },
  { key: 'd90', max: 90 },
  { key: 'd90plus', max: Infinity },
];

function daysBetween(fromIso, toIso) {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function bucketFor(daysOverdue) {
  return AGE_BUCKETS.find(b => daysOverdue <= b.max).key;
}

function emptyBuckets() {
  return Object.fromEntries(AGE_BUCKETS.map(b => [b.key, 0]));
}

/** Gruppera öppna poster per motpart med åldersfördelning. */
function groupOpenItems(items) {
  const byParty = new Map();
  const totals = { ...emptyBuckets(), total: 0 };
  for (const it of items) {
    const p = byParty.get(it.partyKey) || { name: it.partyName, items: [], ...emptyBuckets(), total: 0 };
    p.items.push(it); p[it.bucket] += it.open; p.total += it.open;
    byParty.set(it.partyKey, p);
    totals[it.bucket] += it.open; totals.total += it.open;
  }
  const parties = [...byParty.values()]
    .map(p => ({ ...p, total: round2(p.total), ...Object.fromEntries(AGE_BUCKETS.map(b => [b.key, round2(p[b.key])])), items: p.items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)) }))
    .sort((a, b) => b.total - a.total);
  return { parties, totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round2(v)])) };
}

/**
 * Kundreskontra per datum: fakturor som var obetalda den dagen.
 * - Bara skickade fakturor (inga utkast, inga offerter) daterade senast den dagen.
 * - Helt betald med betaldatum senast den dagen räknas inte.
 * - Belopp i kronor: kundens del (efter ROT/RUT-avdrag, som står på 1510)
 *   minus betalningar och kreditfakturor, omräknat med fakturans kurs.
 * - Kreditfakturor står inte som egna poster (de dras av på originalet).
 * Delbetalningar har inget eget datum; de räknas som gjorda före dagen.
 */
export function computeReceivables(invoices, contacts, asOf, verifications) {
  const at = isoDay(asOf);
  const names = new Map((contacts || []).map(c => [c.id, c.name || '']));
  const items = [];
  for (const inv of invoices || []) {
    if ((inv.type || 'invoice') === 'quote' || inv.status === 'draft' || inv.creditFor) continue;
    if (!inv.date || day(inv.date) > at) continue;
    const paidBefore = inv.status === 'paid' && inv.paidDate && day(inv.paidDate) <= at;
    if (paidBefore) continue;
    const rate = inv.currency && inv.currency !== 'SEK' && Number(inv.fxRate) > 0 ? Number(inv.fxRate) : 1;
    const due = invoiceCustomerDue(inv) - (Number(inv.creditedAmount) || 0);
    // Betald efter dagen: hela beloppet var öppet den dagen.
    const paid = inv.status === 'paid' ? 0 : (Number(inv.paidAmount) || 0);
    const open = round2(Math.max(0, due - paid) * rate);
    if (open <= 0.005) continue;
    const dueDate = day(inv.dueDate) || day(inv.date);
    const daysOverdue = Math.max(0, daysBetween(dueDate, at));
    items.push({
      id: inv.id, number: String(inv.invoiceNumber || ''), date: day(inv.date), dueDate, open, daysOverdue,
      bucket: bucketFor(daysBetween(dueDate, at)),
      currency: rate !== 1 ? inv.currency : null,
      partyKey: inv.customerId || inv.customerName || '?',
      partyName: names.get(inv.customerId) || inv.customerName || '',
    });
  }
  const grouped = groupOpenItems(items);
  const ledger = accountBalanceAt(verifications, '1510', at);
  return { ...grouped, asOf: at, ledgerAccount: '1510', ledgerBalance: ledger, difference: round2(grouped.totals.total - ledger), count: items.length };
}

/**
 * Leverantörsreskontra per datum: leverantörsfakturor som var obetalda den
 * dagen. Fakturor som ägaren betalat privat (2018) är ingen leverantörsskuld.
 * Fakturor utan kontering är inte bokförda än och visas för sig, eftersom de
 * inte finns på 2440.
 */
export function computePayables(expenses, contacts, asOf, verifications) {
  const at = isoDay(asOf);
  const names = new Map((contacts || []).map(c => [c.id, c.name || '']));
  const items = [];
  let unbooked = 0;
  for (const e of expenses || []) {
    if (e.type !== 'supplier_invoice' || e.paidByOwnerPrivately) continue;
    if (!e.date || day(e.date) > at) continue;
    if (e.status === 'paid' && e.paidDate && day(e.paidDate) <= at) continue;
    const open = round2(Number(e.amount) || 0);
    if (open <= 0.005) continue;
    const booked = Boolean(e.rows?.length || e.costAccount);
    if (!booked) { unbooked += open; }
    const dueDate = day(e.dueDate) || day(e.date);
    items.push({
      id: e.id, number: String(e.invoiceNumber || ''), date: day(e.date), dueDate, open,
      daysOverdue: Math.max(0, daysBetween(dueDate, at)), bucket: bucketFor(daysBetween(dueDate, at)),
      unbooked: !booked,
      partyKey: e.supplierId || e.supplier || '?',
      partyName: names.get(e.supplierId) || e.supplier || '',
    });
  }
  const grouped = groupOpenItems(items);
  // 2440 har kreditsaldo; vänd tecknet så att det jämförs med en positiv skuld.
  const ledger = round2(-accountBalanceAt(verifications, '2440', at));
  const bookedTotal = round2(grouped.totals.total - unbooked);
  return { ...grouped, asOf: at, ledgerAccount: '2440', ledgerBalance: ledger, unbooked: round2(unbooked), difference: round2(bookedTotal - ledger), count: items.length };
}
