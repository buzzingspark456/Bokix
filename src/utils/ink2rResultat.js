import { getDebet, getKredit } from './verificationAmounts';
import { isBooked } from './reportCalculations';

/**
 * INK2R — Resultaträkningen (rad 3.1–3.27), den andra sidan av samma
 * blankett som ink2r.js:s balansräkning (rad 2.1–2.50).
 *
 * KÄLLA: liksom ink2r.js hämtat kontonummer-exakt ur BAS-intressenternas
 * Förenings officiella kopplingstabell "Ink 2 Intervall" (bas.se, utgåva
 * 2024-11-19). Till skillnad från ett tidigare försök (byggt på en
 * föråldrad Skatteverkets-broschyr från 2012 vars resultaträkning hade
 * en annan radstruktur, bl.a. egna rader för "Extraordinära poster" som
 * inte längre finns) är fältkoderna nedan nu verifierade och skrivs med
 * i SRU-filen (se sruExport.js) precis som balansräkningen.
 *
 * Flera rader har TVÅ fältkoder — en för "Om netto +" och en för "Om
 * netto -" av SAMMA kontointervall (t.ex. rad 3.12 Resultat från andelar
 * i koncernföretag: vinst och förlust bokförs på samma konton, bara
 * nettots tecken avgör vilken fältkod som gäller). Det representeras här
 * som `fieldCodePlus`/`fieldCodeMinus` istället för en enda `fieldCode`;
 * `computeInk2rResultat` väljer rätt kod utifrån radens uträknade tecken.
 *
 * Kvarvarande medveten förenkling: rad 3.5/3.6 (Råvaror/Handelsvaror)
 * delar SAMMA kontointervall 40xx-47xx i kopplingstabellen — vilket av
 * dem ett visst konto hör till är en bokföringsmässig klassificering,
 * inte något kontonumret ensamt avgör. Precis som tidigare defaultar den
 * delade delen av intervallet till 3.6 (vanligast för Bokix målgrupp);
 * bara de smala underintervall som ENDAST nämns under 3.5 (4910-4920)
 * respektive ENDAST under 3.6 (496x, 498x) styrs dit specifikt.
 */
export const INK2R_RESULT_ROWS = [
  { row: '3.1', label: 'Nettoomsättning', polarity: 'revenue', fieldCode: '7410' },
  { row: '3.2', label: 'Förändring av lager av produkter i arbete, färdiga varor och pågående arbete för annans räkning', polarity: 'revenue', fieldCodePlus: '7411', fieldCodeMinus: '7510' },
  { row: '3.3', label: 'Aktiverat arbete för egen räkning', polarity: 'revenue', fieldCode: '7412' },
  { row: '3.4', label: 'Övriga rörelseintäkter', polarity: 'revenue', fieldCode: '7413' },
  { row: '3.5', label: 'Råvaror och förnödenheter', polarity: 'cost', fieldCode: '7511' },
  { row: '3.6', label: 'Handelsvaror', polarity: 'cost', fieldCode: '7512' },
  { row: '3.7', label: 'Övriga externa kostnader', polarity: 'cost', fieldCode: '7513' },
  { row: '3.8', label: 'Personalkostnader', polarity: 'cost', fieldCode: '7514' },
  { row: '3.9', label: 'Av- och nedskrivningar av materiella och immateriella anläggningstillgångar', polarity: 'cost', fieldCode: '7515' },
  { row: '3.10', label: 'Nedskrivningar av omsättningstillgångar utöver normala nedskrivningar', polarity: 'cost', fieldCode: '7516' },
  { row: '3.11', label: 'Övriga rörelsekostnader', polarity: 'cost', fieldCode: '7517' },
  { row: '3.12', label: 'Resultat från andelar i koncernföretag', polarity: 'revenue', fieldCodePlus: '7414', fieldCodeMinus: '7518' },
  { row: '3.13', label: 'Resultat från andelar i intresseföretag och gemensamt styrda företag', polarity: 'revenue', fieldCodePlus: '7415', fieldCodeMinus: '7519' },
  { row: '3.14', label: 'Resultat från övriga företag som det finns ett ägarintresse i', polarity: 'revenue', fieldCodePlus: '7423', fieldCodeMinus: '7530' },
  { row: '3.15', label: 'Resultat från övriga finansiella anläggningstillgångar', polarity: 'revenue', fieldCodePlus: '7416', fieldCodeMinus: '7520' },
  { row: '3.16', label: 'Övriga ränteintäkter och liknande resultatposter', polarity: 'revenue', fieldCode: '7417' },
  { row: '3.17', label: 'Nedskrivningar av finansiella anläggningstillgångar och kortfristiga placeringar', polarity: 'cost', fieldCode: '7521' },
  { row: '3.18', label: 'Räntekostnader och liknande resultatposter', polarity: 'cost', fieldCode: '7522' },
  { row: '3.19', label: 'Lämnade koncernbidrag', polarity: 'cost', fieldCode: '7524' },
  { row: '3.20', label: 'Mottagna koncernbidrag', polarity: 'revenue', fieldCode: '7419' },
  { row: '3.21', label: 'Återföring av periodiseringsfond', polarity: 'revenue', fieldCode: '7420' },
  { row: '3.22', label: 'Avsättning till periodiseringsfond', polarity: 'cost', fieldCode: '7525' },
  { row: '3.23', label: 'Förändring av överavskrivningar', polarity: 'revenue', fieldCodePlus: '7421', fieldCodeMinus: '7526' },
  { row: '3.24', label: 'Övriga bokslutsdispositioner', polarity: 'revenue', fieldCodePlus: '7422', fieldCodeMinus: '7527' },
  { row: '3.25', label: 'Skatt på årets resultat', polarity: 'cost', fieldCode: '7528' },
  { row: '3.26', label: 'Årets resultat, vinst (flyttas till p. 4.1)', polarity: 'revenue', fieldCode: '7450' },
  { row: '3.27', label: 'Årets resultat, förlust (flyttas till p. 4.2)', polarity: 'cost', fieldCode: '7550' },
];

