import { isBooked } from './reportCalculations';
import { getDebet, getKredit } from './verificationAmounts';

/**
 * NE-bilagans sida 2, skattemässiga justeringar (SKV 2161, rad R12–R48),
 * för enskild firma. Sida 1 (B1–B16, R1–R11) ligger i ne.js.
 *
 * Det som går att räkna ut fylls i som förslag, allt kan ändras:
 *   R12  bokfört resultat, från R11
 *   R13  ej avdragsgilla kostnader ur bokföringen (samma konton som INK2S 4.3c)
 *   R14  skattefria intäkter ur bokföringen (8314, som INK2S 4.5c)
 *   R24  förra årets underskott (R48 förra året)
 *   R32  periodiseringsfonder som måste återföras (sex år gamla, äldst först)
 *   R39  särskild löneskatt 24,26 % på pensionspremierna i R38
 *   R40  förra årets avdrag för egenavgifter (R43 förra året)
 *   R43  schablonavdrag för egenavgifter: 25 % av R42, 10 % för den som fyllt
 *        66 vid årets ingång (67 från inkomstår 2026; bara ålderspensions-
 *        avgift), 0 för född 1937 eller tidigare. Den som har hel sjuk- eller
 *        aktivitetsersättning får också 10 %; det ändrar användaren själv.
 *        Skatteverket räknar de riktiga avgifterna, och
 *        skillnaden rättas nästa år via R40/R41.
 *
 * Inte med: R18–R21 (gemensam verksamhet, medhjälpande make) och R25–R28
 * (skogsavdrag, skogskonto m.m.). De är sällsynta; den som har dem fyller i
 * dem direkt hos Skatteverket. R21 blir då samma som R17.
 */

// sign: '+' läggs till, '-' dras av, '=' summa (räknas fram).
export const NE_TAX_ROWS = [
  { key: 'r12', row: 'R12', label: 'Bokfört resultat (från R11)', sign: '=', group: 'Resultat' },
  { key: 'r13', row: 'R13', label: 'Bokförda kostnader som inte ska dras av', sign: '+', group: 'Skattemässiga justeringar' },
  { key: 'r14', row: 'R14', label: 'Bokförda intäkter som inte ska tas upp', sign: '-', group: 'Skattemässiga justeringar' },
  { key: 'r15', row: 'R15', label: 'Intäkter som inte bokförts men som ska tas upp', sign: '+', group: 'Skattemässiga justeringar' },
  { key: 'r16', row: 'R16', label: 'Kostnader som inte bokförts men som ska dras av', sign: '-', group: 'Skattemässiga justeringar' },
  { key: 'r17', row: 'R17', label: 'Sammanlagt resultat av verksamheten', sign: '=', group: 'Skattemässiga justeringar' },
  { key: 'r22', row: 'R22', label: 'Övriga skattemässiga justeringar, kostnader (t.ex. resor till och från arbetet)', sign: '-', group: 'Övriga justeringar' },
  { key: 'r23', row: 'R23', label: 'Övriga skattemässiga justeringar, intäkter', sign: '+', group: 'Övriga justeringar' },
  { key: 'r24', row: 'R24', label: 'Outnyttjat underskott från förra året (R48 förra året)', sign: '-', group: 'Övriga justeringar' },
  { key: 'r29', row: 'R29', label: 'Överskott/underskott före räntefördelning', sign: '=', group: 'Övriga justeringar' },
  { key: 'r30', row: 'R30', label: 'Positiv räntefördelning (även till INK1 p. 11.1)', sign: '-', group: 'Räntefördelning och fonder' },
  { key: 'r31', row: 'R31', label: 'Negativ räntefördelning (även till INK1 p. 11.2)', sign: '+', group: 'Räntefördelning och fonder' },
  { key: 'r32', row: 'R32', label: 'Återföring av periodiseringsfond', sign: '+', group: 'Räntefördelning och fonder' },
  { key: 'r33', row: 'R33', label: 'Överskott/underskott före avsättning till periodiseringsfond', sign: '=', group: 'Räntefördelning och fonder' },
  { key: 'r34', row: 'R34', label: 'Avsättning till periodiseringsfond, högst 30 % av R33', sign: '-', group: 'Räntefördelning och fonder' },
  { key: 'r35', row: 'R35', label: 'Överskott/underskott före ökning av expansionsfond', sign: '=', group: 'Räntefördelning och fonder' },
  { key: 'r36', row: 'R36', label: 'Ökning av expansionsfond, högst R35 (även till INK1 p. 12.1)', sign: '-', group: 'Räntefördelning och fonder' },
  { key: 'r37', row: 'R37', label: 'Minskning av expansionsfond (även till INK1 p. 12.2)', sign: '+', group: 'Räntefördelning och fonder' },
  { key: 'r38', row: 'R38', label: 'Egna pensionspremier eller pensionssparkonto', sign: '-', group: 'Pension och egenavgifter' },
  { key: 'r39', row: 'R39', label: 'Särskild löneskatt på pensionspremierna i R38', sign: '-', group: 'Pension och egenavgifter' },
  { key: 'r40', row: 'R40', label: 'Förra årets avdrag för egenavgifter och särskild löneskatt (R43 förra året)', sign: '+', group: 'Pension och egenavgifter' },
  { key: 'r41', row: 'R41', label: 'Påförda egenavgifter och särskild löneskatt förra året (slutskattebeskedet)', sign: '-', group: 'Pension och egenavgifter' },
  { key: 'r42', row: 'R42', label: 'Överskott/underskott före årets avdrag för egenavgifter', sign: '=', group: 'Pension och egenavgifter' },
  { key: 'r43', row: 'R43', label: 'Årets beräknade avdrag för egenavgifter och särskild löneskatt', sign: '-', group: 'Pension och egenavgifter' },
  { key: 'r44', row: 'R44', label: 'Sjukpenning som hör till verksamheten', sign: '+', group: 'Slutligt resultat' },
  { key: 'r45', row: 'R45', label: 'Allmänt avdrag: underskott i konstnärlig eller nystartad verksamhet som utnyttjas (även till INK1 p. 14.1)', sign: '+', group: 'Slutligt resultat' },
  { key: 'r46', row: 'R46', label: 'Underskott som utnyttjas i kapital, vinst vid avyttring av näringsfastighet m.m.', sign: '+', group: 'Slutligt resultat' },
];

