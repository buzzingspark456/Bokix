import { round2, lastDayOfMonth } from './fixedAssets';
import { lockedPeriodFor } from './fiscalYear';

/**
 * Månadsperiodisering (2026-11-22, som Bokio och Fortnox): ett belopp som är
 * bokfört på ett resultatkonto fördelas jämnt över flera månader, till
 * exempel en årshyra eller en årslicens.
 *
 *   1. Omföringen (en gång): beloppet flyttas från resultatkontot till ett
 *      balanskonto, så att det inte belastar en enda månad.
 *        kostnad: D 1710/1790  K kostnadskontot
 *        intäkt:  D intäktskontot  K 2970
 *   2. Varje månad: en del flyttas tillbaka till resultatkontot.
 *        kostnad: D kostnadskontot  K 1710/1790
 *        intäkt:  D 2970  K intäktskontot
 *
 * Delarna är lika stora i hela ören; sista månaden tar öresresten, så att
 * summan alltid blir exakt beloppet och balanskontot går till noll.
 * Månadens verifikation dateras sista dagen i månaden och kan bokas först
 * när den dagen har kommit.
 *
 * Planen sparas i company.accrualSpreads; vad som är bokfört avgörs av
 * verifikationerna (source 'accrual_spread'), inte av en flagga.
 * Ångra bokför en rättelse av det som ännu inte är fördelat, ingenting tas bort.
 */

export const SPREAD_SOURCE = 'accrual_spread';

/** Kostnad eller intäkt utifrån kontot: klass 3 är intäkter, 4–8 kostnader
 * (finansiella intäkter i 8 avgörs av vilken sida beloppet stod på). */
export function sideForAccount(account, sign = 1) {
  const c = String(account || '');
  if (c.startsWith('3')) return 'income';
  if (c.startsWith('8')) return sign < 0 ? 'income' : 'expense';
  return 'expense';
}

/** Balanskontot: hyra 1710, övriga kostnader 1790, intäkter 2970 (BAS). */
export function balanceAccountFor(side, account) {
  if (side === 'income') return '2970';
  return /^50[1-2]/.test(String(account || '')) ? '1710' : '1790';
}

export function isResultAccount(account) {
  return /^[3-8]\d{3}$/.test(String(account || ''));
}

