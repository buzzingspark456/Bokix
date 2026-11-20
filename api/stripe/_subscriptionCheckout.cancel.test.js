import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stripe tar bara EN av cancel_at och cancel_at_period_end per anrop
// ("Received both cancel_at_period_end and cancel_at parameters", 2026-11-20).
const calls = [];
let live = { id: 'sub_1', cancel_at_period_end: false, cancel_at: null };

vi.mock('stripe', () => ({
  default: class FakeStripe {
    constructor() {
      this.subscriptions = {
        retrieve: async () => live,
        update: async (id, params) => { calls.push(params); return { id, customer: 'cus_1', status: 'active', cancel_at_period_end: !!params.cancel_at_period_end, cancel_at: params.cancel_at || null, trial_end: null, items: { data: [] } }; },
      };
    }
  },
}));
vi.mock('../_auth.js', () => ({ requireAuthedUser: vi.fn(async () => ({ id: 'user_1', email: 'a@b.se' })) }));
vi.mock('../_rateLimit.js', () => ({ checkRateLimit: vi.fn(async () => true), getClientIp: () => '1.1.1.1' }));
vi.mock('./_subscriptions.js', async (orig) => ({
  ...(await orig()),
  getSubscriptionRow: vi.fn(async () => ({ stripe_subscription_id: 'sub_1', plan: 'solo_monthly', created_at: '2026-01-01T00:00:00Z' })),
  upsertSubscription: vi.fn(async () => {}),
}));

const { default: handler } = await import('./_subscriptionCheckout.js');

function run(body) {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  return handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body }, res).then(() => res);
}
const both = (p) => ('cancel_at' in p) && ('cancel_at_period_end' in p);

describe('uppsägning och återaktivering', () => {
  beforeEach(() => { calls.length = 0; process.env.STRIPE_SECRET_KEY = 'sk_test_x'; });

  it('avsluta skickar bara cancel_at_period_end', async () => {
    const res = await run({ action: 'cancel' });
    expect(res.statusCode).toBe(200);
    expect(calls[0].cancel_at_period_end).toBe(true);
    expect(both(calls[0])).toBe(false);
  });

  it('återaktivera efter vanlig uppsägning nollar bara cancel_at_period_end', async () => {
    live = { id: 'sub_1', cancel_at_period_end: true, cancel_at: 1800000000 };
    const res = await run({ action: 'reactivate' });
    expect(res.statusCode).toBe(200);
    expect(calls[0]).toMatchObject({ cancel_at_period_end: false });
    expect(both(calls[0])).toBe(false);
  });

  it('återaktivera efter uppsägning med minimitid nollar bara cancel_at', async () => {
    live = { id: 'sub_1', cancel_at_period_end: false, cancel_at: 1800000000 };
    const res = await run({ action: 'reactivate' });
    expect(res.statusCode).toBe(200);
    expect(calls[0]).toMatchObject({ cancel_at: null });
    expect(both(calls[0])).toBe(false);
  });
});
