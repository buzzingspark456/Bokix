const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validerar en kommaseparerad lista av e-postadresser (t.ex. CC/BCC-fält).
 * Returnerar vilken specifik adress som är felaktig, inte bara "ogiltig e-post",
 * så användaren kan hitta felet i en lång lista.
 */
export function validateEmailList(value) {
  if (!value || !value.trim()) return { valid: true, invalid: null };
  const parts = value.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (!EMAIL_RE.test(part)) {
      return { valid: false, invalid: part };
    }
  }
  return { valid: true, invalid: null };
}

export function isValidEmail(value) {
  if (!value) return true;
  return EMAIL_RE.test(value.trim());
}

// IBAN-längd per landskod (ISO 3166-1 alpha-2). Används för att ge ett
// tydligare fel än ett generellt mod-97-fel när längden redan är fel.
const IBAN_LENGTHS = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GR: 27, HR: 21, HU: 28, IE: 22,
  IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MT: 31, NL: 18, NO: 15,
  PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27,
};

/**
 * Standard IBAN-validering: kontrollerar landskodens förväntade längd samt
 * mod-97-kontrollsumman (flytta första 4 tecken bakåt, ersätt bokstäver med
 * siffror A=10..Z=35, modulo 97 ska vara 1).
 */
export function isValidIban(raw) {
  if (!raw) return true; // tomt fält valideras inte här, hanteras av required separat
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;
  const country = iban.slice(0, 2);
  const expectedLength = IBAN_LENGTHS[country];
  if (expectedLength && iban.length !== expectedLength) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - 55).toString());
  // mod 97 på en stor sträng, i bitar för att undvika BigInt-krav
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = parseInt(remainder.toString() + numeric.substring(i, i + 7), 10) % 97;
  }
  return remainder === 1;
}
