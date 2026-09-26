import { describe, it, expect } from 'vitest';
import { stripVatRows, isVatExempt } from './vatRegistration';

describe('isVatExempt', () => {
  it('bara ett uttryckligt nej räknas', () => {
    expect(isVatExempt({ vatRegistered: false })).toBe(true);
    expect(isVatExempt({ vatRegistered: true })).toBe(false);
    expect(isVatExempt({})).toBe(false);
  });
});

describe('stripVatRows', () => {
  it('lägger ingående moms på kostnaden', () => {
    const rows = [
      { account: '5410', debet: 800, kredit: 0 },
      { account: '2641', debet: 200, kredit: 0 },
      { account: '1930', debet: 0, kredit: 1000 },
    ];
    expect(stripVatRows(rows)).toEqual([
      { account: '5410', debet: 1000, kredit: 0 },
      { account: '1930', debet: 0, kredit: 1000 },
    ]);
  });

  it('lägger utgående moms på intäkten och behåller strängformatet', () => {
    const rows = [
      { account: '1510', debet: '1250.00', kredit: '' },
      { account: '3001', debet: '', kredit: '1000.00' },
      { account: '2611', debet: '', kredit: '250.00' },
    ];
    expect(stripVatRows(rows)).toEqual([
      { account: '1510', debet: '1250.00', kredit: '' },
      { account: '3001', debet: '', kredit: '1250.00' },
    ]);
  });

  it('rör inte omvänd skattskyldighet eller en bokning utan kostnadsrad', () => {
    const reverse = [
      { account: '4535', debet: 1000, kredit: 0 },
      { account: '2645', debet: 250, kredit: 0 },
      { account: '2614', debet: 0, kredit: 250 },
      { account: '1930', debet: 0, kredit: 1000 },
    ];
    expect(stripVatRows(reverse)).toEqual(reverse);
    const noCost = [{ account: '2641', debet: 100, kredit: 0 }, { account: '1930', debet: 0, kredit: 100 }];
    expect(stripVatRows(noCost)).toEqual(noCost);
  });
});
