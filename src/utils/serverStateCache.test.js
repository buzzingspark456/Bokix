import { describe, it, expect } from 'vitest';
import { isCacheUsable, MAX_AGE_MS } from './serverStateCache';

const now = 1_800_000_000_000;
const entry = { userId: 'u1', updatedAt: '2026-10-18T10:00:00Z', state: { companies: {} }, cachedAt: now - 1000 };

describe('isCacheUsable', () => {
  it('används när konto och updated_at stämmer', () => {
    expect(isCacheUsable(entry, 'u1', '2026-10-18T10:00:00Z', now)).toBe(true);
  });

  it('används inte när raden ändrats sedan dess', () => {
    expect(isCacheUsable(entry, 'u1', '2026-10-18T10:00:01Z', now)).toBe(false);
  });

  it('används aldrig för ett annat konto', () => {
    expect(isCacheUsable(entry, 'u2', '2026-10-18T10:00:00Z', now)).toBe(false);
  });

  it('hämtar ändå hela kontot efter en vecka', () => {
    expect(isCacheUsable({ ...entry, cachedAt: now - MAX_AGE_MS - 1 }, 'u1', entry.updatedAt, now)).toBe(false);
  });

  it('tål saknade värden', () => {
    expect(isCacheUsable(null, 'u1', entry.updatedAt, now)).toBe(false);
    expect(isCacheUsable({ ...entry, state: null }, 'u1', entry.updatedAt, now)).toBe(false);
    expect(isCacheUsable(entry, 'u1', null, now)).toBe(false);
  });
});
