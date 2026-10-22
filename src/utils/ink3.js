import { computeBalanceSheet, isBooked, isClosingEntry } from './reportCalculations';
import { getDebet, getKredit } from './verificationAmounts';
import { inPeriod } from './fiscalYear';
import { unclosedResult } from './ink2r';

/**
 * Inkomstdeklaration 3 för ideella föreningar (och stiftelser): bilagorna
 * INK3R (räkenskapsschema), INK3S (skattemässiga justeringar) och INK3SUF
 * (särskild uppgift för allmännyttiga föreningar). Själva INK3 fylls i
 * Skatteverkets e-tjänst; bilagorna laddas upp som SRU-fil.
 *
 * KÄLLOR, kontrollerade 2026-10-22:
 *  - Fältkoder och teckenregler: Skatteverkets fältlistor
 *    INK3R_SKV2003-33-02-26-07, INK3S_SKV2003-33-01-26-07 och
 *    INK3SUF_SKV2003-33-01-26-01 ur paketet "Nyheter från beskattningsperiod
 *    2026P4". 2025P4 har samma koder, utom INK3S 7.15 (8037) som är ny 2026.
 *  - Vilka bilagor som lämnas: skatteverket.se, "Så fyller du i
 *    Inkomstdeklaration 3". INK3SUF bara för allmännyttig förening och bara
 *    den skattefria delen; skattepliktig verksamhet på INK3R + INK3S, alltid
 *    tillsammans. Medlemsavgifter, gåvor och bidrag till den ideella verksamheten är
 *    skattefria; bidrag som täcker skattepliktig verksamhet är det inte.
 *  - BAS har ingen kopplingstabell för INK3. Kontointervallen följer
 *    kontoklasserna, samma gränser som INK4 (ink4.js).
 *
 * Vad som ska tas upp till beskattning avgör föreningen, inte Bokix: den
 * skattepliktiga kolumnen fylls i av användaren (ingen tyst gissning).
 */

// ── INK3R, balansräkningen (5.1–5.21) ───────────────────────────────────
export const INK3R_BALANCE_ROWS = [
  { row: '5.1', label: 'Immateriella anläggningstillgångar', fieldCode: '8720', side: 'asset' },
  { row: '5.2', label: 'Byggnader och markanläggningar', fieldCode: '8721', side: 'asset' },
  { row: '5.3', label: 'Mark och andra tillgångar som inte får skrivas av', fieldCode: '8722', side: 'asset' },
  { row: '5.4', label: 'Maskiner och inventarier', fieldCode: '8723', side: 'asset' },
  { row: '5.5', label: 'Finansiella anläggningstillgångar', fieldCode: '8724', side: 'asset' },
  { row: '5.6', label: 'Övriga anläggningstillgångar', fieldCode: '8725', side: 'asset' },
  { row: '5.7', label: 'Varulager m.m.', fieldCode: '8726', side: 'asset' },
  { row: '5.8', label: 'Kundfordringar', fieldCode: '8727', side: 'asset' },
  { row: '5.9', label: 'Övriga fordringar och kortfristiga placeringar', fieldCode: '8728', side: 'asset' },
  { row: '5.10', label: 'Upplupna intäkter och förutbetalda kostnader', fieldCode: '8729', side: 'asset' },
  { row: '5.11', label: 'Kassa och bank', fieldCode: '8730', side: 'asset' },
  { row: '5.12', label: 'Eget kapital', fieldCode: '8735', side: 'equity' },
  { row: '5.13', label: 'Periodiseringsfonder', fieldCode: '8736', side: 'liability' },
  { row: '5.14', label: 'Övriga obeskattade reserver', fieldCode: '8737', side: 'liability' },
  { row: '5.15', label: 'Avsättningar för pensioner och liknande förpliktelser', fieldCode: '8738', side: 'liability' },
  { row: '5.16', label: 'Övriga avsättningar', fieldCode: '8739', side: 'liability' },
  { row: '5.17', label: 'Låneskulder', fieldCode: '8740', side: 'liability' },
  { row: '5.18', label: 'Skatteskulder', fieldCode: '8741', side: 'liability' },
  { row: '5.19', label: 'Leverantörsskulder', fieldCode: '8742', side: 'liability' },
  { row: '5.20', label: 'Övriga skulder', fieldCode: '8743', side: 'liability' },
  { row: '5.21', label: 'Upplupna kostnader och förutbetalda intäkter', fieldCode: '8744', side: 'liability' },
];

