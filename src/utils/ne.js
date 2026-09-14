import { computeBalanceSheet, isBooked } from './reportCalculations';
import { getDebet, getKredit } from './verificationAmounts';

/**
 * NE-bilaga — Skatteverkets blankett "Inkomst av näringsverksamhet,
 * Enskilda näringsidkare" (SKV 2161), balans- och resultaträkningsschemat
 * (fälten B1–B16 respektive R1–R11).
 *
 * UPPFÖLJNING (kundönskemål, "gör det som Bokio — det måste funka"): den
 * här filen sa tidigare att ingen verifierad kopplingstabell fanns att
 * hämta ifyllnadsförslag ur (bas.se:s NE-fil krävde anmälan till deras
 * nyhetsbrev, och var då en binär Excel-fil). Det stämde inte längre —
 * bas.se/kontoplaner/sru/ länkar numera raka PDF:er, fritt nedladdningsbara:
 *   - NE_K1-201002.pdf     — för bokföring i K1:s EGEN förenklade
 *     kontoplan (helt andra kontonummer, t.ex. "3200 Bil- och
 *     bostadsförmån" — en ANNAN betydelse än Bokix konto 3200).
 *   - NE_EJ_K1-Intervall-231002.pdf — för bokföring i FULLSTÄNDIGA BAS-
 *     kontoplanen (samma som Bokix faktiskt använder), med riktiga
 *     kontointervall ("Konton i BAS 2023").
 * Bokix bokför alltid i den fullständiga BAS-kontoplanen (aldrig K1:s
 * egen), så NE_EJ_K1-Intervall-tabellen är den korrekta källan här — att
 * av misstag använda K1-tabellens kontonummer hade gett systematiskt fel
 * belopp (samma konto betyder olika saker i de två kontoplanerna). Alla
 * intervall i NE_BALANCE_RANGES/NE_RESULT_RANGES nedan är hämtade
 * kontonummer-exakt ur just den tabellen (bas.se, utgåva 2023-10-02).
 *
 * Kvarvarande medvetna begränsningar (samma "hellre tomt än fel"-princip
 * som ink2rResultat.js:s 3.5/3.6-kommentar):
 *   - B14 (Skatteskulder) saknar konton i källtabellen — "Inget redovisas
 *     här" står uttryckligen i den. Förblir manuellt ifyllbart.
 *   - R2 (Momsfria intäkter) och R3 (Bil-/bostadsförmån) delar antingen
 *     samma kontointervall som R1 (källan har inte en separat, konto-
 *     baserad uppdelning momspliktigt/momsfritt) eller saknar konton helt
 *     (R3). Hela det delade intervallet räknas till R1 (vanligast) — R2/R3
 *     förblir manuellt ifyllbara, precis som Skatteverkets egen kommentar
 *     i källtabellen säger ("kopplingen ... måste baseras på vad som i
 *     det enskilda företaget bokförts på kontot" när samma konto kan höra
 *     till flera rader).
 * Alla föreslagna belopp nedan är fortfarande bara FÖRSLAG — samma
 * redigerbara fält som förut, med ett litet klick-för-att-se-konton
 * bakom beloppet (som INK2R) för att kunna kontrolleras, inte skarpa
 * siffror som skrivs in låst.
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

// ═══════════════════════════════════════════════════════════════════════
// Automatiska ifyllnadsförslag — se filkommentaren överst för källan
// (bas.se NE_EJ_K1-Intervall, 2023-10-02) och de medvetna begränsningarna.
// ═══════════════════════════════════════════════════════════════════════

// Balansräkningen — kontointervall → NE-fältnyckel. `to` inklusive.
const NE_BALANCE_RANGES = [
  [1000, 1099, 'b1'],
  [1100, 1129, 'b2'], [1150, 1179, 'b2'], [1190, 1199, 'b2'],
  [1130, 1149, 'b3'], [1180, 1189, 'b3'], [1291, 1291, 'b3'],
  [1200, 1290, 'b4'], [1292, 1299, 'b4'],
  [1300, 1399, 'b5'],
  [1400, 1499, 'b6'],
  [1500, 1599, 'b7'],
  [1600, 1899, 'b8'],
  [1900, 1999, 'b9'],
  [2100, 2199, 'b11'],
  [2200, 2299, 'b12'],
  [2300, 2399, 'b13'], [2410, 2419, 'b13'], [2480, 2489, 'b13'],
  [2440, 2449, 'b15'], [2460, 2479, 'b15'],
  [2420, 2439, 'b16'], [2450, 2459, 'b16'], [2490, 2499, 'b16'], [2600, 2999, 'b16'],
  // b14 (Skatteskulder) medvetet UTELÄMNAT — se filkommentaren.
];

// Resultaträkningen — samma mönster, plus SIGN_SPLIT_RANGES för de konton
// källtabellen själv listar med "(+ vid intäkt)/(- vid kostnad)" (R4 mot
// R8) — identiskt principiellt problem som ink2rResultat.js:s konto 8810,
// löst likadant här.
const NE_RESULT_RANGES = [
  // R1/R2 delar samma intervall i källan (ingen kontobaserad uppdelning
  // momspliktigt/momsfritt) — allt till R1, se filkommentaren.
  [3000, 3799, 'r1'], [3900, 3999, 'r1'],
  [3800, 3899, 'r4'],
  [8010, 8019, 'r4'], [8110, 8119, 'r4'], [8200, 8209, 'r4'], [8210, 8219, 'r4'],
  [8250, 8259, 'r4'], [8260, 8269, 'r4'], [8300, 8309, 'r4'], [8310, 8319, 'r4'],
  [8340, 8349, 'r4'], [8360, 8369, 'r4'], [8390, 8399, 'r4'], [8440, 8449, 'r4'],
  [4000, 4999, 'r5'],
  [5000, 6999, 'r6'],
  [7000, 7699, 'r7'],
  [7740, 7749, 'r8'], [7790, 7799, 'r8'], [7900, 7999, 'r8'],
  [8070, 8079, 'r8'], [8080, 8089, 'r8'], [8170, 8179, 'r8'], [8180, 8189, 'r8'],
  [8270, 8279, 'r8'], [8280, 8289, 'r8'], [8370, 8379, 'r8'], [8380, 8389, 'r8'],
  [8400, 8409, 'r8'], [8410, 8419, 'r8'], [8420, 8429, 'r8'], [8460, 8469, 'r8'],
  [8480, 8489, 'r8'], [8900, 8989, 'r8'], // 89xx exkl. 899x (R11:s eget konto)
  [7720, 7729, 'r9'], [7770, 7779, 'r9'], [7820, 7829, 'r9'], [7840, 7849, 'r9'],
  [8852, 8852, 'r9'], // "885x" i källan delar R9/R10 odifferentierat — 8852 är specifikt byggnader/mark, resten (8850/8851/8853) till R10.
  [7710, 7719, 'r10'], [7730, 7739, 'r10'], [7760, 7769, 'r10'], [7780, 7789, 'r10'],
  [7810, 7819, 'r10'], [7830, 7839, 'r10'], [8850, 8851, 'r10'], [8853, 8859, 'r10'],
];

// Konton där samma nummer kan höra till antingen R4 (intäkt) eller R8
// (kostnad) beroende på om saldot för perioden faktiskt ÄR en intäkt eller
// en kostnad — kan inte avgöras av kontonumret ensamt, se ink2rResultat.js
// för samma mönster (dess konto 8810).
const NE_SIGN_SPLIT_RANGES = [
  [8020, 8029], [8030, 8039], [8120, 8129], [8130, 8139],
  [8220, 8229], [8230, 8239], [8240, 8249], [8290, 8299],
  [8320, 8329], [8330, 8339], [8350, 8359], [8430, 8439],
  [8450, 8459], [8490, 8499], [8810, 8819], [8860, 8869],
  [8880, 8889], [8890, 8899],
].map(([from, to]) => ({ from, to, positive: 'r4', negative: 'r8' }));

function findRange(code, ranges) {
  const n = Number(code);
  if (!Number.isFinite(n)) return null;
  const hit = ranges.find(([from, to]) => n >= from && n <= to);
  return hit ? hit[2] : null;
}

/** Balansräkningens ifyllnadsförslag per {@link asOfDate} — samma
 * `computeBalanceSheet`-källa som INK2R (ink2r.js) använder, så saldona
 * aldrig kan divergera från Rapporters egen balansräkning. Returnerar
 * {@code {values, byKey, unmatched}}: `values` går rakt in i samma
 * `computeNeBalance`/formulär som manuell ifyllnad redan använder, `byKey`
 * listar kontona bakom varje förslag (för klicka-och-kontrollera, som
 * INK2R), `unmatched` är konton med saldo som inte täcks av någon rad
 * (bör vara mycket sällsynt/tomt för en enskild firmas kontoplan). */