// Kontonummer→rad, hämtat kontonummer-exakt ur bas.se:s "Ink 2 Intervall"
// (2024-11-19). `to` inklusive. Rader med `fieldCodePlus`/`fieldCodeMinus`
// (se ovan) har SAMMA kontointervall oavsett tecken — nettots riktning
// avgör bara vilken fältkod som skrivs i SRU-filen, inte vilken rad.
const SPECIFIC_RANGES = [
  [3000, 3799, '3.1'],
  [4900, 4909, '3.2'], [4930, 4959, '3.2'], [4970, 4979, '3.2'], [4990, 4999, '3.2'],
  [3800, 3899, '3.3'],
  [3900, 3999, '3.4'],
  [4910, 4920, '3.5'],
  [4960, 4969, '3.6'], [4980, 4989, '3.6'],
  [5000, 6999, '3.7'],
  [7000, 7699, '3.8'],
  [7700, 7739, '3.9'], [7750, 7789, '3.9'], [7800, 7899, '3.9'],
  [7740, 7749, '3.10'], [7790, 7799, '3.10'],
  [7900, 7999, '3.11'],
  [8000, 8069, '3.12'], [8090, 8099, '3.12'],
  [8100, 8112, '3.13'], [8114, 8117, '3.13'], [8119, 8122, '3.13'], [8124, 8132, '3.13'], [8134, 8169, '3.13'], [8190, 8199, '3.13'],
  [8113, 8113, '3.14'], [8118, 8118, '3.14'], [8123, 8123, '3.14'], [8133, 8133, '3.14'],
  [8200, 8269, '3.15'], [8290, 8299, '3.15'],
  [8300, 8369, '3.16'], [8390, 8399, '3.16'],
  [8070, 8089, '3.17'], [8170, 8189, '3.17'], [8270, 8289, '3.17'], [8370, 8389, '3.17'],
  [8400, 8499, '3.18'],
  [8830, 8839, '3.19'],
  [8820, 8829, '3.20'],
  [8819, 8819, '3.21'],
  [8811, 8811, '3.22'],
  [8850, 8859, '3.23'],
  [8860, 8899, '3.24'], [8840, 8849, '3.24'],
  [8900, 8989, '3.25'],
];

// Konto 8810 (periodiseringsfond) är det enda kontot i hela tabellen där
// SAMMA kontonummer växlar rad beroende på tecken — återföring (+) på
// 3.21, avsättning (-) på 3.22 — snarare än bara fältkod inom en rad.
const SIGN_SPLIT_RANGES = [
  { from: 8810, to: 8810, positive: '3.21', negative: '3.22' },
];

