import { describe, it, expect } from 'vitest';
import { subscriptionAccess, bestAccess, daysSinceFailure, READ_ONLY_AFTER_DAYS, LOCK_AFTER_DAYS } from './paymentAccess.js';

const DAY = 86400000;
const now = Date.parse('2026-12-01T12:00:00Z');
const ago = (d) => new Date(now - d * DAY).toISOString();

describe('subscriptionAccess', () => {
  it('provperiod och aktiv: full åtkomst utan varning', () => {
    expect(subscriptionAccess({ status: 'trialing' }, now)).toMatchObject({ level: 'full', failing: false });
    expect(subscriptionAccess({ status: 'active', payment_failed_at: ago(40) }, now)).toMatchObject({ level: 'full', failing: false });
  });

  it('past_due: full med varning de första 14 dagarna', () => {
    expect(subscriptionAccess({ status: 'past_due', payment_failed_at: ago(0) }, now)).toMatchObject({ level: 'full', failing: true });
    expect(subscriptionAccess({ status: 'past_due', payment_failed_at: ago(13.9) }, now).level).toBe('full');
  });

  it('past_due: läsläge från dag 14, låst från dag 30', () => {
    expect(subscriptionAccess({ status: 'past_due', payment_failed_at: ago(READ_ONLY_AFTER_DAYS) }, now).level).toBe('read');
    expect(subscriptionAccess({ status: 'past_due', payment_failed_at: ago(29) }, now).level).toBe('read');
    expect(subscriptionAccess({ status: 'past_due', payment_failed_at: ago(LOCK_AFTER_DAYS) }, now).level).toBe('locked');
  });

  it('past_due utan tidpunkt (gamla rader): full som förut', () => {
    expect(subscriptionAccess({ status: 'past_due' }, now)).toMatchObject({ level: 'full', failing: true });
  });

  it('unpaid: läsläge till dag 30, sedan låst', () => {
    expect(subscriptionAccess({ status: 'unpaid', payment_failed_at: ago(15) }, now).level).toBe('read');
    expect(subscriptionAccess({ status: 'unpaid', payment_failed_at: ago(31) }, now).level).toBe('locked');
  });

  it('avslutad efter misslyckade dragningar: läsläge till dag 30', () => {
    expect(subscriptionAccess({ status: 'canceled', payment_failed_at: ago(14) }, now).level).toBe('read');
    expect(subscriptionAccess({ status: 'canceled', payment_failed_at: ago(30) }, now).level).toBe('locked');
  });

  it('uppsagd av kunden och okända statusar: låst', () => {
    expect(subscriptionAccess({ status: 'canceled' }, now).level).toBe('locked');
    expect(subscriptionAccess({ status: 'incomplete_expired' }, now).level).toBe('locked');
    expect(subscriptionAccess(null, now).level).toBe('locked');
  });
});

describe('bestAccess', () => {
  it('väljer bästa nivån, och hellre utan varning', () => {
    const a = bestAccess([{ status: 'canceled' }, { status: 'past_due', payment_failed_at: ago(2) }, { status: 'active' }], now);
    expect(a).toMatchObject({ level: 'full', failing: false });
    expect(bestAccess([{ status: 'unpaid', payment_failed_at: ago(20) }], now).level).toBe('read');
    expect(bestAccess([], now).level).toBe('locked');
  });
});

describe('daysSinceFailure', () => {
  it('räknar hela dagar', () => {
    expect(daysSinceFailure({ payment_failed_at: ago(3.5) }, now)).toBe(3);
    expect(daysSinceFailure({}, now)).toBe(null);
  });
});
