import { getDebet, getKredit } from './verificationAmounts';
import { classifyAccount, isBooked } from './reportCalculations';
import { round2 } from './fixedAssets';

/**
 * Arbetsblad (bokslutsblad) — den klassiska sex-kolumnsöversikten som binder
 * ihop råbalansen, bokslutsjusteringarna och de två slutrapporterna:
 *
 *   Råbalans → Justeringar → Justerad råbalans → Resultaträkning + Balansräkning
 *
 * Justeringar är verifikationer av typen avskrivning, periodisering och
 * lagerjustering (eller de som uttryckligen märkts `isAdjustment`). Allt
 * annat är löpande bokföring och hamnar i råbalansen.
 *
 * Resultatkonton (klass 3–8) räknas bara inom räkenskapsåret; balanskonton
 * (klass 1–2) är kumulativa fram till årets slut. Bokslutsverifikationen
 * (`year_end_close`) inom året lämnas utanför — annars vore resultatkontona
 * redan nollställda och arbetsbladet skulle visa ingenting. Årets resultat
 * (och eventuellt resultat från tidigare, ännu inte bokslutade år) läggs som
 * egna rader på balanssidan så att kolumnerna alltid summerar till noll.
 */

export const ADJUSTMENT_SOURCES = ['depreciation', 'accrual', 'inventory'];

export function isAdjustment(ver) {
  return ver?.isAdjustment === true || ADJUSTMENT_SOURCES.includes(ver?.source);
}

const isResultClass = (type) => type === 'intakt' || type === 'kostnad';

/** Ett saldo i två kolumner: positivt netto = debet, negativt = kredit. */
function sides(net) {
  const n = round2(net);
  return n >= 0 ? { debet: n, kredit: 0 } : { debet: 0, kredit: -n };
}

/** Arbetsbladets rader i fyra grupper med en delsumma per kolumn. Tomma
 * grupper hoppas över. */
const WORKSHEET_GROUPS = [
  { key: 'assets', type: 'tillgang' },
  { key: 'equityAndLiabilities', type: 'skuld_kapital' },
  { key: 'income', type: 'intakt' },
  { key: 'costs', type: 'kostnad' },
];
const WORKSHEET_COLUMNS = ['raw', 'adjustments', 'adjusted', 'income', 'balance'];

export function groupWorksheetRows(rows) {
  return WORKSHEET_GROUPS
    .map(({ key, type }) => {
      const groupRows = rows.filter(r => r.type === type);
      const totals = Object.fromEntries(WORKSHEET_COLUMNS.map(column => [column, {
        debet: round2(groupRows.reduce((s, r) => s + r[column].debet, 0)),
        kredit: round2(groupRows.reduce((s, r) => s + r[column].kredit, 0)),
      }]));
      return { key, rows: groupRows, totals };
    })
    .filter(g => g.rows.length > 0);
}

