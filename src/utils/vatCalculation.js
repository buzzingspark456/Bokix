import { getDebet, getKredit } from './verificationAmounts';
import {
  SALES_ACCOUNT_BY_RATE, OUTPUT_VAT_ACCOUNT_BY_RATE, INPUT_VAT_ACCOUNT,
  REVERSE_PURCHASE_KINDS, REVERSE_VAT_KINDS, EXEMPT_SALES_RUTA_BY_ACCOUNT, VAT_SETTLEMENT_ACCOUNT,
} from './vatConfig';
import { hasReverseVatRows, isReverseChargePurchaseAccount, isReverseVatAccount, missingReverseChargeRows, reverseChargePurchaseInfo } from './reverseCharge';

const SALES_ACCOUNTS_TAXED = [25, 12, 6].map(r => SALES_ACCOUNT_BY_RATE[r]); // 3001/3002/3003 — momsfritt (3004) kräver ingen momsrad
const RATE_BY_SALES_ACCOUNT = Object.fromEntries(Object.entries(SALES_ACCOUNT_BY_RATE).map(([rate, acc]) => [acc, Number(rate)]));
const RATE_BY_VAT_ACCOUNT = Object.fromEntries(Object.entries(OUTPUT_VAT_ACCOUNT_BY_RATE).map(([rate, acc]) => [acc, Number(rate)]));

// Momskontona för omvänd skattskyldighet och import: vilken sats och vilken
// ruta varje utgående konto hör till, och vilka ingående konton som går till
// ruta 48 tillsammans med 2641.
const REVERSE_OUTPUT_INFO = {};
const REVERSE_INPUT_ACCOUNTS = new Set();
for (const [vatKind, k] of Object.entries(REVERSE_VAT_KINDS)) {
  for (const [rate, acc] of Object.entries(k.output)) REVERSE_OUTPUT_INFO[acc] = { vatKind, rate: Number(rate), ruta: k.outputRuta[rate] };
  REVERSE_INPUT_ACCOUNTS.add(k.input);
}
const PURCHASE_RUTOR = Object.values(REVERSE_PURCHASE_KINDS).map(k => k.ruta);
const EXEMPT_SALES_RUTOR = [...new Set(Object.values(EXEMPT_SALES_RUTA_BY_ACCOUNT))];
const zeroRutor = (list) => Object.fromEntries(list.map(r => [r, 0]));
const zeroRates = () => ({ 25: 0, 12: 0, 6: 0 });

function inPeriod(dateStr, start, end) {
  return dateStr >= start && dateStr <= end;
}

function isBookedVerification(v) {
  return (v.status || 'booked') !== 'draft';
}

/** Standard matematisk avrundning till hela kronor (inte alltid ner/upp). */
export function roundKr(v) {
  return Math.round(v || 0);
}

/**
 * Beräknar en periods momssiffror utifrån faktiskt bokförda verifikationer —
 * inte fakturor/utgifter direkt, eftersom det är verifikationsraderna som är
 * den bokföringsmässiga sanningen (och redan har rätt konton bokförda av
 * Invoices/Expenses-flödena).
 *
 * Utöver rutorna sparas saldot per momskonto (vatAccounts). Den avrundade
 * versionen räknar rutorna ur de avrundade kontona, så att den avslutande
 * momsverifikationen alltid går ihop på kronan.
 */
export function computeVatPeriod({ verifications = [], periodStart, periodEnd }) {
  const underlagByRate = zeroRates();
  const outputVatByRate = zeroRates();
  // Underlag för inköp med omvänd skattskyldighet (ruta 20-24) och import (50).
  const purchaseByRuta = zeroRutor(PURCHASE_RUTOR);
  // Försäljning utan svensk moms (ruta 35-42).
  const exemptSalesByRuta = zeroRutor(EXEMPT_SALES_RUTOR);
  // Utgående moms per konto (kredit positivt) och ingående per konto (debet positivt).
  const vatAccounts = {};
  const addVat = (acc, v) => { vatAccounts[acc] = (vatAccounts[acc] || 0) + v; };
  let inputVatDomestic = 0;
  const touchedVerificationIds = new Set();

  const periodVers = verifications.filter(v => isBookedVerification(v) && inPeriod(v.date, periodStart, periodEnd));

  periodVers.forEach(v => {
    (v.rows || []).forEach(row => {
      const credit = getKredit(row) - getDebet(row);
      const debit = -credit;
      let touched = true;
      if (RATE_BY_SALES_ACCOUNT[row.account] !== undefined && row.account !== SALES_ACCOUNT_BY_RATE[0]) {
        underlagByRate[RATE_BY_SALES_ACCOUNT[row.account]] += credit;
      } else if (EXEMPT_SALES_RUTA_BY_ACCOUNT[row.account]) {
        exemptSalesByRuta[EXEMPT_SALES_RUTA_BY_ACCOUNT[row.account]] += credit;
      } else if (RATE_BY_VAT_ACCOUNT[row.account] !== undefined) {
        outputVatByRate[RATE_BY_VAT_ACCOUNT[row.account]] += credit;
      } else if (row.account === INPUT_VAT_ACCOUNT) {
        inputVatDomestic += debit;
      } else if (REVERSE_OUTPUT_INFO[row.account]) {
        addVat(row.account, credit);
      } else if (REVERSE_INPUT_ACCOUNTS.has(row.account)) {
        addVat(row.account, debit);
      } else if (isReverseChargePurchaseAccount(row.account)) {
        const info = reverseChargePurchaseInfo(row.account);
        purchaseByRuta[REVERSE_PURCHASE_KINDS[info.region].ruta] += debit;
      } else {
        touched = false;
      }
      if (touched) touchedVerificationIds.add(v.id);
    });
  });

  return summarize({
    periodStart, periodEnd,
    underlagByRate, outputVatByRate, purchaseByRuta, exemptSalesByRuta, vatAccounts, inputVatDomestic,
    touchedVerificationIds: [...touchedVerificationIds],
    periodVerifications: periodVers,
  });
}

