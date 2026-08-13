/**
 * Bolagsform utifrån ett svenskt organisationsnummer — delas mellan
 * registreringsflödet (Auth.jsx) och Skatt & bokslut (Taxes.jsx), som båda
 * behöver veta t.ex. om bolaget är en enskild firma (som ska deklarera med
 * en NE-bilaga efter bokslutet, till skillnad från ett aktiebolags
 * årsredovisning).
 */
export function detectOrgType(orgNr) {
  const cleaned = (orgNr || '').replace(/\D/g, '');
  if (!cleaned || cleaned.length < 6) return null;
  const prefix = parseInt(cleaned.substring(0, 2), 10);
  // Enskild firma: personnummerformat (19xx / 20xx)
  if (prefix >= 19 && prefix <= 20 && cleaned.length >= 10) return 'Enskild firma';
  // Tredje siffran anger juridisk form
  const thirdDigit = parseInt(cleaned[2], 10);
  if (thirdDigit === 5) return 'Aktiebolag (AB)';
  if (thirdDigit === 7) return 'Ekonomisk förening';
  if (thirdDigit === 8) return 'Ideell förening / stiftelse';
  if (thirdDigit === 9) return 'Handelsbolag / Kommanditbolag';
  return 'Företag';
}

export function formatOrgNr(val) {
  const digits = (val || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}
