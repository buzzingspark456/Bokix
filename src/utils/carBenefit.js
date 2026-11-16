// ── Bilförmån (Skatteverket, kontrollerat 2026-11-16) ─────────────────────
// Källa: Skatteverket "Bilförmånsberäkning" (arbetsgivare) och Belopp och
// procent 2026. Gäller bilar som tagits i trafik från 1 juli 2021.
//
//  Förmånsvärde per år =
//      0,29 × prisbasbeloppet
//    + nybilspriset × (70 % av statslåneräntan 30 nov året före + 1 %)
//      (statslåneräntan räknas som lägst 0,5 %)
//    + 13 % av nybilspriset
//    + bilens årliga fordonsskatt
//  Nybilspriset inkluderar extrautrustning. Miljöbilar: el- och vätgasbilar
//  sätts ned med 350 000 kr, laddhybrider med 140 000 kr, dock högst 50 %
//  av nybilspriset. Elhybrider sätts inte ned.
//
// Skatteverkets exempel 2026: 322 000 kr, fordonsskatt 4 050 kr ger
// 17 168 + 8 967 + 41 860 + 4 050 = 72 045 kr per år.
export const CAR_BENEFIT_YEARS = {
  2026: { priceBaseAmount: 59200, governmentRate: 2.55 },
};
const REDUCTION = { el: 350000, laddhybrid: 140000 };

/** Förmånsvärdet per år och månad, eller null om året saknas i tabellen
 * (då ska Skatteverkets egen beräkning användas). */
export function calcCarBenefit({ year, newCarPrice, extras = 0, vehicleTax = 0, fuel = 'annat' }) {
  const y = CAR_BENEFIT_YEARS[year];
  if (!y) return null;
  const price = Math.max(0, (Number(newCarPrice) || 0) + (Number(extras) || 0));
  if (!price) return null;
  const cut = REDUCTION[fuel] ? Math.min(REDUCTION[fuel], price * 0.5) : 0;
  const reducedPrice = price - cut;
  const rate = Math.max(0.5, y.governmentRate) * 0.7 + 1;
  const parts = {
    base: Math.floor(0.29 * y.priceBaseAmount),
    interest: Math.floor(reducedPrice * rate / 100),
    price: Math.floor(reducedPrice * 0.13),
    tax: Math.floor(Number(vehicleTax) || 0),
  };
  const yearly = parts.base + parts.interest + parts.price + parts.tax;
  return { yearly, monthly: Math.round(yearly / 12), parts, reducedPrice };
}
