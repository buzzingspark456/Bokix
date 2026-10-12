import { computeBalanceSheet, isBooked, isClosingEntry } from './reportCalculations';
import { getDebet, getKredit } from './verificationAmounts';
import { inPeriod } from './fiscalYear';
import { unclosedResult } from './ink2r';
import { allocateResult, computePartnerStatement } from './partners';

/**
 * Inkomstdeklaration 4 för handels- och kommanditbolag: bilagorna INK4R
 * (räkenskapsschema), INK4S (skattemässiga justeringar) och INK4DU
 * (delägaruppgifter, en per delägare). Själva INK4 fylls i Skatteverkets
 * e-tjänst; bilagorna laddas upp som SRU-fil med filöverföringen.
 *
 * KÄLLOR, kontrollerade 2026-10-12:
 *  - Fältkoder och teckenregler: Skatteverkets fältlistor
 *    INK4R_SKV2004-33-02-26-01, INK4S_SKV2004-33-01-26-06 och
 *    INK4DU_SKV2004-33-01-26-01 ur paketet "Nyheter från beskattningsperiod
 *    2026P4" (skatteverket.se, Teknisk information om filöverföring).
 *  - Kontointervall: BAS kopplingstabell "INK4_P1_Intervall-241119"
 *    (bas.se/kontoplaner/sru). Samma källa som INK2R i ink2r.js.
 *
 * Bolaget betalar ingen egen skatt: över- eller underskottet (INK4S 4.12/
 * 4.13) fördelas på delägarna efter andel och redovisas i INK4DU. Varje
 * delägare deklarerar sedan sin andel själv (N3A eller K10).
 */

// ── INK4R, balansräkningen (rad 2.1–2.36) ────────────────────────────────
export const INK4R_BALANCE_ROWS = [
  { row: '2.1', label: 'Koncessioner, patent, licenser, varumärken, hyresrätter, goodwill och liknande rättigheter', fieldCode: '7201', side: 'asset' },
  { row: '2.2', label: 'Förskott avseende immateriella anläggningstillgångar', fieldCode: '7202', side: 'asset' },
  { row: '2.3', label: 'Byggnader och mark', fieldCode: '7214', side: 'asset' },
  { row: '2.4', label: 'Maskiner, inventarier och övriga materiella anläggningstillgångar', fieldCode: '7215', side: 'asset' },
  { row: '2.5', label: 'Förbättringsutgifter på annans fastighet', fieldCode: '7216', side: 'asset' },
  { row: '2.6', label: 'Pågående nyanläggningar och förskott avseende materiella anläggningstillgångar', fieldCode: '7217', side: 'asset' },
  { row: '2.7', label: 'Andelar i koncernföretag, intresseföretag, gemensamt styrda företag och övriga företag som det finns ett ägarintresse i', fieldCode: '7236', side: 'asset' },
  { row: '2.8', label: 'Fordringar hos koncernföretag, intresseföretag, gemensamt styrda företag och övriga företag som det finns ett ägarintresse i', fieldCode: '7232', side: 'asset' },
  { row: '2.9', label: 'Lån till delägare eller närstående', fieldCode: '7234', side: 'asset' },
  { row: '2.10', label: 'Andra finansiella anläggningstillgångar', fieldCode: '7237', side: 'asset' },
  { row: '2.11', label: 'Varulager', fieldCode: '7247', side: 'asset' },
  { row: '2.12', label: 'Pågående arbeten för annans räkning', fieldCode: '7245', side: 'asset' },
  { row: '2.13', label: 'Förskott till leverantörer', fieldCode: '7246', side: 'asset' },
  { row: '2.14', label: 'Kundfordringar', fieldCode: '7253', side: 'asset' },
  { row: '2.15', label: 'Övriga fordringar', fieldCode: '7264', side: 'asset' },
  { row: '2.16', label: 'Förutbetalda kostnader och upplupna intäkter', fieldCode: '7263', side: 'asset' },
  { row: '2.17', label: 'Kortfristiga placeringar', fieldCode: '7272', side: 'asset' },
  { row: '2.18', label: 'Kassa, bank och redovisningsmedel', fieldCode: '7281', side: 'asset' },
  { row: '2.19', label: 'Ingående kapital', fieldCode: '7310', side: 'equity' },
  { row: '2.20', label: 'Delägarnas nettouttag (−) eller nettotillskott (+)', fieldCode: '7311', side: 'equity' },
  { row: '2.21', label: 'Årets redovisade vinst', fieldCode: '7312', side: 'equity' },
  { row: '2.22', label: 'Årets redovisade förlust', fieldCode: '7313', side: 'equity' },
  { row: '2.23', label: 'Utgående kapital', fieldCode: '7314', side: 'equity' },
  { row: '2.24', label: 'Ackumulerade överavskrivningar', fieldCode: '7322', side: 'liability' },
  { row: '2.25', label: 'Övriga obeskattade reserver', fieldCode: '7323', side: 'liability' },
  { row: '2.26', label: 'Avsättningar för pensioner enligt tryggandelagen', fieldCode: '7331', side: 'liability' },
  { row: '2.27', label: 'Övriga avsättningar för pensioner och liknande förpliktelser', fieldCode: '7332', side: 'liability' },
  { row: '2.28', label: 'Övriga avsättningar', fieldCode: '7333', side: 'liability' },
  { row: '2.29', label: 'Långfristiga skulder till koncernföretag, intresseföretag m.fl.', fieldCode: '7353', side: 'liability' },
  { row: '2.30', label: 'Övriga långfristiga skulder', fieldCode: '7355', side: 'liability' },
  { row: '2.31', label: 'Förskott från kunder', fieldCode: '7362', side: 'liability' },
  { row: '2.32', label: 'Pågående arbeten för annans räkning', fieldCode: '7363', side: 'liability' },
  { row: '2.33', label: 'Leverantörsskulder', fieldCode: '7365', side: 'liability' },
  { row: '2.34', label: 'Skatteskulder', fieldCode: '7368', side: 'liability' },
  { row: '2.35', label: 'Övriga kortfristiga skulder', fieldCode: '7371', side: 'liability' },
  { row: '2.36', label: 'Upplupna kostnader och förutbetalda intäkter', fieldCode: '7370', side: 'liability' },
];

