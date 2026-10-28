import { describe, it, expect, vi, beforeEach } from 'vitest';

const logged = [];
const UID = 'd1b08949-66f5-4e92-ad06-9dbb3e04c7ef';
vi.mock('./_systemEvents.js', () => ({ logSystemEvent: vi.fn(async (kind, detail, opts) => { logged.push({ kind, detail, alertKey: opts?.alertKey }); }) }));
vi.mock('./_rateLimit.js', () => ({ checkRateLimit: vi.fn(async () => true) }));
vi.mock('./_security.js', () => ({ applySecurityHeaders: () => {} }));
vi.mock('./stripe/_parseBody.js', () => ({ parseJsonBody: async (req) => req.body }));
// Inloggad = en Authorization-header med token 'ok'.
vi.mock('./_auth.js', () => ({
  optionalAuthedUser: vi.fn(async (req) => (req.headers.authorization === 'Bearer ok' ? { id: 'd1b08949-66f5-4e92-ad06-9dbb3e04c7ef' } : null)),
}));

const { default: handler } = await import('./client-error.js');

const run = async (body, { authed = false } = {}) => {
  const res = { statusCode: 0, setHeader() {}, status(c) { this.statusCode = c; return this; }, end() { return this; }, json() { return this; } };
  const headers = { 'user-agent': 'Safari', ...(authed ? { authorization: 'Bearer ok' } : {}) };
  await handler({ method: 'POST', body, headers }, res);
  return res;
};

describe('client-error', () => {
  beforeEach(() => { logged.length = 0; });

  it('kvittoläsningens fel blir ocr_error med filtyp, Vision-status och kontot ur inloggningen', async () => {
    const res = await run({ message: 'Invalid PDF structure', source: 'ocr', fileType: 'pdf', cloud: 'svarade 403', path: '/app' }, { authed: true });
    expect(res.statusCode).toBe(204);
    expect(logged).toHaveLength(1);
    expect(logged[0].kind).toBe('ocr_error');
    expect(logged[0].detail).toContain('PDF: Invalid PDF structure');
    expect(logged[0].detail).toContain('Vision: svarade 403');
    expect(logged[0].detail).toContain(`Konto: ${UID}`);
  });

  it('ett konto-id i rapporten godtas aldrig utan inloggning', async () => {
    await run({ message: `Fel för ${UID}`, source: 'ocr', userId: UID });
    expect(logged[0].detail).toContain('Konto: okänt');
    expect(logged[0].detail).not.toContain(UID);
  });

  it('skuggläsning: lika loggas tyst, skillnad och fel får egna sorter', async () => {
    await run({ source: 'shadow', message: 'ok', summary: { mismatched: 0, records: 197, ms: 150 } }, { authed: true });
    await run({ source: 'shadow', message: 'skillnad', summary: { mismatched: 1, companies: [{ diffs: [{ field: 'verifications', missing: 1 }] }] } }, { authed: true });
    await run({ source: 'shadow', message: 'ok', summary: { error: 'company_records: permission denied', mismatched: 0 } }, { authed: true });
    expect(logged.map(l => l.kind)).toEqual(['shadow_read', 'shadow_read_mismatch', 'shadow_read_failed']);
    expect(logged[0].detail).toContain(`Konto: ${UID}`);
    expect(logged[1].detail).toContain('"field":"verifications"');
    expect(logged[2].detail).toContain('permission denied');
  });

  it('skuggläsning utan inloggning loggas inte (kan inte förfalska larm)', async () => {
    const res = await run({ source: 'shadow', userId: UID, summary: { error: 'x', mismatched: 1 } });
    expect(res.statusCode).toBe(204);
    expect(logged).toHaveLength(0);
  });

  it('skuggläsningens rapport kortas och kräver inget meddelande', async () => {
    const res = await run({ source: 'shadow', summary: { mismatched: 0, junk: 'x'.repeat(5000) } }, { authed: true });
    expect(res.statusCode).toBe(204);
    expect(logged[0].detail.length).toBeLessThan(1800);
  });

  it('krascher: anonyma och inloggade har var sin larmplats', async () => {
    await run({ message: 'x is undefined', source: 'boundary', path: '/app' });
    await run({ message: 'y is undefined', source: 'boundary', path: '/app' }, { authed: true });
    expect(logged.map(l => l.kind)).toEqual(['client_error', 'client_error']);
    expect(logged.map(l => l.alertKey)).toEqual(['client_error:anonym', 'client_error:inloggad']);
    expect(logged[1].detail).toContain(`Konto: ${UID}`);
  });
});
