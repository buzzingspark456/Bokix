import { getDebet, getKredit } from './verificationAmounts';
import { isBooked } from './reportCalculations';
/**
 * INK2S — Skattemässiga justeringar (rad 4.1–4.16) av Skatteverkets
 * Inkomstdeklaration 2. Till skillnad från INK2R (ink2r.js/
 * ink2rResultat.js) går de här posterna INTE att räkna fram automatiskt
 * ur bokföringen — de flesta (ej avdragsgilla kostnader, periodiserings-
 * fondsavsättningar, kapitalvinster m.m.) kräver skattemässig bedömning
 * som bara användaren kan göra. Den här modulen summerar bara det
 * användaren själv matat in, med rätt tecken enligt blanketten.
 *
 * Rad 4.1/4.2 (Årets resultat) fylls INTE i här — de tas emot färdiga
 * från ink2rResultat.js:s `total` (samma resultat som redan visas i
 * resultaträkningen ovanför på sidan), så det aldrig kan divergera.
 *
 * Rad 4.17–4.22 ("Övriga uppgifter") och frågorna om revision m.m. är
 * inte med — de påverkar inte över-/underskottsberäkningen och är
 * rena tilläggsuppgifter, avsiktligt utanför den här första versionen.
 *
 * Fältkoderna för SRU-filen finns i INK2S_SRU längre ner.
 */
export const INK2S_ROWS = [
  { key: '4.3a', row: '4.3 a', label: 'Skatt på årets resultat', group: 'Bokförda kostnader som inte ska dras av', sign: '+' },
  { key: '4.3b', row: '4.3 b', label: 'Nedskrivning av finansiella tillgångar', group: 'Bokförda kostnader som inte ska dras av', sign: '+' },
  { key: '4.3c', row: '4.3 c', label: 'Andra bokförda kostnader', group: 'Bokförda kostnader som inte ska dras av', sign: '+' },
  { key: '4.4a', row: '4.4 a', label: 'Lämnade koncernbidrag', group: 'Kostnader som ska dras av men som inte ingår i det redovisade resultatet', sign: '-' },
  { key: '4.4b', row: '4.4 b', label: 'Andra ej bokförda kostnader', group: 'Kostnader som ska dras av men som inte ingår i det redovisade resultatet', sign: '-' },
  { key: '4.5a', row: '4.5 a', label: 'Ackordsvinster', group: 'Bokförda intäkter som inte ska tas upp', sign: '-' },
  { key: '4.5b', row: '4.5 b', label: 'Utdelning', group: 'Bokförda intäkter som inte ska tas upp', sign: '-' },
  { key: '4.5c', row: '4.5 c', label: 'Andra bokförda intäkter', group: 'Bokförda intäkter som inte ska tas upp', sign: '-' },
  { key: '4.6a', row: '4.6 a', label: 'Beräknad schablonintäkt på periodiseringsfonder vid beskattningsårets ingång', group: 'Intäkter som ska tas upp men som inte ingår i det redovisade resultatet', sign: '+' },
  { key: '4.6b', row: '4.6 b', label: 'Beräknad schablonintäkt på fondandelar ägda vid kalenderårets ingång', group: 'Intäkter som ska tas upp men som inte ingår i det redovisade resultatet', sign: '+' },
  { key: '4.6c', row: '4.6 c', label: 'Mottagna koncernbidrag', group: 'Intäkter som ska tas upp men som inte ingår i det redovisade resultatet', sign: '+' },
  { key: '4.6d', row: '4.6 d', label: 'Uppräknat belopp vid återföring av periodiseringsfond', group: 'Intäkter som ska tas upp men som inte ingår i det redovisade resultatet', sign: '+' },
  { key: '4.6e', row: '4.6 e', label: 'Andra ej bokförda intäkter', group: 'Intäkter som ska tas upp men som inte ingår i det redovisade resultatet', sign: '+' },
  { key: '4.7a', row: '4.7 a', label: 'Bokförd vinst', group: 'Avyttring av delägarrätter', sign: '-' },
  { key: '4.7b', row: '4.7 b', label: 'Bokförd förlust', group: 'Avyttring av delägarrätter', sign: '+' },
  { key: '4.7c', row: '4.7 c', label: 'Uppskov med kapitalvinst enligt blankett N4', group: 'Avyttring av delägarrätter', sign: '-' },
  { key: '4.7d', row: '4.7 d', label: 'Återfört uppskov av kapitalvinst enligt blankett N4', group: 'Avyttring av delägarrätter', sign: '+' },
  { key: '4.7e', row: '4.7 e', label: 'Kapitalvinst för beskattningsåret', group: 'Avyttring av delägarrätter', sign: '+' },
  { key: '4.7f', row: '4.7 f', label: 'Kapitalförlust som ska dras av', group: 'Avyttring av delägarrätter', sign: '-' },
  { key: '4.8a', row: '4.8 a', label: 'Bokförd intäkt/vinst', group: 'Andel i handelsbolag (inkl. avyttring)', sign: '-' },
  { key: '4.8b', row: '4.8 b', label: 'Skattemässigt överskott enligt N3B', group: 'Andel i handelsbolag (inkl. avyttring)', sign: '+' },
  { key: '4.8c', row: '4.8 c', label: 'Bokförd kostnad/förlust', group: 'Andel i handelsbolag (inkl. avyttring)', sign: '+' },
  { key: '4.8d', row: '4.8 d', label: 'Skattemässigt underskott enligt N3B', group: 'Andel i handelsbolag (inkl. avyttring)', sign: '-' },
  { key: '4.9', row: '4.9', label: 'Skattemässig justering vid avskrivning på byggnader/fast egendom samt restvärdesavskrivning på maskiner och inventarier', group: 'Övriga justeringar', sign: '±' },
  { key: '4.10', row: '4.10', label: 'Skattemässig justering vid avyttring av näringsfastighet och näringsbostadsrätt', group: 'Övriga justeringar', sign: '±' },
  { key: '4.11', row: '4.11', label: 'Skogs-/substansminskningsavdrag (specificeras på blankett N8)', group: 'Övriga justeringar', sign: '-' },
  { key: '4.12', row: '4.12', label: 'Återföringar vid avyttring av fastighet', group: 'Övriga justeringar', sign: '+' },
  { key: '4.13', row: '4.13', label: 'Andra skattemässiga justeringar av resultatet', group: 'Övriga justeringar', sign: '±' },
  { key: '4.14a', row: '4.14 a', label: 'Outnyttjat underskott från föregående år', group: 'Underskott', sign: '-' },
  { key: '4.14b', row: '4.14 b', label: 'Reduktion av outnyttjat underskott med hänsyn till beloppsspärr, ackord, konkurs m.m.', group: 'Underskott', sign: '+' },
  { key: '4.14c', row: '4.14 c', label: 'Reduktion av outnyttjat underskott med hänsyn till koncernbidragsspärr, fusionsspärr m.m.', group: 'Underskott', sign: '+' },
];

