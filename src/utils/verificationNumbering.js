// Verifikationsserier och verifikationsnummer (A001, B014, ...). Delad av
// bokföringen (App.jsx: handleAddVerification), Ny verifikation
// (Verifications.jsx), Bank och Inställningar → Allmänt.
//
// Serierna följer samma indelning som Fortnox (kundönskemål 2026-09-27), så
// en revisor känner igen dem och en SIE-fil flyttar dem rätt: varje sorts
// affärshändelse får en egen löpande nummerserie, obruten per serie som
// bokföringslagen kräver.

export const SERIES_DEFAULTS = [
  { letter: 'A', name: 'Redovisning' },
  { letter: 'B', name: 'Kundfakturor' },
  { letter: 'C', name: 'Inbetalningar från kunder' },
  { letter: 'D', name: 'Leverantörsfakturor' },
  { letter: 'E', name: 'Utbetalningar till leverantörer' },
  { letter: 'H', name: 'Periodisering' },
  { letter: 'I', name: 'Bokslut' },
  { letter: 'K', name: 'Lön' },
  { letter: 'L', name: 'Kontantfaktura' },
  { letter: 'M', name: 'Momsrapport' },
];

export const VERIFICATION_SERIES = SERIES_DEFAULTS.map(s => s.letter);

// Vilken serie en automatisk bokning hamnar i, efter dess `source`.
// Allt som inte står här (manuella verifikationer, kvitton, bank,
// skattekonto m.fl.) går till A.
const SOURCE_SERIES = {
  invoice: 'B',
  invoice_payment: 'C',
  stripe_ledger: 'C',
  supplier_invoice: 'D',
  supplier_invoice_payment: 'E',
  accrual: 'H',
  depreciation: 'H',
  year_end_close: 'I',
  year_open_transfer: 'I',
  equity_reclass: 'I',
  dividend: 'I',
  partner_allocation: 'I',
  inventory: 'I',
  payroll: 'K',
  payroll_reversal: 'K',
  zettle_ledger: 'L',
  rotrut_import: 'L',
  vat_declaration: 'M',
};

export function seriesForSource(source) {
  return SOURCE_SERIES[source] || 'A';
}

/** Seriens namn: företagets egna namn om det finns, annars standardnamnet. */
export function seriesName(letter, company) {
  const custom = company?.verificationSeriesNames?.[letter];
  if (custom && String(custom).trim()) return String(custom).trim();
  return SERIES_DEFAULTS.find(s => s.letter === letter)?.name || '';
}

// Numret i en serie: bokstaven följd av siffror. "V12" (äldre automatiska
// bokningar) räknas därför inte till någon av serierna ovan.
function numberInSeries(number, letter) {
  const m = /^([A-Z]+)(\d+)$/.exec(String(number || '').trim());
  return m && m[1] === letter ? parseInt(m[2], 10) : null;
}

export function getMaxUsedNumber(verifications = [], seriesLetter = 'A') {
  return verifications.reduce((max, v) => {
    const n = numberInSeries(v.number, seriesLetter);
    return n !== null && n > max ? n : max;
  }, 0);
}

/** Nästa nummer i serien. `floor` (valfritt) är ett lägsta nästa nummer,
 * t.ex. för att fortsätta där ett tidigare program slutade. */
export function getNextNumber(verifications = [], seriesLetter = 'A', floor = 0) {
  const next = Math.max(getMaxUsedNumber(verifications, seriesLetter) + 1, Number(floor) || 0);
  return `${seriesLetter}${String(next).padStart(3, '0')}`;
}

/** Serien ett sparat verifikat hör till: den lagrade serien, annars
 * bokstaven i numret (V12 → V), annars A. */
export function seriesOfVerification(ver) {
  if (ver?.series) return ver.series;
  const m = /^([A-Z]+)\d+$/.exec(String(ver?.number || '').trim());
  return m ? m[1] : 'A';
}