// Kontonummer → rad, ur "INK4_P1_Intervall-241119". `to` inklusive.
// Eget kapital (2.19–2.23) räknas för sig, se computeInk4r.
const BALANCE_RANGES = [
  [1000, 1087, '2.1'], [1089, 1099, '2.1'],
  [1088, 1088, '2.2'],
  [1100, 1119, '2.3'], [1130, 1179, '2.3'], [1190, 1199, '2.3'],
  [1200, 1279, '2.4'], [1290, 1299, '2.4'],
  [1120, 1129, '2.5'],
  [1180, 1189, '2.6'], [1280, 1289, '2.6'],
  [1310, 1319, '2.7'], [1330, 1339, '2.7'],
  [1320, 1329, '2.8'], [1340, 1349, '2.8'],
  [1360, 1369, '2.9'],
  [1350, 1359, '2.10'], [1370, 1389, '2.10'],
  [1400, 1469, '2.11'], [1490, 1499, '2.11'],
  [1470, 1479, '2.12'],
  [1480, 1489, '2.13'],
  [1500, 1559, '2.14'], [1580, 1599, '2.14'],
  [1560, 1579, '2.15'], [1600, 1699, '2.15'],
  [1700, 1799, '2.16'],
  [1800, 1899, '2.17'],
  [1900, 1999, '2.18'],
  [2150, 2159, '2.24'],
  [2100, 2149, '2.25'], [2160, 2199, '2.25'],
  [2210, 2219, '2.26'],
  [2230, 2239, '2.27'],
  [2220, 2229, '2.28'], [2240, 2299, '2.28'],
  [2360, 2379, '2.29'],
  [2300, 2359, '2.30'], [2380, 2399, '2.30'],
  [2420, 2429, '2.31'],
  [2430, 2439, '2.32'],
  [2440, 2449, '2.33'],
  [2500, 2599, '2.34'],
  [2410, 2419, '2.35'], [2450, 2499, '2.35'], [2600, 2899, '2.35'],
  [2900, 2999, '2.36'],
];
// Konton tabellen inte nämner, på närmaste rimliga rad så att summan stämmer.
const BALANCE_FALLBACK = [
  [1300, 1309, '2.10'], [1390, 1399, '2.10'],
  [2200, 2209, '2.28'],
  [2400, 2409, '2.35'],
];

