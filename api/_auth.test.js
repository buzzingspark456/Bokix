import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireActiveSubscription, isFreeEmail } from './_auth.js';

// Mock @supabase/supabase-js
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe('_auth requireActiveSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VITE_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  });

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      },
    };
    return res;
  };

  it('allows free/admin email addresses directly', async () => {
    const res = createMockRes();
    const allowed = await requireActiveSubscription({ email: 'alwakiabdullah1@gmail.com' }, res);
    expect(allowed).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('allows accounts within active UF free period', async () => {
    const res = createMockRes();
    const user = {
      email: 'student@skola.se',
      user_metadata: {
        uf: true,
        uf_started_at: new Date().toISOString(),
      },
    };
    const allowed = await requireActiveSubscription(user, res);
    expect(allowed).toBe(true);
  });

  it('blocks users without active subscription or exception with 402', async () => {
    const res = createMockRes();
    mockFrom.mockImplementation((table) => {
      if (table === 'company_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [{ status: 'canceled' }],
            }),
          }),
        };
      }
      return {};
    });

    const user = { id: 'u-123', email: 'regular@user.se' };
    const allowed = await requireActiveSubscription(user, res);
    expect(allowed).toBe(false);
    expect(res.statusCode).toBe(402);
    expect(res.jsonData?.error).toContain('Ingen aktiv prenumeration');
  });

  it('allows users with active or trialing subscription', async () => {
    const res = createMockRes();
    mockFrom.mockImplementation((table) => {
      if (table === 'company_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [{ status: 'active' }],
            }),
          }),
        };
      }
      return {};
    });

    const user = { id: 'u-123', email: 'paying@user.se' };
    const allowed = await requireActiveSubscription(user, res);
    expect(allowed).toBe(true);
  });
});
