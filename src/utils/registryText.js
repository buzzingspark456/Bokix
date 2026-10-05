// Text ur företagsregistret (Bolagsverket/FöretagsAPI) i vanlig skrivning.
// Registren skriver ofta allt med versaler ("STOCKHOLM", "VÄSTERG 5"); det
// görs om innan det hamnar i företagsuppgifterna. Text som redan har gemener
// lämnas som den är.

export function niceCase(text) {
  const s = String(text || '').trim();
  if (!s || s !== s.toUpperCase() || !/\p{L}/u.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

/** "11153" → "111 53". Annat än fem siffror lämnas orört. */
export function formatPostalCode(code) {
  const digits = String(code || '').replace(/\s/g, '');
  return /^\d{5}$/.test(digits) ? `${digits.slice(0, 3)} ${digits.slice(3)}` : String(code || '').trim();
}
