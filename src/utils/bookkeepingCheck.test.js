import { describe, it, expect } from 'vitest';
import { runBookkeepingCheck, verificationCreatedAt } from './bookkeepingCheck';

const ver = (id, date, rows, extra = {}) => ({ id, date, series: 'A', number: 1, description: 'Test', source: 'manual', rows, ...extra });
const r = (account, debet, kredit = 0) => ({ account, debet, kredit });
const get = (res, id) => res.checks.find(c => c.id === id);

describe('runBookkeepingCheck', () => {
  it('ren bokföring ger inga fynd', () => {
    const res = runBookkeepingCheck({ verifications: [ver('1', '2026-10-01', [r('1930', 1000), r('2081', 0, 1000)])], today: '2026-11-21' });
    expect(res.errors).toBe(0);
    expect(res.warnings).toBe(0);
  });

  it('hittar obalanserade verifikationer', () => {
    const res = runBookkeepingCheck({ verifications: [ver('1', '2026-10-01', [r('1930', 100), r('3001', 0, 90)])], today: '2026-11-21' });
    const c = get(res, 'balance');
    expect(c.level).toBe('error');
    expect(c.items[0].amount).toBe(10);
    expect(res.checks[0].id).toBe('balance');
  });

  it('räknar inte utkast', () => {
    const res = runBookkeepingCheck({ verifications: [ver('1', '2026-10-01', [r('1930', 100)], { status: 'draft' })], today: '2026-11-21' });
    expect(get(res, 'balance').level).toBe('ok');
  });

  it('hittar moms bokförd efter att perioden deklarerats', () => {
    const created = Date.parse('2026-11-15T10:00:00Z');
    const v = ver(`${created}_3`, '2026-09-10', [r('5410', 400), r('2641', 100), r('1930', 0, 500)], { attachmentUrl: 'x' });
    const vatPeriods = { '2026-Q3': { periodStart: '2026-07-01', periodEnd: '2026-09-30', bookedAt: '2026-11-01T08:00:00Z' } };
    const c = get(runBookkeepingCheck({ verifications: [v], vatPeriods, today: '2026-11-21' }), 'late_vat');
    expect(c.level).toBe('warn');
    expect(c.items[0].period).toBe('2026-Q3');
  });

  it('moms bokförd före deklarationen är rätt', () => {
    const created = Date.parse('2026-10-05T10:00:00Z');
    const v = ver(`${created}_3`, '2026-09-10', [r('5410', 400), r('2641', 100), r('1930', 0, 500)], { attachmentUrl: 'x' });
    const vatPeriods = { '2026-Q3': { periodStart: '2026-07-01', periodEnd: '2026-09-30', bookedAt: '2026-11-01T08:00:00Z' } };
    expect(get(runBookkeepingCheck({ verifications: [v], vatPeriods, today: '2026-11-21' }), 'late_vat').level).toBe('ok');
  });

  it('kundfordringar mot obetalda fakturor', () => {
    const vers = [ver('1', '2026-10-01', [r('1510', 1250), r('3001', 0, 1000), r('2611', 0, 250)], { source: 'invoice' })];
    const ok = runBookkeepingCheck({ verifications: vers, invoices: [{ id: 'i', status: 'sent', total: 1250, rows: [{ qty: 1, unitPrice: 1000, vatRate: 25 }] }], today: '2026-11-21' });
    expect(get(ok, 'receivables').expected).toBeGreaterThan(0);
    const missing = runBookkeepingCheck({ verifications: vers, invoices: [], today: '2026-11-21' });
    expect(get(missing, 'receivables').level).toBe('warn');
    expect(get(missing, 'receivables').diff).toBe(1250);
  });

  it('leverantörsskulder mot obetalda leverantörsfakturor', () => {
    const vers = [ver('1', '2026-10-01', [r('5410', 400), r('2641', 100), r('2440', 0, 500)], { source: 'supplier_invoice' })];
    const ok = runBookkeepingCheck({ verifications: vers, expenses: [{ type: 'supplier_invoice', status: 'unpaid', amount: 500 }], today: '2026-11-21' });
    expect(get(ok, 'payables').level).toBe('ok');
    const paid = runBookkeepingCheck({ verifications: vers, expenses: [{ type: 'supplier_invoice', status: 'paid', amount: 500 }], today: '2026-11-21' });
    expect(get(paid, 'payables').level).toBe('warn');
  });

  it('negativ kassa är fel, negativt företagskonto en varning', () => {
    const cash = runBookkeepingCheck({ verifications: [ver('1', '2026-10-01', [r('5410', 100), r('1910', 0, 100)], { attachmentUrl: 'x' })], today: '2026-11-21' });
    expect(get(cash, 'negative_money').level).toBe('error');
    const bank = runBookkeepingCheck({ verifications: [ver('1', '2026-10-01', [r('5410', 100), r('1930', 0, 100)], { attachmentUrl: 'x' })], today: '2026-11-21' });
    expect(get(bank, 'negative_money').level).toBe('warn');
  });

  it('kostnad utan underlag, men inte lön eller avskrivning', () => {
    const vers = [
      ver('1', '2026-10-01', [r('5410', 100), r('2081', 0, 100)]),
      ver('2', '2026-10-01', [r('7010', 100), r('1930', 0, 100)], { source: 'payroll' }),
      ver('3', '2026-10-01', [r('7832', 100), r('1229', 0, 100)], { source: 'depreciation' }),
    ];
    const c = get(runBookkeepingCheck({ verifications: vers, today: '2026-11-21' }), 'receipts');
    expect(c.count).toBe(1);
  });

  it('hittar dubbletter', () => {
    const a = ver('1', '2026-10-01', [r('5410', 100), r('2081', 0, 100)], { attachmentUrl: 'x', number: 4 });
    const b = { ...a, id: '2', number: 5 };
    const c = get(runBookkeepingCheck({ verifications: [a, b], today: '2026-11-21' }), 'duplicates');
    expect(c.count).toBe(1);
    expect(c.items[0].others).toEqual(['A4', 'A5']);
  });

  it('gamla obokade banktransaktioner och framtida datum', () => {
    const res = runBookkeepingCheck({
      verifications: [ver('1', '2026-12-24', [r('1930', 100), r('2081', 0, 100)])],
      bankTransactions: [{ status: 'unmatched', date: '2026-09-01', amount: -50 }, { status: 'unmatched', date: '2026-11-20', amount: -50 }],
      today: '2026-11-21',
    });
    expect(get(res, 'old_bank').count).toBe(1);
    expect(get(res, 'future').count).toBe(1);
  });

  it('momsbefriade företag får ingen momskontroll', () => {
    const res = runBookkeepingCheck({ vatExempt: true, today: '2026-11-21' });
    expect(get(res, 'late_vat')).toBeUndefined();
  });
});

describe('verificationCreatedAt', () => {
  it('läser tiden ur id', () => {
    expect(verificationCreatedAt({ id: '1763712000000_4' })).toBe('2025-11-21T08:00:00.000Z');
    expect(verificationCreatedAt({ id: 'ver_vat_x' })).toBeNull();
  });
});
