import { describe, it, expect } from 'vitest';
import { runChecks, buildStatus, dayStatus, uptime, eventStatus, stripeIndicator, worst } from './_status.js';

const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body });
const env = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', RESEND_API_KEY: 're', GOOGLE_VISION_API_KEY: 'g' };

describe('runChecks', () => {
  it('allt grönt när allt svarar och inga fel loggats', async () => {
    const fetch = async (url) => (url.includes('stripe') ? ok({ status: { indicator: 'none' } }) : ok());
    const res = await runChecks({ fetch, env, countEvents: async () => 0 });
    expect(res.map(r => [r.component, r.status])).toEqual([
      ['app', 'ok'], ['login', 'ok'], ['data', 'ok'], ['ocr', 'ok'], ['email', 'ok'], ['payments', 'ok'], ['errors', 'ok'],
    ]);
  });

  it('felspårningen följer Sentrys egen statussida', async () => {
    const fetch = async (url) => (url.includes('status.sentry.io') ? ok({ status: { indicator: 'major', description: 'Ingestion delayed' } }) : ok());
    const res = Object.fromEntries((await runChecks({ fetch, env, countEvents: async () => 0 })).map(r => [r.component, r]));
    expect(res.errors).toMatchObject({ status: 'down', note: 'Ingestion delayed' });
    expect(res.payments.status).toBe('ok');
  });

  it('nere när inloggningen inte svarar, störning vid många misslyckade kvittoläsningar och Stripe minor', async () => {
    const fetch = async (url) => {
      if (url.includes('/auth/v1/health')) return { ok: false, status: 503, json: async () => ({}) };
      if (url.includes('stripe')) return ok({ status: { indicator: 'minor', description: 'Partial outage' } });
      return ok();
    };
    const res = Object.fromEntries((await runChecks({ fetch, env, countEvents: async (kind) => (kind === 'vision_error' ? 4 : 0) })).map(r => [r.component, r]));
    expect(res.login.status).toBe('down');
    expect(res.ocr.status).toBe('degraded');
    expect(res.ocr.note).toContain('4 misslyckade');
    expect(res.payments).toMatchObject({ status: 'degraded', note: 'Partial outage' });
  });

  it('kvittoläsning och e-post är nere utan nycklar', async () => {
    const res = Object.fromEntries((await runChecks({ fetch: async (u) => (u.includes('stripe') ? ok({ status: { indicator: 'none' } }) : ok()), env: { ...env, GOOGLE_VISION_API_KEY: '', RESEND_API_KEY: '' } })).map(r => [r.component, r.status]));
    expect(res.ocr).toBe('down');
    expect(res.email).toBe('down');
  });
});

describe('hjälpfunktioner', () => {
  it('dagens färg, tillgänglighet och fel', () => {
    expect(dayStatus(undefined)).toBe('nodata');
    expect(dayStatus({ ok: 288, degraded: 0, down: 0 })).toBe('ok');
    expect(dayStatus({ ok: 287, degraded: 0, down: 1 })).toBe('degraded');
    expect(dayStatus({ ok: 280, degraded: 0, down: 8 })).toBe('down');
    expect(uptime([{ ok: 287, degraded: 0, down: 1 }, { ok: 288, degraded: 0, down: 0 }])).toBe(99.82);
    expect(uptime([])).toBe(null);
    expect([eventStatus(2), eventStatus(3), eventStatus(10)]).toEqual(['ok', 'degraded', 'down']);
    expect([stripeIndicator('none'), stripeIndicator('minor'), stripeIndicator('major')]).toEqual(['ok', 'degraded', 'down']);
    expect(worst(['ok', 'maintenance', 'degraded'])).toBe('degraded');
  });
});

describe('buildStatus', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  it('senaste kollen, ett pågående meddelande som färgar delen och 90 dagar', () => {
    const s = buildStatus({
      now,
      latest: { app: { status: 'ok', checked_at: '2026-10-24T11:58:00Z' }, ocr: { status: 'ok', checked_at: '2026-10-24T11:58:00Z' } },
      daily: [{ day: '2026-10-24', component: 'app', ok: 100, degraded: 0, down: 0 }],
      incidents: [
        { id: 'i1', title: 'Kvittoläsningen är långsam', components: ['ocr'], status: 'investigating', impact: 'degraded', starts_at: '2026-10-24T11:00:00Z' },
        { id: 'i2', title: 'Underhåll', components: ['data'], status: 'maintenance', impact: 'maintenance', starts_at: '2026-10-30T22:00:00Z' },
        { id: 'i3', title: 'Löst', components: ['email'], status: 'resolved', impact: 'down', starts_at: '2026-10-20T10:00:00Z', resolved_at: '2026-10-20T11:00:00Z' },
      ],
    });
    expect(s.overall).toBe('degraded');
    expect(s.components.find(c => c.id === 'ocr').status).toBe('degraded');
    expect(s.components.find(c => c.id === 'app').days).toHaveLength(90);
    expect(s.components.find(c => c.id === 'app').days.at(-1)).toEqual({ date: '2026-10-24', status: 'ok' });
    expect(s.active.map(i => i.title)).toEqual(['Kvittoläsningen är långsam']);
    expect(s.upcoming.map(i => i.title)).toEqual(['Underhåll']);
    expect(s.past.map(i => i.components)).toEqual([['E-post (fakturor och påminnelser)']]);
  });

  it('en gammal kontroll räknas inte', () => {
    const s = buildStatus({ now, latest: { login: { status: 'down', checked_at: '2026-10-24T10:00:00Z' } } });
    expect(s.components.find(c => c.id === 'login').status).toBe('ok');
  });
});