export function computeWorksheet(verifications, accounts, start, end) {
  const byCode = new Map((accounts || []).map(a => [a.code, a]));
  const startStr = start;
  const endStr = end;
  const acc = new Map(); // code → { raw, adj }
  let priorResult = 0;

  const touch = (code) => {
    if (!acc.has(code)) acc.set(code, { raw: 0, adj: 0 });
    return acc.get(code);
  };

  (verifications || []).forEach(v => {
    if (!isBooked(v) || !v.date || v.date > endStr) return;
    const inYear = v.date >= startStr;
    if (v.source === 'year_end_close' && inYear) return;
    const adj = isAdjustment(v);
    (v.rows || []).forEach(r => {
      const net = getDebet(r) - getKredit(r);
      const type = classifyAccount(byCode.get(r.account) || { code: r.account });
      if (isResultClass(type)) {
        if (!inYear) { priorResult += net; return; }
      } else if (type == null) {
        return;
      }
      const slot = touch(r.account);
      if (adj && inYear) slot.adj += net;
      else slot.raw += net;
    });
  });

  const rows = [...acc.entries()]
    .map(([code, { raw, adj }]) => {
      const account = byCode.get(code);
      const type = classifyAccount(account || { code });
      const adjusted = raw + adj;
      const row = {
        code,
        name: account?.name || 'Okänt konto',
        type,
        raw: sides(raw),
        adjustments: sides(adj),
        adjusted: sides(adjusted),
        income: { debet: 0, kredit: 0 },
        balance: { debet: 0, kredit: 0 },
      };
      if (isResultClass(type)) row.income = sides(adjusted);
      else row.balance = sides(adjusted);
      return row;
    })
    .filter(r => Math.abs(r.raw.debet) + Math.abs(r.raw.kredit) + Math.abs(r.adjustments.debet) + Math.abs(r.adjustments.kredit) > 0.004)
    .sort((a, b) => a.code.localeCompare(b.code));

  const sum = (pick) => round2(rows.reduce((s, r) => s + pick(r), 0));
  const incomeDebet = sum(r => r.income.debet);
  const incomeKredit = sum(r => r.income.kredit);
  // Årets resultat = intäkter (kredit) − kostnader (debet).
  const yearResult = round2(incomeKredit - incomeDebet);
  const priorResultAmount = round2(-priorResult);

  const totals = {
    raw: { debet: sum(r => r.raw.debet), kredit: sum(r => r.raw.kredit) },
    adjustments: { debet: sum(r => r.adjustments.debet), kredit: sum(r => r.adjustments.kredit) },
    adjusted: { debet: sum(r => r.adjusted.debet), kredit: sum(r => r.adjusted.kredit) },
    income: { debet: incomeDebet, kredit: incomeKredit },
    balance: { debet: sum(r => r.balance.debet), kredit: sum(r => r.balance.kredit) },
  };

  // Balanssidan får årets resultat och ev. tidigare års resultat som
  // kompletterande rader — vinst på kredit-sidan, förlust på debet-sidan.
  const balanceDebet = round2(totals.balance.debet + (yearResult < 0 ? -yearResult : 0) + (priorResultAmount < 0 ? -priorResultAmount : 0));
  const balanceKredit = round2(totals.balance.kredit + (yearResult > 0 ? yearResult : 0) + (priorResultAmount > 0 ? priorResultAmount : 0));

  return {
    rows,
    totals,
    yearResult,
    priorResult: priorResultAmount,
    // Resultatkolumnerna balanseras med årets resultat på den mindre sidan.
    incomeBalanced: {
      debet: round2(incomeDebet + (yearResult > 0 ? yearResult : 0)),
      kredit: round2(incomeKredit + (yearResult < 0 ? -yearResult : 0)),
    },
    balanceWithResult: { debet: balanceDebet, kredit: balanceKredit },
    // Råbalansen med tidigare års resultat, som saknar egna rader: så går
    // summorna ihop på skärmen även när ett år inte är bokslutat.
    rawWithPrior: {
      debet: round2(totals.raw.debet + (priorResultAmount < 0 ? -priorResultAmount : 0)),
      kredit: round2(totals.raw.kredit + (priorResultAmount > 0 ? priorResultAmount : 0)),
    },
    adjustedWithPrior: {
      debet: round2(totals.adjusted.debet + (priorResultAmount < 0 ? -priorResultAmount : 0)),
      kredit: round2(totals.adjusted.kredit + (priorResultAmount > 0 ? priorResultAmount : 0)),
    },
    adjustmentsTotal: totals.adjustments.debet,
    // Kundfordringar på kreditsidan: kunder har betalat mer än det som är
    // fakturerat, oftast en betalning som är bokförd utan sin faktura.
    negativeReceivables: rows
      .filter(r => r.code >= '1510' && r.code <= '1519' && r.adjusted.kredit > 0)
      .map(r => ({ code: r.code, name: r.name, amount: r.adjusted.kredit })),
    hasAdjustments: rows.some(r => r.adjustments.debet !== 0 || r.adjustments.kredit !== 0),
    // Grundkontrollen: all bokföring summerar till noll i råbalansen. Tidigare
    // års resultat står inte på egna rader där men är en del av summan, annars
    // larmar kontrollen för varje företag med ett år som inte är bokslutat.
    rawInBalance: Math.abs(totals.raw.debet - totals.raw.kredit + priorResult) < 0.01,
    balanceInBalance: Math.abs(balanceDebet - balanceKredit) < 0.01,
  };
}
