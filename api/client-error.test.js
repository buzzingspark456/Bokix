import { describe, it, expect, vi, beforeEach } from 'vitest';

const logged = [];
vi.mock('./_systemEvents.js', () => ({ logSystemEvent: vi.fn(async (kind, detail) => { logged.push({ kind, detail }); }) }));
vi.mock('./_rateLimit.js', () => ({ checkRateLimit: vi.fn(async () => true) }));
vi.mock('./_security.js', () => ({ applySecurityHeaders: () => {} }));
vi.mock('./stripe/_parseBody.js', () => ({ parseJsonBody: async (req) => req.body }));

const { default: handler } = await import('./client-error.js');

const run = async (body) => {
  const res = { statusCode: 0, setHeader() {}, status(c) { this.statusCode = c; return this; }, end() { return this; }, json() { return this; } };
  await handler({ method: 'POST', body, headers: { 'user-agent': 'Safari' } }, res);
  return res;
};

describe('client-error', () => {
  beforeEach(() => { logged.length = 0; });

  it('kvittoläsningens fel blir ocr_error med filtyp, Vision-status och konto', async () => {
    const res = await run({ message: 'Invalid PDF structure', source: 'ocr', fileType: 'pdf', cloud: 'svarade 403', userId: 'd1b08949-66f5-4e92-ad06-9dbb3e04c7ef', path: '/app' });
    expect(res.statusCode).toBe(204);
    expect(logged).toHaveLength(1);
    expect(logged[0].kind).toBe('ocr_error');
    expect(logged[0].detail).toContain('PDF: Invalid PDF structure');
    expect(logged[0].detail).toContain('Vision: svarade 403');
    expect(logged[0].detail).toContain('Konto: d1b08949-66f5-4e92-ad06-9dbb3e04c7ef');
  });

  it('ett konto-id som inte ser ut som ett id loggas som okänt', async () => {
    await run({ message: 'Fel', source: 'ocr', userId: '<script>' });
    expect(logged[0].detail).toContain('Konto: okänt');
  });

  it('skuggläsning: lika loggas tyst, skillnad och fel får egna sorter', async () => {
    const uid = 'd1b08949-66f5-4e92-ad06-9dbb3e04c7ef';
    await run({ source: 'shadow', message: 'ok', userId: uid, summary: { mismatched: 0, records: 197, ms: 150 } });
    await run({ source: 'shadow', message: 'skillnad', userId: uid, summary: { mismatched: 1, companies: [{ diffs: [{ field: 'verifications', missing: 1 }] }] } });
    await run({ source: 'shadow', message: 'ok', userId: uid, summary: { error: 'company_records: permission denied', mismatched: 0 } });
    expect(logged.map(l => l.kind)).toEqual(['shadow_read', 'shadow_read_mismatch', 'shadow_read_failed']);
    expect(logged[0].detail).toContain(`Konto: ${uid}`);
    expect(logged[1].detail).toContain('"field":"verifications"');
    expect(logged[2].detail).toContain('permission denied');
  });

  it('skuggläsningens rapport kortas och kräver inget meddelande', async () => {
    const res = await run({ source: 'shadow', userId: 'inte-ett-id', summary: { mismatched: 0, junk: 'x'.repeat(5000) } });
    expect(res.statusCode).toBe(204);
    expect(logged[0].detail).toContain('Konto: okänt');
    expect(logged[0].detail.length).toBeLessThan(1800);
  });

  it('vanliga krascher loggas som förut', async () => {
    await run({ message: 'x is undefined', source: 'boundary', path: '/app' });
    expect(logged[0].kind).toBe('client_error');
  });
});
