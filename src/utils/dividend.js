import { getDebet, getKredit } from './verificationAmounts';
import { classifyAccount, isBooked } from './reportCalculations';
import { round2 } from './fixedAssets';

/**
 * Aktiebolagets utdelning.
 *
 * Utdelning får bara ske av fritt eget kapital (ABL 17 kap. 3 §), och även
 * då bara om det med hänsyn till verksamhetens art, omfattning och risker
 * är försvarligt (försiktighetsregeln). Den här modulen räknar ut det fria
 * egna kapitalet ur bokföringen — försiktighetsbedömningen gör styrelsen.
 *
 * Bokföring i två steg:
 *   beslut på stämman   D fritt eget kapital (t.ex. 2091)   K 2898 Outtagen utdelning
 *   utbetalning         D 2898                              K bankkonto
 *
 * Utdelning till privatpersoner ska dessutom redovisas i en kontrolluppgift
 * (KU31) — det görs inte här.
 */

export const DIVIDEND_LIABILITY_ACCOUNT = '2898';
export const DIVIDEND_SOURCE_ACCOUNTS = ['2091', '2098', '2099', '2097'];

const isFreeEquity = (code) => /^209[0-9]$/.test(String(code || ''));

/** Fritt eget kapital till och med ett datum: saldot på 2090–2099 plus
 * resultat som ännu inte bokförts in på ett eget kapital-konto. Kreditsida
 * positiv. */
export function freeEquityAt(verifications, accounts, date) {
  const byCode = new Map((accounts || []).map(a => [a.code, a]));
  const perAccount = new Map();
  let unclosedResult = 0;
  (verifications || []).forEach(v => {
    if (!isBooked(v) || !v.date || v.date > date) return;
    (v.rows || []).forEach(r => {
      const net = getKredit(r) - getDebet(r);
      if (isFreeEquity(r.account)) perAccount.set(r.account, (perAccount.get(r.account) || 0) + net);
      else {
        const type = classifyAccount(byCode.get(r.account) || { code: r.account });
        if (type === 'intakt' || type === 'kostnad') unclosedResult += net;
      }
    });
  });
  const total = round2([...perAccount.values()].reduce((s, n) => s + n, 0) + unclosedResult);
  return {
    total,
    unclosedResult: round2(unclosedResult),
    byAccount: [...perAccount.entries()].map(([code, amount]) => ({ code, amount: round2(amount) })).sort((a, b) => a.code.localeCompare(b.code)),
  };
}

export function checkDividend({ verifications, accounts, date, amount }) {
  const free = freeEquityAt(verifications, accounts, date);
  const value = round2(Number(amount) || 0);
  const outstanding = round2(-balance(verifications, DIVIDEND_LIABILITY_ACCOUNT, date));
  return {
    freeEquity: free.total,
    unclosedResult: free.unclosedResult,
    maxDividend: Math.max(0, free.total),
    outstanding,
    withinFreeEquity: value <= Math.max(0, free.total) + 0.005,
    amount: value,
  };
}

function balance(verifications, account, date) {
  return (verifications || []).reduce((sum, v) => {
    if (!isBooked(v) || !v.date || v.date > date) return sum;
    return sum + (v.rows || []).reduce((s, r) => (r.account === account ? s + getDebet(r) - getKredit(r) : s), 0);
  }, 0);
}

export function dividendPerShare(amount, shares) {
  const n = Number(shares) || 0;
  return n > 0 ? round2((Number(amount) || 0) / n) : null;
}

export function buildDividendDecision(dividend) {
  const amount = round2(dividend.amount);
  return {
    date: dividend.date,
    description: `Utdelningsbeslut${dividend.note ? `: ${dividend.note}` : ''}`,
    source: 'dividend',
    sourceId: `dividend_${dividend.id}`,
    rows: [
      { account: dividend.sourceAccount, debet: amount, kredit: 0 },
      { account: DIVIDEND_LIABILITY_ACCOUNT, debet: 0, kredit: amount },
    ],
  };
}

export function buildDividendPayment(dividend, { date, bankAccount = '1930' }) {
  const amount = round2(dividend.amount);
  return {
    date,
    description: `Utbetalning av utdelning${dividend.note ? `: ${dividend.note}` : ''}`,
    source: 'dividend',
    sourceId: `dividend_${dividend.id}_payment`,
    rows: [
      { account: DIVIDEND_LIABILITY_ACCOUNT, debet: amount, kredit: 0 },
      { account: bankAccount, debet: 0, kredit: amount },
    ],
  };
}

export function dividendStatus(dividend, verifications) {
  const ids = new Set((verifications || [])
    .filter(v => v.source === 'dividend' && (v.status || 'booked') !== 'draft')
    .map(v => v.sourceId));
  return { decided: ids.has(`dividend_${dividend.id}`), paid: ids.has(`dividend_${dividend.id}_payment`) };
}

/** Utdelningsgränsen enligt ABL 17 kap. 3 § och 18 kap. 4 §: det fria egna
 * kapitalet i den senast fastställda balansräkningen (räkenskapsårets slut
 * före beslutet), minus utdelning som redan beslutats efter den dagen.
 * Årets pågående resultat räknas alltså inte. balanceDate är slutdagen för
 * det räkenskapsår som balansräkningen gäller. */
export function dividendLimit({ verifications, accounts, dividends = [], balanceDate, date, amount = 0, excludeId = null }) {
  const free = freeEquityAt(verifications, accounts, balanceDate).total;
  const decidedSince = round2((dividends || [])
    .filter(d => d.id !== excludeId && d.date > balanceDate && (!date || d.date <= date))
    .reduce((s, d) => s + (Number(d.amount) || 0), 0));
  const maxDividend = Math.max(0, round2(free - decidedSince));
  const value = round2(Number(amount) || 0);
  return { freeEquity: free, decidedSince, maxDividend, amount: value, withinLimit: value <= maxDividend + 0.005 };
}

/** Utbetalningsdagen för en utdelning, eller null om den inte är utbetald. */
export function dividendPaymentDate(dividend, verifications) {
  const v = (verifications || []).find(x => x.source === 'dividend' && x.sourceId === `dividend_${dividend.id}_payment` && (x.status || 'booked') !== 'draft');
  return v?.date || null;
}
