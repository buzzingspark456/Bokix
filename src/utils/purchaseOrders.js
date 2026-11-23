// Inköpsorder (2026-11-23): beställning till en leverantör, som sedan tas
// emot (helt eller delvis) och blir inleveranser i lagret, och som till sist
// kopplas till leverantörsfakturan. Ingen bokföring här: inköpet bokförs från
// fakturan som vanligt, lagervärdet från inleveranserna (utils/inventory.js).
//
// Form: { id, number, supplier, date, expectedDate, status, note, sentAt,
//   rows: [{ key, articleId, description, qty, unitCost, unit, received }],
//   matchedExpenseId, cancelled }

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;

export function nextPoNumber(list = []) {
  const max = list.reduce((m, po) => {
    const n = Number(String(po.number || '').replace(/^\D+/, ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, 1000);
  return `IO-${max + 1}`;
}

export const poTotal = (po) => round2((po?.rows || []).reduce((s, r) => s + num(r.qty) * num(r.unitCost), 0));
export const rowRemaining = (r) => Math.max(0, round2(num(r.qty) - num(r.received)));

/** 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled' */
export function poStatus(po) {
  if (!po) return 'draft';
  if (po.cancelled) return 'cancelled';
  const rows = po.rows || [];
  const any = rows.some(r => num(r.received) > 0);
  const all = rows.length > 0 && rows.every(r => rowRemaining(r) === 0);
  if (all) return 'received';
  if (any) return 'partial';
  return po.sentAt || po.ordered ? 'ordered' : 'draft';
}

/** Beställt men inte levererat, per vara: Map(articleId → { qty, expectedDate }). */
export function onOrderByArticle(pos = []) {
  const out = new Map();
  for (const po of pos) {
    const st = poStatus(po);
    if (st !== 'ordered' && st !== 'partial') continue;
    for (const r of po.rows || []) {
      const left = rowRemaining(r);
      if (!r.articleId || left <= 0) continue;
      const cur = out.get(r.articleId) || { qty: 0, expectedDate: '' };
      cur.qty = round2(cur.qty + left);
      if (po.expectedDate && (!cur.expectedDate || po.expectedDate < cur.expectedDate)) cur.expectedDate = po.expectedDate;
      out.set(r.articleId, cur);
    }
  }
  return out;
}

/**
 * Tar emot varor på en order. `amounts` = { rowKey: antal } (saknas en rad
 * tas resten emot). Returnerar { po, movements } där movements är nya
 * inleveranser med orderns pris och ett poId att följa.
 */
export function receivePo(po, { date, amounts = null, newId }) {
  const movements = [];
  const rows = (po.rows || []).map(r => {
    const left = rowRemaining(r);
    const take = amounts ? Math.min(left, Math.max(0, num(amounts[r.key]))) : left;
    if (!(take > 0) || !r.articleId) return r;
    movements.push({ id: newId(), articleId: r.articleId, type: 'in', date, qty: take, unitCost: num(r.unitCost), poId: po.id, note: [po.number, po.supplier].filter(Boolean).join(' ') });
    return { ...r, received: round2(num(r.received) + take) };
  });
  return { po: { ...po, rows }, movements };
}

const normName = (s) => String(s || '').toLowerCase()
  .replace(/\b(aktiebolag|ab|hb|kb|ek\.?\s*för\.?|inc|ltd|oy|as|aps)\b/g, '')
  .replace(/[^a-z0-9åäöéü]+/g, ' ').trim();

export function sameSupplier(a, b) {
  const x = normName(a); const y = normName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x) || x.split(' ')[0] === y.split(' ')[0];
}

/**
 * Inköpsordern som en leverantörsfaktura eller ett kvitto troligen hör till:
 * samma leverantör, inte redan kopplad, inte makulerad, daterad tidigast tre
 * veckor före ordern. Bäst belopp vinner. Returnerar { po, diff, diffPct } eller null.
 * Säker träff (`sure`) när beloppet skiljer högst 2 % och 50 kr.
 */
export function matchPurchaseOrder(pos = [], expense) {
  if (!expense?.supplier) return null;
  const net = num(expense.netAmount) || (num(expense.amount) - num(expense.vatAmount));
  const cands = pos.filter(po => !po.cancelled && !po.matchedExpenseId && poStatus(po) !== 'draft'
    && sameSupplier(po.supplier, expense.supplier)
    && (!expense.date || !po.date || String(expense.date) >= addDays(po.date, -21)));
  if (!cands.length) return null;
  const scored = cands.map(po => {
    const total = poTotal(po);
    const diff = round2(net - total);
    return { po, total, net: round2(net), diff, diffPct: total ? Math.abs(diff) / total : 1 };
  }).sort((a, b) => a.diffPct - b.diffPct);
  const best = scored[0];
  return { ...best, sure: best.diffPct <= 0.02 && Math.abs(best.diff) <= 50 };
}

function addDays(iso, d) {
  const [y, m, day] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + d));
  return dt.toISOString().slice(0, 10);
}