// Härledda summor och de äldre fältnamnen (reverseVatByRate, reversePurchaseEu
// m.fl.) som vyerna och testerna redan läser.
function summarize(calc) {
  const { outputVatByRate, purchaseByRuta, vatAccounts, inputVatDomestic } = calc;
  const reverseVatByRate = zeroRates();
  const importVatByRate = zeroRates();
  let inputVatReverse = 0;
  for (const [acc, amount] of Object.entries(vatAccounts)) {
    const out = REVERSE_OUTPUT_INFO[acc];
    if (out) (out.vatKind === 'import' ? importVatByRate : reverseVatByRate)[out.rate] += amount;
    else if (REVERSE_INPUT_ACCOUNTS.has(acc)) inputVatReverse += amount;
  }
  const sum3 = (r) => r[25] + r[12] + r[6];
  const outputVatTotal = sum3(outputVatByRate);
  const reverseVatTotal = sum3(reverseVatByRate);
  const importVatTotal = sum3(importVatByRate);
  const inputVat = inputVatDomestic + inputVatReverse; // ruta 48
  // ruta 49 = ruta 10-12 + 30-32 + 60-62 minus ruta 48. Positivt = skuld, negativt = fordran.
  const netToPay = outputVatTotal + reverseVatTotal + importVatTotal - inputVat;
  return {
    ...calc,
    reverseVatByRate, reverseVatTotal, importVatByRate, importVatTotal,
    reversePurchaseEu: purchaseByRuta['21'] || 0,
    reversePurchaseNonEu: purchaseByRuta['22'] || 0,
    inputVatDomestic, inputVatReverse,
    inputVat, outputVatTotal, netToPay,
  };
}

/** Avrundade belopp — används både i Steg 2:s granskningsvy och i exporten,
 * så de siffror användaren ser aldrig skiljer sig från vad som skickas in. */
export function roundedVatPeriod(calc) {
  const roundMap = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, roundKr(v)]));
  // Varje momskonto avrundas för sig och rutorna räknas ur de avrundade
  // kontona, precis som på deklarationen. Då går den avslutande
  // momsverifikationen alltid ihop på kronan.
  return summarize({
    ...calc,
    underlagByRate: roundMap(calc.underlagByRate || zeroRates()),
    outputVatByRate: roundMap(calc.outputVatByRate || zeroRates()),
    purchaseByRuta: roundMap(calc.purchaseByRuta || zeroRutor(PURCHASE_RUTOR)),
    exemptSalesByRuta: roundMap(calc.exemptSalesByRuta || zeroRutor(EXEMPT_SALES_RUTOR)),
    vatAccounts: roundMap(calc.vatAccounts),
    inputVatDomestic: roundKr(calc.inputVatDomestic ?? calc.inputVat),
  });
}

/** Värdet för en ruta i VAT_RUTOR, ur ett (avrundat eller oavrundat) resultat. */
export function vatRutaValue(ruta, data) {
  switch (ruta.kind) {
    case 'salesTotal': return data.underlagByRate[25] + data.underlagByRate[12] + data.underlagByRate[6];
    case 'output': return data.outputVatByRate[ruta.rate];
    case 'purchase': return (data.purchaseByRuta || {})[ruta.ruta] || 0;
    case 'reverseOutput': return (data.reverseVatByRate || {})[ruta.rate] || 0;
    case 'importOutput': return (data.importVatByRate || {})[ruta.rate] || 0;
    case 'exemptSales': return (data.exemptSalesByRuta || {})[ruta.ruta] || 0;
    case 'input': return data.inputVat;
    case 'net': return data.netToPay;
    default: return null;
  }
}

