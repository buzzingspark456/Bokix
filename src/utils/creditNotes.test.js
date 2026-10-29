import { describe, it, expect } from 'vitest';
import { applyCreditNotes } from './creditNotes';
import { invoiceCustomerRemaining } from './rotRutConfig';

const orig = (extra = {}) => ({ id: 'a', invoiceNumber: '101', status: 'sent', amount: 1000, date: '2026-10-01', ...extra });
const credit = (amount, extra = {}) => ({ id: 'k', invoiceNumber: '102', creditFor: '101', status: 'sent', amount: -amount, date: '2026-10-20', ...extra });

describe('applyCreditNotes', () => {
  it('helt krediterad faktura och kreditfakturan blir reglerade', () => {
    const [a, k] = applyCreditNotes([orig(), credit(1000)]);
    expect(a).toMatchObject({ status: 'paid', paidVia: 'credit', paidDate: '2026-10-20', creditedAmount: 1000 });
    expect(k).toMatchObject({ status: 'paid', paidVia: 'credit' });
    expect(invoiceCustomerRemaining(a)).toBe(0);
  });

  it('delkreditering minskar det som är kvar', () => {
    const [a, k] = applyCreditNotes([orig(), credit(300)]);
    expect(a.status).toBe('sent');
    expect(invoiceCustomerRemaining(a)).toBe(700);
    expect(k.status).toBe('paid');
  });

  it('räknar med delbetalning före krediten', () => {
    const [a] = applyCreditNotes([orig({ paidAmount: 400 }), credit(600)]);
    expect(a.status).toBe('paid');
    expect(invoiceCustomerRemaining(a)).toBe(0);
  });

  it('utkast till kreditfaktura räknas inte', () => {
    const [a] = applyCreditNotes([orig(), credit(1000, { status: 'draft' })]);
    expect(a.status).toBe('sent');
    expect(invoiceCustomerRemaining(a)).toBe(1000);
  });

  it('kredit på en redan betald faktura står kvar som skuld till kunden', () => {
    const list = [orig({ status: 'paid', paidAmount: 1000 }), credit(1000)];
    const [a, k] = applyCreditNotes(list);
    expect(a.paidVia).toBeUndefined();
    expect(k.status).toBe('sent');
  });

  it('tas kreditfakturan bort blir originalet obetalt igen', () => {
    const [a] = applyCreditNotes([orig({ status: 'paid', paidVia: 'credit', paidDate: '2026-10-20', creditedAmount: 1000 })]);
    expect(a).toMatchObject({ status: 'sent', paidVia: undefined, creditedAmount: undefined });
  });

  it('samma lista ger samma objekt (inga onödiga sparningar)', () => {
    const list = [orig({ status: 'paid', amount: 500, paidAmount: 500 })];
    expect(applyCreditNotes(list)).toBe(list);
    const settled = applyCreditNotes([orig(), credit(1000)]);
    expect(applyCreditNotes(settled)).toBe(settled);
  });
});