const BALANCE_RANGES = [
  [1000, 1099, '5.1'],
  [1100, 1129, '5.2'], [1150, 1199, '5.2'],
  [1130, 1149, '5.3'],
  [1200, 1299, '5.4'],
  [1300, 1399, '5.5'],
  [1400, 1499, '5.7'],
  [1500, 1599, '5.8'],
  [1600, 1699, '5.9'], [1800, 1899, '5.9'],
  [1700, 1799, '5.10'],
  [1900, 1999, '5.11'],
  [2000, 2099, '5.12'],
  [2110, 2149, '5.13'],
  [2100, 2109, '5.14'], [2150, 2199, '5.14'],
  [2210, 2239, '5.15'],
  [2200, 2209, '5.16'], [2240, 2299, '5.16'],
  [2300, 2399, '5.17'], [2410, 2419, '5.17'], [2480, 2489, '5.17'],
  [2500, 2599, '5.18'],
  [2440, 2449, '5.19'],
  [2400, 2409, '5.20'], [2420, 2439, '5.20'], [2450, 2479, '5.20'], [2490, 2899, '5.20'],
  [2900, 2999, '5.21'],
];

const findRow = (code, ranges) => {
  const n = Number(code);
  const hit = ranges.find(([from, to]) => n >= from && n <= to);
  return hit ? hit[2] : null;
};

export function ink3rRowForAccount(code) {
  return findRow(code, BALANCE_RANGES);
}

/** INK3R:s balansräkning per räkenskapsårets slut. Årets resultat ingår i eget kapital (5.12). */
export function computeInk3r(verifications, accounts, asOfDate) {
  const { assets, equityAndLiabilities, totalAssets } = computeBalanceSheet(verifications, accounts, asOfDate);
  const sums = new Map();
  const byRow = new Map();
  const unmatched = [];
  for (const acc of [...assets, ...equityAndLiabilities]) {
    const row = ink3rRowForAccount(acc.code);
    if (!row) { unmatched.push(acc); continue; }
    sums.set(row, (sums.get(row) || 0) + acc.amount);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push({ code: acc.code, name: acc.name, amount: acc.amount });
  }
  const result = unclosedResult(verifications, asOfDate);
  sums.set('5.12', (sums.get('5.12') || 0) + result);
  const rows = INK3R_BALANCE_ROWS
    .map(def => ({ ...def, amount: sums.get(def.row) || 0, accounts: byRow.get(def.row) || [] }))
    .filter(r => Math.abs(r.amount) > 0.5);
  const totalEquityAndLiabilities = rows.filter(r => r.side !== 'asset').reduce((s, r) => s + r.amount, 0);
  const difference = totalAssets - totalEquityAndLiabilities;
  return { rows, result, totalAssets, totalEquityAndLiabilities, balanced: Math.abs(difference) < 1, difference, unmatched };
}