// Eget kapital per delägarserie: sista siffran avgör raden.
// 0 och 6 = ingående kapital, 1–3 och 7–8 = uttag/tillskott, 9 = årets resultat.
function equityRow(code) {
  const n = Number(code);
  if (!(n >= 2000 && n <= 2099)) return null;
  if (n >= 2010 && n <= 2049) {
    const last = n % 10;
    if (last === 0 || last === 6) return '2.19';
    if ([1, 2, 3, 7, 8].includes(last)) return '2.20';
    if (last === 9) return 'result';
    return '2.20';
  }
  // 2099 (årets resultat före fördelningen) och övrigt eget kapital.
  if (n >= 2090) return 'result';
  return '2.19';
}

const findRow = (code, ranges) => {
  const n = Number(code);
  const hit = ranges.find(([from, to]) => n >= from && n <= to);
  return hit ? hit[2] : null;
};

/** Vilken INK4R-balansrad ett konto hör till (eget kapital: '2.19', '2.20' eller 'result'). */
export function ink4rRowForAccount(code) {
  return equityRow(code) || findRow(code, BALANCE_RANGES) || findRow(code, BALANCE_FALLBACK);
}

/**
 * INK4R:s balansräkning per räkenskapsårets slut. Årets resultat (2.21/2.22)
 * är det bokförda resultatet, oavsett om bokslutet och resultatfördelningen
 * är bokförda. Utgående kapital (2.23) är summan av 2.19–2.22.
 */
export function computeInk4r(verifications, accounts, asOfDate) {
  const { assets, equityAndLiabilities, totalAssets } = computeBalanceSheet(verifications, accounts, asOfDate);
  const sums = new Map();
  const byRow = new Map();
  const unmatched = [];
  let result = unclosedResult(verifications, asOfDate);
  const add = (row, acc) => {
    sums.set(row, (sums.get(row) || 0) + acc.amount);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push({ code: acc.code, name: acc.name, amount: acc.amount });
  };
  for (const acc of [...assets, ...equityAndLiabilities]) {
    const row = ink4rRowForAccount(acc.code);
    if (!row) { unmatched.push(acc); continue; }
    if (row === 'result') { result += acc.amount; continue; }
    add(row, acc);
  }
  if (result >= 0) sums.set('2.21', result); else sums.set('2.22', -result);
  const opening = sums.get('2.19') || 0;
  const net = sums.get('2.20') || 0;
  sums.set('2.23', opening + net + result);

  const rows = INK4R_BALANCE_ROWS
    .map(def => ({ ...def, amount: sums.get(def.row) || 0, accounts: (byRow.get(def.row) || []).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)) }))
    .filter(r => Math.abs(r.amount) > 0.5);
  const liabilities = rows.filter(r => r.side === 'liability').reduce((s, r) => s + r.amount, 0);
  const totalEquityAndLiabilities = (sums.get('2.23') || 0) + liabilities;
  const difference = totalAssets - totalEquityAndLiabilities;
  return { rows, result, totalAssets, totalEquityAndLiabilities, balanced: Math.abs(difference) < 1, difference, unmatched };
}

