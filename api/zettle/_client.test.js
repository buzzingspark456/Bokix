import { describe, it, expect } from 'vitest';
import { zettleFinanceRows } from './_client.js';

describe('zettleFinanceRows', () => {
  it('summerar dagens avgifter och gör en rad per utbetalning', () => {
    const rows = zettleFinanceRows([
      { timestamp: '2026-10-14T09:00:00', amount: -1250, originatorTransactionType: 'PAYMENT_FEE', originatorTransactionUuid: 'a' },
      { timestamp: '2026-10-14T15:30:00', amount: -470, originatorTransactionType: 'PAYMENT_FEE', originatorTransactionUuid: 'b' },
      { timestamp: '2026-10-14T16:00:00', amount: 120, originatorTransactionType: 'PAYMENT_FEE', originatorTransactionUuid: 'c' },
      { timestamp: '2026-10-15T08:00:00', amount: -98500, originatorTransactionType: 'PAYOUT', originatorTransactionUuid: 'p1' },
      { timestamp: '2026-10-15T08:00:00', amount: 98500, originatorTransactionType: 'PAYOUT', originatorTransactionUuid: 'p2' },
    ], { userId: 'u', companyId: 'c' });
    expect(rows).toEqual([
      { user_id: 'u', company_id: 'c', kind: 'fee', zettle_purchase_uuid: 'fee-2026-10-14', amount: 16, vat_amount: 0, currency: 'SEK', is_refund: false, payment_type: null, created_at_zettle: '2026-10-14T12:00:00Z' },
      { user_id: 'u', company_id: 'c', kind: 'payout', zettle_purchase_uuid: 'payout-p1', amount: 985, vat_amount: 0, currency: 'SEK', is_refund: false, payment_type: null, created_at_zettle: '2026-10-15T08:00:00Z' },
    ]);
  });
});
