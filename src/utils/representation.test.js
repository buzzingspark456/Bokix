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

describe('personalfest och intern representation', () => {
  it('julbord för 10: 7632, momsen högst 300 kr per person', () => {
    // 10 × 500 kr exkl. moms, 12 % = 600 kr moms, taket 360 kr
    const r = representationBooking({ kind: 'meal', persons: 10, net: 5000, vat: 600, vatRate: 12, account: '7631' });
    expect(r.account).toBe('7632');
    expect(r.deductibleVat).toBe(360);
    expect(r.cost).toBe(5240);
  });
  it('lokal och musik upp till 180 kr per person: 7631', () => {
    const r = representationBooking({ kind: 'extras', persons: 10, net: 1500, vat: 375, vatRate: 25, account: '7631' });
    expect(r.account).toBe('7631');
    expect(r.deductibleVat).toBe(375); // taket 450
  });
  it('kringkostnader över 180 kr per person: 7632', () => {
    const r = representationBooking({ kind: 'extras', persons: 5, net: 2000, vat: 500, vatRate: 25, account: '7631' });
    expect(r.account).toBe('7632');
    expect(r.deductibleVat).toBe(225);
  });
});
