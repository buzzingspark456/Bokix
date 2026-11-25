// ── Skatteavdrag på engångsbelopp (Skatteverket, kontrollerat 2026-11-16) ──
// Källa: Skatteverket "Engångsbelopp" (arbetsgivare), engångstabeller för
// inkomståret 2026. Procentsatsen beror på kolumnen i den anställdas
// skattetabell och på årslönen (den vanliga lönen räknad på ett år).
// Tabellerna gäller alla tabellnummer. Saknar den anställda tidsbestämd lön
// ska 30 % dras. Nya tabeller kommer varje år: lägg till året nedan.
//
// Varje rad: [årslön till och med, procent]. Sista raden gäller allt över.
export const ONE_TIME_TABLES = {
  2026: {
    1: [[25041, 0], [82800, 10], [192000, 21], [477600, 26], [660000, 34], [Infinity, 54]],
    2: [[65800, 0], [477600, 26], [660000, 34], [Infinity, 55]],
    3: [[25041, 0], [331200, 10], [477600, 26], [660000, 34], [Infinity, 55]],
    4: [[25041, 0], [54000, 3], [192000, 22], [660000, 26], [Infinity, 46]],
    5: [[25041, 0], [32400, 10], [160800, 29], [184800, 34], [660000, 38], [Infinity, 54]],
    6: [[25041, 0], [160800, 29], [184800, 34], [660000, 38], [Infinity, 54]],
  },
};
export const ONE_TIME_NO_REGULAR_SALARY = 30;

/** Procentsatsen för ett engångsbelopp, eller null om året eller kolumnen
 * saknas (då anges den för hand). */
export function oneTimeTaxRate({ year, kolumn, annualSalary }) {
  const table = ONE_TIME_TABLES[year]?.[Number(kolumn)];
  if (!table) return null;
  const salary = Math.max(0, Math.round(Number(annualSalary) || 0));
  if (salary === 0) return ONE_TIME_NO_REGULAR_SALARY;
  return table.find(([to]) => salary <= to)[1];
}
