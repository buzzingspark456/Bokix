import { describe, it, expect, vi } from 'vitest';
vi.mock('../_resend.js', () => ({ hasResendApiKey: () => true, sendViaResend: vi.fn(async () => ({ ok: true })) }));
import { buildBillingCcEmail, sendBillingCc } from './_billingCc.js';
import { sendViaResend } from '../_resend.js';

const invoice = { id: 'in_1', customer: 'cus_1', amount_paid: 12900, currency: 'sek', number: 'ABC-0001', created: 1763280000, invoice_pdf: 'https://pay.stripe.com/x.pdf' };

describe('kvittokopia till fakturamejl', () => {
  it('mejlet har belopp, kvittonummer och nedladdningslänk', () => {
    const { subject, html } = buildBillingCcEmail(invoice);
    expect(subject).toBe('Kvitto från Bokix ABC-0001');
    expect(html).toContain('129,00 SEK');
    expect(html).toContain('https://pay.stripe.com/x.pdf');
  });

  it('skickas bara när kunden har en giltig adress och något betalats', async () => {
    const stripe = { customers: { retrieve: vi.fn(async () => ({ metadata: { billing_cc: 'konsult@byra.se' } })) } };
    expect(await sendBillingCc(stripe, invoice)).toBe(true);
    expect(sendViaResend.mock.calls[0][0].to).toEqual(['konsult@byra.se']);
    expect(await sendBillingCc(stripe, { ...invoice, amount_paid: 0 })).toBe(false);
    stripe.customers.retrieve = vi.fn(async () => ({ metadata: {} }));
    expect(await sendBillingCc(stripe, invoice)).toBe(false);
  });
});
