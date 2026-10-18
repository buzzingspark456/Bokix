import { describe, it, expect } from 'vitest';
import { sessionStrength } from './index.js';

const token = (claims) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

describe('sessionStrength (admin-panelen kräver stark inloggning)', () => {
  it('bara lösenord räcker inte', () => {
    expect(sessionStrength(token({ aal: 'aal1', amr: [{ method: 'password', timestamp: 1 }] })).strong).toBe(false);
  });
  it('lösenord + kod från app (aal2) räcker', () => {
    expect(sessionStrength(token({ aal: 'aal2', amr: [{ method: 'totp' }, { method: 'password' }] })).strong).toBe(true);
  });
  it('passkey räcker, även som första faktor', () => {
    expect(sessionStrength(token({ aal: 'aal1', amr: [{ method: 'webauthn' }] })).strong).toBe(true);
    expect(sessionStrength(token({ aal: 'aal1', amr: ['passkey'] })).strong).toBe(true);
  });
  it('trasig token är svag', () => {
    expect(sessionStrength('inte-en-token').strong).toBe(false);
    expect(sessionStrength('').methods).toEqual([]);
  });
});