export function computeNeBalanceSuggestions(verifications, accounts, asOfDate) {
  const { assets, equityAndLiabilities } = computeBalanceSheet(verifications, accounts, asOfDate);
  const values = {};
  const byKey = {};
  const unmatched = [];
  for (const acc of [...assets, ...equityAndLiabilities]) {
    const key = findRange(acc.code, NE_BALANCE_RANGES);
    if (!key) { unmatched.push(acc); continue; }
    values[key] = (values[key] || 0) + acc.amount;
    (byKey[key] ||= []).push(acc);
  }
  // Blanketten kräver hela kronor (samma konvention som INK2S/manuell
  // NE-ifyllnad, se INK2S_AMOUNT_RE i Taxes.jsx) — avrundat på slutsumman
  // per fält, inte per enskild transaktion, så avrundningsfel inte kan
  // ackumuleras.
  Object.keys(values).forEach(k => { values[k] = Math.round(values[k]); });
  return { values, byKey, unmatched };
}

/** Resultaträkningens ifyllnadsförslag för ett kalenderår — samma
 * "summera debet−kredit per konto, slå upp rad, flippa tecken för
 * intäktsrader"-recept som computeInk2rResultat (ink2rResultat.js). */
export function computeNeResultSuggestions(verifications, year) {
  const rawByAccount = new Map();
  for (const ver of verifications) {
    if (!isBooked(ver) || !(ver.date || '').startsWith(String(year))) continue;
    for (const r of ver.rows || []) {
      const first = String(r.account || '')[0];
      if (!['3', '4', '5', '6', '7', '8'].includes(first)) continue;
      rawByAccount.set(r.account, (rawByAccount.get(r.account) || 0) + getDebet(r) - getKredit(r));
    }
  }
  const revenueKeys = new Set(['r1', 'r2', 'r3', 'r4']);
  const values = {};
  const byKey = {};
  const unmatched = [];
  for (const [code, rawNet] of rawByAccount.entries()) {
    if (Math.abs(rawNet) < 0.5) continue;
    const n = Number(code);
    const split = NE_SIGN_SPLIT_RANGES.find(s => n >= s.from && n <= s.to);
    const key = split
      ? (rawNet < 0 ? split.positive : split.negative) // rawNet<0 = kreditnormalt = intäktsliknande
      : findRange(code, NE_RESULT_RANGES);
    if (!key) { unmatched.push({ code, amount: rawNet }); continue; }
    const displayed = revenueKeys.has(key) ? -rawNet : rawNet;
    values[key] = (values[key] || 0) + displayed;
    (byKey[key] ||= []).push({ code, name: undefined, amount: displayed });
  }
  Object.keys(values).forEach(k => { values[k] = Math.round(values[k]); });
  return { values, byKey, unmatched };
}
