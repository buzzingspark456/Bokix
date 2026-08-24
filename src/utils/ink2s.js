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
 * Ingen SRU-fältkod finns här av samma anledning som i
 * ink2rResultat.js: ingen pålitlig källa för INK2S:s koder har hittats,
 * så det här skrivs inte med i SRU-filen (se sruExport.js).
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