// ── INK3R, resultaträkningen (6.1–6.21) ─────────────────────────────────
// booked = "enligt redovisningen", taxable = "som ska tas upp/dras av".
// Rader med två tecken (6.11, 6.12, 6.18) har plus- och minuskoder; 6.16
// och 6.17 är samma kontogrupp delad på tecknet. 6.1 och 6.19 har ingen
// skattepliktig kolumn.
export const INK3R_RESULT_ROWS = [
  { row: '6.1', label: 'Medlemsavgifter', polarity: 'revenue', booked: '8650', income: true },
  { row: '6.2', label: 'Serviceavgifter', polarity: 'revenue', booked: '8651', taxable: '8671', income: true },
  { row: '6.3', label: 'Gåvor och bidrag', polarity: 'revenue', booked: '8652', taxable: '8672', income: true },
  { row: '6.4', label: 'Nettoomsättning', polarity: 'revenue', booked: '8653', taxable: '8673', income: true },
  { row: '6.5', label: 'Övriga intäkter', polarity: 'revenue', booked: '8654', taxable: '8674', income: true },
  { row: '6.6', label: 'Varor och legoarbeten', polarity: 'cost', booked: '8750', taxable: '8770' },
  { row: '6.7', label: 'Övriga externa kostnader', polarity: 'cost', booked: '8751', taxable: '8771' },
  { row: '6.8', label: 'Personalkostnader inklusive särskild löneskatt', polarity: 'cost', booked: '8752', taxable: '8772' },
  { row: '6.9', label: 'Av- och nedskrivningar', polarity: 'cost', booked: '8753', taxable: '8773' },
  { row: '6.10', label: 'Övriga rörelsekostnader', polarity: 'cost', booked: '8754', taxable: '8774' },
  { row: '6.11', label: 'Resultat från andelar i koncern- och intresseföretag m.fl.', polarity: 'signed', bookedPlus: '8655', bookedMinus: '8755', taxablePlus: '8675', taxableMinus: '8775' },
  { row: '6.12', label: 'Resultat från övriga finansiella anläggningstillgångar', polarity: 'signed', bookedPlus: '8656', bookedMinus: '8756', taxablePlus: '8676', taxableMinus: '8776' },
  { row: '6.13', label: 'Övriga finansiella intäkter, t.ex. ränteintäkter och utdelningar', polarity: 'revenue', booked: '8657', taxable: '8677' },
  { row: '6.14', label: 'Nedskrivning av finansiella anläggningstillgångar och kortfristiga placeringar', polarity: 'cost', booked: '8757', taxable: '8777' },
  { row: '6.15', label: 'Räntekostnader och liknande resultatposter', polarity: 'cost', booked: '8758', taxable: '8778' },
  { row: '6.16', label: 'Återföring av periodiseringsfond', polarity: 'revenue', booked: '8659', taxable: '8679' },
  { row: '6.17', label: 'Avsättning till periodiseringsfond', polarity: 'cost', booked: '8760', taxable: '8780' },
  { row: '6.18', label: 'Övriga bokslutsdispositioner', polarity: 'signed', bookedPlus: '8660', bookedMinus: '8761', taxablePlus: '8680', taxableMinus: '8781' },
  { row: '6.19', label: 'Skatt på årets resultat', polarity: 'cost', booked: '8762' },
];
export const INK3_INCOME_ROWS = INK3R_RESULT_ROWS.filter(r => r.income).map(r => r.row);
const resultDef = (row) => INK3R_RESULT_ROWS.find(r => r.row === row);

const RESULT_RANGES = [
  [3000, 3799, '6.4'],
  [3800, 3999, '6.5'],
  [4000, 4999, '6.6'],
  [5000, 6999, '6.7'],
  [7000, 7699, '6.8'],
  [7700, 7739, '6.9'], [7750, 7789, '6.9'], [7800, 7899, '6.9'],
  [7740, 7749, '6.10'], [7790, 7799, '6.10'], [7900, 7999, '6.10'],
  [8070, 8089, '6.14'], [8170, 8189, '6.14'], [8270, 8289, '6.14'], [8370, 8389, '6.14'],
  [8000, 8199, '6.11'],
  [8200, 8299, '6.12'],
  [8300, 8399, '6.13'],
  [8400, 8499, '6.15'],
  [8500, 8809, '6.18'], [8820, 8899, '6.18'],
  [8900, 8989, '6.19'],
];
// Offentliga bidrag (3980–3989) och donationer och gåvor (3993).
const GIFT_RANGES = [[3980, 3989], [3993, 3993]];

