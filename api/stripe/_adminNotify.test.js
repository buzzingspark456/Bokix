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

describe('uppsägning', () => {
  const sub = (o, prev) => ({ type: 'customer.subscription.updated', livemode: true, data: { object: { customer: 'cus_1', current_period_end: 1793000000, metadata: {}, ...o }, previous_attributes: prev } });

  it('ny uppsägning ger mejl', async () => {
    const n = await buildAdminNotice(stripe, sub({ cancel_at_period_end: true, status: 'active' }, { cancel_at_period_end: false }));
    expect(n.subject).toBe('Uppsägning: kund@example.se');
  });

  it('uppsägning med cancel_at (årsplanens minimitid) ger mejl', async () => {
    const n = await buildAdminNotice(stripe, sub({ cancel_at_period_end: false, cancel_at: 1795000000, status: 'active' }, { cancel_at: null }));
    expect(n.subject).toBe('Uppsägning: kund@example.se');
  });

  it('ångrad uppsägning ger mejl', async () => {
    const n = await buildAdminNotice(stripe, sub({ cancel_at_period_end: false, cancel_at: null }, { cancel_at_period_end: true }));
    expect(n.subject).toBe('Ångrade uppsägningen: kund@example.se');
  });

  it('annan uppdatering ger inget mejl', async () => {
    expect(await buildAdminNotice(stripe, sub({ status: 'active' }, { status: 'trialing' }))).toBeNull();
  });

  it('avslutad prenumeration ger mejl med anledning', async () => {
    const n = await buildAdminNotice(stripe, { type: 'customer.subscription.deleted', livemode: true, data: { object: { customer: 'cus_1', metadata: {}, cancellation_details: { reason: 'payment_failed' } } } });
    expect(n.subject).toBe('Avslutad: kund@example.se');
    expect(n.lines).toContain('Betalningen gick inte igenom.');
  });
});
