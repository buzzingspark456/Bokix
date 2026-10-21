import { describe, it, expect, vi, beforeEach } from 'vitest';

const sent = [];
vi.mock('../_security.js', () => ({ applySecurityHeaders: () => {} }));
vi.mock('../_systemEvents.js', () => ({ logSystemEvent: async () => {} }));
vi.mock('../_rateLimit.js', () => ({ checkRateLimit: async () => true }));
vi.mock('../stripe/_parseBody.js', () => ({ parseJsonBody: async (req) => req.body }));
vi.mock('../_auth.js', () => ({
  requireAuthedUser: async () => ({ id: 'u1' }),
  requireActiveSubscription: async () => true,
  loadOwnedOrMemberCompany: async () => ({
    ownerUserId: 'u1',
    companyData: {
      company: { name: 'Städ AB', email: 'lon@stad.se' },
      employees: [{ id: 'e1', firstName: 'Bo', email: 'bo@exempel.se' }, { id: 'e2', firstName: 'Sara', email: '' }],
    },
  }),
}));
vi.mock('../_smtp.js', () => ({ trySendFromOwnAddress: async () => ({ used: false }) }));
vi.mock('../_resend.js', () => ({
  hasResendApiKey: () => true,
  sendWithFallback: async (payload) => { sent.push(payload); return { ok: true, data: { id: 'm1' } }; },
}));

const { default: handler } = await import('./send-payslip.js');

function call(body) {
  const res = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return handler({ method: 'POST', body, headers: {} }, res).then(() => res);
}

describe('send-payslip', () => {
  beforeEach(() => { sent.length = 0; });

  it('skickar till den anställdas sparade adress, inte en adress från klienten', async () => {
    const res = await call({ company_id: 'c1', employee_id: 'e1', period: '2026-09', attachmentBase64: 'JVBERi0x', to: 'angripare@x.se' });
    expect(res.statusCode).toBe(200);
    expect(sent[0].to).toEqual(['bo@exempel.se']);
    expect(sent[0].attachments[0].filename).toBe('lonebesked-2026-09.pdf');
    expect(sent[0].reply_to).toBe('lon@stad.se');
  });

  it('nekar anställd utan e-post och okänd anställd', async () => {
    expect((await call({ company_id: 'c1', employee_id: 'e2', period: '2026-09', attachmentBase64: 'JVBERi0x' })).statusCode).toBe(400);
    expect((await call({ company_id: 'c1', employee_id: 'nope', period: '2026-09', attachmentBase64: 'JVBERi0x' })).statusCode).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('kräver giltig period', async () => {
    expect((await call({ company_id: 'c1', employee_id: 'e1', period: 'x', attachmentBase64: 'JVBERi0x' })).statusCode).toBe(400);
  });
});

describe('send-payslip bilaga', () => {
  it('skickar bara PDF', async () => {
    sent.length = 0;
    expect((await call({ company_id: 'c1', employee_id: 'e1', period: '2026-08', attachmentBase64: 'PGh0bWw+' })).statusCode).toBe(400);
    expect(sent).toHaveLength(0);
  });
});
