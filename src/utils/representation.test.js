import { describe, it, expect } from 'vitest';
import { representationBooking } from './representation';

describe('extern representation', () => {
  it('kundlunch för två: 6072, momsen högst 36 kr per person', () => {
    // 2 luncher à 250 kr exkl. moms, 12 % moms = 60 kr
    const r = representationBooking({ kind: 'meal', persons: 2, net: 500, vat: 60, vatRate: 12 });
    expect(r.account).toBe('6072');
    expect(r.deductibleVat).toBe(60); // under taket 72 kr
    expect(r.cost).toBe(500);
  });

  it('dyr middag: momsen över taket blir kostnad', () => {
    // 2 middagar à 800 kr exkl. moms, 12 % = 192 kr moms, taket 72 kr
    const r = representationBooking({ kind: 'meal', persons: 2, net: 1600, vat: 192, vatRate: 12 });
    expect(r.deductibleVat).toBe(72);
    expect(r.cost).toBe(1720);
    expect(r.cost + r.deductibleVat).toBe(1792);
  });

  it('fika upp till 60 kr per person är avdragsgill (6071)', () => {
    const r = representationBooking({ kind: 'simple', persons: 3, net: 150, vat: 18, vatRate: 12 });
    expect(r.account).toBe('6071');
    expect(r.deductibleVat).toBe(18);
  });

  it('fika över 60 kr per person är inte avdragsgill (6072)', () => {
    const r = representationBooking({ kind: 'simple', persons: 1, net: 95, vat: 11.4, vatRate: 12 });
    expect(r.account).toBe('6072');
  });
});