/**
 * Förvald rad för ett resultatkonto. Intäktskonton med "medlem" i namnet
 * är medlemsavgifter, bidrags- och gåvokontona är gåvor och bidrag;
 * användaren kan flytta varje intäktskonto (overrides).
 */
export function ink3ResultRowForAccount(code, name = '', amount = 0) {
  const n = Number(code);
  if (n >= 3000 && n <= 3999) {
    if (/medlem/i.test(name)) return '6.1';
    if (/serviceavgift/i.test(name)) return '6.2';
    if (GIFT_RANGES.some(([a, b]) => n >= a && n <= b) || /gåv|donation|insaml/i.test(name)) return '6.3';
  }
  // Periodiseringsfond: tecknet avgör återföring (kredit) eller avsättning (debet).
  if (n >= 8810 && n <= 8819) return amount <= 0 ? '6.16' : '6.17';
  return findRow(code, RESULT_RANGES);
}

/**
 * INK3R:s resultaträkning "enligt redovisningen". `overrides` flyttar
 * intäktskonton mellan 6.1–6.5. Beloppen är positiva i radens riktning;
 * 6.11/6.12/6.18 är med tecken (+ = intäkt).
 */
export function computeInk3rResultat(verifications, period, accounts = [], overrides = {}) {
  const names = new Map((accounts || []).map(a => [String(a.code), a.name || '']));
  const raw = new Map();
  for (const v of verifications || []) {
    if (!isBooked(v) || isClosingEntry(v) || !inPeriod(v.date, period)) continue;
    for (const r of v.rows || []) {
      const n = Number(r.account);
      if (!(n >= 3000 && n <= 8989)) continue;
      raw.set(String(r.account), (raw.get(String(r.account)) || 0) + getDebet(r) - getKredit(r));
    }
  }
  const sums = new Map();
  const incomeAccounts = [];
  const unmatched = [];
  for (const [code, net] of raw.entries()) {
    if (Math.abs(net) < 0.5) continue;
    const name = names.get(code) || '';
    const suggested = ink3ResultRowForAccount(code, name, net);
    const isIncome = Number(code) < 4000;
    const row = isIncome && INK3_INCOME_ROWS.includes(overrides[code]) ? overrides[code] : suggested;
    if (!row) { unmatched.push({ code, amount: net }); continue; }
    const def = resultDef(row);
    const amount = def.polarity === 'cost' ? net : -net;
    sums.set(row, (sums.get(row) || 0) + amount);
    if (isIncome) incomeAccounts.push({ code, name, amount: -net, row, suggested });
  }
  let total = 0;
  for (const [row, amount] of sums.entries()) total += resultDef(row).polarity === 'cost' ? -amount : amount;
  const rows = INK3R_RESULT_ROWS
    .map(def => ({ ...def, amount: sums.get(def.row) || 0 }))
    .filter(r => Math.abs(r.amount) > 0.5);
  incomeAccounts.sort((a, b) => Number(a.code) - Number(b.code));
  return { rows, total, incomeAccounts, unmatched };
}

/** Skattepliktig kolumn ur användarens värden: { [row]: belopp }. */
export function computeInk3Taxable(resultRows, taxable = {}) {
  let total = 0;
  const values = {};
  for (const def of INK3R_RESULT_ROWS) {
    if (!def.taxable && !def.taxablePlus) continue;
    const v = Math.round(Number(taxable[def.row]) || 0);
    if (!v) continue;
    values[def.row] = v;
    total += def.polarity === 'cost' ? -v : v;
  }
  return { values, total: Math.round(total) };
}

/**
 * Fyller den skattepliktiga kolumnen med det bokförda beloppet för alla
 * rader utom medlemsavgifter, gåvor och bidrag (alltid skattefria) och
 * skatten. För en förening som inte är allmännyttig; användaren justerar
 * sedan kostnader som hör till den ideella verksamheten.
 */
