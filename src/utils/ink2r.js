import { computeBalanceSheet } from './reportCalculations';

/**
 * INK2R — Räkenskapsschema, balansräkningsdelen (rad 2.1–2.50) av
 * Skatteverkets Inkomstdeklaration 2. Gäller aktiebolag, ekonomiska
 * föreningar m.fl. — INTE enskild firma (den deklarerar med en NE-bilaga,
 * se Taxes.jsx/orgType.js).
 *
 * KÄLLA: raderna, fältkoderna och kontointervallen nedan är hämtade direkt
 * ur BAS-intressenternas Förenings officiella kopplingstabell "Ink 2
 * Intervall" (bas.se/kontoplaner/sru/), utgåva 2024-11-19 — den version
 * som gäller för BAS 2023/taxeringsår 2025–2026, samma tabell som
 * bokföringsprogram använder för att bygga sina SRU-filer. Tidigare
 * byggde den här filen på en gissad, grövre gruppindelning; efter att ha
 * hittat och verifierat den riktiga tabellen är alla intervall nedan
 * kontonummer-exakta, inte uppskattade.
 *
 * Några konton ligger ändå i luckor som kopplingstabellen inte täcker
 * (t.ex. 2000–2079, ovanliga eget kapital-konton före aktiekapitalet) —
 * `FALLBACK_RANGES` fångar upp dessa på respektive huvudgrupps mest
 * rimliga standardrad, så summan per grupp (och hela balansräkningen)
 * alltid stämmer även för ett konto kopplingstabellen inte nämner.
 */
