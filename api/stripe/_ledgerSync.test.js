import { describe, it, expect } from 'vitest';
import { syncStripeLedger } from './_ledgerSync.js';

function fakeAdmin(paymentEvents = []) {
  const calls = { upsert: null };
  const query = {
    select() { return this; }, eq() { return this; },
    gte() { return Promise.resolve({ data: paymentEvents }); },
  };
  return {
    calls,
    from(table) {
      if (table === 'stripe_payment_events') return query;
      return { upsert: (rows, opts) => { calls.upsert = { rows, opts }; return Promise.resolve({ error: null }); } };
    },
  };
}

function fakeStripe(txns) {
  return {
    balanceTransactions: {
      list: (params, opts) => ({ params, opts, autoPagingToArray: () => Promise.resolve(txns) }),
    },
  };
}

const now = Math.floor(Date.now() / 1000);

describe('syncStripeLedger', () => {
  it('kopplar kortbetalningen till fakturan via metadata och sparar avgiften', async () => {
    const admin = fakeAdmin();
    const stripe = fakeStripe([
      { id: 'txn_1', type: 'charge', amount: 125000, fee: 2250, currency: 'sek', created: now, fee_details: [{ type: 'application_fee', amount: 500 }], source: { id: 'ch_1', metadata: { invoice_id: 'inv_9' } } },
      { id: 'txn_2', type: 'payout', amount: -122750, fee: 0, currency: 'sek', created: now, source: 'po_1' },
    ]);
    const { count } = await syncStripeLedger({ admin, stripe, userId: 'u', companyId: 'c', stripeAccountId: 'acct', sinceSeconds: 86400 });
    expect(count).toBe(2);
    const [charge, payout] = admin.calls.upsert.rows;
    expect(charge).toMatchObject({ matched_invoice_id: 'inv_9', amount: 1250, fee: 22.5, platform_fee_amount: 5, source_id: 'ch_1' });
    expect(payout).toMatchObject({ type: 'payout', amount: -1227.5, matched_invoice_id: null, source_id: 'po_1' });
    expect(admin.calls.upsert.opts).toEqual({ onConflict: 'stripe_balance_transaction_id', ignoreDuplicates: true });
  });

  it('faller tillbaka på tidsnärhet för äldre betalningar utan metadata', async () => {
    const admin = fakeAdmin([{ invoice_id: 'inv_old', amount_total: 500, paid_at: new Date((now - 60) * 1000).toISOString() }]);
    const stripe = fakeStripe([{ id: 'txn_3', type: 'charge', amount: 50000, fee: 900, currency: 'sek', created: now, source: { id: 'ch_3', metadata: {} } }]);
    await syncStripeLedger({ admin, stripe, userId: 'u', companyId: 'c', stripeAccountId: 'acct', sinceSeconds: 86400 });
    expect(admin.calls.upsert.rows[0].matched_invoice_id).toBe('inv_old');
  });

  it('skriver inget när Stripe inte har några transaktioner', async () => {
    const admin = fakeAdmin();
    const { count } = await syncStripeLedger({ admin, stripe: fakeStripe([]), userId: 'u', companyId: 'c', stripeAccountId: 'acct', sinceSeconds: 86400 });
    expect(count).toBe(0);
    expect(admin.calls.upsert).toBeNull();
  });
});
