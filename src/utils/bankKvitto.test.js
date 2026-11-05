import { describe, it, expect } from 'vitest';
import { receiptCandidates } from './bankMatching';

const row = { id: 'b1', date: '2026-10-30', amount: -890, status: 'unmatched' };
const receipts = [
  { id: 'r1', type: 'receipt', date: '2026-10-28', amount: 890, supplier: 'Exempelmacken', costAccount: '' },
  { id: 'r2', type: 'receipt', date: '2026-09-01', amount: 890, supplier: 'För gammalt' },
  { id: 'r3', type: 'receipt', date: '2026-10-30', amount: 120, supplier: 'Fel belopp' },
  { id: 'r4', type: 'supplier_invoice', date: '2026-10-30', amount: 890 },
];

describe('kvitto till bankrad', () => {
  it('hittar kvittot med samma belopp inom en vecka', () => {
    expect(receiptCandidates(row, receipts).map(r => r.id)).toEqual(['r1']);
    expect(receiptCandidates(row, receipts)[0].booked).toBe(false);
  });

  it('ett bokfört kvitto märks som bokfört', () => {
    expect(receiptCandidates(row, [{ ...receipts[0], costAccount: '5460' }])[0].booked).toBe(true);
  });

  it('ett kvitto som redan kopplats till en annan rad föreslås inte igen', () => {
    const other = { id: 'b2', matchedType: 'receipt', matchedId: 'r1', status: 'matched' };
    expect(receiptCandidates(row, receipts, [row, other])).toEqual([]);
  });

  it('inget för en inbetalning', () => {
    expect(receiptCandidates({ ...row, amount: 890 }, receipts)).toEqual([]);
  });
});
