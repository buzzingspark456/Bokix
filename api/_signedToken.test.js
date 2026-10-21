import { describe, it, expect, beforeAll } from 'vitest';
import { createSignedToken, verifySignedToken, hashCode, codeMatches } from './_signedToken.js';

beforeAll(() => { process.env.SIGNED_TOKEN_SECRET = 'test-hemlighet'; });

describe('koder i signerade token', () => {
  it('koden syns inte i token men går att kontrollera', () => {
    const token = createSignedToken({ email: 'a@b.se', codeHash: hashCode('123456') });
    const readable = Buffer.from(token.split('.')[0], 'base64url').toString('utf8');
    expect(readable).not.toContain('123456');
    const payload = verifySignedToken(token);
    expect(codeMatches(payload, '123456')).toBe(true);
    expect(codeMatches(payload, '654321')).toBe(false);
    expect(codeMatches({}, '123456')).toBe(false);
  });
});