export function fillTaxableFromBooked(resultRows) {
  const out = {};
  for (const r of resultRows || []) {
    if (r.row === '6.1' || r.row === '6.3' || r.row === '6.19') continue;
    out[r.row] = Math.round(r.amount);
  }
  return out;
}

// ── INK3S, skattemässiga justeringar (7.1–7.15) ──────────────────────────
export const INK3S_ROWS = [
  { key: '7.3a', label: 'Outnyttjat underskott från föregående år', sign: '-', fieldCode: '8787' },
  { key: '7.3b', label: 'Reduktion av underskott, t.ex. vid ackord', sign: '+', fieldCode: '8687' },
  { key: '7.4', label: 'Kostnader som ska dras av men inte ingår i resultatet', sign: '-', fieldCode: '8788' },
  { key: '7.5a', label: 'Schablonintäkt på kvarvarande periodiseringsfonder', sign: '+', fieldCode: '8688' },
  { key: '7.5b', label: 'Schablonintäkt på fondandelar ägda vid kalenderårets ingång', sign: '+', fieldCode: '8693' },
  { key: '7.5c', label: 'Uppräknat belopp vid återföring av periodiseringsfond', sign: '+', fieldCode: '8696' },
  { key: '7.5d', label: 'Övriga intäkter som ska tas upp men inte ingår i resultatet', sign: '+', fieldCode: '8689' },
  { key: '7.6', label: 'Skattemässig korrigering vid avyttring av fastighet och bostadsrätt (+ ökar, − minskar)', sign: '±', fieldCodePlus: '8690', fieldCodeMinus: '8789' },
  { key: '7.7', label: 'Skogs- och substansminskningsavdrag (N8)', sign: '-', fieldCode: '8790' },
  { key: '7.8', label: 'Återföringar vid avyttring av fastighet', sign: '+', fieldCode: '8691' },
];
export const INK3S_INFO_ROWS = [
  { key: '7.11', label: 'Ej återförda värdeminskningsavdrag avseende byggnader', fieldCode: '8030' },
  { key: '7.12', label: 'Ej återförda värdeminskningsavdrag avseende markanläggningar', fieldCode: '8031' },
  { key: '7.13', label: 'Vid restvärdesavskrivning: återförda belopp', fieldCode: '8033' },
  { key: '7.14', label: 'Avdrag för kapitalförvaltningskostnader', fieldCode: '8034' },
  { key: '7.15', label: 'Pensionskostnader (som ingår i 6.8)', fieldCode: '8037', from: '2026P4' },
];

/** Överskott (7.9) eller underskott (7.10) ur justerat resultat (6.21) och justeringarna. */
export function computeInk3s(values = {}, justerat = 0) {
  let total = justerat;
  for (const def of INK3S_ROWS) {
    const v = Number(values[def.key]) || 0;
    if (!v) continue;
    total += def.sign === '-' ? -Math.abs(v) : def.sign === '+' ? Math.abs(v) : v;
  }
  total = Math.round(total);
  return { justerat, values, total, overskott: total > 0 ? total : 0, underskott: total < 0 ? -total : 0 };
}

