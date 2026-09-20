import { getDebet, getKredit } from './verificationAmounts';
import {
  SALES_ACCOUNT_BY_RATE, OUTPUT_VAT_ACCOUNT_BY_RATE, INPUT_VAT_ACCOUNT,
  REVERSE_PURCHASE_ACCOUNTS, REVERSE_OUTPUT_VAT_ACCOUNT_BY_RATE, REVERSE_INPUT_VAT_ACCOUNT,
} from './vatConfig';
import { hasReverseVatRows, isReverseChargePurchaseAccount, missingReverseChargeRows } from './reverseCharge';

const SALES_ACCOUNTS_TAXED = [25, 12, 6].map(r => SALES_ACCOUNT_BY_RATE[r]); // 3001/3002/3003 — momsfritt (3004) kräver ingen momsrad
const RATE_BY_SALES_ACCOUNT = Object.fromEntries(Object.entries(SALES_ACCOUNT_BY_RATE).map(([rate, acc]) => [acc, Number(rate)]));
const RATE_BY_VAT_ACCOUNT = Object.fromEntries(Object.entries(OUTPUT_VAT_ACCOUNT_BY_RATE).map(([rate, acc]) => [acc, Number(rate)]));
const RATE_BY_REVERSE_VAT_ACCOUNT = Object.fromEntries(Object.entries(REVERSE_OUTPUT_VAT_ACCOUNT_BY_RATE).map(([rate, acc]) => [acc, Number(rate)]));
const EU_PURCHASE_ACCOUNTS = Object.values(REVERSE_PURCHASE_ACCOUNTS.eu);
const NON_EU_PURCHASE_ACCOUNTS = Object.values(REVERSE_PURCHASE_ACCOUNTS.nonEu);

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
 */
export function computeVatPeriod({ verifications = [], periodStart, periodEnd }) {
  const underlagByRate = { 25: 0, 12: 0, 6: 0 };
  const outputVatByRate = { 25: 0, 12: 0, 6: 0 };
  // Omvänd skattskyldighet (tjänster från utlandet): underlag i ruta 21/22 och
  // utgående moms i ruta 30/31/32. Den beräknade ingående momsen (2645) går
  // med i ruta 48 tillsammans med vanlig ingående moms.
  const reverseVatByRate = { 25: 0, 12: 0, 6: 0 };
  let reversePurchaseEu = 0;
  let reversePurchaseNonEu = 0;
  let inputVatDomestic = 0;
  let inputVatReverse = 0;
  const touchedVerificationIds = new Set();

  const periodVers = verifications.filter(v => isBookedVerification(v) && inPeriod(v.date, periodStart, periodEnd));

  periodVers.forEach(v => {
    (v.rows || []).forEach(row => {
      const net = getKredit(row) - getDebet(row);
      if (RATE_BY_SALES_ACCOUNT[row.account] !== undefined) {
        underlagByRate[RATE_BY_SALES_ACCOUNT[row.account]] += net;
        touchedVerificationIds.add(v.id);
      } else if (RATE_BY_VAT_ACCOUNT[row.account] !== undefined) {
        outputVatByRate[RATE_BY_VAT_ACCOUNT[row.account]] += net;
        touchedVerificationIds.add(v.id);
      } else if (row.account === INPUT_VAT_ACCOUNT) {
        inputVatDomestic += (getDebet(row) - getKredit(row));
        touchedVerificationIds.add(v.id);
      } else if (RATE_BY_REVERSE_VAT_ACCOUNT[row.account] !== undefined) {
        reverseVatByRate[RATE_BY_REVERSE_VAT_ACCOUNT[row.account]] += net;
        touchedVerificationIds.add(v.id);
      } else if (row.account === REVERSE_INPUT_VAT_ACCOUNT) {
        inputVatReverse += (getDebet(row) - getKredit(row));
        touchedVerificationIds.add(v.id);
      } else if (EU_PURCHASE_ACCOUNTS.includes(row.account)) {
        reversePurchaseEu += (getDebet(row) - getKredit(row));
        touchedVerificationIds.add(v.id);
      } else if (NON_EU_PURCHASE_ACCOUNTS.includes(row.account)) {
        reversePurchaseNonEu += (getDebet(row) - getKredit(row));
        touchedVerificationIds.add(v.id);
      }
    });
  });

  const outputVatTotal = outputVatByRate[25] + outputVatByRate[12] + outputVatByRate[6];
  const reverseVatTotal = reverseVatByRate[25] + reverseVatByRate[12] + reverseVatByRate[6];
  const inputVat = inputVatDomestic + inputVatReverse; // ruta 48
  // ruta 49 = ruta 10-12 + ruta 30-32 minus ruta 48. Positivt = skuld, negativt = fordran.
  const netToPay = outputVatTotal + reverseVatTotal - inputVat;

  return {
    periodStart, periodEnd,
    underlagByRate, outputVatByRate,
    reverseVatByRate, reverseVatTotal, reversePurchaseEu, reversePurchaseNonEu,
    inputVatDomestic, inputVatReverse,
    inputVat, outputVatTotal, netToPay,
    touchedVerificationIds: [...touchedVerificationIds],
    periodVerifications: periodVers,
  };
}