export const NE_TAX_INPUT_KEYS = NE_TAX_ROWS.filter(r => r.sign !== '=').map(r => r.key);

export const PENSION_PAYROLL_TAX = 0.2426;
const FUND_YEARS = 6; // en periodiseringsfond återförs senast det sjätte året efter avsättningen

// Samma konton som INK2S (ink2s.js).
const NON_DEDUCTIBLE = new Set(['6072', '6982', '6992', '7623', '7632', '8423']);
const TAX_FREE_INCOME = new Set(['8314']);

const num = (v) => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const has = (stored, key) => stored && stored[key] !== undefined;

/** Ej avdragsgilla kostnader (R13) och skattefria intäkter (R14) för året. */
export function bookedNeAdjustments(verifications, period) {
  let nonDeductible = 0;
  let taxFree = 0;
  for (const v of verifications || []) {
    if (!isBooked(v) || !v.date || v.date < period.start || v.date > period.end) continue;
    if (v.source === 'year_end_close') continue;
    for (const r of v.rows || []) {
      const account = String(r.account || '');
      const net = getDebet(r) - getKredit(r);
      if (NON_DEDUCTIBLE.has(account)) nonDeductible += net;
      if (TAX_FREE_INCOME.has(account)) taxFree -= net;
    }
  }
  return { r13: Math.max(0, Math.round(nonDeductible)), r14: Math.max(0, Math.round(taxFree)) };
}

/** Födelseåret ur ett personnummer (10 eller 12 siffror), eller null. Ett
 * 10-siffrigt nummer med "+" är 100 år eller äldre. */
export function birthYearFromPersonnummer(pnr, now = new Date()) {
  const raw = String(pnr || '');
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12) return Number(digits.slice(0, 4));
  if (digits.length !== 10) return null;
  const yy = Number(digits.slice(0, 2));
  const current = now.getFullYear();
  let year = 2000 + yy;
  if (year > current) year -= 100;
  if (raw.includes('+')) year -= 100;
  return year;
}

/** Schablonsatsen för R43. */
export function egenavgiftSchablonRate(birthYear, taxYear) {
  if (!birthYear || !taxYear) return 0.25;
  if (birthYear <= 1937) return 0;
  // Bara ålderspensionsavgift för den som fyllt 66 vid årets ingång, från
  // inkomstår 2026 67 år (Skatteverket). Både 2025 och 2026 blir det född
  // 1958 eller tidigare.
  const age = taxYear >= 2026 ? 67 : 66;
  if (birthYear <= taxYear - age - 1) return 0.10;
  return 0.25;
}

/** Periodiseringsfonder som finns kvar: avsättningar minus återföringar,
 * äldst först. `history` = [{ year, allocated, reversed }] i årsordning. */
export function openFunds(history) {
  const funds = [];
  for (const h of history || []) {
    let toReverse = Math.max(0, Math.round(h.reversed || 0));
    for (const f of funds) {
      if (toReverse <= 0) break;
      const take = Math.min(f.amount, toReverse);
      f.amount -= take;
      toReverse -= take;
    }
    const allocated = Math.max(0, Math.round(h.allocated || 0));
    if (allocated > 0) funds.push({ year: h.year, amount: allocated });
  }
  return funds.filter(f => f.amount > 0);
}

