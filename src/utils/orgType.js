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
  // Om numret råkar skrivas in med sekel (12 siffror, ÅÅÅÅMMDD-XXXX) —
  // reducera till samma 10-siffriga form (ÅÅMMDD-XXXX) som all annan
  // klassificering nedan bygger på. Sekelsiffrorna är annars bara brus här.
  const tenDigit = cleaned.length >= 12 ? cleaned.slice(cleaned.length - 10) : cleaned;
  const thirdDigit = parseInt(tenDigit[2], 10);
  // Den faktiska regeln (Skatteverket/Bolagsverket, verifierad mot
  // sv.wikipedia.org/wiki/Organisationsnummer): i ett riktigt
  // organisationsnummer är tredje siffran ALLTID minst 2 — det är själva
  // konstruktionen som garanterar att det aldrig kan förväxlas med ett
  // personnummer, vars tredje siffra är födelsemånadens första siffra
  // (0 för jan–sep, 1 för okt–dec), alltså alltid 0 eller 1. En enskild
  // firma har inget eget organisationsnummer (firman är inte en egen
  // juridisk person) — ägarens personnummer ÄR firmans identifierande
  // nummer i alla praktiska sammanhang (fakturor, Skatteverket).
  //
  // OBS: tidigare version kollade istället om de FÖRSTA två siffrorna var
  // 19/20 (ett sekel-prefix) — det matchar bara ett 12-siffrigt personnummer
  // och missar därmed varje enskild firma som (som överallt annars i den
  // här appen, se formatOrgNr nedan) anges i den vanliga 10-siffriga
  // formen, t.ex. 850315-1234. Tredje siffran där är "0" (mars), inte
  // "8" — så den gamla kollen (prefix "85") aldrig triggade. Konkret
  // konsekvens: Taxes.jsx:s isSoleProp blev fel för i praktiken alla
  // enskilda firmor, vilket visade fel skatteflöde (INK2 istället för
  // NE-bilaga).
  if (Number.isNaN(thirdDigit) || tenDigit.length < 3) return null;
  if (thirdDigit <= 1) return 'Enskild firma';
  // Tredje siffrans enda jobb är ovanstående (≥2 = "det här är inte ett
  // personnummer") — det är istället den FÖRSTA siffran som faktiskt
  // kodar juridisk form (verifierat mot sv.wikipedia.org/wiki/
  // Organisationsnummer). Tidigare version av den här funktionen läste
  // fel position (tredje siffran) för det här steget också — det råkade
  // ge rätt svar för en del riktiga nummer av en ren slump (t.ex. de
  // flesta AB börjar även på "56" i position 2–3), men var fel som regel.
  const firstDigit = parseInt(tenDigit[0], 10);
  if (Number.isNaN(firstDigit)) return null;
  if (firstDigit === 2) return 'Stat, region eller kommun';
  if (firstDigit === 5) return 'Aktiebolag (AB)';
  if (firstDigit === 6) return 'Enkelt bolag';
  if (firstDigit === 7) return 'Ekonomisk förening';
  if (firstDigit === 8) return 'Ideell förening / stiftelse';
  if (firstDigit === 9) return 'Handelsbolag / Kommanditbolag';
  return 'Företag';
}

// Standard Swedish legal-form abbreviations, expanded to a readable label.
// Only "AB" has actually been observed coming back from FöretagsAPI (see
// api/company-access.js's legalForm field) and verified against a real
// company; the rest are the standard Bolagsverket abbreviations but aren't
// independently confirmed against FöretagsAPI's exact code set — an
// unmapped code is shown as-is rather than guessed into a wrong label.
const LEGAL_FORM_LABELS = {
  AB: 'Aktiebolag',
  HB: 'Handelsbolag',
  KB: 'Kommanditbolag',
  EF: 'Enskild firma',
  EK: 'Ekonomisk förening',
  BRF: 'Bostadsrättsförening',
  IF: 'Ideell förening',
  SF: 'Stiftelse',
  FI: 'Filial (utländskt företag)',
};

/** Expands a legal-form code (e.g. from FöretagsAPI's `legalForm` field) to
 * a readable Swedish label; returns the code unchanged if not recognized,
 * so an unmapped code is still shown rather than hidden. */
export function formatLegalForm(code) {
  const trimmed = (code || '').trim();
  if (!trimmed) return '';
  return LEGAL_FORM_LABELS[trimmed.toUpperCase()] || trimmed;
}

export function formatOrgNr(val) {
  const digits = (val || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}
