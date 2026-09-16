// Delad logik för verifikationsnummer (A001, B014, ...). Låg tidigare bara
// som en lokal funktion inuti Bokforing (Verifications.jsx) — flyttad hit
// så Inställningar (System > Verifikationsserier) kan räkna på EXAKT samma
// sätt när den visar/validerar en nummer-golv-inställning, utan att
// duplicera (och långsamt tappa synk med) samma logik på två ställen.
export const VERIFICATION_SERIES = ['A', 'B', 'C'];

export function getMaxUsedNumber(verifications = [], seriesLetter = 'A') {
  return verifications.reduce((max, v) => {
    if (!(v.number || '').startsWith(seriesLetter)) return max;
    const n = parseInt((v.number || '').replace(/\D/g, ''), 10);
    return !isNaN(n) && n > max ? n : max;
  }, 0);
}

export function getNextNumber(verifications = [], seriesLetter = 'A') {
  const max = getMaxUsedNumber(verifications, seriesLetter);
  return `${seriesLetter}${String(max + 1).padStart(3, '0')}`;
}
