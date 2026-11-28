import { describe, it, expect, vi, beforeEach } from 'vitest';

// Planspärren i kvittoavläsningen (2026-11-28): Solo 100, Team 300, Handel
// 1 000 per företag och månad; köpta paket (Stripe-fakturaposter) räknas när
// planens del är slut; konton utan plan har ingen planspärr.

const counters = new Map();
let subsRows = [];
let invoiceItems = [];

vi.mock('./_security.js', () => ({ applySecurityHeaders: () => {} }));
vi.mock('./_sentry.js', () => ({ withSentry: (h) => h }));
vi.mock('./_systemEvents.js', () => ({ logSystemEvent: async () => {} }));
vi.mock('./_auth.js', () => ({
  requireAuthedUser: async () => ({ id: 'u1' }),
  requireActiveSubscription: async () => true,
  payingAccountFor: async () => ({ id: 'u1', uf: false }),
}));
vi.mock('./_rateLimit.js', () => ({
  checkRateLimit: async () => true,
  // Samma regel som hit_rate_limit: räkna upp, svara count <= max.
  hitShared: async (key, _w, max) => { const n = (counters.get(key) || 0) + 1; counters.set(key, n); return n <= max; },
}));
vi.mock('./stripe/_parseBody.js', () => ({ parseJsonBody: async (req) => req.body }));
vi.mock('./_vision.js', async (orig) => {
  const real = await orig();
  return { ...real, documentFromBody: () => ({ isPdf: false }), readWithVision: async () => ({ ok: true, text: 'ICA 123,00', lines: [] }) };
});
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: subsRows }) }) }) }),
}));
vi.mock('stripe', () => ({
  default: class { constructor() { this.invoiceItems = { list: async () => ({ data: invoiceItems, has_more: false }) }; } },
}));

const { default: handler } = await import('./ocr-vision.js');

function call(companyId = 'f1') {
  const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return handler({ method: 'POST', body: { image: 'x', company_id: companyId } }, res).then(() => res);
}

beforeEach(() => {
  counters.clear();
  invoiceItems = [];
  process.env.GOOGLE_VISION_API_KEY = 'k';
  process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 's';
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
});

describe('kvittoavläsningens planspärr', () => {
  it('Solo stoppas efter 100 per företag och månad', async () => {
    subsRows = [{ company_id: '', plan: 'solo_monthly', stripe_customer_id: 'cus_1' }];
    for (let i = 0; i < 100; i++) expect((await call()).statusCode).toBe(200);
    const stopped = await call();
    expect(stopped.statusCode).toBe(429);
    expect(stopped.body.code).toBe('plan_quota');
    expect(stopped.body.error).toMatch(/100 kvittoavläsningar i Solo/);
  });

  it('ett köpt paket ger 100 till samma månad', async () => {
    subsRows = [{ company_id: '', plan: 'solo_monthly', stripe_customer_id: 'cus_2' }];
    const month = new Date().toISOString().slice(0, 7);
    invoiceItems = [{ metadata: { bokix_ocr_month: month, bokix_company: 'f2' } }];
    for (let i = 0; i < 200; i++) expect((await call('f2')).statusCode).toBe(200);
    expect((await call('f2')).body.code).toBe('plan_quota');
  });

  it('företagets egen prenumeration styr, och Team har 300', async () => {
    subsRows = [{ company_id: '', plan: 'solo_monthly', stripe_customer_id: 'cus_3' }, { company_id: 'f3', plan: 'employer_monthly', stripe_customer_id: 'cus_4' }];
    for (let i = 0; i < 300; i++) expect((await call('f3')).statusCode).toBe(200);
    expect((await call('f3')).body.error).toMatch(/300 kvittoavläsningar i Team/);
  });

  it('konto utan sparad plan har ingen planspärr', async () => {
    subsRows = [{ company_id: '', plan: null, stripe_customer_id: 'cus_5' }];
    for (let i = 0; i < 150; i++) expect((await call('f5')).statusCode).toBe(200);
  });
});
