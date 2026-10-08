// ROT/RUT-avdrag — procentsatser och tak, i en egen fil av samma skäl som
// vatConfig.js/payrollConfig.js: siffrorna ändras med jämna mellanrum av
// regeringen (senast: tillfälligt höjt till 50 % ROT under slutet av 2025,
// tillbaka till 30 % från 1 januari 2026 — källa: skatteverket.se,
// kontrollerat september 2026) — EN plats att uppdatera i, inte utspritt i
// komponenter.
export const ROT_RUT_RATES = {
  rot: { percent: 30, label: 'ROT', fullLabel: 'ROT-avdrag (reparation, ombyggnad, tillbyggnad)' },
  rut: { percent: 50, label: 'RUT', fullLabel: 'RUT-avdrag (hushållsnära tjänster)' },
};

// ROT och RUT delar samma kombinerade takbelopp per person och år
// (75 000 kr, varav max 50 000 kr ROT). Bokix håller idag INTE reda på hur
// mycket av taket en kund redan använt över flera fakturor/år — det skulle
// kräva att aggregera samtliga en kunds ROT/RUT-fakturor över
// kalenderåret, inte byggt än. Visas bara som en påminnelsetext i UI:t.
export const ROT_RUT_COMBINED_CAP = 75000;
export const ROT_CAP = 50000;

/** Radens bruttobelopp (inkl. moms) — samma formel som InvoiceForm/
 * InvoiceViewer/InvoiceDocument annars hade räknat var för sig, delad hit
 * så de aldrig kan glida isär. */
export function rowGross(r) {
  const net = (Number(r.qty) || 0) * (Number(r.unitPrice) || 0) * (1 - (Number(r.discount) || 0) / 100);
  return net * (1 + (Number(r.vatRate) || 0) / 100);
}

/** ROT/RUT-avdraget för en uppsättning fakturarader. Bara rader märkta
 * `rotRutLabor: true` räknas (avdraget gäller bara arbetskostnad, aldrig
 * material) — och alltid på BRUTTObeloppet (inkl. moms), inte nettot.
 * Det är Skatteverkets egen regel (kontrollerad mot skatteverket.se), en
 * vanlig missuppfattning är annars att avdraget räknas på nettopriset.
 * `rotRutType`: 'rot' | 'rut' | något annat (→ inget avdrag). */
export function calcRotRutDeduction(rotRutType, rows) {
  const rate = ROT_RUT_RATES[rotRutType]?.percent || 0;
  if (!rate) return { rate: 0, laborGross: 0, deduction: 0 };
  const laborGross = (rows || []).filter(r => r.rotRutLabor).reduce((sum, r) => sum + rowGross(r), 0);
  // Avrundas NEDÅT till hela kronor: Skatteverket godtar aldrig ett begärt
  // belopp som är större än det kunden betalat för arbetet, och med 50 %
  // RUT på t.ex. 717 kr skulle 358,50 avrundat uppåt bli 359 mot 358 betalt.
  // Mot noll för en kreditfaktura (negativa rader), så att krediten vänder
  // exakt det originalet bokade: -358, inte -359.
  const raw = Math.round(laborGross * rate) / 100;
  return { rate, laborGross, deduction: Math.sign(raw) * Math.floor(Math.abs(raw)) || 0 };
}

/** Det kunden själv ska betala på en faktura: hela beloppet minus ROT/RUT-
 * avdraget, som Skatteverket betalar i stället. Har Skatteverket avslagit
 * begäran (`rotRutStatus: 'rejected'`) ska kunden betala hela beloppet.
 * Fakturor i annan valuta kan inte ha husavdrag, och räknas som förut. */
export function invoiceCustomerDue(inv) {
  const gross = (inv?.rows || []).reduce((sum, r) => sum + rowGross(r), 0) || Number(inv?.amount) || 0;
  if (!inv?.rotRutType || inv.rotRutStatus === 'rejected') return gross;
  if ((inv.currency || 'SEK') !== 'SEK') return gross;
  // Det belopp som bokades på 1513 när fakturan skapades, om det finns.
  const deduction = inv.rotRutBookedDeduction ?? calcRotRutDeduction(inv.rotRutType, inv.rows).deduction;
  return gross - deduction;
}

/** Kvar för kunden att betala. */
export function invoiceCustomerRemaining(inv) {
  return Math.max(0, invoiceCustomerDue(inv) - (Number(inv?.paidAmount) || 0));
}