// Standardrad (3.6, samma val som för den delade 40xx-47xx-ambiguiteten
// ovan) för det fåtal konton kopplingstabellen inte nämner: 4800-4899 och
// 4921-4929 (obetydliga luckor inom varulager/handelsvaror-intervallet),
// samt 8500-8809 och 8812-8818 (odokumenterat intervall mellan koncern-
// bidrag och periodiseringsfond) och 8990-8999 (kontot som konceptuellt
// ÄR "Årets resultat" — normalt bara en bokslutsteknisk motpost, aldrig
// ett konto man bokför på direkt, men fångas upp ändå om det förekommer)
// — "Övriga bokslutsdispositioner" är den rimligaste hemvisten för dessa.
const FALLBACK_RANGES = [
  [4000, 4999, '3.6'],
  [8500, 8809, '3.24'],
  [8812, 8818, '3.24'],
  [8990, 8999, '3.24'],
];

function findRow(code, ranges) {
  const n = Number(code);
  if (!Number.isFinite(n)) return null;
  const hit = ranges.find(([from, to]) => n >= from && n <= to);
  return hit ? hit[2] : null;
}

const rowDef = (rowId) => INK2R_RESULT_ROWS.find(r => r.row === rowId);

/**
 * Räknar fram resultaträkningens rader (3.1–3.27) för ett kalenderår ur
 * bokförda verifikationer. `rawNet` per konto är debet−kredit (samma
 * teckenkonvention som resten av rapportmodulen); varje rad flippar
 * tecknet vid behov så att intäktsrader visas positiva och
 * kostnadsrader visas positiva kostnadsbelopp — som på pappersblanketten.
 * Varje utdatarad får ett upplöst `fieldCode` (rätt av plus/minus-koden
 * vid behov) så att sruExport.js kan hantera INK2R:s båda sidor likadant.
 */
export function computeInk2rResultat(verifications, year) {
  const rawByAccount = new Map();
  for (const ver of verifications) {
    if (!isBooked(ver) || !(ver.date || '').startsWith(String(year))) continue;
    for (const r of ver.rows || []) {
      const first = String(r.account || '')[0];
      if (!['3', '4', '5', '6', '7', '8'].includes(first)) continue;
      rawByAccount.set(r.account, (rawByAccount.get(r.account) || 0) + getDebet(r) - getKredit(r));
    }
  }

  const sums = new Map();
  const unmatched = [];
  for (const [code, rawNet] of rawByAccount.entries()) {
    if (Math.abs(rawNet) < 0.5) continue;
    const n = Number(code);
    const split = SIGN_SPLIT_RANGES.find(s => n >= s.from && n <= s.to);
    const rowId = split
      ? (rawNet < 0 ? split.positive : split.negative) // rawNet<0 = kreditnormalt = intäktsliknande
      : (findRow(code, SPECIFIC_RANGES) || findRow(code, FALLBACK_RANGES));
    if (!rowId) { unmatched.push({ code, amount: rawNet }); continue; }
    const displayed = rowDef(rowId).polarity === 'revenue' ? -rawNet : rawNet;
    sums.set(rowId, (sums.get(rowId) || 0) + displayed);
  }

  // Årets resultat = alla rader 3.1–3.25 (raderna 3.26/3.27 är själva
  // slutsumman, inte input till den) — teckenkorrigerat till vinst-
  // positivt precis som `yearResult` i Taxes.jsx.
  let total = 0;
  for (const [rowId, amount] of sums.entries()) {
    if (rowId === '3.26' || rowId === '3.27') continue;
    total += rowDef(rowId).polarity === 'revenue' ? amount : -amount;
  }
  if (total >= 0) sums.set('3.26', total);
  else sums.set('3.27', -total);

  const rows = INK2R_RESULT_ROWS
    .map(def => {
      const amount = sums.get(def.row) || 0;
      const fieldCode = def.fieldCode ?? (amount >= 0 ? def.fieldCodePlus : def.fieldCodeMinus);
      return { ...def, amount, fieldCode };
    })
    .filter(r => Math.abs(r.amount) > 0.5);

  return { rows, total, unmatched };
}