/**
 * @param values  Objekt {radnyckel: belopp} med av användaren inmatade,
 *                ALLTID positiva belopp (tecknet i `sign` avgör hur det
 *                påverkar summan) — utom för "±"-rader där värdet redan
 *                är det signerade beloppet användaren avser.
 * @param arsResultat  Årets bokförda resultat (vinst positivt, förlust
 *                     negativt) — från `computeInk2rResultat(...).total`.
 */
export function computeInk2s(values, arsResultat) {
  const rows = INK2S_ROWS.map(def => {
    const raw = Number(values?.[def.key]) || 0;
    const contribution = def.sign === '+' ? raw : def.sign === '-' ? -raw : raw;
    return { ...def, value: raw, contribution };
  });
  const adjustments = rows.reduce((sum, r) => sum + r.contribution, 0);
  const total = (arsResultat || 0) + adjustments;
  return {
    rows,
    arsResultatVinst: arsResultat > 0 ? arsResultat : 0,
    arsResultatForlust: arsResultat < 0 ? -arsResultat : 0,
    adjustments,
    total,
    overskott: total > 0 ? total : 0,
    underskott: total < 0 ? -total : 0,
  };
}

// ── SRU-fältkoder (2026-10-10) ──
// Ur Skatteverkets fältnamnstabell INK2S_SKV2002-33-01-24-04 (paketet
// 2025P4). "±"-rader har en kod för plus och en för minus; beloppet skrivs
// alltid positivt på koden som tecknet pekar ut. 4.15/4.16 förs över till
// huvudblanketten som 7104 (1.1 överskott) och 7114 (1.2 underskott).
export const INK2S_SRU = {
  '4.1': '7650', '4.2': '7750',
  '4.3a': '7651', '4.3b': '7652', '4.3c': '7653',
  '4.4a': '7751', '4.4b': '7764',
  '4.5a': '7752', '4.5b': '7753', '4.5c': '7754',
  '4.6a': '7654', '4.6b': '7668', '4.6c': '7655', '4.6d': '7673', '4.6e': '7665',
  '4.7a': '7755', '4.7b': '7656', '4.7c': '7756', '4.7d': '7657', '4.7e': '7658', '4.7f': '7757',
  '4.8a': '7758', '4.8b': '7659', '4.8c': '7660', '4.8d': '7759',
  '4.9': { plus: '7666', minus: '7765' },
  '4.10': { plus: '7661', minus: '7760' },
  '4.11': '7761', '4.12': '7662',
  '4.13': { plus: '7663', minus: '7762' },
  '4.14a': '7763', '4.14b': '7671', '4.14c': '7672',
  '4.15': '7670', '4.16': '7770',
};
export const INK2_MAIN_SRU = { overskott: '7104', underskott: '7114' };

