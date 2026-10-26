import { describe, it, expect, vi, beforeEach } from 'vitest';

const counters = new Map();
const hitShared = vi.fn(async (key, _windowMs, max) => {
  if (hitShared.unreachable) return null;
  const n = (counters.get(key) || 0) + 1;
  counters.set(key, n);
  return n <= max;
});
const readWithVision = vi.fn(async () => ({ ok: true, text: 'ICA Nära\nTOTALT 123,00', lines: [{ text: 'TOTALT 123,00', box: { x: 0.1, y: 0.8, w: 0.5, h: 0.03 } }] }));
const verifyTurnstile = vi.fn(async token => (token === 'ok' ? { ok: true } : { ok: false, reason: 'verification_failed' }));

vi.mock('./_security.js', () => ({ applySecurityHeaders: () => {} }));
vi.mock('./_sentry.js', () => ({ withSentry: h => h }));
vi.mock('./stripe/_parseBody.js', () => ({ parseJsonBody: async req => req.body }));
vi.mock('./_rateLimit.js', () => ({
  checkRateLimit: vi.fn(async () => true),
  hitShared: (...args) => hitShared(...args),
  getClientIp: req => req.ip,
}));
vi.mock('./_turnstile.js', () => ({ hasTurnstileSecretKey: () => Boolean(process.env.TURNSTILE_SECRET_KEY), verifyTurnstile: (...a) => verifyTurnstile(...a) }));
vi.mock('./_vision.js', async () => {
  const real = await vi.importActual('./_vision.js');
  return { ...real, readWithVision: (...a) => readWithVision(...a) };
});

const { default: handler, visitorKey } = await import('./ocr-free.js');

const run = async ({ ip = '203.0.113.7', body = { image: 'aGVq', captchaToken: 'ok' } } = {}) => {
  const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ method: 'POST', ip, body, headers: {} }, res);
  return res;
};

describe('ocr-free', () => {
  beforeEach(() => {
    counters.clear();
    hitShared.unreachable = false;
    readWithVision.mockClear();
    process.env.GOOGLE_VISION_API_KEY = 'nyckel';
    process.env.TURNSTILE_SECRET_KEY = 'hemlig';
  });

  it('första kvittot läses av Google, nästa från samma person nekas', async () => {
    const first = await run();
    expect(first.statusCode).toBe(200);
    expect(first.body.text).toContain('TOTALT');
    expect(first.body.lines).toHaveLength(1);

    const second = await run();
    expect(second.statusCode).toBe(429);
    expect(second.body.code).toBe('used');
    expect(readWithVision).toHaveBeenCalledTimes(1);
  });

  it('en annan person får sin egen läsning', async () => {
    expect((await run({ ip: '203.0.113.7' })).statusCode).toBe(200);
    expect((await run({ ip: '198.51.100.20' })).statusCode).toBe(200);
  });

  it('IPv6 räknas per /64, så ett nytt suffix ger ingen ny läsning', async () => {
    expect((await run({ ip: '2001:db8:1:2:aaaa::1' })).statusCode).toBe(200);
    const again = await run({ ip: '2001:db8:1:2:bbbb::9' });
    expect(again.body.code).toBe('used');
  });

  it('utan godkänd Turnstile anropas inte Google och läsningen räknas inte', async () => {
    const res = await run({ body: { image: 'aGVq', captchaToken: 'fel' } });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('captcha');
    expect(readWithVision).not.toHaveBeenCalled();
    expect((await run()).statusCode).toBe(200);
  });

  it('går räknaren inte att nå används inte Google', async () => {
    hitShared.unreachable = true;
    const res = await run();
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('unavailable');
    expect(readWithVision).not.toHaveBeenCalled();
  });

  it('en fil som saknas eller inte är base64 nekas innan något räknas', async () => {
    const res = await run({ body: { image: 'inte base64!', captchaToken: 'ok' } });
    expect(res.statusCode).toBe(400);
    expect(counters.size).toBe(0);
  });

  it('IP-adressen sparas aldrig i klartext', () => {
    const key = visitorKey('203.0.113.7', 'hemlighet');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain('203');
    expect(visitorKey('203.0.113.7', 'annan')).not.toBe(key);
  });
});