/**
 * Sida 2 för ett år. `stored` = det användaren skrivit (strängar), där ett
 * sparat fält, även '', alltid vinner över förslaget. `suggested` = förslag
 * ur bokföringen och förra året (r13, r14, r24, r32, r40).
 * Returnerar raderna med belopp, vilka som är förslag, R47/R48 och
 * maxbeloppen för R34 och R36.
 */
export function computeNeTax({ r12, stored = {}, suggested = {}, birthYear = null, taxYear = null }) {
  const v = {};
  const fromSuggestion = new Set();
  const pick = (key, fallback) => {
    if (has(stored, key)) return num(stored[key]);
    if (fallback !== undefined && fallback !== null && Math.round(fallback) !== 0) {
      fromSuggestion.add(key);
      return Math.round(fallback);
    }
    return 0;
  };
  v.r12 = Math.round(num(r12));
  for (const k of ['r13', 'r14', 'r15', 'r16']) v[k] = pick(k, suggested[k]);
  v.r17 = v.r12 + v.r13 - v.r14 + v.r15 - v.r16;
  for (const k of ['r22', 'r23', 'r24']) v[k] = pick(k, suggested[k]);
  v.r29 = v.r17 - v.r22 + v.r23 - v.r24;
  for (const k of ['r30', 'r31', 'r32']) v[k] = pick(k, suggested[k]);
  v.r33 = v.r29 - v.r30 + v.r31 + v.r32;
  const maxR34 = Math.max(0, Math.floor(v.r33 * 0.3));
  v.r34 = pick('r34');
  v.r35 = v.r33 - v.r34;
  const maxR36 = Math.max(0, v.r35);
  for (const k of ['r36', 'r37', 'r38']) v[k] = pick(k, suggested[k]);
  v.r39 = pick('r39', v.r38 * PENSION_PAYROLL_TAX);
  for (const k of ['r40', 'r41']) v[k] = pick(k, suggested[k]);
  v.r42 = v.r35 - v.r36 + v.r37 - v.r38 - v.r39 + v.r40 - v.r41;
  const rate = egenavgiftSchablonRate(birthYear, taxYear);
  v.r43 = pick('r43', v.r42 > 0 ? v.r42 * rate : 0);
  for (const k of ['r44', 'r45', 'r46']) v[k] = pick(k, suggested[k]);
  // R45 och R46 läggs tillbaka: underskottet används på annat håll (mot lön
  // eller i kapital) och ska inte också sparas till nästa år.
  const total = v.r42 - v.r43 + v.r44 + v.r45 + v.r46;

  const warnings = [];
  if (v.r34 > maxR34) warnings.push({ key: 'r34', text: `Högst ${maxR34} kr (30 % av R33).` });
  if (v.r36 > maxR36) warnings.push({ key: 'r36', text: `Högst ${maxR36} kr (R35).` });
  if (v.r30 > 0 && v.r30 > Math.max(0, v.r29)) warnings.push({ key: 'r30', text: 'Positiv räntefördelning får inte vara större än överskottet i R29.' });

  return {
    values: v,
    rows: NE_TAX_ROWS.map(def => ({ ...def, amount: v[def.key], suggested: fromSuggestion.has(def.key) })),
    r47: total > 0 ? total : 0,
    r48: total < 0 ? -total : 0,
    maxR34,
    maxR36,
    schablonRate: rate,
    warnings,
  };
}

/**
 * Hela kedjan av år, äldst först: förra årets R43 blir årets R40, förra
 * årets R48 blir årets R24, och periodiseringsfonderna följs år för år.
 * `years` = [{ key, start, end, r12 }] i ordning, `neByKey` = company.ne.
 * Returnerar { [key]: { ...computeNeTax-resultat, funds, mustReverse } }.
 */
export function computeNeTaxChain({ years, neByKey = {}, verifications = [], birthYear = null }) {
  const out = {};
  const history = [];
  let prev = null;
  for (const fy of years || []) {
    const stored = neByKey?.[fy.key]?.tax || {};
    const taxYear = Number(String(fy.end).slice(0, 4));
    const fundsAtStart = openFunds(history);
    const mustReverse = fundsAtStart
      .filter(f => Number(f.year) <= taxYear - FUND_YEARS)
      .reduce((s, f) => s + f.amount, 0);
    const booked = bookedNeAdjustments(verifications, fy);
    const suggested = {
      ...booked,
      r24: prev?.r48 || 0,
      r40: prev?.values?.r43 || 0,
      r32: mustReverse,
    };
    const result = computeNeTax({ r12: fy.r12, stored, suggested, birthYear, taxYear });
    history.push({ year: taxYear, allocated: result.values.r34, reversed: result.values.r32 });
    out[fy.key] = { ...result, fundsAtStart, mustReverse, fundsAfter: openFunds(history) };
    prev = result;
  }
  return out;
}