export const INK2R_ROWS = [
  { row: '2.1', label: 'Koncessioner, patent, licenser, varumärken, hyresrätter, goodwill och liknande rättigheter', group: 'Immateriella anläggningstillgångar', fieldCode: '7201' },
  { row: '2.2', label: 'Förskott avseende immateriella anläggningstillgångar', group: 'Immateriella anläggningstillgångar', fieldCode: '7202' },
  { row: '2.3', label: 'Byggnader och mark', group: 'Materiella anläggningstillgångar', fieldCode: '7214' },
  { row: '2.4', label: 'Maskiner, inventarier och övriga materiella anläggningstillgångar', group: 'Materiella anläggningstillgångar', fieldCode: '7215' },
  { row: '2.5', label: 'Förbättringsutgifter på annans fastighet', group: 'Materiella anläggningstillgångar', fieldCode: '7216' },
  { row: '2.6', label: 'Pågående nyanläggningar och förskott avseende materiella anläggningstillgångar', group: 'Materiella anläggningstillgångar', fieldCode: '7217' },
  { row: '2.7', label: 'Andelar i koncernföretag', group: 'Finansiella anläggningstillgångar', fieldCode: '7230' },
  { row: '2.8', label: 'Andelar i intresseföretag och gemensamt styrda företag', group: 'Finansiella anläggningstillgångar', fieldCode: '7231' },
  { row: '2.9', label: 'Ägarintressen i övriga företag och andra långfristiga värdepappersinnehav', group: 'Finansiella anläggningstillgångar', fieldCode: '7233' },
  { row: '2.10', label: 'Fordringar hos koncern-, intresse- och gemensamt styrda företag', group: 'Finansiella anläggningstillgångar', fieldCode: '7232' },
  { row: '2.11', label: 'Lån till delägare eller närstående', group: 'Finansiella anläggningstillgångar', fieldCode: '7234' },
  { row: '2.12', label: 'Fordringar hos övriga företag som det finns ett ägarintresse i och andra långfristiga fordringar', group: 'Finansiella anläggningstillgångar', fieldCode: '7235' },
  { row: '2.13', label: 'Råvaror och förnödenheter', group: 'Varulager m.m.', fieldCode: '7241' },
  { row: '2.14', label: 'Varor under tillverkning', group: 'Varulager m.m.', fieldCode: '7242' },
  { row: '2.15', label: 'Färdiga varor och handelsvaror', group: 'Varulager m.m.', fieldCode: '7243' },
  { row: '2.16', label: 'Övriga lagertillgångar', group: 'Varulager m.m.', fieldCode: '7244' },
  { row: '2.17', label: 'Pågående arbeten för annans räkning', group: 'Varulager m.m.', fieldCode: '7245' },
  { row: '2.18', label: 'Förskott till leverantörer', group: 'Varulager m.m.', fieldCode: '7246' },
  { row: '2.19', label: 'Kundfordringar', group: 'Kortfristiga fordringar', fieldCode: '7251' },
  { row: '2.20', label: 'Fordringar hos koncern-, intresse- och gemensamt styrda företag', group: 'Kortfristiga fordringar', fieldCode: '7252' },
  { row: '2.21', label: 'Fordringar hos övriga företag som det finns ett ägarintresse i och övriga fordringar', group: 'Kortfristiga fordringar', fieldCode: '7261' },
  { row: '2.22', label: 'Upparbetad men ej fakturerad intäkt', group: 'Kortfristiga fordringar', fieldCode: '7262' },
  { row: '2.23', label: 'Förutbetalda kostnader och upplupna intäkter', group: 'Kortfristiga fordringar', fieldCode: '7263' },
  { row: '2.24', label: 'Andelar i koncernföretag', group: 'Kortfristiga placeringar', fieldCode: '7270' },
  { row: '2.25', label: 'Övriga kortfristiga placeringar', group: 'Kortfristiga placeringar', fieldCode: '7271' },
  { row: '2.26', label: 'Kassa, bank och redovisningsmedel', group: 'Kassa och bank', fieldCode: '7281' },
  { row: '2.27', label: 'Bundet eget kapital', group: 'Eget kapital', fieldCode: '7301' },
  { row: '2.28', label: 'Fritt eget kapital', group: 'Eget kapital', fieldCode: '7302' },
  { row: '2.29', label: 'Periodiseringsfonder', group: 'Obeskattade reserver', fieldCode: '7321' },
  { row: '2.30', label: 'Ackumulerade överavskrivningar', group: 'Obeskattade reserver', fieldCode: '7322' },
  { row: '2.31', label: 'Övriga obeskattade reserver', group: 'Obeskattade reserver', fieldCode: '7323' },
  { row: '2.32', label: 'Avsättningar för pensioner och liknande förpliktelser enligt lag (1967:531) om tryggande av pensionsutfästelse m.m.', group: 'Avsättningar', fieldCode: '7331' },
  { row: '2.33', label: 'Övriga avsättningar för pensioner och liknande förpliktelser', group: 'Avsättningar', fieldCode: '7332' },
  { row: '2.34', label: 'Övriga avsättningar', group: 'Avsättningar', fieldCode: '7333' },
  { row: '2.35', label: 'Obligationslån', group: 'Långfristiga skulder', fieldCode: '7350' },
  { row: '2.36', label: 'Checkräkningskredit', group: 'Långfristiga skulder', fieldCode: '7351' },
  { row: '2.37', label: 'Övriga skulder till kreditinstitut', group: 'Långfristiga skulder', fieldCode: '7352' },
  { row: '2.38', label: 'Skulder till koncern-, intresse- och gemensamt styrda företag', group: 'Långfristiga skulder', fieldCode: '7353' },
  { row: '2.39', label: 'Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder', group: 'Långfristiga skulder', fieldCode: '7354' },
  { row: '2.40', label: 'Checkräkningskredit', group: 'Kortfristiga skulder', fieldCode: '7360' },
  { row: '2.41', label: 'Övriga skulder till kreditinstitut', group: 'Kortfristiga skulder', fieldCode: '7361' },
  { row: '2.42', label: 'Förskott från kunder', group: 'Kortfristiga skulder', fieldCode: '7362' },
  { row: '2.43', label: 'Pågående arbeten för annans räkning', group: 'Kortfristiga skulder', fieldCode: '7363' },
  { row: '2.44', label: 'Fakturerad men ej upparbetad intäkt', group: 'Kortfristiga skulder', fieldCode: '7364' },
  { row: '2.45', label: 'Leverantörsskulder', group: 'Kortfristiga skulder', fieldCode: '7365' },
  { row: '2.46', label: 'Växelskulder', group: 'Kortfristiga skulder', fieldCode: '7366' },
  { row: '2.47', label: 'Skulder till koncern-, intresse- och gemensamt styrda företag', group: 'Kortfristiga skulder', fieldCode: '7367' },
  { row: '2.48', label: 'Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder', group: 'Kortfristiga skulder', fieldCode: '7369' },
  { row: '2.49', label: 'Skatteskulder', group: 'Kortfristiga skulder', fieldCode: '7368' },
  { row: '2.50', label: 'Upplupna kostnader och förutbetalda intäkter', group: 'Kortfristiga skulder', fieldCode: '7370' },
];

