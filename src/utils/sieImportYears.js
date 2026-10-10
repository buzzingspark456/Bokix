// Flytt i ett steg (SieImportModal.jsx): flera SIE-filer på en gång, en per
// år. Filerna sorteras äldst först så att varje års ingående balans räknas
// mot året före (sieOpeningReconcile.js), och avslutade år kan stängas direkt
// efter importen (App.jsx handleCloseImportedYears).
import { activeFiscalYear, periodLabel } from './fiscalYear';
import { detectOrgType } from './orgType';
import { isTradingPartnershipType } from './yearEnd';
import { validatePartners } from './partners';

/** Filens eget räkenskapsår (#RAR 0), eller null. */
export function fileFiscalYear(parsed) {
  return (parsed?.fiscalYears || []).find(fy => fy.index === 0) || null;
}

/** Äldst räkenskapsår först; filer utan #RAR sist. */
export function sortFilesByYear(files) {
  return [...files].sort((a, b) => {
    const x = fileFiscalYear(a.parsed)?.start || '9999';
    const y = fileFiscalYear(b.parsed)?.start || '9999';
    return x.localeCompare(y);
  });
}

/**
 * De importerade år som är avslutade och inte redan låsta, äldst först:
 * [{ start, end, label }]. Tom lista för ett handels-/kommanditbolag utan
 * delägare, där bokslutet måste fördela resultatet (görs under Skatt och bokslut).
 */
export function closableImportedYears(fiscalYears, company, now = new Date()) {
  const orgType = detectOrgType(company?.orgNr);
  if (isTradingPartnershipType(orgType) && validatePartners(company?.partners).length > 0) return [];
  const current = activeFiscalYear(company, now);
  const locked = company?.lockedFiscalYears || {};
  const seen = new Set();
  return fiscalYears
    .filter(Boolean)
    .filter(fy => fy.end && fy.end < current.start)
    .map(fy => ({ start: fy.start, end: fy.end, label: periodLabel({ start: fy.start, end: fy.end }) }))
    .filter(fy => !locked[fy.label] && !seen.has(fy.label) && seen.add(fy.label))
    .sort((a, b) => a.start.localeCompare(b.start));
}
