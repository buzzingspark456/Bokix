import { describe, it, expect } from 'vitest';
import {
  halfPriceBase, accumulatedThrough, depreciationForMonth, scheduleOf, pendingDepreciation, pendingByYear,
  buildYearDepreciationVerification, bookedDepreciationMap, unregisteredAcquisitions, buildReclassVerification,
} from './fixedAssets';

const sum = (rows, k) => Math.round(rows.reduce((s, r) => s + (r[k] || 0), 0) * 100) / 100;
const pc = { id: 'a1', name: 'Dator', acquisitionDate: '2026-01-10', cost: 36000, usefulLifeMonths: 36, residualValue: 0, assetAccount: '1224', accumulatedAccount: '1229', expenseAccount: '7832' };

describe('tillgångar: nya delar 2026-11-22', () => {
  it('halvt prisbasbelopp per år (59 200 kr 2026)', () => {
    expect(halfPriceBase('2026-05-01')).toBe(29600);
    expect(halfPriceBase('2025-05-01')).toBe(29400);
    expect(halfPriceBase('2027-01-01')).toBe(29800);
  });

  it('tidigare avskrivningar: inget bokas igen, resten fördelas över återstoden', () => {
    const a = { ...pc, acquisitionDate: '2025-01-01', openingAccumulated: 12000, openingMonth: '2025-12' };
    expect(depreciationForMonth(a, '2025-06')).toBe(0);
    expect(accumulatedThrough(a, '2025-12')).toBe(12000);
    expect(depreciationForMonth(a, '2026-01')).toBe(1000);
    expect(accumulatedThrough(a, '2027-12')).toBe(36000);
    // Hela planen efter bytet summerar till exakt resten.
    const after = scheduleOf(a).filter(r => r.month > '2025-12');
    expect(Math.round(after.reduce((s, r) => s + r.amount, 0) * 100) / 100).toBe(24000);
    const p = pendingDepreciation([a], [], '2026-03', {});
    expect(p.months.map(m => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('årsvis: obokade månader samlas på räkenskapsårets sista dag, bara avslutade år', () => {
    const p = pendingDepreciation([pc], [], '2026-12', {});
    const yearOf = (m) => ({ key: m.slice(0, 4), label: m.slice(0, 4), end: `${m.slice(0, 4)}-12-31` });
    expect(pendingByYear(p, yearOf, '2026-11-22')).toEqual([]);
    const years = pendingByYear(p, yearOf, '2027-01-05');
    expect(years).toHaveLength(1);
    expect(years[0].total).toBe(12000);
    const v = buildYearDepreciationVerification(years[0]);
    expect(v.date).toBe('2026-12-31');
    expect(sum(v.rows, 'debet')).toBe(sum(v.rows, 'kredit'));
    // När den är bokförd räknas alla tolv månader som bokförda.
    const map = bookedDepreciationMap([{ ...v, id: 'x' }]);
    expect([...map.keys()].sort()).toHaveLength(12);
    expect(pendingDepreciation([pc], [{ ...v, id: 'x' }], '2026-12', {}).months).toEqual([]);
  });

  it('köp på 5410 över halvt prisbasbelopp föreslås, med omföring', () => {
    const vers = [
      { id: 'v1', date: '2026-03-01', description: 'MacBook Pro', rows: [{ account: '5410', debet: 32000 }, { account: '2641', debet: 8000 }, { account: '1930', kredit: 40000 }] },
      { id: 'v2', date: '2026-03-02', description: 'Stol', rows: [{ account: '5410', debet: 4000 }, { account: '1930', kredit: 4000 }] },
      { id: 'v4', date: '2026-03-03', description: 'Årslicens', rows: [{ account: '5420', debet: 40000 }, { account: '1930', kredit: 40000 }] },
    ];
    const s = unregisteredAcquisitions(vers, [], { includeExpensed: true });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ verificationId: 'v1', amount: 32000, reclassFrom: '5410', category: 'dator', account: '1224' });
    const r = buildReclassVerification({ id: 'a9', name: 'MacBook Pro', cost: 32000, assetAccount: '1224' }, '5410', '2026-03-01');
    expect(r.rows).toEqual([{ account: '1224', debet: 32000, kredit: 0 }, { account: '5410', debet: 0, kredit: 32000 }]);
    // Omföringen själv blir inget nytt förslag.
    expect(unregisteredAcquisitions([...vers, { ...r, id: 'v3' }], [{ sourceVerificationId: 'v1' }], { includeExpensed: true })).toEqual([]);
    // Den gamla sidan (utan omföring) får inga sådana förslag.
    expect(unregisteredAcquisitions(vers, [])).toEqual([]);
  });
});