/**
 * Raderna i den verifikation som avslutar momsperioden: varje momskonto
 * nollställs mot 2650 Redovisningskonto för moms. Samma lista visas i Steg 3
 * och bokförs av App.jsx, så det användaren ser är det som bokförs.
 * Tar ett avrundat resultat (roundedVatPeriod).
 */
export function vatSettlementRows(rounded) {
  const rows = [];
  [25, 12, 6].forEach(rate => {
    const amount = rounded.outputVatByRate?.[rate];
    if (amount) rows.push({ account: OUTPUT_VAT_ACCOUNT_BY_RATE[rate], debet: amount, kredit: 0 });
  });
  // Utgående moms på omvänd skattskyldighet och import, konto för konto.
  const accounts = rounded.vatAccounts || {};
  Object.keys(REVERSE_OUTPUT_INFO).forEach(acc => {
    if (accounts[acc]) rows.push({ account: acc, debet: accounts[acc], kredit: 0 });
  });
  if (rounded.inputVatDomestic) rows.push({ account: INPUT_VAT_ACCOUNT, debet: 0, kredit: rounded.inputVatDomestic });
  [...REVERSE_INPUT_ACCOUNTS].forEach(acc => {
    if (accounts[acc]) rows.push({ account: acc, debet: 0, kredit: accounts[acc] });
  });
  if (rounded.netToPay > 0) rows.push({ account: VAT_SETTLEMENT_ACCOUNT, debet: 0, kredit: rounded.netToPay });
  else if (rounded.netToPay < 0) rows.push({ account: VAT_SETTLEMENT_ACCOUNT, debet: -rounded.netToPay, kredit: 0 });
  // Negativa belopp (t.ex. en period med bara returer) vänds till andra sidan.
  return rows.map(r => (r.debet < 0 || r.kredit < 0 ? { account: r.account, debet: Math.max(-r.kredit, 0) + Math.max(r.debet, 0), kredit: Math.max(-r.debet, 0) + Math.max(r.kredit, 0) } : r));
}

/**
 * Steg 1 — valideringskontroll. Blockerande fel måste åtgärdas innan
 * användaren kan gå vidare; varningar är bara till för dubbelkoll.
 */
