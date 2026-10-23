// De viktigaste datumen för ett nytt företag, för sista steget i
// onboardingen (OnboardingFlow.jsx): nästa momsdeklaration, när
// räkenskapsåret tar slut (bokslutet), inkomstdeklarationen och, för
// aktiebolag, årsredovisningen. Räknas med samma regler som Skatt och
// bokslut (declarationDeadlines.js), så att datumen aldrig skiljer sig åt.
import { detectOrgType } from './orgType.js';
import { vatDueDate, nextMonthlyVatDeadline, yearlyVatDueDate, incomeDeclarationDueDate } from './declarationDeadlines.js';

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Slutdatum för räkenskapsåret som pågår: första årets slut, annars start + 12 månader - 1 dag. */
export function currentFiscalYearEnd({ fiscalYear, firstFiscalYear }, now = new Date()) {
  const today = isoOf(now);
  if (firstFiscalYear?.end && firstFiscalYear.end >= today) return firstFiscalYear.end;
  if (!fiscalYear) return null;
  const [y, m] = fiscalYear.split('-').map(Number);
  let start = new Date(y, m - 1, 1);
  // Ett sparat startdatum kan vara ett gammalt år: flytta fram tills året pågår.
  while (isoOf(new Date(start.getFullYear() + 1, start.getMonth(), 0)) < today) {
    start = new Date(start.getFullYear() + 1, start.getMonth(), 1);
  }
  return isoOf(new Date(start.getFullYear() + 1, start.getMonth(), 0));
}

function nextQuarterlyVatDue(now) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const q = Math.floor(today.getMonth() / 3) + 1;
  // Förra kvartalets deklaration först, om den inte har passerat.
  const prev = q === 1 ? { year: today.getFullYear() - 1, quarter: 4 } : { year: today.getFullYear(), quarter: q - 1 };
  const prevDue = vatDueDate(prev.year, prev.quarter);
  if (prevDue >= today) return { date: prevDue, period: `kvartal ${prev.quarter} ${prev.year}` };
  return { date: vatDueDate(today.getFullYear(), q), period: `kvartal ${q} ${today.getFullYear()}` };
}

/**
 * Datumen som rader { key, label, date (Date), note }. Momsraden saknas när
 * företaget inte är momsregistrerat eller perioden inte är vald.
 */
export function keyDatesForSetup({ orgNr, fiscalYear, firstFiscalYear, vatRegistered, vatPeriod }, now = new Date()) {
  const orgType = detectOrgType(orgNr);
  const fyEnd = currentFiscalYearEnd({ fiscalYear, firstFiscalYear }, now);
  const rows = [];

  if (vatRegistered && vatPeriod) {
    if (vatPeriod === 'monthly') {
      const next = nextMonthlyVatDeadline(now);
      if (next) rows.push({ key: 'vat', label: 'Nästa momsdeklaration', date: next.dueDate, note: `för ${next.periodKey}` });
    } else if (vatPeriod === 'quarterly') {
      const next = nextQuarterlyVatDue(now);
      rows.push({ key: 'vat', label: 'Nästa momsdeklaration', date: next.date, note: `för ${next.period}` });
    } else if (vatPeriod === 'yearly' && fyEnd) {
      rows.push({ key: 'vat', label: 'Momsdeklaration för hela året', date: yearlyVatDueDate({ orgType, fyEnd }), note: 'tidigare om ni handlar med andra EU-länder' });
    }
  }

  if (fyEnd) {
    const [y, m, d] = fyEnd.split('-').map(Number);
    rows.push({ key: 'closing', label: 'Räkenskapsåret slutar, bokslut', date: new Date(y, m - 1, d), note: '' });
    const income = incomeDeclarationDueDate({ orgType, fyEnd });
    if (income) rows.push({ key: 'income', label: orgType === 'Enskild firma' ? 'Inkomstdeklaration med NE-bilaga' : 'Inkomstdeklaration', date: income, note: '' });
    // Årsredovisningen ska vara hos Bolagsverket senast sju månader efter
    // räkenskapsårets slut (8 kap. 3 § årsredovisningslagen).
    if (orgType === 'Aktiebolag (AB)') rows.push({ key: 'annual', label: 'Årsredovisning till Bolagsverket', date: new Date(y, m - 1 + 8, 0), note: '' });
  }
  return rows;
}
