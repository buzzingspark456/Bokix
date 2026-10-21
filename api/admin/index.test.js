import { describe, it, expect } from 'vitest';
import { sessionStrength } from './index.js';

const token = (claims) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

describe('sessionStrength (admin-panelen kräver stark inloggning)', () => {
  it('bara lösenord räcker inte', () => {
    expect(sessionStrength(token({ aal: 'aal1', amr: [{ method: 'password', timestamp: 1 }] })).strong).toBe(false);
  });
  it('lösenord + kod från app (aal2) räcker', () => {
    expect(sessionStrength(token({ aal: 'aal2', amr: [{ method: 'totp' }, { method: 'password' }] })).strong).toBe(true);
  });
  it('passkey räcker, även som första faktor', () => {
    expect(sessionStrength(token({ aal: 'aal1', amr: [{ method: 'webauthn' }] })).strong).toBe(true);
    expect(sessionStrength(token({ aal: 'aal1', amr: ['passkey'] })).strong).toBe(true);
  });
  it('trasig token är svag', () => {
    expect(sessionStrength('inte-en-token').strong).toBe(false);
    expect(sessionStrength('').methods).toEqual([]);
  });
});

import { discountFromStripe, priceAfterDiscount } from './index.js';

describe('rabatter i Betalningar', () => {
  it('läser kupongen från discounts eller discount', () => {
    expect(discountFromStripe({ discounts: [{ coupon: { percent_off: 50, duration: 'repeating' }, end: 1800000000 }] }).percentOff).toBe(50);
    expect(discountFromStripe({ discount: { coupon: { amount_off: 4000, duration: 'forever' } } }).amountOff).toBe(40);
    expect(discountFromStripe({ discounts: ['di_123'] })).toBe(null);
    expect(discountFromStripe({})).toBe(null);
  });
  it('räknar pris efter rabatt', () => {
    expect(priceAfterDiscount(179, null, false)).toBe(179);
    expect(priceAfterDiscount(179, { percentOff: 50 }, false)).toBe(90);
    expect(priceAfterDiscount(179, { amountOff: 40 }, false)).toBe(139);
    expect(priceAfterDiscount(149, { amountOff: 120 }, true)).toBe(139);
    expect(priceAfterDiscount(129, { percentOff: 100 }, false)).toBe(0);
  });
});