// Kontonummer→rad, hämtat kontonummer-exakt ur bas.se:s "Ink 2 Intervall"
// (2024-11-19). `to` inklusive. Sorterat i radordning; ingen inbördes
// överlappning finns i källan så ordningen spelar ingen roll för
// korrekthet, bara för läsbarhet.
const SPECIFIC_RANGES = [
  [1000, 1087, '2.1'], [1089, 1099, '2.1'],
  [1088, 1088, '2.2'],
  [1100, 1119, '2.3'], [1130, 1179, '2.3'], [1190, 1199, '2.3'],
  [1200, 1279, '2.4'], [1290, 1299, '2.4'],
  [1120, 1129, '2.5'],
  [1180, 1189, '2.6'], [1280, 1289, '2.6'],
  [1310, 1319, '2.7'],
  [1330, 1335, '2.8'], [1338, 1339, '2.8'],
  [1350, 1359, '2.9'], [1336, 1336, '2.9'], [1337, 1337, '2.9'],
  [1320, 1329, '2.10'], [1340, 1345, '2.10'], [1348, 1349, '2.10'],
  [1360, 1369, '2.11'],
  [1370, 1379, '2.12'], [1380, 1389, '2.12'], [1346, 1346, '2.12'], [1347, 1347, '2.12'],
  [1410, 1419, '2.13'], [1420, 1429, '2.13'],
  [1440, 1449, '2.14'],
  [1450, 1459, '2.15'], [1460, 1469, '2.15'],
  [1490, 1499, '2.16'],
  [1470, 1479, '2.17'],
  [1480, 1489, '2.18'],
  [1510, 1559, '2.19'], [1580, 1589, '2.19'],
  [1560, 1569, '2.20'], [1570, 1572, '2.20'], [1574, 1579, '2.20'], [1660, 1669, '2.20'], [1671, 1672, '2.20'], [1674, 1679, '2.20'],
  [1610, 1619, '2.21'], [1630, 1659, '2.21'], [1680, 1699, '2.21'], [1573, 1573, '2.21'], [1673, 1673, '2.21'],
  [1620, 1629, '2.22'],
  [1700, 1799, '2.23'],
  [1860, 1869, '2.24'],
  [1800, 1859, '2.25'], [1870, 1899, '2.25'],
  [1900, 1999, '2.26'],
  [2080, 2089, '2.27'],
  [2090, 2099, '2.28'],
  [2110, 2139, '2.29'],
  [2150, 2159, '2.30'],
  [2160, 2199, '2.31'],
  [2210, 2219, '2.32'],
  [2230, 2239, '2.33'],
  [2220, 2229, '2.34'], [2240, 2299, '2.34'],
  [2310, 2329, '2.35'],
  [2330, 2339, '2.36'],
  [2340, 2359, '2.37'],
  [2360, 2372, '2.38'], [2374, 2379, '2.38'],
  [2380, 2399, '2.39'], [2373, 2373, '2.39'],
  [2480, 2489, '2.40'],
  [2410, 2419, '2.41'],
  [2420, 2429, '2.42'],
  [2430, 2439, '2.43'],
  [2450, 2459, '2.44'],
  [2440, 2449, '2.45'],
  [2492, 2492, '2.46'],
  [2460, 2472, '2.47'], [2474, 2479, '2.47'], [2874, 2879, '2.47'],
  [2490, 2491, '2.48'], [2493, 2499, '2.48'], [2600, 2859, '2.48'], [2880, 2899, '2.48'],
  [2500, 2599, '2.49'],
  [2900, 2999, '2.50'],
];

// Standardrad för de fåtal konton kopplingstabellen inte nämner alls
// (t.ex. 2000–2079: eget kapital-konton före aktiekapitalet 2081, som
// enskild firma/handelsbolag använder men som sällan förekommer i ett
// aktiebolags kontoplan) — garanterar att gruppsumman ändå stämmer.
const FALLBACK_RANGES = [
  [1300, 1309, '2.12'],
  [1390, 1409, '2.12'],
  [1430, 1439, '2.13'],
  [1500, 1509, '2.19'],
  [1590, 1609, '2.21'],
  [1670, 1670, '2.20'],
  [2000, 2079, '2.28'],
  [2100, 2109, '2.31'],
  [2140, 2149, '2.31'],
  [2200, 2209, '2.34'],
  [2300, 2309, '2.39'],
  [2400, 2409, '2.48'],
  [2473, 2473, '2.47'],
  [2860, 2873, '2.47'],
];

function findRow(code, ranges) {
  const n = Number(code);
  if (!Number.isFinite(n)) return null;
  const hit = ranges.find(([from, to]) => n >= from && n <= to);
  return hit ? hit[2] : null;
}

/** Vilken INK2R-rad ett BAS-konto hör till, eller null om det inte är ett
 * balansräkningskonto (klass 1–2). */
export function ink2rRowForAccount(code) {
  return findRow(code, SPECIFIC_RANGES) || findRow(code, FALLBACK_RANGES);
}

/**
 * Räknar fram INK2R:s balansräkningsrader per {@link asOfDate}, återanvänder
 * `computeBalanceSheet` (samma källa som Rapporter-sidans balansräkning)
 * så saldona per definition alltid stämmer överens med resten av appen.
 */
export function computeInk2r(verifications, accounts, asOfDate) {
  const { assets, equityAndLiabilities, totalAssets, totalEquityAndLiabilities } = computeBalanceSheet(verifications, accounts, asOfDate);
  const sums = new Map();
  const unmatched = [];
  for (const acc of [...assets, ...equityAndLiabilities]) {
    const rowId = ink2rRowForAccount(acc.code);
    if (!rowId) { unmatched.push(acc); continue; }
    sums.set(rowId, (sums.get(rowId) || 0) + acc.amount);
  }
  const rows = INK2R_ROWS
    .map(def => ({ ...def, amount: sums.get(def.row) || 0 }))
    .filter(r => Math.abs(r.amount) > 0.5);
  return {
    rows,
    totalAssets,
    totalEquityAndLiabilities,
    balanced: Math.abs(totalAssets - totalEquityAndLiabilities) < 1,
    unmatched,
  };
}
