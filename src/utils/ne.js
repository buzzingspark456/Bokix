/**
 * NE-bilaga — Skatteverkets blankett "Inkomst av näringsverksamhet,
 * Enskilda näringsidkare" (SKV 2161), balans- och resultaträkningsschemat
 * (fälten B1–B16 respektive R1–R11).
 *
 * Till skillnad från INK2R (ink2r.js), som fyller i aktiebolagets
 * balansräkning automatiskt ur bokföringen via ett verifierat konto-
 * intervall (bas.se/kontoplaner/sru/), finns INGEN motsvarande verifierad
 * kopplingstabell för NE-blanketten tillgänglig här — bas.se:s egen
 * NE-fil kräver anmälan till deras nyhetsbrev för att laddas ner, och är
 * då en binär Excel-fil, inte något som gått att läsa och verifiera rad
 * för rad. Att GISSA kontointervallen och fylla i skarpa belopp automatiskt
 * i en skattehandling vore fel — en felklassificerad rad hade gått rakt in
 * i användarens riktiga deklaration.
 *
 * Den här modulen är därför medvetet samma mönster som INK2S (ink2s.js):
 * ren manuell ifyllnad, inga konton läses. Vad som SKA stå i varje fält
 * (etiketterna nedan) är däremot verifierat, dels direkt mot en skärmdump
 * av den riktiga blanketten, dels mot Skatteverkets egen vägledning
 * "Deklarera på NE-blanketten" (SKV 306).
 */

// B10 (Eget kapital) är INTE ett eget inmatningsfält — blanketten definierar
// den uttryckligen som "(tillgångar - skulder)", alltså en härledd
// balanspost, inte ett bokfört saldo att skriva av för hand. Räknas fram i
// computeNeBalance nedan istället, så den aldrig kan hamna i otakt med de
// andra fälten.
export const NE_BALANCE_ROWS = [
  { key: 'b1', row: 'B1', label: 'Immateriella anläggningstillgångar', group: 'Anläggningstillgångar', side: 'assets' },
  { key: 'b2', row: 'B2', label: 'Byggnader och markanläggningar', group: 'Anläggningstillgångar', side: 'assets' },
  { key: 'b3', row: 'B3', label: 'Mark och andra tillgångar som inte får skrivas av', group: 'Anläggningstillgångar', side: 'assets' },
  { key: 'b4', row: 'B4', label: 'Maskiner och inventarier', group: 'Anläggningstillgångar', side: 'assets' },
  { key: 'b5', row: 'B5', label: 'Övriga anläggningstillgångar', group: 'Anläggningstillgångar', side: 'assets' },
  { key: 'b6', row: 'B6', label: 'Varulager', group: 'Omsättningstillgångar', side: 'assets' },
  { key: 'b7', row: 'B7', label: 'Kundfordringar', group: 'Omsättningstillgångar', side: 'assets' },
  { key: 'b8', row: 'B8', label: 'Övriga fordringar', group: 'Omsättningstillgångar', side: 'assets' },
  { key: 'b9', row: 'B9', label: 'Kassa och bank', group: 'Omsättningstillgångar', side: 'assets' },
  { key: 'b11', row: 'B11', label: 'Obeskattade reserver', group: 'Obeskattade reserver', side: 'liabilities' },
  { key: 'b12', row: 'B12', label: 'Avsättningar', group: 'Avsättningar', side: 'liabilities' },
  { key: 'b13', row: 'B13', label: 'Låneskulder', group: 'Skulder', side: 'liabilities' },
  { key: 'b14', row: 'B14', label: 'Skatteskulder', group: 'Skulder', side: 'liabilities' },
  { key: 'b15', row: 'B15', label: 'Leverantörsskulder', group: 'Skulder', side: 'liabilities' },
  { key: 'b16', row: 'B16', label: 'Övriga skulder', group: 'Skulder', side: 'liabilities' },
];

// R11 (Bokfört resultat) är på samma sätt härlett — summan av R1–R10 med
// rätt tecken, aldrig ett eget fält (blanketten säger uttryckligen
// "förs över till sidan 2 R12").
export const NE_RESULT_ROWS = [
  { key: 'r1', row: 'R1', label: 'Försäljning och utfört arbete samt övriga momspliktiga intäkter', group: 'Intäkter', sign: '+' },
  { key: 'r2', row: 'R2', label: 'Momsfria intäkter', group: 'Intäkter', sign: '+' },
  { key: 'r3', row: 'R3', label: 'Bil- och bostadsförmån m.m.', group: 'Intäkter', sign: '+' },
  { key: 'r4', row: 'R4', label: 'Ränteintäkter m.m.', group: 'Intäkter', sign: '+' },
  { key: 'r5', row: 'R5', label: 'Varor, material och tjänster', group: 'Kostnader', sign: '-' },
  { key: 'r6', row: 'R6', label: 'Övriga externa kostnader', group: 'Kostnader', sign: '-' },
  { key: 'r7', row: 'R7', label: 'Anställd personal', group: 'Kostnader', sign: '-' },
  { key: 'r8', row: 'R8', label: 'Räntekostnader m.m.', group: 'Kostnader', sign: '-' },
  { key: 'r9', row: 'R9', label: 'Avskrivningar/nedskrivningar byggnader och markanläggningar', group: 'Avskrivningar', sign: '-' },
  { key: 'r10', row: 'R10', label: 'Avskrivningar/nedskrivningar maskiner och inventarier m.m.', group: 'Avskrivningar', sign: '-' },
];

/** @param values Objekt {radnyckel: belopp} med av användaren inmatade,
 *  alltid positiva belopp för B1–B9/B11–B16 (samtliga är rena
 *  tillgångs-/skuldbelopp, blanketten har inga ±-fält på balanssidan). */
export function computeNeBalance(values) {
  const rows = NE_BALANCE_ROWS.map(def => ({ ...def, amount: Number(values?.[def.key]) || 0 }));
  const totalAssets = rows.filter(r => r.side === 'assets').reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = rows.filter(r => r.side === 'liabilities').reduce((s, r) => s + r.amount, 0);
  return {
    rows,
    totalAssets,
    totalLiabilities,
    // B10 — härlett, se filkommentaren ovan.
    equity: totalAssets - totalLiabilities,
  };
}

/** @param values Objekt {radnyckel: belopp} — alltid positiva belopp,
 *  `sign` avgör hur respektive rad påverkar R11. */
export function computeNeResult(values) {
  const rows = NE_RESULT_ROWS.map(def => {
    const raw = Number(values?.[def.key]) || 0;
    return { ...def, amount: raw, contribution: def.sign === '+' ? raw : -raw };
  });
  return {
    rows,
    // R11 — härlett, se filkommentaren ovan.
    total: rows.reduce((s, r) => s + r.contribution, 0),
  };
}
