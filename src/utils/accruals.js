import { round2, lastDayOfMonth } from './fixedAssets';

/**
 * Periodiseringar vid bokslut — upplupna och förutbetalda poster.
 *
 * Kostnader och intäkter ska hamna på den period de HÖR till, inte den de
 * betalas eller faktureras på. Fyra fall, alla med automatisk återföring
 * första dagen i nästa räkenskapsår:
 *
 *   förutbetald kostnad  betalt nu, avser nästa period   D 1710  K kostnadskonto
 *   upplupen kostnad     förbrukat, ej fakturerat än     D kostnadskonto  K 2990
 *   upplupen intäkt      levererat, ej fakturerat än     D 1790  K intäktskonto
 *   förutbetald intäkt   fakturerat, avser nästa period  D intäktskonto  K 2970
 *
 * Själva posten sparas som en vanlig verifikation (source 'accrual'). Här
 * lagras bara PLANEN (company.accruals) så återföringen kan hittas igen;
 * om återföringen bokförts avgörs av verifikationerna, inte av en flagga.
 */

export const ACCRUAL_KINDS = [
  {
    id: 'prepaid_expense', label: 'Förutbetald kostnad', balanceAccount: '1710', side: 'expense',
    help: 'Du har betalat i år för något som avser nästa år, t.ex. hyra eller försäkring.',
    counterLabel: 'Kostnadskonto', counterDefault: '5010',
  },
  {
    id: 'accrued_expense', label: 'Upplupen kostnad', balanceAccount: '2990', side: 'expense',
    help: 'Du har förbrukat något i år men fått fakturan först nästa år, t.ex. el eller revisor.',
    counterLabel: 'Kostnadskonto', counterDefault: '5020',
  },
  {
    id: 'accrued_income', label: 'Upplupen intäkt', balanceAccount: '1790', side: 'income',
    help: 'Du har levererat i år men fakturerar först nästa år.',
    counterLabel: 'Intäktskonto', counterDefault: '3001',
  },
  {
    id: 'prepaid_income', label: 'Förutbetald intäkt', balanceAccount: '2970', side: 'income',
    help: 'Kunden har betalat i förskott för något du levererar nästa år.',
    counterLabel: 'Intäktskonto', counterDefault: '3001',
  },
];

export function accrualKind(id) {
  return ACCRUAL_KINDS.find(k => k.id === id) || null;
}

/** Dagen efter bokföringsdatumet — återföringen sker första dagen i nästa
 * period. Bokslutsdatum är i praktiken alltid räkenskapsårets sista dag. */
export function reversalDateFor(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function rowsFor(kind, amount, counterAccount, reverse) {
  const a = round2(amount);
  // Kostnadssidan: bokföring = D balanskonto/K kostnad (förutbetald) resp.
  // D kostnad/K balanskonto (upplupen). Intäktssidan är spegelvänd.
  const balanceIsDebit = kind.id === 'prepaid_expense' || kind.id === 'accrued_income';
  const debitBalance = reverse ? !balanceIsDebit : balanceIsDebit;
  return debitBalance
    ? [{ account: kind.balanceAccount, debet: a, kredit: 0 }, { account: counterAccount, debet: 0, kredit: a }]
    : [{ account: counterAccount, debet: a, kredit: 0 }, { account: kind.balanceAccount, debet: 0, kredit: a }];
}

export function buildAccrualVerification(accrual) {
  const kind = accrualKind(accrual.kind);
  return {
    date: accrual.date,
    description: `${kind.label}: ${accrual.description}`,
    source: 'accrual',
    sourceId: `accrual_${accrual.id}`,
    rows: rowsFor(kind, accrual.amount, accrual.counterAccount, false),
  };
}

export function buildReversalVerification(accrual) {
  const kind = accrualKind(accrual.kind);
  return {
    date: accrual.reversalDate || reversalDateFor(accrual.date),
    description: `Återföring ${kind.label.toLowerCase()}: ${accrual.description}`,
    source: 'accrual',
    sourceId: `accrual_${accrual.id}_reversal`,
    rows: rowsFor(kind, accrual.amount, accrual.counterAccount, true),
  };
}

/** Vilka periodiseringar som har bokförts / återförts, avläst från
 * verifikationerna själva. */
export function accrualStatus(accrual, verifications) {
  const ids = new Set((verifications || [])
    .filter(v => v.source === 'accrual' && (v.status || 'booked') !== 'draft')
    .map(v => v.sourceId));
  return {
    booked: ids.has(`accrual_${accrual.id}`),
    reversed: ids.has(`accrual_${accrual.id}_reversal`),
  };
}

/** Återföringar vars datum passerat men som ännu inte bokförts — de som
 * annars glöms och gör att kostnaden räknas två gånger. */
export function dueReversals(accruals, verifications, today) {
  return (accruals || []).filter(a => {
    const s = accrualStatus(a, verifications);
    return s.booked && !s.reversed && (a.reversalDate || reversalDateFor(a.date)) <= today;
  });
}

export function accrualsTotal(accruals, verifications) {
  return round2((accruals || [])
    .filter(a => accrualStatus(a, verifications).booked)
    .reduce((s, a) => s + Number(a.amount || 0), 0));
}

export { lastDayOfMonth };