/** Raderna som [fältkod, belopp] för SRU-filen: årets resultat, varje
 * ifylld justering och över- eller underskottet. Hela kronor. */
export function ink2sSruRows(ink2s) {
  const out = [];
  const push = (code, amount) => { const v = Math.round(Math.abs(amount)); if (v) out.push([code, v]); };
  if (ink2s.arsResultatVinst) push(INK2S_SRU['4.1'], ink2s.arsResultatVinst);
  if (ink2s.arsResultatForlust) push(INK2S_SRU['4.2'], ink2s.arsResultatForlust);
  for (const r of ink2s.rows) {
    if (!r.value) continue;
    const code = INK2S_SRU[r.key];
    if (typeof code === 'object') push(r.value >= 0 ? code.plus : code.minus, r.value);
    else push(code, r.value);
  }
  if (ink2s.overskott) push(INK2S_SRU['4.15'], ink2s.overskott);
  if (ink2s.underskott) push(INK2S_SRU['4.16'], ink2s.underskott);
  return out;
}

// ── Förslag ur bokföringen ──
// Det som går att läsa ut säkert ur kontona. Användaren kan alltid ändra.
//   4.3a  bokförd skatt på årets resultat (8910–8980)
//   4.3c  kostnader bokförda som ej avdragsgilla (BAS-kontona för det)
//   4.5c  skattefria intäkter (8314 skattefria ränteintäkter)
//   4.6a  schablonintäkt: periodiseringsfonder vid årets ingång gånger
//         statslåneräntan 30 november året innan (IL 30 kap. 6 a §)
//   4.14a outnyttjat underskott från förra årets deklaration i Bokix
const TAX_ACCOUNTS = /^89[1-8]\d$/;
const NON_DEDUCTIBLE = new Set(['6072', '6982', '6992', '7623', '7632', '8423']);
const TAX_FREE_INCOME = new Set(['8314']);
const PERIODISERINGSFOND = /^21[1-4]\d$/;

// Statslåneräntan 30 november året före beskattningsåret, i procent
// (Riksgälden). Nyckel = året beskattningsåret börjar.
export const STATSLANERANTA = { 2024: 2.62, 2025: 1.96, 2026: 2.55 };

export function suggestInk2s({ verifications, fy, previousUnderskott = 0 }) {
  let tax = 0; let nonDeductible = 0; let taxFree = 0; let fundsAtStart = 0;
  const accounts = new Map();
  const add = (key, account, amount) => {
    const list = accounts.get(key) || new Map();
    list.set(account, (list.get(account) || 0) + amount);
    accounts.set(key, list);
  };
  for (const v of verifications || []) {
    if (!isBooked(v) || !v.date) continue;
    const inYear = v.date >= fy.start && v.date <= fy.end;
    // Ingående balans: allt före året, plus IB-verifikationer på första dagen.
    const opening = v.date < fy.start || (v.date === fy.start && (v.isOpeningBalance || /ingående balans/i.test(v.description || '')));
    for (const r of v.rows || []) {
      const account = String(r.account || '');
      const net = getDebet(r) - getKredit(r);
      if (opening && PERIODISERINGSFOND.test(account)) fundsAtStart -= net;
      if (!inYear || opening) continue;
      if (TAX_ACCOUNTS.test(account)) { tax += net; add('4.3a', account, net); }
      if (NON_DEDUCTIBLE.has(account)) { nonDeductible += net; add('4.3c', account, net); }
      if (TAX_FREE_INCOME.has(account)) { taxFree -= net; add('4.5c', account, -net); }
    }
  }
  const rate = STATSLANERANTA[Number(String(fy.start).slice(0, 4))];
  const suggestions = {};
  const round = (n) => Math.round(n);
  if (round(tax) > 0) suggestions['4.3a'] = round(tax);
  if (round(nonDeductible) > 0) suggestions['4.3c'] = round(nonDeductible);
  if (round(taxFree) > 0) suggestions['4.5c'] = round(taxFree);
  if (fundsAtStart > 0 && rate != null) suggestions['4.6a'] = round(fundsAtStart * rate / 100);
  if (previousUnderskott > 0) suggestions['4.14a'] = round(previousUnderskott);
  return {
    suggestions,
    fundsAtStart: round(fundsAtStart),
    rate,
    // Kontona bakom varje förslag, för att kunna visa var beloppet kommer ifrån.
    accounts: Object.fromEntries([...accounts.entries()].map(([k, m]) => [k, [...m.entries()].map(([account, amount]) => ({ account, amount: round(amount) })).filter(a => a.amount)])),
  };
}

/** Värdet som gäller för en rad: det användaren skrivit, annars förslaget. */
export function resolveInk2sValues(saved = {}, suggestions = {}) {
  const out = {};
  for (const def of INK2S_ROWS) {
    const s = saved?.[def.key];
    out[def.key] = s !== undefined && s !== null && s !== '' ? Number(s) || 0 : (suggestions[def.key] || 0);
  }
  return out;
}
