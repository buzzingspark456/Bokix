import { getDebet, getKredit } from './verificationAmounts';
import { invoiceCustomerRemainingSek } from './rotRutConfig';

// ── Kontrollera bokföringen (2026-11-21) ──────────────────────────────────
//
// Går igenom bokföringen och letar efter det som brukar bli fel i ett litet
// företag. Rättar ingenting själv: varje fynd får en förklaring och en väg
// till rätt ställe, så att användaren bestämmer. Gissar inte heller: en
// kontroll som inte säkert kan avgöra något säger "stämmer inte, så här kan
// det bero på" i stället för att peka ut ett fel.
//
// Varje kontroll ger { id, level, count, items, ... }:
//   level  'ok' | 'warn' | 'error'
//   items  upp till MAX_ITEMS rader att visa, med verificationId när det går
// Texterna ligger i komponenten (i18n), här finns bara siffrorna.

export const MAX_ITEMS = 20;
const EPS = 0.005;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const isBooked = (v) => (v?.status || 'booked') !== 'draft';

/** Saldo (debet − kredit) på ett konto, bokförda verifikationer t.o.m. datumet. */
export function accountBalance(verifications, account, through = '9999-12-31') {
  let sum = 0;
  for (const v of verifications || []) {
    if (!isBooked(v) || (v.date && v.date > through)) continue;
    for (const r of v.rows || []) if (r.account === account) sum += getDebet(r) - getKredit(r);
  }
  return round2(sum);
}

const verLabel = (v) => `${v.series || ''}${v.number ?? ''}`.trim();
const verItem = (v, extra = {}) => ({ verificationId: v.id, ver: verLabel(v), date: v.date || '', text: v.description || '', ...extra });

/** När verifikationen skapades, om det går att veta. Nya verifikationer får
 * id `${Date.now()}_${n}` (App.jsx handleAddVerification). */
export function verificationCreatedAt(v) {
  const m = /^(\d{13})_/.exec(String(v?.id || ''));
  return m ? new Date(Number(m[1])).toISOString() : null;
}

// 1. Debet och kredit ska vara lika stora på varje verifikation.
function checkBalance(verifications) {
  const bad = (verifications || []).filter(isBooked).map(v => {
    const d = (v.rows || []).reduce((s, r) => s + getDebet(r), 0);
    const k = (v.rows || []).reduce((s, r) => s + getKredit(r), 0);
    return { v, diff: round2(d - k) };
  }).filter(x => Math.abs(x.diff) > EPS);
  return { id: 'balance', level: bad.length ? 'error' : 'ok', count: bad.length, items: bad.slice(0, MAX_ITEMS).map(x => verItem(x.v, { amount: x.diff })) };
}

const isVatAccount = (a) => /^26[1-4]\d$/.test(String(a));

// 2. Moms bokförd i en period som redan är deklarerad, efter deklarationen.
function checkLateVat(verifications, vatPeriods) {
  const periods = Object.entries(vatPeriods || {}).map(([key, p]) => ({ key, ...p })).filter(p => p.periodStart && p.periodEnd && p.bookedAt);
  const hits = [];
  for (const v of verifications || []) {
    if (!isBooked(v) || !v.date || v.source === 'vat_declaration') continue;
    if (!(v.rows || []).some(r => isVatAccount(r.account) && (getDebet(r) || getKredit(r)))) continue;
    const created = verificationCreatedAt(v);
    if (!created) continue;
    const p = periods.find(x => v.date >= x.periodStart && v.date <= x.periodEnd);
    if (p && created > p.bookedAt) hits.push(verItem(v, { period: p.key }));
  }
  return { id: 'late_vat', level: hits.length ? 'warn' : 'ok', count: hits.length, items: hits.slice(0, MAX_ITEMS) };
}

// 3. Kundfordringar (1510) mot obetalda bokförda kundfakturor.
function checkReceivables(verifications, invoices) {
  const open = (invoices || []).filter(i => i.type !== 'quote' && i.status === 'sent');
  const expected = round2(open.reduce((s, i) => s + invoiceCustomerRemainingSek(i), 0));
  const booked = accountBalance(verifications, '1510');
  const diff = round2(booked - expected);
  const tolerance = Math.max(1, open.length);
  return { id: 'receivables', level: Math.abs(diff) > tolerance ? 'warn' : 'ok', count: Math.abs(diff) > tolerance ? 1 : 0, booked, expected, diff, openCount: open.length, items: [] };
}

