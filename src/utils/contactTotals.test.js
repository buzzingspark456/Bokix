import { describe, it, expect } from 'vitest';
import { contactTotals, invoiceNetSek } from './contactTotals';

describe('contactTotals', () => {
  it('summerar kundens fakturor i år exklusive moms och hoppar över utkast', () => {
    const totals = contactTotals({
      year: 2026,
      invoices: [
        { type: 'invoice', customerId: 'c1', date: '2026-03-01', status: 'paid', rows: [{ qty: 2, unitPrice: 1000, vatRate: 25 }] },
        { type: 'invoice', customerId: 'c1', date: '2026-05-01', status: 'sent', priceInclVat: true, rows: [{ qty: 1, unitPrice: 1250, vatRate: 25 }] },
        { type: 'invoice', customerId: 'c1', date: '2026-06-01', status: 'draft', rows: [{ qty: 1, unitPrice: 9999, vatRate: 25 }] },
        { type: 'invoice', customerId: 'c1', date: '2025-12-01', status: 'paid', rows: [{ qty: 1, unitPrice: 500, vatRate: 25 }] },
      ],
    });
    expect(totals.get('c1')).toEqual({ lastInvoiceDate: '2026-05-01', totalInvoicedThisYear: 3000 });
  });

  it('räknar om utländsk valuta och tar leverantörer från kostnaderna', () => {
    expect(invoiceNetSek({ currency: 'EUR', fxRate: 11.5, rows: [{ qty: 1, unitPrice: 100, vatRate: 0 }] })).toBe(1150);
    const totals = contactTotals({ year: 2026, expenses: [{ supplierId: 's1', date: '2026-02-02', netAmount: 3400 }] });
    expect(totals.get('s1').totalInvoicedThisYear).toBe(3400);
  });
});
