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

describe('ROT- och RUT-taket per kund och år', async () => {
  const { rotRutUsedThisYear, rotRutRoom, calcRotRutDeduction } = await import('./rotRutConfig');
  const labor = (gross) => [{ rotRutLabor: true, qty: 1, unitPrice: gross / 1.25, vatRate: 25 }];
  const invoices = [
    { id: 'a', customerId: 'k1', date: '2026-03-01', rotRutType: 'rot', rotRutBookedDeduction: 40000 },
    { id: 'b', customerId: 'k1', date: '2026-05-01', rotRutType: 'rut', rotRutBookedDeduction: 20000 },
    { id: 'c', customerId: 'k1', date: '2025-05-01', rotRutType: 'rot', rotRutBookedDeduction: 50000 },
    { id: 'd', customerId: 'k1', date: '2026-06-01', rotRutType: 'rot', rotRutStatus: 'rejected', rotRutBookedDeduction: 9000 },
    { id: 'e', customerId: 'k2', date: '2026-06-01', rotRutType: 'rot', rotRutBookedDeduction: 9000 },
  ];
  it('räknar bara samma kund, samma år och inte avslagna', () => {
    expect(rotRutUsedThisYear(invoices, { customerId: 'k1', year: '2026' })).toEqual({ rot: 40000, rut: 20000 });
  });
  it('kvar: 75 000 totalt, högst 50 000 ROT', () => {
    const used = { rot: 40000, rut: 20000 };
    expect(rotRutRoom(used, 'rot')).toBe(10000);
    expect(rotRutRoom(used, 'rut')).toBe(15000);
    expect(rotRutRoom({ rot: 0, rut: 70000 }, 'rot')).toBe(5000);
  });
  it('avdraget begränsas till det som är kvar', () => {
    const r = calcRotRutDeduction('rot', labor(100000), 10000);
    expect(r.deduction).toBe(10000);
    expect(r.capped).toBe(true);
    expect(calcRotRutDeduction('rot', labor(10000), 10000).capped).toBe(false);
  });
});
