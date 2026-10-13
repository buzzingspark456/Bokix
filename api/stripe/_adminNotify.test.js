import { describe, it, expect } from 'vitest';
import { buildAdminNotice } from './_adminNotify.js';

const stripe = { customers: { retrieve: async () => ({ email: 'kund@example.se' }) } };

describe('buildAdminNotice', () => {
  it('ny provperiod ger mejl med e-post, plan och slutdatum', async () => {
    const n = await buildAdminNotice(stripe, {
      id: 'evt_1', type: 'customer.subscription.created', livemode: true,
      data: { object: { status: 'trialing', customer: 'cus_1', trial_end: 1793000000, metadata: { plan: 'employer_monthly' } } },
    });
    expect(n.subject).toBe('Ny provperiod: kund@example.se');
    expect(n.lines.join(' ')).toMatch(/Med personal/);
    expect(n.lines.join(' ')).toMatch(/Provperioden slutar/);
  });

  it('månadsbetalning ger mejl med belopp', async () => {
    const n = await buildAdminNotice(stripe, {
      id: 'evt_2', type: 'invoice.paid', livemode: true,
      data: { object: { amount_paid: 17900, currency: 'sek', customer_email: 'kund@example.se', billing_reason: 'subscription_cycle' } },
    });
    expect(n.subject).toBe('Betalning 179 kr: kund@example.se');
  });

  it('hoppar över kundernas anslutna konton, testläge och 0 kr', async () => {
    const paid = { type: 'invoice.paid', data: { object: { amount_paid: 17900, customer_email: 'x@y.se' } } };
    expect(await buildAdminNotice(stripe, { ...paid, livemode: true, account: 'acct_1' })).toBeNull();
    expect(await buildAdminNotice(stripe, { ...paid, livemode: false })).toBeNull();
    expect(await buildAdminNotice(stripe, { type: 'invoice.paid', livemode: true, data: { object: { amount_paid: 0 } } })).toBeNull();
  });
});
