import { getDebet, getKredit } from './verificationAmounts';
import {
  SALES_ACCOUNT_BY_RATE, OUTPUT_VAT_ACCOUNT_BY_RATE, INPUT_VAT_ACCOUNT,
} from './vatConfig';

const SALES_ACCOUNTS_TAXED = [25, 12, 6].map(r => SALES_ACCOUNT_BY_RATE[r]); // 3001/3002/3003 — momsfritt (3004) kräver ingen momsrad
const RATE_BY_SALES_ACCOUNT = Object.fromEntries(Object.entries(SALES_ACCOUNT_BY_RATE).map(([rate, acc]) => [acc, Number(rate)]));
const RATE_BY_VAT_ACCOUNT = Object.fromEntries(Object.entries(OUTPUT_VAT_ACCOUNT_BY_RATE).map(([rate, acc]) => [acc, Number(rate)]));

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
  let inputVat = 0;
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
        inputVat += (getDebet(row) - getKredit(row));
        touchedVerificationIds.add(v.id);
      }
    });
  });

  const outputVatTotal = outputVatByRate[25] + outputVatByRate[12] + outputVatByRate[6];
  const netToPay = outputVatTotal - inputVat; // ruta 49: positivt = skuld, negativt = fordran

  return {
    periodStart, periodEnd,
    underlagByRate, outputVatByRate,
    inputVat, outputVatTotal, netToPay,
    touchedVerificationIds: [...touchedVerificationIds],
    periodVerifications: periodVers,
  };
}

/** Avrundade belopp — används både i Steg 2:s granskningsvy och i exporten,
 * så de siffror användaren ser aldrig skiljer sig från vad som skickas in. */
export function roundedVatPeriod(calc) {
  return {
    ...calc,
    underlagByRate: Object.fromEntries(Object.entries(calc.underlagByRate).map(([k, v]) => [k, roundKr(v)])),
    outputVatByRate: Object.fromEntries(Object.entries(calc.outputVatByRate).map(([k, v]) => [k, roundKr(v)])),
    inputVat: roundKr(calc.inputVat),
    outputVatTotal: roundKr(calc.outputVatTotal),
    netToPay: roundKr(calc.netToPay),
  };
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

  // Kontering saknas helt för perioden — det finns fakturor/utgifter daterade i
  // perioden, men ingen enda verifikation som rör moms- eller försäljningskonton
  const hasSourceDocsInPeriod = [...invoices, ...expenses].some(d => inPeriod(d.date, periodStart, periodEnd) && (d.status || 'booked') !== 'draft');
  const hasAnyVatTouchingVerification = periodVers.some(v => isBookedVerification(v) && (v.rows || []).some(r =>
    SALES_ACCOUNTS_TAXED.includes(r.account) || Object.values(OUTPUT_VAT_ACCOUNT_BY_RATE).includes(r.account) || r.account === INPUT_VAT_ACCOUNT
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
