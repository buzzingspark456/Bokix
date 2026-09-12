import { describe, it, expect, vi, afterEach } from 'vitest';
import { convertToSek } from './currencyConversion.js';

function mockFetchOnce(status, body) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('convertToSek', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('räknar om ett dollarbelopp till kronor med den hämtade kursen', async () => {
    mockFetchOnce(200, { amount: 1, base: 'USD', date: '2024-06-03', rates: { SEK: 10.5179 } });
    const result = await convertToSek(45, 'USD', '2024-06-03');
    expect(result).not.toBeNull();
    expect(result.sek).toBeCloseTo(473.31, 2);
    expect(result.rate).toBe(10.5179);
    expect(result.date).toBe('2024-06-03');
  });

  it('frågar API:et om rätt köpdatum, inte alltid dagens kurs', async () => {
    mockFetchOnce(200, { amount: 1, base: 'GBP', date: '2024-01-05', rates: { SEK: 13.0 } });
    await convertToSek(28, 'GBP', '2024-01-05');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/2024-01-05?'));
  });

  it('ger null (inte ett hittepåbelopp) när valutan är okänd eller API:et svarar fel', async () => {
    mockFetchOnce(404, { message: 'not found' });
    const result = await convertToSek(100, 'XYZ', '2024-06-03');
    expect(result).toBeNull();
  });

  it('ger null vid nätverksfel istället för att krascha', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await convertToSek(100, 'USD', '2024-06-03');
    expect(result).toBeNull();
  });

  it('gör inget anrop alls för SEK, noll- eller saknat belopp', async () => {
    global.fetch = vi.fn();
    expect(await convertToSek(100, 'SEK', '2024-06-03')).toBeNull();
    expect(await convertToSek(0, 'USD', '2024-06-03')).toBeNull();
    expect(await convertToSek(null, 'USD', '2024-06-03')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