// ── INK3SUF och INK3SUS, särskild uppgift ─────────────────────────────────
// Samma ändamål för förening (fieldCode, INK3SUF) och stiftelse (susCode,
// INK3SUS), med olika fältkoder.
export const INK3SUF_PURPOSES = [
  { key: 'sport', label: 'Idrott', fieldCode: '8822', susCode: '8806' },
  { key: 'culture', label: 'Kultur', fieldCode: '8828', susCode: '8807' },
  { key: 'environment', label: 'Miljövård', fieldCode: '8832', susCode: '8808' },
  { key: 'youth', label: 'Omsorg om barn och ungdom', fieldCode: '8823', susCode: '8804' },
  { key: 'political', label: 'Politisk verksamhet', fieldCode: '8827', susCode: '8809' },
  { key: 'religious', label: 'Religiös verksamhet', fieldCode: '8820', susCode: '8810' },
  { key: 'health', label: 'Sjukvård', fieldCode: '8833', susCode: '8811' },
  { key: 'social', label: 'Social hjälpverksamhet', fieldCode: '8821', susCode: '8801' },
  { key: 'defence', label: 'Sveriges försvar och krisberedskap i samverkan med myndighet', fieldCode: '8831', susCode: '8805' },
  { key: 'education', label: 'Utbildning', fieldCode: '8829', susCode: '8800' },
  { key: 'research', label: 'Vetenskaplig forskning', fieldCode: '8830', susCode: '8803' },
  { key: 'other', label: 'Annan likvärdig verksamhet', fieldCode: '8619', susCode: '8839' },
];
export const INK3SUF_ROWS = [
  { key: '4.1', label: 'Medlemsavgifter', group: 'income', fieldCode: '8640' },
  { key: '4.2', label: 'Bidrag, gåvor', group: 'income', fieldCode: '8641' },
  { key: '4.3', label: 'Räntor, utdelningar', group: 'income', fieldCode: '8642' },
  { key: '4.4', label: 'Vinst vid försäljning av fastigheter, värdepapper m.m.', group: 'income', fieldCode: '8643' },
  { key: '4.5', label: 'Rörelseintäkter', group: 'income', fieldCode: '8629' },
  { key: '4.6', label: 'Fastighetsintäkter', group: 'income', fieldCode: '8644' },
  { key: '4.7', label: 'Medlemsverksamhet', group: 'cost', fieldCode: '8713' },
  { key: '4.8', label: 'Utdelade bidrag, stipendier', group: 'cost', fieldCode: '8714' },
  { key: '4.9', label: 'Räntor och kapitalförvaltning', group: 'cost', fieldCode: '8715' },
  { key: '4.10', label: 'Förlust vid försäljning av fastigheter, värdepapper m.m.', group: 'cost', fieldCode: '8716' },
  { key: '4.11', label: 'Rörelsekostnader', group: 'cost', fieldCode: '8717' },
  { key: '4.12', label: 'Fastighetskostnader', group: 'cost', fieldCode: '8718' },
];
// Lämnade bidrag (6710–6719) och lämnade bidrag och gåvor (6993).
const GRANT_COST_RANGES = [[6710, 6719], [6993, 6993]];

/**
 * Förslag till INK3SUF: den skattefria delen, alltså bokfört minus det som
 * tagits upp på INK3R. Fastigheter, vinster och förluster vid försäljning
 * och rörelsekostnader går inte att skilja ut ur kontona och föreslås inte.
 */
export function suggestInk3suf(verifications, period, resultRows = [], taxable = {}) {
  const booked = (row) => {
    const r = resultRows.find(x => x.row === row);
    return r ? r.amount : 0;
  };
  const free = (row) => booked(row) - (Number(taxable[row]) || 0);
  let grants = 0;
  for (const v of verifications || []) {
    if (!isBooked(v) || isClosingEntry(v) || !inPeriod(v.date, period)) continue;
    for (const r of v.rows || []) {
      const n = Number(r.account);
      if (GRANT_COST_RANGES.some(([a, b]) => n >= a && n <= b)) grants += getDebet(r) - getKredit(r);
    }
  }
  const operatingCosts = ['6.6', '6.7', '6.8', '6.9', '6.10'].reduce((s, row) => s + free(row), 0);
  const financialIncome = free('6.13') + Math.max(0, free('6.11')) + Math.max(0, free('6.12'));
  const out = {
    '4.1': booked('6.1'),
    '4.2': free('6.3'),
    '4.3': financialIncome,
    '4.5': free('6.2') + free('6.4') + free('6.5'),
    '4.7': operatingCosts - grants,
    '4.8': grants,
    '4.9': free('6.14') + free('6.15'),
  };
  for (const key of Object.keys(out)) out[key] = Math.max(0, Math.round(out[key]));
  return out;
}

