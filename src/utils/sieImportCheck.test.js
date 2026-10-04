import { describe, it, expect } from 'vitest';
import { checkSieImport, applySieFixes, equityAccountFor } from './sieImportCheck';

const ib = (rows) => ({ series: 'A', date: '2025-01-01', description: 'Ingående balanser', rows });
const v = (series, sieNumber, rows) => ({ series, sieNumber, date: '2025-01-08', description: 'Faktura', rows });

describe('checkSieImport', () => {
  it('ingående balans utan eget kapital: föregående år inte avslutat', () => {
    const opening = ib([
      { account: '1930', debet: 120000, kredit: 0 },
      { account: '1510', debet: 30000, kredit: 0 },
      { account: '2440', debet: 0, kredit: 101800 },
    ]);
    const c = checkSieImport({ opening, companyType: 'AB' });
    expect(c.opening).toMatchObject({ debet: 150000, kredit: 101800, diff: 48200, cause: 'equity_missing' });
    expect(c.opening.equity.code).toBe('2098');
  });

  it('resultatkonton i ingående balans rättas inte automatiskt', () => {
    const opening = ib([{ account: '1930', debet: 500, kredit: 0 }, { account: '3001', debet: 0, kredit: 200 }]);
    const c = checkSieImport({ opening });
    expect(c.opening.cause).toBe('result_accounts');
    const fixed = applySieFixes({ opening, verifications: [] }, c, { bookOpeningDifference: true });
    expect(fixed.opening).toBe(opening);
  });

  it('skiljer avrundning från verkliga fel', () => {
    const verifications = [
      v('A', '1', [{ account: '6110', debet: 100.4, kredit: 0 }, { account: '1930', debet: 0, kredit: 100 }]),
      v('A', '2', [{ account: '6110', debet: 500, kredit: 0 }, { account: '1930', debet: 0, kredit: 400 }]),
      v('A', '3', [{ account: '6110', debet: 50, kredit: 0 }, { account: '1930', debet: 0, kredit: 50 }]),
    ];
    const c = checkSieImport({ verifications });
    expect(c.rounding.map(r => r.label)).toEqual(['A1']);
    expect(c.unbalanced.map(r => r.label)).toEqual(['A2']);
    expect(c.opening).toBe(null);
  });

  it('allt stämmer: inga problem', () => {
    const c = checkSieImport({ opening: ib([{ account: '1930', debet: 10, kredit: 0 }, { account: '2081', debet: 0, kredit: 10 }]), verifications: [] });
    expect(c).toEqual({ opening: null, rounding: null, unbalanced: null });
  });
});

describe('applySieFixes', () => {
  it('bokar skillnaden på eget kapital så att balansen går ihop', () => {
    const opening = ib([{ account: '1930', debet: 150000, kredit: 0 }, { account: '2440', debet: 0, kredit: 101800 }]);
    const c = checkSieImport({ opening, companyType: 'AB' });
    const { opening: fixed } = applySieFixes({ opening, verifications: [] }, c, { bookOpeningDifference: true });
    const last = fixed.rows[fixed.rows.length - 1];
    expect(last).toMatchObject({ account: '2098', kredit: 48200, debet: 0 });
    expect(fixed.balanced).toBe(true);
  });

  it('öresavrundning på 3740 och hoppar över det som inte går ihop', () => {
    const verifications = [
      v('A', '1', [{ account: '6110', debet: 100.4, kredit: 0 }, { account: '1930', debet: 0, kredit: 100 }]),
      v('A', '2', [{ account: '6110', debet: 500, kredit: 0 }, { account: '1930', debet: 0, kredit: 400 }]),
    ];
    const c = checkSieImport({ verifications });
    const out = applySieFixes({ opening: null, verifications }, c, { roundOff: true, skipUnbalanced: true });
    expect(out.verifications).toHaveLength(1);
    expect(out.verifications[0].rows.at(-1)).toMatchObject({ account: '3740', kredit: 0.4 });
  });

  it('väljer konto efter företagsform', () => {
    expect(equityAccountFor('AB').code).toBe('2098');
    expect(equityAccountFor('E').code).toBe('2010');
    expect(equityAccountFor(null, new Map([['2081', {}]])).code).toBe('2098');
  });
});
