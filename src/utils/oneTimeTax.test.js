import { describe, it, expect } from 'vitest';
import { oneTimeTaxRate } from './oneTimeTax';

describe('engångstabellen 2026', () => {
  it('kolumn 1 enligt Skatteverket', () => {
    expect(oneTimeTaxRate({ year: 2026, kolumn: 1, annualSalary: 25041 })).toBe(0);
    expect(oneTimeTaxRate({ year: 2026, kolumn: 1, annualSalary: 25042 })).toBe(10);
    expect(oneTimeTaxRate({ year: 2026, kolumn: 1, annualSalary: 462000 })).toBe(26);
    expect(oneTimeTaxRate({ year: 2026, kolumn: 1, annualSalary: 500000 })).toBe(34);
    expect(oneTimeTaxRate({ year: 2026, kolumn: 1, annualSalary: 700000 })).toBe(54);
  });
  it('andra kolumner', () => {
    expect(oneTimeTaxRate({ year: 2026, kolumn: 2, annualSalary: 300000 })).toBe(26);
    expect(oneTimeTaxRate({ year: 2026, kolumn: 4, annualSalary: 50000 })).toBe(3);
    expect(oneTimeTaxRate({ year: 2026, kolumn: 6, annualSalary: 170000 })).toBe(34);
  });
  it('ingen vanlig lön ger 30 %, okänt år eller kolumn ger null', () => {
    expect(oneTimeTaxRate({ year: 2026, kolumn: 1, annualSalary: 0 })).toBe(30);
    expect(oneTimeTaxRate({ year: 2027, kolumn: 1, annualSalary: 400000 })).toBeNull();
    expect(oneTimeTaxRate({ year: 2026, kolumn: 7, annualSalary: 400000 })).toBeNull();
  });
});