// ── INK4R, resultaträkningen (rad 3.1–3.19) ──────────────────────────────
export const INK4R_RESULT_ROWS = [
  { row: '3.1', label: 'Nettoomsättning', polarity: 'revenue', fieldCode: '7410' },
  { row: '3.2', label: 'Förändring av lager av produkter i arbete, färdiga varor och pågående arbete för annans räkning', polarity: 'revenue', fieldCodePlus: '7411', fieldCodeMinus: '7510' },
  { row: '3.3', label: 'Aktiverat arbete för egen räkning', polarity: 'revenue', fieldCode: '7412' },
  { row: '3.4', label: 'Övriga rörelseintäkter', polarity: 'revenue', fieldCode: '7413' },
  { row: '3.5', label: 'Råvaror och förnödenheter', polarity: 'cost', fieldCode: '7511' },
  { row: '3.6', label: 'Handelsvaror', polarity: 'cost', fieldCode: '7512' },
  { row: '3.7', label: 'Övriga externa kostnader', polarity: 'cost', fieldCode: '7513' },
  { row: '3.8', label: 'Personalkostnader', polarity: 'cost', fieldCode: '7514' },
  { row: '3.9', label: 'Av- och nedskrivningar av materiella och immateriella anläggningstillgångar', polarity: 'cost', fieldCode: '7515' },
  { row: '3.10', label: 'Övriga rörelsekostnader', polarity: 'cost', fieldCode: '7535' },
  { row: '3.11', label: 'Resultat från andelar i koncernföretag', polarity: 'revenue', fieldCodePlus: '7414', fieldCodeMinus: '7518' },
  { row: '3.12', label: 'Resultat från andelar i intresseföretag, gemensamt styrda företag och övriga företag som det finns ett ägarintresse i', polarity: 'revenue', fieldCodePlus: '7415', fieldCodeMinus: '7519' },
  { row: '3.13', label: 'Resultat från övriga finansiella anläggningstillgångar', polarity: 'revenue', fieldCodePlus: '7416', fieldCodeMinus: '7520' },
  { row: '3.14', label: 'Övriga ränteintäkter och liknande resultatposter', polarity: 'revenue', fieldCode: '7417' },
  { row: '3.15', label: 'Nedskrivningar av finansiella anläggningstillgångar och kortfristiga placeringar', polarity: 'cost', fieldCode: '7521' },
  { row: '3.16', label: 'Räntekostnader och liknande resultatposter', polarity: 'cost', fieldCode: '7522' },
  { row: '3.17', label: 'Bokslutsdispositioner', polarity: 'revenue', fieldCodePlus: '7427', fieldCodeMinus: '7537' },
  { row: '3.18', label: 'Årets resultat, vinst', polarity: 'revenue', fieldCode: '7450' },
  { row: '3.19', label: 'Årets resultat, förlust', polarity: 'cost', fieldCode: '7550' },
];

// 40xx–47xx står under både 3.5 och 3.6 i tabellen; som i INK2 går det
// delade intervallet till 3.6 och bara 4910–4920 till 3.5.
const RESULT_RANGES = [
  [3000, 3799, '3.1'],
  [4900, 4909, '3.2'], [4930, 4959, '3.2'], [4970, 4979, '3.2'], [4990, 4999, '3.2'],
  [3800, 3899, '3.3'],
  [3900, 3999, '3.4'],
  [4910, 4920, '3.5'],
  [4960, 4969, '3.6'], [4980, 4989, '3.6'],
  [5000, 6999, '3.7'],
  [7000, 7699, '3.8'],
  [7700, 7739, '3.9'], [7750, 7789, '3.9'], [7800, 7899, '3.9'],
  [7740, 7749, '3.10'], [7790, 7799, '3.10'], [7900, 7999, '3.10'],
  [8000, 8069, '3.11'], [8090, 8099, '3.11'],
  [8100, 8169, '3.12'], [8190, 8199, '3.12'],
  [8200, 8269, '3.13'], [8290, 8299, '3.13'],
  [8300, 8369, '3.14'], [8390, 8399, '3.14'],
  [8070, 8089, '3.15'], [8170, 8189, '3.15'], [8270, 8289, '3.15'], [8370, 8389, '3.15'],
  [8400, 8499, '3.16'],
  [8800, 8899, '3.17'],
];
const RESULT_FALLBACK = [
  [4000, 4999, '3.6'],
  [8500, 8799, '3.17'],
  [8900, 8999, '3.17'],
];
const resultDef = (row) => INK4R_RESULT_ROWS.find(r => r.row === row);

/** INK4R:s resultaträkning för räkenskapsåret, ur bokförda verifikationer. */
export function computeInk4rResultat(verifications, period) {
  const raw = new Map();
  for (const v of verifications || []) {
    if (!isBooked(v) || isClosingEntry(v) || !inPeriod(v.date, period)) continue;
    for (const r of v.rows || []) {
      const first = String(r.account || '')[0];
      if (!['3', '4', '5', '6', '7', '8'].includes(first)) continue;
      raw.set(r.account, (raw.get(r.account) || 0) + getDebet(r) - getKredit(r));
    }
  }
  const sums = new Map();
  const unmatched = [];
  for (const [code, net] of raw.entries()) {
    if (Math.abs(net) < 0.5) continue;
    const row = findRow(code, RESULT_RANGES) || findRow(code, RESULT_FALLBACK);
    if (!row) { unmatched.push({ code, amount: net }); continue; }
    sums.set(row, (sums.get(row) || 0) + (resultDef(row).polarity === 'revenue' ? -net : net));
  }
  let total = 0;
  for (const [row, amount] of sums.entries()) total += resultDef(row).polarity === 'revenue' ? amount : -amount;
  if (total >= 0) sums.set('3.18', total); else sums.set('3.19', -total);
  const rows = INK4R_RESULT_ROWS
    .map(def => {
      const amount = sums.get(def.row) || 0;
      return { ...def, amount, fieldCode: def.fieldCode ?? (amount >= 0 ? def.fieldCodePlus : def.fieldCodeMinus) };
    })
    .filter(r => Math.abs(r.amount) > 0.5);
  return { rows, total, unmatched };
}