// ── SRU-rader ───────────────────────────────────────────────────────────
/** INK3R: balans, bokförd och skattepliktig kolumn, 6.20 och 6.21. */
export function ink3rSruRows(ink3r, resultat, taxable) {
  const out = [];
  for (const r of ink3r?.rows || []) {
    const v = Math.round(r.amount);
    if (v) out.push([r.fieldCode, v]);
  }
  for (const r of resultat?.rows || []) {
    const v = Math.round(r.amount);
    if (!v) continue;
    if (r.polarity === 'signed') out.push([v > 0 ? r.bookedPlus : r.bookedMinus, Math.abs(v)]);
    else out.push([r.booked, v]);
  }
  for (const def of INK3R_RESULT_ROWS) {
    const v = taxable?.values?.[def.row];
    if (!v) continue;
    if (def.polarity === 'signed') out.push([v > 0 ? def.taxablePlus : def.taxableMinus, Math.abs(v)]);
    else out.push([def.taxable, v]);
  }
  const res = Math.round(resultat?.total || 0);
  if (res > 0) out.push(['8663', res]); else if (res < 0) out.push(['8763', -res]);
  const adj = Math.round(taxable?.total || 0);
  if (adj > 0) out.push(['8685', adj]); else if (adj < 0) out.push(['8785', -adj]);
  return out;
}

/** INK3S. `sruP` ('2026P4') filtrerar bort fält som inte finns det året. */
export function ink3sSruRows(ink3s, info = {}, answers = {}, sruP = '2026P4') {
  const out = [];
  const adj = Math.round(ink3s.justerat);
  if (adj > 0) out.push(['8686', adj]); else if (adj < 0) out.push(['8786', -adj]);
  for (const def of INK3S_ROWS) {
    const v = Math.round(Number(ink3s.values?.[def.key]) || 0);
    if (!v) continue;
    if (def.sign === '±') out.push([v > 0 ? def.fieldCodePlus : def.fieldCodeMinus, Math.abs(v)]);
    else out.push([def.fieldCode, Math.abs(v)]);
  }
  if (ink3s.overskott) out.push(['8695', ink3s.overskott]);
  if (ink3s.underskott) out.push(['8795', ink3s.underskott]);
  for (const def of INK3S_INFO_ROWS) {
    if (def.from && sruP < def.from) continue;
    const v = Math.round(Number(info[def.key]) || 0);
    if (v) out.push([def.fieldCode, v]);
  }
  if (answers.consultant === true) out.push(['8040', 'X']); else if (answers.consultant === false) out.push(['8041', 'X']);
  if (answers.audited === true) out.push(['8044', 'X']); else if (answers.audited === false) out.push(['8045', 'X']);
  return out;
}

/** INK3SUF: ändamål, fastighet och den skattefria verksamhetens intäkter och kostnader. */
export function ink3sufSruRows(suf = {}) {
  const out = [];
  for (const p of INK3SUF_PURPOSES) if (suf.purposes?.[p.key]) out.push([p.fieldCode, 'X']);
  const other = String(suf.otherPurpose || '').replace(/\s+/g, ' ').trim().slice(0, 36).trim();
  if (suf.purposes?.other && other) out.push(['8620', other]);
  const pct = Math.round(Number(suf.rentedPct) || 0);
  const sqm = Math.round(Number(suf.rentedSqm) || 0);
  if (pct) out.push(['8614', pct]);
  if (sqm) out.push(['8615', sqm]);
  for (const def of INK3SUF_ROWS) {
    const v = Math.round(Number(suf.values?.[def.key]) || 0);
    if (v) out.push([def.fieldCode, v]);
  }
  return out;
}

