import { describe, it, expect } from 'vitest';
import { isDisposableEmail, isIpBlocked } from './_abuse.js';

describe('engångsadresser', () => {
  it('känner igen vanliga tjänster och underdomäner', () => {
    expect(isDisposableEmail('x@mailinator.com')).toBe(true);
    expect(isDisposableEmail('x@sub.yopmail.com')).toBe(true);
    expect(isDisposableEmail('anna@gmail.com')).toBe(false);
    expect(isDisposableEmail('anna@foretaget.se')).toBe(false);
  });
});

describe('IP-spärr', () => {
  it('enskild adress och nät', () => {
    expect(isIpBlocked('203.0.113.7', '198.51.100.1, 203.0.113.0/24')).toBe(true);
    expect(isIpBlocked('198.51.100.1', '198.51.100.1')).toBe(true);
    expect(isIpBlocked('203.0.114.7', '203.0.113.0/24')).toBe(false);
    expect(isIpBlocked('81.230.1.2', '')).toBe(false);
  });
});