/** Avrundade belopp — används både i Steg 2:s granskningsvy och i exporten,
 * så de siffror användaren ser aldrig skiljer sig från vad som skickas in. */
export function roundedVatPeriod(calc) {
  const roundRates = (byRate) => Object.fromEntries(Object.entries(byRate || { 25: 0, 12: 0, 6: 0 }).map(([k, v]) => [k, roundKr(v)]));
  const outputVatByRate = roundRates(calc.outputVatByRate);
  const reverseVatByRate = roundRates(calc.reverseVatByRate);
  const outputVatTotal = outputVatByRate[25] + outputVatByRate[12] + outputVatByRate[6];
  const reverseVatTotal = reverseVatByRate[25] + reverseVatByRate[12] + reverseVatByRate[6];
  // Ruta 48 är summan av de avrundade delarna, och ruta 49 räknas ur de
  // avrundade rutorna, precis som på deklarationen. Då går den avslutande
  // momsverifikationen alltid ihop på kronan.
  const inputVatDomestic = roundKr(calc.inputVatDomestic ?? calc.inputVat);
  const inputVatReverse = roundKr(calc.inputVatReverse ?? 0);
  const inputVat = inputVatDomestic + inputVatReverse;
  return {
    ...calc,
    underlagByRate: roundRates(calc.underlagByRate),
    outputVatByRate,
    reverseVatByRate,
    reverseVatTotal,
    reversePurchaseEu: roundKr(calc.reversePurchaseEu),
    reversePurchaseNonEu: roundKr(calc.reversePurchaseNonEu),
    inputVatDomestic,
    inputVatReverse,
    inputVat,
    outputVatTotal,
    netToPay: outputVatTotal + reverseVatTotal - inputVat,
  };
}

/** Värdet för en ruta i VAT_RUTOR, ur ett (avrundat eller oavrundat) resultat. */
export function vatRutaValue(ruta, data) {
  switch (ruta.kind) {
    case 'salesTotal': return data.underlagByRate[25] + data.underlagByRate[12] + data.underlagByRate[6];
    case 'output': return data.outputVatByRate[ruta.rate];
    case 'reversePurchaseEu': return data.reversePurchaseEu || 0;
    case 'reversePurchaseNonEu': return data.reversePurchaseNonEu || 0;
    case 'reverseOutput': return (data.reverseVatByRate || {})[ruta.rate] || 0;
    case 'input': return data.inputVat;
    case 'net': return data.netToPay;
    default: return null;
  }
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
        errors.push({ type: 'missing_vat_rate', verificationId: v.id, message: `Verifikation ${v.number || v.id}: försäljningsraden på konto ${sr.account} saknar en motsvarande momsrad (${expectedVatAccount}).` });
      }
    });
  });

  // Inköp av tjänster från utlandet (omvänd skattskyldighet) måste ha sina
  // momsrader, annars hamnar underlaget i ruta 21/22 utan moms i ruta 30 och
  // ruta 48, och deklarationen blir fel.
  periodVers.filter(isBookedVerification).forEach(v => {
    const rows = v.rows || [];
    if (rows.some(r => isReverseChargePurchaseAccount(r.account) && getDebet(r) > 0) && !hasReverseVatRows(rows)) {
      const need = missingReverseChargeRows(rows);
      const amount = need.length > 0 ? need[0].debet.toFixed(2) : '';
      errors.push({ type: 'missing_reverse_vat', verificationId: v.id, message: `Verifikation ${v.number || v.id} bokför inköp av tjänster från utlandet men saknar momsraderna för omvänd skattskyldighet (konto 2645 i debet och 2614 i kredit${amount ? `, ${amount} kr` : ''}). Lägg till dem så att ruta 21/22, 30 och 48 blir rätt.` });
    }
  });

  // Kontering saknas helt för perioden — det finns fakturor/utgifter daterade i
  // perioden, men ingen enda verifikation som rör moms- eller försäljningskonton
  const hasSourceDocsInPeriod = [...invoices, ...expenses].some(d => inPeriod(d.date, periodStart, periodEnd) && (d.status || 'booked') !== 'draft');
  const hasAnyVatTouchingVerification = periodVers.some(v => isBookedVerification(v) && (v.rows || []).some(r =>
    SALES_ACCOUNTS_TAXED.includes(r.account) || Object.values(OUTPUT_VAT_ACCOUNT_BY_RATE).includes(r.account) || r.account === INPUT_VAT_ACCOUNT || isReverseChargePurchaseAccount(r.account) || r.account === REVERSE_INPUT_VAT_ACCOUNT
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
