import { describe, it, expect, vi, beforeEach } from 'vitest';

const KEY = 'a'.repeat(48);
let state;
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state ? { state } : null, error: null }) }),
      }),
    }),
  }),
}));

const { default: handler } = await import('./calendar.js');

function run(query, method = 'GET') {
  const res = {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; return this; },
  };
  return handler({ method, query }, res).then(() => res);
}

describe('api/calendar', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'http://x';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'y';
    state = { companies: { c1: { company: { name: 'Test AB', calendar: { key: KEY } }, invoices: [{ id: 'i1', invoiceNumber: '7', status: 'sent', dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) }] } } };
  });

  it('svarar med kalendern när nyckeln stämmer', async () => {
    const res = await run({ u: '11111111-1111-4111-8111-111111111111', c: 'c1', k: KEY });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.body).toContain('X-WR-CALNAME:Bokix – Test AB');
    expect(res.body).toContain('SUMMARY:Faktura 7 förfaller');
  });

  it('ger 404 för fel nyckel, okänt företag och trasig indata', async () => {
    expect((await run({ u: '11111111-1111-4111-8111-111111111111', c: 'c1', k: 'b'.repeat(48) })).statusCode).toBe(404);
    expect((await run({ u: '11111111-1111-4111-8111-111111111111', c: 'nope', k: KEY })).statusCode).toBe(404);
    expect((await run({ u: 'u1;drop', c: 'c1', k: KEY })).statusCode).toBe(404);
    state.companies.c1.company.calendar = {};
    expect((await run({ u: '11111111-1111-4111-8111-111111111111', c: 'c1', k: KEY })).statusCode).toBe(404);
  });

  it('tar bort fakturor när de är avstängda i inställningarna', async () => {
    state.companies.c1.company.calendar.invoices = false;
    const res = await run({ u: '11111111-1111-4111-8111-111111111111', c: 'c1', k: KEY });
    expect(res.body).not.toContain('Faktura 7');
  });

  it('godtar bara GET och HEAD', async () => {
    expect((await run({ u: '11111111-1111-4111-8111-111111111111', c: 'c1', k: KEY }, 'POST')).statusCode).toBe(405);
  });
});