function monthIndex(ym) { const [y, m] = String(ym).split('-').map(Number); return y * 12 + (m - 1); }
function indexToMonth(i) { return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`; }

export function spreadMonths(startMonth, count) {
  const n = Math.max(1, Math.min(120, Math.round(Number(count) || 1)));
  const s = monthIndex(startMonth);
  return Array.from({ length: n }, (_, k) => indexToMonth(s + k));
}

/** Lika delar i hela ören; sista delen tar resten. */
export function spreadShares(amount, count) {
  const total = round2(Math.abs(Number(amount) || 0));
  const n = Math.max(1, Math.round(Number(count) || 1));
  const each = Math.floor((total / n) * 100) / 100;
  const shares = Array.from({ length: n }, () => each);
  shares[n - 1] = round2(total - each * (n - 1));
  return shares;
}

/** Hela planen: månad, del och datum. */
export function spreadPlan(spread) {
  const months = spreadMonths(spread.startMonth, spread.months);
  const shares = spreadShares(spread.amount, months.length);
  return months.map((month, i) => ({ month, amount: shares[i], date: lastDayOfMonth(month) }));
}

const rows = (debit, credit, amount) => [
  { account: debit, debet: round2(amount), kredit: 0 },
  { account: credit, debet: 0, kredit: round2(amount) },
];

export function buildSpreadStart(spread) {
  const amount = round2(Math.abs(spread.amount));
  return {
    date: spread.date,
    description: `Periodisering: ${spread.description}`,
    source: SPREAD_SOURCE,
    sourceId: `spread_${spread.id}`,
    rows: spread.side === 'income'
      ? rows(spread.account, spread.balanceAccount, amount)
      : rows(spread.balanceAccount, spread.account, amount),
  };
}

export function buildSpreadMonth(spread, month, amount) {
  return {
    date: lastDayOfMonth(month),
    description: `Periodisering ${month}: ${spread.description}`,
    source: SPREAD_SOURCE,
    sourceId: `spread_${spread.id}_${month}`,
    rows: spread.side === 'income'
      ? rows(spread.balanceAccount, spread.account, amount)
      : rows(spread.account, spread.balanceAccount, amount),
  };
}

/** Vad som är bokfört, avläst från verifikationerna. */
export function spreadStatus(spread, verifications) {
  const ids = new Set((verifications || [])
    .filter(v => v.source === SPREAD_SOURCE && (v.status || 'booked') !== 'draft')
    .map(v => v.sourceId));
  const plan = spreadPlan(spread);
  const bookedMonths = plan.filter(p => ids.has(`spread_${spread.id}_${p.month}`));
  const distributed = round2(bookedMonths.reduce((s, p) => s + p.amount, 0));
  const undone = ids.has(`spread_${spread.id}_undo`);
  const started = ids.has(`spread_${spread.id}`);
  return {
    started,
    undone,
    booked: bookedMonths.length,
    total: plan.length,
    distributed,
    remaining: round2(Math.abs(spread.amount) - distributed),
    done: started && !undone && bookedMonths.length === plan.length,
    next: undone ? null : plan.find(p => !ids.has(`spread_${spread.id}_${p.month}`)) || null,
  };
}

/**
 * Månader vars sista dag har kommit men som inte är bokförda. Månader i ett
 * låst räkenskapsår tas inte med (de räknas i blockedByLock).
 */
export function dueSpreadMonths(spreads, verifications, today, lockedFiscalYears) {
  const due = [];
  let blockedByLock = 0;
  (spreads || []).forEach(spread => {
    const st = spreadStatus(spread, verifications);
    if (!st.started || st.undone) return;
    const ids = new Set((verifications || []).filter(v => v.source === SPREAD_SOURCE && (v.status || 'booked') !== 'draft').map(v => v.sourceId));
    spreadPlan(spread).forEach(p => {
      if (p.date > today || ids.has(`spread_${spread.id}_${p.month}`)) return;
      if (lockedPeriodFor(p.date, lockedFiscalYears)) { blockedByLock += 1; return; }
      due.push({ spread, month: p.month, amount: p.amount });
    });
  });
  due.sort((a, b) => a.month.localeCompare(b.month));
  return { due, blockedByLock, total: round2(due.reduce((s, d) => s + d.amount, 0)) };
}

/** Ångra: det som ännu inte fördelats flyttas tillbaka till resultatkontot. */
export function buildSpreadUndo(spread, verifications, date) {
  const st = spreadStatus(spread, verifications);
  if (!st.started || st.undone || st.remaining <= 0) return null;
  return {
    date,
    description: `Ångrad periodisering: ${spread.description}`,
    source: SPREAD_SOURCE,
    sourceId: `spread_${spread.id}_undo`,
    rows: spread.side === 'income'
      ? rows(spread.balanceAccount, spread.account, st.remaining)
      : rows(spread.account, spread.balanceAccount, st.remaining),
  };
}

/**
 * Förslag ur en verifikation: ett belopp per resultatkonto (debet minus
 * kredit), som i Bokio där man väljer vilka konton som ska periodiseras.
 */
export function spreadCandidates(verification, getDebet, getKredit) {
  const byAccount = new Map();
  (verification?.rows || []).forEach(r => {
    if (!isResultAccount(r.account)) return;
    byAccount.set(r.account, round2((byAccount.get(r.account) || 0) + getDebet(r) - getKredit(r)));
  });
  return [...byAccount].filter(([, net]) => Math.abs(net) >= 0.01).map(([account, net]) => {
    const side = sideForAccount(account, net >= 0 ? 1 : -1);
    return { account, amount: round2(Math.abs(net)), side, balanceAccount: balanceAccountFor(side, account) };
  });
}
