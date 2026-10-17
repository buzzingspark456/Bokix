import { describe, it, expect } from 'vitest';
import { categorizeStripeItem, buildStripeVerification, isSafeStripeItem } from './stripeLedger';

const balanced = (v) => {
  const d = v.rows.reduce((s, r) => s + r.debet, 0);
  const k = v.rows.reduce((s, r) => s + r.kredit, 0);
  return Math.round((d - k) * 100) === 0;
};

describe('categorizeStripeItem', () => {
  it('kortbetalning kopplad till faktura blir en säker avgiftsrad, aldrig en ny försäljning', () => {
    expect(categorizeStripeItem({ type: 'charge', currency: 'sek', amount: 1250, fee: 22.5, matched_invoice_id: 'inv1' })).toBe('invoice_fee');
    expect(categorizeStripeItem({ type: 'charge', currency: 'sek', amount: 1250, fee: 0, matched_invoice_id: 'inv1' })).toBe('invoice_paid');
  });
  it('okopplad betalning kräver val, utbetalning och avgift är säkra', () => {
    expect(categorizeStripeItem({ type: 'charge', currency: 'sek', amount: 499, fee: 9 })).toBe('sale');
    expect(isSafeStripeItem({ type: 'charge', currency: 'sek', amount: 499, fee: 9 })).toBe(false);
    expect(categorizeStripeItem({ type: 'payout', currency: 'sek', amount: -2000 })).toBe('payout');
    expect(categorizeStripeItem({ type: 'stripe_fee', currency: 'sek', amount: -15 })).toBe('fee');
    expect(isSafeStripeItem({ type: 'stripe_fee', currency: 'sek', amount: -15 })).toBe(false);
    expect(categorizeStripeItem({ type: 'refund', currency: 'sek', amount: -499 })).toBe('refund');
    expect(categorizeStripeItem({ type: 'charge', currency: 'eur', amount: 10 })).toBe('manual');
  });
});

describe('buildStripeVerification', () => {
  it('försäljning med 25 % moms och avgift går jämnt ut och landar på Stripe-saldot', () => {
    const v = buildStripeVerification(
      { id: 'a', type: 'charge', currency: 'sek', amount: 500, fee: 9.75, created_at_stripe: '2026-10-01T10:00:00Z' },
      { account: '3001', vatRate: 25, vatAccount: '2611' },
    );
    expect(v.date).toBe('2026-10-01');
    expect(balanced(v)).toBe(true);
    expect(v.rows).toContainEqual({ account: '1686', debet: 500, kredit: 0 });
    expect(v.rows).toContainEqual({ account: '3001', debet: 0, kredit: 400 });
    expect(v.rows).toContainEqual({ account: '2611', debet: 0, kredit: 100 });
    expect(v.rows).toContainEqual({ account: '6570', debet: 9.75, kredit: 0 });
  });
  it('utbetalning flyttar saldot till banken', () => {
    const v = buildStripeVerification({ id: 'b', type: 'payout', currency: 'sek', amount: -1980.25 });
    expect(v.rows).toEqual([{ account: '1930', debet: 1980.25, kredit: 0 }, { account: '1686', debet: 0, kredit: 1980.25 }]);
  });
  it('återbetalning vänder försäljningen', () => {
    const v = buildStripeVerification({ id: 'c', type: 'refund', currency: 'sek', amount: -250 }, { account: '3001', vatRate: 25, vatAccount: '2611' });
    expect(balanced(v)).toBe(true);
    expect(v.rows).toContainEqual({ account: '1686', debet: 0, kredit: 250 });
  });
  it('fakturabetalning utan avgift har inget att bokföra, försäljning utan konto heller inte', () => {
    expect(buildStripeVerification({ id: 'd', type: 'charge', currency: 'sek', amount: 100, fee: 0, matched_invoice_id: 'x' })).toBeNull();
    expect(buildStripeVerification({ id: 'e', type: 'charge', currency: 'sek', amount: 100, fee: 2 })).toBeNull();
  });
});
