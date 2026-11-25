import { describe, it, expect } from 'vitest';
import { attemptsFor, recordFailure, clearAttempts, isWrongCredentials } from './loginAttempts';

const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

describe('inloggningsförsök', () => {
  it('räknar fel per adress och spärrar efter fem', () => {
    const storage = mem(); const now = 1_000_000;
    for (let i = 0; i < 4; i++) recordFailure('A@b.se', { storage, now });
    expect(attemptsFor('a@b.se', { storage, now })).toEqual({ fails: 4, lockedUntil: 0 });
    const r = recordFailure('a@b.se', { storage, now });
    expect(r.lockedUntil).toBe(now + 15 * 60000);
    expect(attemptsFor('x@b.se', { storage, now }).fails).toBe(0);
  });
  it('spärren släpper efter 15 minuter och nollställs vid inloggning', () => {
    const storage = mem(); const now = 1_000_000;
    for (let i = 0; i < 5; i++) recordFailure('a@b.se', { storage, now });
    expect(attemptsFor('a@b.se', { storage, now: now + 16 * 60000 })).toEqual({ fails: 0, lockedUntil: 0 });
    recordFailure('a@b.se', { storage, now }); clearAttempts('a@b.se', { storage });
    expect(attemptsFor('a@b.se', { storage, now }).fails).toBe(0);
  });
  it('känner igen fel lösenord men inte nätfel', () => {
    expect(isWrongCredentials('Invalid login credentials')).toBe(true);
    expect(isWrongCredentials('Failed to fetch')).toBe(false);
  });
});
