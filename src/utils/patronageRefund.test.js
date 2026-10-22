import { describe, it, expect } from 'vitest';
import { memberTurnover, computeRefund, refundSummary, refundInk2sAdjustments, buildRefundDecision, proposedRefundFor, coopDividendDeduction } from './patronageRefund';
import { suggestInk2s } from './ink2s';
import { computeAnnualReport } from './annualReport';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

const fy25 = { key: '2025', start: '2025-01-01', end: '2025-12-31', label: '2025' };
const fy26 = { key: '2026', start: '2026-01-01', end: '2026-12-31', label: '2026' };
const members = [
  { id: 'a', name: 'Anna', turnover: 50000 },
  { id: 'b', name: 'Bo', turnover: 30000 },
  { id: 'c', name: 'Cia', turnover: 20000 },
];
const base = { id: 'r1', fyKey: '2025', fyStart: fy25.start, fyEnd: fy25.end, fyLabel: '2025', basis: 'purchases', members };

describe('återbäring i ekonomisk förening', () => {
  it('ett belopp fördelas efter omsättning och summan stämmer på kronan', () => {
    const r = computeRefund({ ...base, mode: 'amount', amount: 1001 });
    expect(r.perMember.map(m => m.refund)).toEqual([501, 300, 200]);
    expect(r.total).toBe(1001);
    expect(r.totalTurnover).toBe(100000);
  });

  it('procent av omsättningen per medlem', () => {
    expect(computeRefund({ ...base, mode: 'percent', percent: 2.5 }).perMember.map(m => m.refund)).toEqual([1250, 750, 500]);
  });

  it('taket när medlemmarna får återbäringen skattefritt: 80 % av statslåneräntan gånger omsättningen', () => {
    // Statslåneräntan för 2025 är 1,96 %: 0,8 × 1,96 % × 100 000 = 1 568 kr.
    const s = refundSummary({ ...base, mode: 'amount', amount: 3000, privateMembers: true, decisionDate: '2026-04-20' });
    expect(s.cap).toBe(1568);
    expect(s.deductible).toBe(1568);
    expect(s.nonDeductible).toBe(1432);
    expect(refundSummary({ ...base, mode: 'amount', amount: 3000, privateMembers: false }).deductible).toBe(3000);
  });

  it('stämman beslutar året efter: avdrag i år 1, tillbakaläggning i år 2 när beslutet bokförts', () => {
    const refund = { ...base, mode: 'amount', amount: 3000, decidedBy: 'meeting', decisionDate: '2026-04-20' };
    const decision = { ...buildRefundDecision(refund, 3000), id: 'v1', status: 'booked' };
    expect(refundInk2sAdjustments({ refunds: [refund], verifications: [], fy: fy25 })).toEqual({ '4.4b': 3000 });
    expect(refundInk2sAdjustments({ refunds: [refund], verifications: [decision], fy: fy26 })).toEqual({ '4.3c': 3000 });
    // Inte bokfört än: inget att lägga tillbaka.
    expect(refundInk2sAdjustments({ refunds: [refund], verifications: [], fy: fy26 })).toEqual({});
    const s = suggestInk2s({ verifications: [], fy: fy25, adjustments: { '4.4b': 3000 } });
    expect(s.suggestions['4.4b']).toBe(3000);
  });

  it('styrelsen beslutar under året: bokfört och avdraget, bara delen över taket läggs tillbaka', () => {
    const refund = { ...base, mode: 'amount', amount: 3000, decidedBy: 'board', decisionDate: '2025-12-20', privateMembers: true };
    const decision = { ...buildRefundDecision(refund, 3000), id: 'v1', status: 'booked' };
    expect(refundInk2sAdjustments({ refunds: [refund], verifications: [decision], fy: fy25 })).toEqual({ '4.3c': 1432 });
  });

  it('medlemmarnas omsättning ur kundfakturor, krediteringar och utkast', () => {
    const invoices = [
      { customerId: 'k1', date: '2025-03-01', status: 'sent', rows: [{ qty: 2, unitPrice: 1000 }] },
      { customerId: 'k1', date: '2025-05-01', status: 'sent', rows: [{ qty: 1, unitPrice: -500 }] },
      { customerId: 'k2', date: '2025-06-01', status: 'paid', rows: [{ qty: 1, unitPrice: 4000, discount: 25 }] },
      { customerId: 'k2', date: '2025-07-01', status: 'draft', rows: [{ qty: 1, unitPrice: 9999 }] },
      { customerId: 'k3', date: '2026-01-02', status: 'sent', rows: [{ qty: 1, unitPrice: 9999 }] },
    ];
    const contacts = [{ id: 'k1', name: 'Anna' }, { id: 'k2', name: 'Bo' }];
    expect(memberTurnover({ invoices, contacts, period: fy25 })).toEqual([
      { contactId: 'k2', name: 'Bo', turnover: 3000 },
      { contactId: 'k1', name: 'Anna', turnover: 1500 },
    ]);
    const expenses = [{ type: 'supplier_invoice', supplierId: 'k1', date: '2025-02-01', netAmount: 800 }, { type: 'receipt', supplierId: 'k1', date: '2025-02-01', netAmount: 100 }];
    expect(memberTurnover({ basis: 'sales', expenses, contacts, period: fy25 })).toEqual([{ contactId: 'k1', name: 'Anna', turnover: 800 }]);
  });

  it('årsredovisningen: Lämnad gottgörelse som egen rad och stämmans förslag', () => {
    const v = (id, date, rows) => ({ id, date, status: 'booked', rows: rows.map(([account, debet, kredit]) => ({ account, debet, kredit })) });
    const verifications = [
      v('1', '2026-02-01', [['1930', 100000, 0], ['3001', 0, 100000]]),
      v('2', '2026-12-20', [['8840', 2000, 0], ['2890', 0, 2000]]),
    ];
    const company = { orgNr: '769600-0005', fiscalYearStart: '01-01', patronageRefunds: [{ ...base, fyEnd: fy26.end, mode: 'amount', amount: 5000, decisionDate: '2027-04-20' }] };
    const report = computeAnnualReport({ verifications, accounts: DEFAULT_ACCOUNTS, company, fy: fy26, orgType: 'Ekonomisk förening' });
    const line = report.income.lines.find(l => l.label === 'Lämnad gottgörelse');
    expect(line.current).toBe(-2000);
    expect(report.income.lines.find(l => l.label === 'Övriga bokslutsdispositioner')).toBeUndefined();
    expect(report.yearResult).toBe(98000);
    expect(report.disposition.refund).toBe(5000);
    expect(proposedRefundFor(company.patronageRefunds, fy25).total).toBe(0);
  });

  it('utdelning på insatser: avdrag i kooperativ förening, utom delen till företag om den är över tio procent', () => {
    expect(coopDividendDeduction({ dividend: 10000, cooperative: true, toCompanies: 0 }).deductible).toBe(10000);
    expect(coopDividendDeduction({ dividend: 10000, cooperative: true, toCompanies: 1000 })).toMatchObject({ deductible: 10000, smallShare: true });
    expect(coopDividendDeduction({ dividend: 10000, cooperative: true, toCompanies: 3000 })).toMatchObject({ deductible: 7000, smallShare: false });
    expect(coopDividendDeduction({ dividend: 10000, cooperative: false }).deductible).toBe(0);
    expect(coopDividendDeduction({ dividend: 10000 }).deductible).toBe(0);
  });
});