export function validateVatPeriod({ verifications = [], invoices = [], expenses = [], periodStart, periodEnd }) {
  const errors = [];
  const warnings = [];

  const periodVers = verifications.filter(v => inPeriod(v.date, periodStart, periodEnd));

  // Obalanserade verifikationer inom perioden
  periodVers.forEach(v => {
    const debet = (v.rows || []).reduce((s, r) => s + (getDebet(r) || 0), 0);
    const kredit = (v.rows || []).reduce((s, r) => s + (getKredit(r) || 0), 0);
    if (Math.abs(debet - kredit) > 0.01) {
      errors.push({ type: 'unbalanced', verificationId: v.id, message: `Verifikation ${v.number || v.id} är obalanserad (differens ${(debet - kredit).toFixed(2)} kr).` });
    }
  });

  // Försäljningsrad utan matchande momsrad i samma verifikation
  periodVers.filter(isBookedVerification).forEach(v => {
    const rows = v.rows || [];
    const salesRows = rows.filter(r => SALES_ACCOUNTS_TAXED.includes(r.account) && getKredit(r) > 0);
    salesRows.forEach(sr => {
      const rate = RATE_BY_SALES_ACCOUNT[sr.account];
      const expectedVatAccount = OUTPUT_VAT_ACCOUNT_BY_RATE[rate];
      const hasVatRow = rows.some(r => r.account === expectedVatAccount);
      if (!hasVatRow) {
        // Säg vad som är fel och vad man gör: momsen saknas helt, eller den är
        // bokförd på ett momskonto med en annan sats än försäljningskontot.
        const otherVat = rows.find(r => RATE_BY_VAT_ACCOUNT[r.account] != null && r.account !== expectedVatAccount);
        const num = v.number || v.id;
        const message = otherVat
          ? `${num}: försäljningen på ${sr.account} är för ${rate} % moms, men momsen är bokförd på ${otherVat.account} (${RATE_BY_VAT_ACCOUNT[otherVat.account]} %). Ändra så att försäljning och moms har samma sats.`
          : `${num}: försäljningen på ${sr.account} (${rate} % moms) har ingen moms bokförd. Lägg till momsen på ${expectedVatAccount}, eller byt till 3004 om försäljningen är momsfri.`;
        errors.push({ type: 'missing_vat_rate', verificationId: v.id, number: num, message });
      }
    });
  });

  // Inköp med omvänd skattskyldighet måste ha sina momsrader, annars hamnar
  // underlaget i ruta 20-24 eller 50 utan moms i ruta 30-32/60-62 och ruta 48,
  // och deklarationen blir fel.
  periodVers.filter(isBookedVerification).forEach(v => {
    const rows = v.rows || [];
    const purchase = rows.find(r => isReverseChargePurchaseAccount(r.account) && getDebet(r) > 0);
    if (purchase && !hasReverseVatRows(rows)) {
      const need = missingReverseChargeRows(rows);
      const amount = need.length > 0 ? need[0].debet.toFixed(2) : '';
      const accounts = need.length > 0 ? `konto ${need[0].account} i debet och ${need[1].account} i kredit` : 'ingående och utgående moms';
      const info = reverseChargePurchaseInfo(purchase.account);
      const kind = REVERSE_PURCHASE_KINDS[info.region];
      errors.push({ type: 'missing_reverse_vat', verificationId: v.id, message: `Verifikation ${v.number || v.id} bokför ${kind.label.toLowerCase()} (konto ${purchase.account}) men saknar momsraderna för omvänd skattskyldighet (${accounts}${amount ? `, ${amount} kr` : ''}). Lägg till dem så att ruta ${kind.ruta} och ruta 48 blir rätt.` });
    }
  });

  // Kontering saknas helt för perioden — det finns fakturor/utgifter daterade i
  // perioden, men ingen enda verifikation som rör moms- eller försäljningskonton
  const hasSourceDocsInPeriod = [...invoices, ...expenses].some(d => inPeriod(d.date, periodStart, periodEnd) && (d.status || 'booked') !== 'draft');
  const hasAnyVatTouchingVerification = periodVers.some(v => isBookedVerification(v) && (v.rows || []).some(r =>
    SALES_ACCOUNTS_TAXED.includes(r.account) || Object.values(OUTPUT_VAT_ACCOUNT_BY_RATE).includes(r.account) || r.account === INPUT_VAT_ACCOUNT
    || isReverseChargePurchaseAccount(r.account) || isReverseVatAccount(r.account) || EXEMPT_SALES_RUTA_BY_ACCOUNT[r.account]
  ));
  if (hasSourceDocsInPeriod && !hasAnyVatTouchingVerification) {
    errors.push({ type: 'missing_booking', verificationId: null, message: 'Det finns fakturor eller utgifter daterade inom perioden, men ingen bokförd verifikation som rör moms för perioden. Bokför dem innan momsdeklarationen kan fortsätta.' });
  }

  return { errors, warnings, canProceed: errors.length === 0 };
}

/** Jämför med föregående period av samma längd och varnar (blockerar aldrig)
 * vid stor avvikelse — kan vara helt korrekt, men värt att dubbelkolla. */
export function compareToPreviousPeriod(currentCalc, previousCalc) {
  const warnings = [];
  const currentTotal = currentCalc.underlagByRate[25] + currentCalc.underlagByRate[12] + currentCalc.underlagByRate[6];
  const prevTotal = previousCalc.underlagByRate[25] + previousCalc.underlagByRate[12] + previousCalc.underlagByRate[6];
  if (prevTotal > 0 && currentTotal > prevTotal * 2) {
    warnings.push(`Momspliktig försäljning är mer än dubbelt så hög som föregående period (${roundKr(currentTotal)} kr mot ${roundKr(prevTotal)} kr). Kan vara korrekt, men värt att dubbelkolla.`);
  } else if (prevTotal > 0 && currentTotal < prevTotal * 0.2) {
    warnings.push(`Momspliktig försäljning är betydligt lägre än föregående period (${roundKr(currentTotal)} kr mot ${roundKr(prevTotal)} kr). Kan vara korrekt, men värt att dubbelkolla.`);
  }
  return warnings;
}

/** Given a period key like "2026-Q2", returns [start, end] as YYYY-MM-DD. */
export function quarterToRange(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

/** Föregående period av samma längd (kvartal antas — 3 månader bakåt). */
export function previousQuarterRange(year, quarter) {
  if (quarter === 1) return quarterToRange(year - 1, 4);
  return quarterToRange(year, quarter - 1);
}

/**
 * Om `date` faller inom en period som redan är momsbokförd (Steg 3 i
 * momsdeklarationsflödet), returneras den perioden — annars null. Används
 * för att varna om ändringar i redan inlämnade perioder (Sida 11).
 * vatPeriods: { [periodKey]: { periodStart, periodEnd, bookedAt, ... } }
 */
export function findLockedVatPeriod(date, vatPeriods) {
  if (!date || !vatPeriods) return null;
  return Object.values(vatPeriods).find(p => date >= p.periodStart && date <= p.periodEnd) || null;
}
