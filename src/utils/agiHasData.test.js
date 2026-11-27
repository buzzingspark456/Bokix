import { describe, it, expect } from 'vitest';
import { hasAgiData } from './agiExport.js';

describe('hasAgiData (vem som visas i arbetsgivardeklarationen)', () => {
  it('lön eller skatt: med', () => {
    expect(hasAgiData({ gross: 30000, tax: 7000 })).toBe(true);
    expect(hasAgiData({ gross: 0, tax: 1200 })).toBe(true);
  });
  it('bara förmån: med', () => {
    expect(hasAgiData({ gross: 0, tax: 0, payLines: [{ kind: 'benefit', amount: 2500 }] })).toBe(true);
  });
  it('0 kr (inga timmar den här månaden): inte med', () => {
    expect(hasAgiData({ gross: 0, tax: 0, net: 0, payLines: [] })).toBe(false);
    expect(hasAgiData(null)).toBe(false);
  });
});
