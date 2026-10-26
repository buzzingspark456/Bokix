import { describe, expect, it } from 'vitest';
import {
  addOneCalendarMonth,
  firstPaidInvoice,
  getFirstPaidInvoiceForCustomer,
  shouldScheduleTrustpilotInvite,
} from './_trustpilotInvites.js';

describe('addOneCalendarMonth', () => {
  it('keeps the time and clamps dates at the end of shorter months', () => {
    expect(addOneCalendarMonth('2026-01-31T12:34:56.000Z').toISOString()).toBe('2026-02-28T12:34:56.000Z');
    expect(addOneCalendarMonth('2026-10-26T18:00:00.000Z').toISOString()).toBe('2026-11-26T18:00:00.000Z');
  });

  it('handles leap February', () => {
    expect(addOneCalendarMonth('2028-01-31T00:00:00.000Z').toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });
});

describe('firstPaidInvoice', () => {
  it('selects the earliest positive paid invoice and ignores trials and unpaid invoices', () => {
    const result = firstPaidInvoice([
      { id: 'later', status: 'paid', amount_paid: 17900, created: 30 },
      { id: 'trial', status: 'paid', amount_paid: 0, created: 5 },
      { id: 'open', status: 'open', amount_paid: 17900, created: 1 },
      { id: 'first', status: 'paid', amount_paid: 17900, created: 10 },
    ]);
    expect(result.id).toBe('first');
  });

  describe('getFirstPaidInvoiceForCustomer', () => {
    it('checks all known Bokix subscriptions, including subscriptions on other Stripe customers', async () => {
      const stripe = {
        subscriptions: {
          list: async () => ({ data: [], has_more: false }),
        },
        invoices: {
          list: async ({ subscription }) => ({
            data: subscription === 'older-sub'
              ? [{ id: 'first-invoice', subscription, status: 'paid', amount_paid: 17900, created: 10 }]
              : [{ id: 'current-invoice', subscription, status: 'paid', amount_paid: 17900, created: 30 }],
            has_more: false,
          }),
        },
      };
      const currentInvoice = {
        id: 'current-invoice',
        subscription: 'current-sub',
        status: 'paid',
        amount_paid: 17900,
        created: 30,
      };

      const result = await getFirstPaidInvoiceForCustomer(
        stripe,
        'current-customer',
        'user-1',
        'current-sub',
        currentInvoice,
        ['older-sub'],
      );

      expect(result.id).toBe('first-invoice');
    });
  });

  describe('shouldScheduleTrustpilotInvite', () => {
    const event = {
      livemode: true,
      type: 'invoice.paid',
      data: { object: { status: 'paid', amount_paid: 17900 } },
    };

    it('only enables live, positive subscription payments on Bokix own account', () => {
      expect(shouldScheduleTrustpilotInvite(event, 'bcc@example.test')).toBe(true);
      expect(shouldScheduleTrustpilotInvite({ ...event, livemode: false }, 'bcc@example.test')).toBe(false);
      expect(shouldScheduleTrustpilotInvite({ ...event, account: 'acct_connected' }, 'bcc@example.test')).toBe(false);
      expect(shouldScheduleTrustpilotInvite({ ...event, type: 'invoice.payment_succeeded' }, 'bcc@example.test')).toBe(false);
      expect(shouldScheduleTrustpilotInvite({
        ...event,
        data: { object: { status: 'paid', amount_paid: 0 } },
      }, 'bcc@example.test')).toBe(false);
      expect(shouldScheduleTrustpilotInvite(event, '')).toBe(false);
    });
  });

  it('returns null when no positive payment exists', () => {
    expect(firstPaidInvoice([{ status: 'paid', amount_paid: 0, created: 1 }])).toBeNull();
  });
});
