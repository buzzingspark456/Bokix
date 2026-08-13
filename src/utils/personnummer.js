// Validering av svenskt personnummer (ÅÅÅÅMMDD-XXXX), inklusive Luhn-
// checksumma. Inget valideringsbibliotek för detta finns redan i projektet,
// så det är implementerat direkt här — Luhn-algoritmen är entydig,
// standardiserad matematik (inte en juridisk detalj som kan variera), så
// den är säker att implementera utan extern verifiering.

/** Normaliserar till rena siffror + eventuellt bindestreck/plus bevarat separat. */
function digitsOnly(value) {
  return (value || '').replace(/[^\d]/g, '');
}

/**
 * Formaterar löpande medan användaren skriver: ÅÅÅÅMMDD-XXXX.
 */
export function formatPersonnummerInput(value) {
  const digits = digitsOnly(value).slice(0, 12);
  if (digits.length <= 8) return digits;
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

function luhnValid(tenDigits) {
  // Luhn på de 10 siffrorna ÅÅMMDD + NNN + kontrollsiffra.
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(tenDigits[i]);
    if (i % 2 === 0) { // varannan siffra (0-indexerat: position 0,2,4...) dubblas
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * Validerar format (ÅÅÅÅMMDD-XXXX) + att datumdelen är ett giltigt datum +
 * Luhn-checksumma. Returnerar { valid, error }.
 */
export function validatePersonnummer(value) {
  const digits = digitsOnly(value);
  if (digits.length === 0) return { valid: false, error: 'Personnummer krävs.' };
  if (digits.length !== 12) return { valid: false, error: 'Personnummer måste anges som ÅÅÅÅMMDD-XXXX (12 siffror).' };

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));

  if (month < 1 || month > 12) return { valid: false, error: 'Ogiltigt personnummer: månad utanför 01–12.' };
  // Samordningsnummer adderar 60 på dagen — tillåt det (dag 61–91 för dag 1–31)
  const isCoordinationNumber = day > 60;
  const realDay = isCoordinationNumber ? day - 60 : day;
  if (realDay < 1 || realDay > 31) return { valid: false, error: 'Ogiltigt personnummer: dag utanför giltigt intervall.' };
  const testDate = new Date(year, month - 1, realDay);
  if (testDate.getMonth() !== month - 1) return { valid: false, error: 'Ogiltigt personnummer: datumdelen finns inte i kalendern.' };

  const tenDigitForm = digits.slice(2); // ÅÅMMDD + XXXX, 10 siffror
  if (!luhnValid(tenDigitForm)) return { valid: false, error: 'Ogiltigt personnummer: kontrollsiffran stämmer inte (Luhn-kontroll misslyckades).' };

  return { valid: true, error: null };
}
