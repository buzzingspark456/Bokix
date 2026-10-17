import { describe, expect, it, vi } from 'vitest';
import { listSubscriptionCustomerIds, listSubscriptionInvoices } from './_billingInvoices.js';

describe('listSubscriptionInvoices', () => {
  it('finds every Stripe customer linked to the account metadata', async () => {
    const search = vi.fn()
      .mockResolvedValueOnce({
        data: [{ customer: 'cus_a' }, { customer: { id: 'cus_b' } }],
        has_more: true,
        next_page: 'next-page',
      })
      .mockResolvedValueOnce({
        data: [{ customer: 'cus_a' }, { customer: null }],
        has_more: false,
      });

    await expect(listSubscriptionCustomerIds({ subscriptions: { search } }, 'user-123', ['cus_saved']))
      .resolves.toEqual(['cus_saved', 'cus_a', 'cus_b']);
    expect(search).toHaveBeenNthCalledWith(1, {
      query: "metadata['user_id']:'user-123'",
      limit: 100,
    });
    expect(search).toHaveBeenNthCalledWith(2, {
      query: "metadata['user_id']:'user-123'",
      limit: 100,
      page: 'next-page',
    });
  });

  it('fails rather than silently truncating subscription search results', async () => {
    await expect(listSubscriptionCustomerIds({
      subscriptions: { search: vi.fn().mockResolvedValue({ data: [], has_more: true }) },
    }, 'user-123')).rejects.toThrow('Stripe returned an incomplete subscription page.');
  });

  it('collects and sorts invoices across every customer, including older pages', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({
        data: [
          { id: 'in_new', number: 'BOKIX-2', created: 200, status: 'paid', amount_due: 17900, amount_paid: 17900, currency: 'sek', hosted_invoice_url: 'https://stripe.test/in_new', invoice_pdf: 'https://stripe.test/in_new.pdf' },
        ],
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'in_old', number: 'BOKIX-1', created: 100, status: 'open', amount_due: 17900, amount_paid: 0, currency: 'sek' },
        ],
        has_more: false,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'in_other_customer', number: 'BOKIX-3', created: 300, status: 'paid', amount_due: 12900, amount_paid: 12900, currency: 'sek' },
          { id: 'in_new', number: 'BOKIX-2', created: 200, status: 'paid', amount_due: 17900, amount_paid: 17900, currency: 'sek' },
        ],
        has_more: false,
      });

    const invoices = await listSubscriptionInvoices({ invoices: { list } }, ['cus_a', 'cus_a', 'cus_b']);

    expect(list).toHaveBeenNthCalledWith(1, { customer: 'cus_a', limit: 100 });
    expect(list).toHaveBeenNthCalledWith(2, { customer: 'cus_a', limit: 100, starting_after: 'in_new' });
    expect(list).toHaveBeenNthCalledWith(3, { customer: 'cus_b', limit: 100 });
    expect(invoices.map(invoice => invoice.id)).toEqual(['in_other_customer', 'in_new', 'in_old']);
    expect(invoices[1]).toMatchObject({
      status: 'paid',
      hosted_invoice_url: 'https://stripe.test/in_new',
      invoice_pdf: 'https://stripe.test/in_new.pdf',
    });
  });

  it('hides zero-amount trial invoices, drafts and voided invoices', async () => {
    const list = vi.fn().mockResolvedValueOnce({
      data: [
        { id: 'in_trial_1', created: 400, status: 'paid', amount_due: 0, amount_paid: 0, currency: 'sek' },
        { id: 'in_trial_2', created: 400, status: 'paid', amount_due: 0, amount_paid: 0, currency: 'sek' },
        { id: 'in_draft', created: 300, status: 'draft', amount_due: 17900, amount_paid: 0, currency: 'sek' },
        { id: 'in_void', created: 250, status: 'void', amount_due: 17900, amount_paid: 0, currency: 'sek' },
        { id: 'in_real', created: 200, status: 'paid', amount_due: 17900, amount_paid: 17900, currency: 'sek' },
        { id: 'in_open', created: 100, status: 'open', amount_due: 17900, amount_paid: 0, currency: 'sek' },
      ],
      has_more: false,
    });

    const invoices = await listSubscriptionInvoices({ invoices: { list } }, ['cus_a']);
    expect(invoices.map(invoice => invoice.id)).toEqual(['in_real', 'in_open']);
  });

  it('does not silently accept an incomplete page', async () => {
    await expect(listSubscriptionInvoices({
      invoices: { list: vi.fn().mockResolvedValue({ data: [], has_more: true }) },
    }, ['cus_a'])).rejects.toThrow('Stripe returned an incomplete invoice page.');
  });
});
