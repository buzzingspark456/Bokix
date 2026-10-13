// Intl-formaterare är dyra att skapa (en bit över en tiondels millisekund
// var) men billiga att använda. Listor med tusentals rader skapade förut en
// ny för varje belopp och datum, vilket låste sökningen i Kvitton i flera
// sekunder hos ett stort företag. Samma språk och inställningar ger här
// samma formaterare.
const numberCache = new Map();
const dateCache = new Map();

const keyOf = (locale, options) => `${Array.isArray(locale) ? locale.join(',') : locale ?? ''}|${options ? JSON.stringify(options) : ''}`;

export function numberFormat(locale, options) {
  const key = keyOf(locale, options);
  let f = numberCache.get(key);
  if (!f) { f = new Intl.NumberFormat(locale, options); numberCache.set(key, f); }
  return f;
}

export function dateTimeFormat(locale, options) {
  const key = keyOf(locale, options);
  let f = dateCache.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale, options); dateCache.set(key, f); }
  return f;
}

// localeCompare(b, undefined, { numeric: true }) bygger en ny jämförare vid
// varje anrop; en sortering av några tusen verifikationer gjorde det tiotusentals
// gånger per tangenttryck i sökningen.
export const compareNumeric = new Intl.Collator(undefined, { numeric: true }).compare;
