import { describe, it, expect } from 'vitest';
import { invoiceCustomerRemaining, invoiceCustomerRemainingSek } from './rotRutConfig';

describe('invoiceCustomerRemainingSek', () => {
  it('räknar om en faktura i euro med bokföringskursen', () => {
    const inv = { currency: 'EUR', fxRate: 11.5, amount: 1000, paidAmount: 200 };
    expect(invoiceCustomerRemaining(inv)).toBe(800);
    expect(invoiceCustomerRemainingSek(inv)).toBe(9200);
  });

  it('lämnar kronor orörda, även utan kurs', () => {
    expect(invoiceCustomerRemainingSek({ amount: 500 })).toBe(500);
    expect(invoiceCustomerRemainingSek({ currency: 'SEK', fxRate: 11, amount: 500 })).toBe(500);
    expect(invoiceCustomerRemainingSek({ currency: 'EUR', amount: 500 })).toBe(500);
  });
});