// ── INK4S, skattemässiga justeringar (rad 4.1–4.16) ─────────────────────
// Beloppen matas in positiva; `sign` avgör om de ökar (+) eller minskar (−)
// överskottet. 4.9 kan gå åt båda hållen (två fältkoder).
export const INK4S_ROWS = [
  { key: '4.3a', label: 'Nedskrivning av finansiella tillgångar', group: 'Bokförda kostnader som inte ska dras av', sign: '+', fieldCode: '7652' },
  { key: '4.3b', label: 'Andra bokförda kostnader', group: 'Bokförda kostnader som inte ska dras av', sign: '+', fieldCode: '7653' },
  { key: '4.4a', label: 'Skogs- och substansminskningsavdrag', group: 'Kostnader som ska dras av men inte ingår i resultatet', sign: '-', fieldCode: '7761' },
  { key: '4.4b', label: 'Andra ej bokförda kostnader', group: 'Kostnader som ska dras av men inte ingår i resultatet', sign: '-', fieldCode: '7764' },
  { key: '4.5a', label: 'Ackordsvinster', group: 'Bokförda intäkter som inte ska tas upp', sign: '-', fieldCode: '7752' },
  { key: '4.5b', label: 'Andra bokförda intäkter', group: 'Bokförda intäkter som inte ska tas upp', sign: '-', fieldCode: '7754' },
  { key: '4.6a', label: 'Återföring av värdeminskningsavdrag m.m. vid avyttring av fastighet', group: 'Intäkter som ska tas upp men inte ingår i resultatet', sign: '+', fieldCode: '7662' },
  { key: '4.6b', label: 'Beräknad schablonintäkt på fondandelar ägda vid kalenderårets ingång', group: 'Intäkter som ska tas upp men inte ingår i resultatet', sign: '+', fieldCode: '7668' },
  { key: '4.6c', label: 'Andra ej bokförda intäkter', group: 'Intäkter som ska tas upp men inte ingår i resultatet', sign: '+', fieldCode: '7665' },
  { key: '4.7', label: 'Bokförd intäkt av delägarnas uttag av förmåner, varor och tjänster', group: 'Delägarnas uttag', sign: '-', fieldCode: '7766' },
  { key: '4.8a', label: 'Bokförd intäkt/vinst', group: 'Resultat från andel i handelsbolag', sign: '-', fieldCode: '7741' },
  { key: '4.8b', label: 'Skattemässigt överskott enligt N3B', group: 'Resultat från andel i handelsbolag', sign: '+', fieldCode: '7642' },
  { key: '4.8c', label: 'Bokförd kostnad/förlust', group: 'Resultat från andel i handelsbolag', sign: '+', fieldCode: '7641' },
  { key: '4.8d', label: 'Skattemässigt underskott enligt N3B', group: 'Resultat från andel i handelsbolag', sign: '-', fieldCode: '7742' },
  { key: '4.9', label: 'Skattemässig justering för avskrivningar på byggnader och restvärdesavskrivning (+ ökar, − minskar)', group: 'Övriga justeringar', sign: '±', fieldCodePlus: '7666', fieldCodeMinus: '7765' },
  { key: '4.10a', label: 'Bokförd vinst vid avyttring av fastighet eller bostadsrätt', group: 'Övriga justeringar', sign: '-', fieldCode: '7767' },
  { key: '4.10b', label: 'Bokförd förlust vid avyttring av fastighet eller bostadsrätt', group: 'Övriga justeringar', sign: '+', fieldCode: '7669' },
  { key: '4.11a', label: 'Bokförd vinst vid avyttring av värdepapper', group: 'Övriga justeringar', sign: '-', fieldCode: '7768' },
  { key: '4.11b', label: 'Bokförd förlust vid avyttring av värdepapper', group: 'Övriga justeringar', sign: '+', fieldCode: '7643' },
];
// Upplysningar som inte påverkar över-/underskottet.
export const INK4S_INFO_ROWS = [
  { key: '4.14', label: 'Ej återförda värdeminskningsavdrag avseende byggnader', fieldCode: '8020' },
  { key: '4.15', label: 'Ej återförda värdeminskningsavdrag avseende markanläggningar', fieldCode: '8021' },
  { key: '4.16', label: 'Pensionskostnader (som ingår i 3.8)', fieldCode: '8022' },
];

