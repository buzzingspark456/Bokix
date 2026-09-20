import { getDebet, getKredit } from './verificationAmounts';
import { round2 } from './fixedAssets';

/**
 * Avstämning av bank och kassa.
 *
 * Kontoutdragets saldo ska stämma med saldot på bokföringskontot (1930 för
 * huvudkontot, 1910 för kassan). Skillnaden förklaras av det som redan
 * ligger på kontoutdraget men ännu inte bokförts, alltså importerade
 * banktransaktioner med status "Ej hanterad":
 *
 *   förväntat saldo i bokföringen = bokfört saldo + ej hanterade transaktioner
 *   oförklarad differens          = kontoutdragets saldo − förväntat saldo
 *
 * Är den oförklarade differensen 0 är kontot avstämt. Annars saknas något:
 * en bokning utan motsvarighet på kontoutdraget, en felaktigt bokad summa
 * eller en transaktion som inte importerats.
 *
 * Kassan har inget kontoutdrag — där räknar man kontanterna och jämför
 * direkt mot bokfört saldo.
 */

/** Saldot på ett konto (debet − kredit) till och med ett datum. */
export function ledgerBalance(verifications, account, date) {
  return round2((verifications || []).reduce((sum, v) => {
    if ((v.status || 'booked') === 'draft' || !v.date || v.date > date) return sum;
    return sum + (v.rows || []).reduce((s, r) => (r.account === account ? s + getDebet(r) - getKredit(r) : s), 0);
  }, 0));
}

/** Importerade transaktioner på det här bankkontot som ännu inte hanterats,
 * till och med datumet. `accountId` saknas på transaktioner från huvudkontot. */
export function unhandledTransactions(bankTransactions, accountId, date) {
  return (bankTransactions || []).filter(t =>
    t.status === 'unmatched'
    && (t.accountId || 'default') === (accountId || 'default')
    && (!t.date || t.date <= date));
}

export function reconcileBank({ verifications, bankTransactions, ledgerAccount, accountId, statementBalance, date }) {
  const booked = ledgerBalance(verifications, ledgerAccount, date);
  const pending = unhandledTransactions(bankTransactions, accountId, date);
  const pendingNet = round2(pending.reduce((s, t) => s + (Number(t.amount) || 0), 0));
  const statement = round2(Number(statementBalance) || 0);
  const difference = round2(statement - (booked + pendingNet));
  return {
    statementBalance: statement,
    ledgerBalance: booked,
    pendingCount: pending.length,
    pendingNet,
    expectedBalance: round2(booked + pendingNet),
    difference,
    reconciled: Math.abs(difference) < 0.005,
  };
}

export function reconcileCash({ verifications, ledgerAccount = '1910', countedAmount, date }) {
  const booked = ledgerBalance(verifications, ledgerAccount, date);
  const counted = round2(Number(countedAmount) || 0);
  const difference = round2(counted - booked);
  return { countedAmount: counted, ledgerBalance: booked, difference, reconciled: Math.abs(difference) < 0.005 };
}

/** Senaste sparade avstämning per bokföringskonto. */
export function latestReconciliations(reconciliations) {
  const byAccount = new Map();
  (reconciliations || []).forEach(r => {
    const current = byAccount.get(r.ledgerAccount);
    if (!current || String(r.date) > String(current.date) || (r.date === current.date && String(r.createdAt) > String(current.createdAt))) {
      byAccount.set(r.ledgerAccount, r);
    }
  });
  return byAccount;
}

/** Är det avstämt per (minst) ett visst datum, utan differens? Används av
 * årsbokslutets första steg. */
export function isReconciledThrough(reconciliations, date) {
  return (reconciliations || []).some(r => r.date >= date && Math.abs(Number(r.difference) || 0) < 0.005);
}