// INK3SUS för allmännyttig stiftelse, bara den skattefria delen.
// Avkastningsstiftelser fyller i 3.1–3.7, insamlings- och
// verksamhetsstiftelser 3.8–3.9 (blanketten SKV 2003, utgåva 33).
export const INK3SUS_ROWS = [
  { key: '3.1', label: 'Beslutad utdelning av bidrag och stipendier enligt ändamålet', kind: 'yield', fieldCode: '8850' },
  { key: '3.2', label: 'Bidrag och gåvor', kind: 'yield', fieldCode: '8857' },
  { key: '3.3', label: 'Kostnader för att få bidrag och gåvor (insamlingskostnader)', kind: 'yield', fieldCode: '8858' },
  { key: '3.4', label: 'Kapitalavkastning (räntor och utdelning, inte kapitalvinster)', kind: 'yield', fieldCode: '8851' },
  { key: '3.5', label: 'Kapitalförvaltningskostnader', kind: 'yield', fieldCode: '8852' },
  { key: '3.6', label: 'Kostnader för att fullfölja stiftelsens ändamål', kind: 'yield', fieldCode: '8853' },
  { key: '3.8', label: 'Intäkter', kind: 'operating', fieldCode: '8855' },
  { key: '3.9', label: 'Kostnader', kind: 'operating', fieldCode: '8856' },
];

/**
 * Förslag till INK3SUS ur bokföringen, minus det som tagits upp på INK3R.
 * Insamlings- och kapitalförvaltningskostnader går inte att skilja ut ur
 * kontona och föreslås inte.
 */
export function suggestInk3sus(verifications, period, resultRows = [], taxable = {}) {
  const booked = (row) => resultRows.find(x => x.row === row)?.amount || 0;
  const free = (row) => booked(row) - (Number(taxable[row]) || 0);
  const suf = suggestInk3suf(verifications, period, resultRows, taxable);
  const revenue = ['6.1', '6.2', '6.3', '6.4', '6.5', '6.13'].reduce((sum, row) => sum + free(row), 0)
    + Math.max(0, free('6.11')) + Math.max(0, free('6.12'));
  const costs = ['6.6', '6.7', '6.8', '6.9', '6.10', '6.14', '6.15'].reduce((sum, row) => sum + free(row), 0);
  const out = {
    '3.1': suf['4.8'],
    '3.2': free('6.3'),
    '3.4': free('6.13'),
    '3.6': suf['4.7'],
    '3.8': revenue,
    '3.9': costs,
  };
  for (const key of Object.keys(out)) out[key] = Math.max(0, Math.round(out[key] || 0));
  return out;
}

/** INK3SUS: ändamål och, efter stiftelsens sort, rad 3.1–3.7 eller 3.8–3.9. */
export function ink3susSruRows(sus = {}, purposes = {}, otherPurpose = '') {
  const out = [];
  for (const p of INK3SUF_PURPOSES) if (purposes?.[p.key]) out.push([p.susCode, 'X']);
  const other = String(otherPurpose || '').replace(/\s+/g, ' ').trim().slice(0, 36).trim();
  if (purposes?.other && other) out.push(['8840', other]);
  const kind = sus.kind === 'operating' ? 'operating' : 'yield';
  for (const def of INK3SUS_ROWS) {
    if (def.kind !== kind) continue;
    const v = Math.round(Number(sus.values?.[def.key]) || 0);
    if (v) out.push([def.fieldCode, v]);
  }
  if (kind === 'yield' && sus.previousYearDividend) out.push(['8854', 'X']);
  return out;
}

/** Vilka bilagor som ska lämnas, ur svaren. */
export function ink3Forms({ entity = 'association', publicBenefit, taxableActivity } = {}) {
  const suf = entity === 'association' && publicBenefit === true;
  const sus = entity === 'foundation' && publicBenefit === true;
  const rs = publicBenefit === false || taxableActivity === true;
  return { suf, sus, rs };
}