// 4. Leverantörsskulder (2440) mot obetalda leverantörsfakturor.
function checkPayables(verifications, expenses) {
  const open = (expenses || []).filter(e => e.type === 'supplier_invoice' && e.status !== 'paid' && !e.paidByOwnerPrivately);
  const expected = round2(open.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const booked = round2(-accountBalance(verifications, '2440'));
  const diff = round2(booked - expected);
  const tolerance = Math.max(1, open.length);
  return { id: 'payables', level: Math.abs(diff) > tolerance ? 'warn' : 'ok', count: Math.abs(diff) > tolerance ? 1 : 0, booked, expected, diff, openCount: open.length, items: [] };
}

// 5. Kassan kan aldrig vara negativ. Företagskontot bara med kredit.
function checkNegativeMoney(verifications) {
  const cash = accountBalance(verifications, '1910');
  const bank = accountBalance(verifications, '1930');
  const items = [];
  if (cash < -EPS) items.push({ account: '1910', amount: cash });
  if (bank < -EPS) items.push({ account: '1930', amount: bank });
  return { id: 'negative_money', level: cash < -EPS ? 'error' : bank < -EPS ? 'warn' : 'ok', count: items.length, items };
}

// 6. Kostnader utan underlag. Bara det användaren själv bokfört: lön, moms,
// avskrivningar och liknande skapar Bokix ur egna uppgifter.
const NEEDS_RECEIPT = new Set(['manual', 'expense', 'bank_import']);
const isCostAccount = (a) => { const n = Number(a); return n >= 4000 && n <= 6999; };
const hasAttachment = (v) => Boolean(v.attachmentUrl || (Array.isArray(v.attachments) && v.attachments.length) || (Array.isArray(v.documentIds) && v.documentIds.length));
function checkReceipts(verifications) {
  const hits = (verifications || []).filter(v => isBooked(v)
    && NEEDS_RECEIPT.has(v.source || 'manual')
    && (v.rows || []).some(r => isCostAccount(r.account) && getDebet(r) > 0)
    && !hasAttachment(v));
  return { id: 'receipts', level: hits.length ? 'warn' : 'ok', count: hits.length, items: hits.slice(0, MAX_ITEMS).map(v => verItem(v, { amount: round2((v.rows || []).reduce((s, r) => s + getDebet(r), 0)) })) };
}

// 7. Samma händelse bokförd två gånger: samma dag, samma belopp, samma text.
const AUTO_SOURCES = new Set(['payroll', 'depreciation', 'accrual', 'vat_declaration', 'year_end_close', 'year_open_transfer']);
function checkDuplicates(verifications) {
  const groups = new Map();
  for (const v of verifications || []) {
    if (!isBooked(v) || AUTO_SOURCES.has(v.source)) continue;
    const total = round2((v.rows || []).reduce((s, r) => s + getDebet(r), 0));
    if (!total) continue;
    const key = `${v.date}|${total}|${String(v.description || '').trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }
  const dups = [...groups.values()].filter(g => g.length > 1);
  const items = dups.slice(0, MAX_ITEMS).map(g => verItem(g[1], { amount: round2((g[1].rows || []).reduce((s, r) => s + getDebet(r), 0)), others: g.map(verLabel) }));
  return { id: 'duplicates', level: dups.length ? 'warn' : 'ok', count: dups.length, items };
}

// 8. Banktransaktioner som legat obokade länge.
function checkOldBank(bankTransactions, today) {
  const limit = new Date(new Date(`${today}T00:00:00Z`).getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const old = (bankTransactions || []).filter(t => t.status === 'unmatched' && t.date && t.date < limit);
  return { id: 'old_bank', level: old.length ? 'warn' : 'ok', count: old.length, items: old.slice(0, MAX_ITEMS).map(t => ({ date: t.date, text: t.description || t.text || '', amount: Number(t.amount) || 0 })) };
}

// 9. Verifikationer med datum i framtiden.
function checkFuture(verifications, today) {
  const hits = (verifications || []).filter(v => isBooked(v) && v.date && v.date > today);
  return { id: 'future', level: hits.length ? 'warn' : 'ok', count: hits.length, items: hits.slice(0, MAX_ITEMS).map(v => verItem(v)) };
}

/**
 * Alla kontroller. `today` som 'YYYY-MM-DD'. Ordningen är den som visas:
 * fel först, sedan det som oftast behöver åtgärdas.
 */
export function runBookkeepingCheck({ verifications = [], invoices = [], expenses = [], vatPeriods = {}, bankTransactions = [], today = new Date().toISOString().slice(0, 10), vatExempt = false } = {}) {
  const checks = [
    checkBalance(verifications),
    checkNegativeMoney(verifications),
    ...(vatExempt ? [] : [checkLateVat(verifications, vatPeriods)]),
    checkReceivables(verifications, invoices),
    checkPayables(verifications, expenses),
    checkDuplicates(verifications),
    checkReceipts(verifications),
    checkOldBank(bankTransactions, today),
    checkFuture(verifications, today),
  ];
  const rank = { error: 0, warn: 1, ok: 2 };
  checks.sort((a, b) => rank[a.level] - rank[b.level]);
  return {
    checks,
    errors: checks.filter(c => c.level === 'error').length,
    warnings: checks.filter(c => c.level === 'warn').length,
  };
}