/** Över- eller underskott ur årets resultat och justeringarna. */
export function computeInk4s(values = {}, arsResultat = 0) {
  let total = arsResultat;
  for (const def of INK4S_ROWS) {
    const v = Number(values[def.key]) || 0;
    if (!v) continue;
    total += def.sign === '-' ? -Math.abs(v) : def.sign === '+' ? Math.abs(v) : v;
  }
  total = Math.round(total);
  return { arsResultat, values, total, overskott: total > 0 ? total : 0, underskott: total < 0 ? -total : 0 };
}

/** SRU-rader för INK4S: [fältkod, värde]. */
export function ink4sSruRows(ink4s, info = {}, answers = {}) {
  const out = [];
  const res = Math.round(ink4s.arsResultat);
  if (res > 0) out.push(['7650', res]); else if (res < 0) out.push(['7750', -res]);
  for (const def of INK4S_ROWS) {
    const v = Math.round(Number(ink4s.values?.[def.key]) || 0);
    if (!v) continue;
    if (def.sign === '±') out.push([v > 0 ? def.fieldCodePlus : def.fieldCodeMinus, Math.abs(v)]);
    else out.push([def.fieldCode, Math.abs(v)]);
  }
  if (ink4s.overskott) out.push(['7670', ink4s.overskott]);
  if (ink4s.underskott) out.push(['7770', ink4s.underskott]);
  for (const def of INK4S_INFO_ROWS) {
    const v = Math.round(Number(info[def.key]) || 0);
    if (v) out.push([def.fieldCode, v]);
  }
  if (answers.consultant === true) out.push(['8040', 'X']); else if (answers.consultant === false) out.push(['8041', 'X']);
  if (answers.audited === true) out.push(['8044', 'X']); else if (answers.audited === false) out.push(['8045', 'X']);
  return out;
}

// ── INK4DU, en per delägare ──────────────────────────────────────────────
/**
 * Delägarens andel av över- eller underskottet (efter andel), tillskott och
 * uttag under året (delägarens egna konton, se partners.js).
 */
export function computeInk4du(verifications, partners, period, ink4s) {
  const list = partners || [];
  const surplus = ink4s ? ink4s.total : 0;
  const shares = allocateResult(surplus, list);
  const statements = computePartnerStatement(verifications, list, period.start, period.end, 0);
  return list.map((partner, i) => {
    const share = Math.round(shares[i]?.amount || 0);
    const st = statements[i];
    return {
      partner,
      personnummer: String(partner.personnummer || '').trim(),
      overskott: share > 0 ? share : 0,
      underskott: share < 0 ? -share : 0,
      tillskott: Math.max(0, Math.round(st?.insattningar || 0)),
      uttag: Math.max(0, Math.round(st?.uttag || 0)),
    };
  });
}

/** Personnummer/orgnr i SRU-format: bara siffror, 12 för personnummer. */
export function sruPersonId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) {
    // ÅÅMMDDNNNN → ÅÅÅÅMMDDNNNN (sekel efter ålder, som Skatteverket).
    const yy = Number(digits.slice(0, 2));
    const nowYY = new Date().getFullYear() % 100;
    return `${yy > nowYY ? '19' : '20'}${digits}`;
  }
  return digits;
}

/** SRU-rader för ett INK4DU-block. */
export function ink4duSruRows(du) {
  const out = [['8100', sruPersonId(du.personnummer)]];
  if (du.overskott) out.push(['8101', du.overskott]);
  if (du.underskott) out.push(['8102', du.underskott]);
  if (du.tillskott) out.push(['8103', du.tillskott]);
  if (du.uttag) out.push(['8104', du.uttag]);
  return out;
}
