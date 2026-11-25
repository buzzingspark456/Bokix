// ── Representation (Skatteverket, kontrollerat 2026-11-16) ────────────────
// Källor: "Avdrag för moms vid representation", "Kostförmån, personalfester
// och intern representation" och Belopp och procent 2026.
//
// Extern representation (kunder, 6071/6072):
//  Moms: avdrag på ett underlag om högst 300 kr exklusive moms per person
//  och tillfälle för mat och dryck (36 kr vid 12 %, 75 kr vid 25 %; mat och
//  alkohol på samma nota: schablon 46 kr per person).
//  Inkomstskatt: måltider (frukost, lunch, middag) är inte avdragsgilla
//  (6072). Enklare förtäring (fika) är avdragsgill om den kostar högst 60 kr
//  exklusive moms per person (6071), annars inte (6072).
//
// Intern representation och personalfest (7631/7632):
//  Mat och dryck: moms på högst 300 kr exklusive moms per person, och
//  måltiden är inte avdragsgill i skatten (7632).
//  Kringkostnader (lokal, musik, underhållning): avdragsgilla och momsen
//  dras på högst 180 kr exklusive moms per person (7631), annars 7632.
//
// Moms som inte får dras av blir en del av kostnaden.
export const REPRESENTATION = {
  vatBasePerPerson: 300,
  mixedVatPerPerson: 46,
  simpleFoodPerPerson: 60,
  partyExtrasPerPerson: 180,
};
const EXTERNAL = { deductible: '6071', nonDeductible: '6072' };
const INTERNAL = { deductible: '7631', nonDeductible: '7632' };
export const REPRESENTATION_ACCOUNTS = new Set([EXTERNAL.deductible, EXTERNAL.nonDeductible, INTERNAL.deductible, INTERNAL.nonDeductible]);

/** 'internal' för personalrepresentation (7631/7632), annars 'external'. */
export const representationScope = (account) => (String(account).startsWith('763') ? 'internal' : 'external');

/** De typer användaren väljer mellan för kontot. */
export const representationKinds = (account) => (representationScope(account) === 'internal' ? ['meal', 'extras'] : ['meal', 'simple']);

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Hur ett representationskvitto ska bokföras.
 * `kind`: 'meal' (mat och dryck), 'simple' (fika, extern) eller 'extras'
 * (kringkostnader vid personalfest). `net`/`vat`: kvittots belopp
 * exklusive moms och momsen (positiva). `account`: valt konto, avgör om
 * det är extern eller intern representation.
 */
export function representationBooking({ kind, persons, net, vat, vatRate, account = '6071' }) {
  const n = Math.max(1, Math.floor(Number(persons) || 0));
  const rate = Number(vatRate) || 0;
  const internal = representationScope(account) === 'internal';
  const accounts = internal ? INTERNAL : EXTERNAL;
  const basePerPerson = internal && kind === 'extras' ? REPRESENTATION.partyExtrasPerPerson : REPRESENTATION.vatBasePerPerson;
  const vatCap = vatRate === 'mixed' && kind !== 'extras'
    ? round2(n * REPRESENTATION.mixedVatPerPerson)
    : round2(n * basePerPerson * rate / 100);
  const deductibleVat = round2(Math.min(Math.max(0, vat), vatCap));
  const cost = round2(net + (vat - deductibleVat));
  const limit = internal ? (kind === 'extras' ? REPRESENTATION.partyExtrasPerPerson : 0) : (kind === 'simple' ? REPRESENTATION.simpleFoodPerPerson : 0);
  const deductible = limit > 0 && net <= n * limit + 0.005;
  return {
    account: deductible ? accounts.deductible : accounts.nonDeductible,
    cost,
    deductibleVat,
    vatCap,
    persons: n,
    deductible,
  };
}
