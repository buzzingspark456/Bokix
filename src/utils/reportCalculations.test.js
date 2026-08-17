import { describe, it, expect } from 'vitest';
import { groupCostsByCategory } from './reportCalculations.js';

const accounts = [
  { code: '5010', name: 'Lokalhyra', type: 'kostnad' },
  { code: '5920', name: 'Annonsering', type: 'kostnad' },
  { code: '7010', name: 'Löner till anställda', type: 'kostnad' },
  { code: '6540', name: 'IT-tjänster', type: 'kostnad' },
  { code: '1930', name: 'Företagskonto', type: 'tillgang' },
];

function ver(id, date, rows) {
  return { id, date, status: 'booked', rows };
}

describe('groupCostsByCategory', () => {
  it('bucketar konton i Personal/Lokal/Marknadsföring/Övrigt enligt kontokodsintervall', () => {
    const verifications = [
      ver('v1', '2026-06-01', [
        { account: '5010', debet: 10000, kredit: 0 }, // Lokal
        { account: '1930', debet: 0, kredit: 10000 },
      ]),
      ver('v2', '2026-06-05', [
        { account: '5920', debet: 3000, kredit: 0 }, // Marknadsföring
        { account: '1930', debet: 0, kredit: 3000 },
      ]),
      ver('v3', '2026-06-10', [
        { account: '7010', debet: 25000, kredit: 0 }, // Personal
        { account: '1930', debet: 0, kredit: 25000 },
      ]),
      ver('v4', '2026-06-15', [
        { account: '6540', debet: 2000, kredit: 0 }, // Övrigt (65xx, ej 59xx/50xx/7xxx)
        { account: '1930', debet: 0, kredit: 2000 },
      ]),
    ];
    const { categories, total } = groupCostsByCategory(verifications, accounts, new Date(2026, 5, 1), new Date(2026, 5, 30));
    expect(total).toBe(40000);
    const byName = Object.fromEntries(categories.map(c => [c.name, c.amount]));
    expect(byName.Lokal).toBe(10000);
    expect(byName.Marknadsföring).toBe(3000);
    expect(byName.Personal).toBe(25000);
    expect(byName.Övrigt).toBe(2000);
  });

  it('utelämnar kategorier utan bokförda kostnader istället för att visa nollposter', () => {
    const verifications = [
      ver('v1', '2026-06-01', [
        { account: '7010', debet: 5000, kredit: 0 },
        { account: '1930', debet: 0, kredit: 5000 },
      ]),
    ];
    const { categories } = groupCostsByCategory(verifications, accounts, new Date(2026, 5, 1), new Date(2026, 5, 30));
    expect(categories).toEqual([{ name: 'Personal', amount: 5000 }]);
  });

  it('ignorerar utkast och kostnader utanför perioden', () => {
    const verifications = [
      ver('v1', '2026-06-01', [{ account: '5010', debet: 1000, kredit: 0 }, { account: '1930', debet: 0, kredit: 1000 }]),
      { ...ver('v2', '2026-06-02', [{ account: '5010', debet: 5000, kredit: 0 }]), status: 'draft' },
      ver('v3', '2025-06-01', [{ account: '5010', debet: 9000, kredit: 0 }, { account: '1930', debet: 0, kredit: 9000 }]),
    ];
    const { total } = groupCostsByCategory(verifications, accounts, new Date(2026, 5, 1), new Date(2026, 5, 30));
    expect(total).toBe(1000);
  });
});
