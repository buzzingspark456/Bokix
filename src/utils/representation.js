// ── Extern representation (Skatteverket, kontrollerat 2026-11-16) ─────────
// Källa: "Avdrag för moms vid representation" och Belopp och procent 2026.
//
//  Moms: avdrag på ett underlag om högst 300 kr exklusive moms per person
//  och tillfälle för mat och dryck. Med 12 % moms blir det högst 36 kr per
//  person, med 25 % (t.ex. alkohol) högst 75 kr.
//
//  Inkomstskatt: måltider (frukost, lunch, middag) är inte avdragsgilla och
//  bokförs på 6072. Enklare förtäring (fika, kaffe och bulle) är avdragsgill
//  om kostnaden är högst 60 kr exklusive moms per person, och bokförs då på
//  6071. Är den högre är inget avdragsgillt (6072).
//
//  Moms som inte får dras av blir en del av kostnaden.
export const REPRESENTATION = {
  vatBasePerPerson: 300,
  // Mat och alkohol på samma nota: schablon 46 kr moms per person.
  mixedVatPerPerson: 46,
  simpleFoodPerPerson: 60,
  deductibleAccount: '6071',
  nonDeductibleAccount: '6072',
};
export const REPRESENTATION_ACCOUNTS = new Set([REPRESENTATION.deductibleAccount, REPRESENTATION.nonDeductibleAccount]);

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Hur ett representationskvitto ska bokföras.
 * `kind`: 'meal' (lunch, middag) eller 'simple' (fika, enklare förtäring).
 * `net` och `vat` är kvittots belopp exklusive moms och momsen (positiva).
 * Returnerar konto, kostnad (netto plus moms som inte får dras av) och den
 * moms som får dras av.
 */
export function representationBooking({ kind, persons, net, vat, vatRate }) {
  const n = Math.max(1, Math.floor(Number(persons) || 0));
  const rate = Number(vatRate) || 0;
  const vatCap = vatRate === 'mixed'
    ? round2(n * REPRESENTATION.mixedVatPerPerson)
    : round2(n * REPRESENTATION.vatBasePerPerson * rate / 100);
  const deductibleVat = round2(Math.min(Math.max(0, vat), vatCap));
  const cost = round2(net + (vat - deductibleVat));
  const simpleOk = kind === 'simple' && net <= n * REPRESENTATION.simpleFoodPerPerson + 0.005;
  return {
    account: simpleOk ? REPRESENTATION.deductibleAccount : REPRESENTATION.nonDeductibleAccount,
    cost,
    deductibleVat,
    vatCap,
    persons: n,
    deductible: simpleOk,
  };
}
