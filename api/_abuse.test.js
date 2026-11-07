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

describe('isDisposableEmailDeep', () => {
  it('fångar en slumpad domän vars e-postserver är 10minutemail', async () => {
    const { isDisposableEmailDeep } = await import('./_abuse.js');
    const resolveMx = async () => [{ exchange: 'prd-smtp.10minutemail.com.', priority: 10 }];
    expect(await isDisposableEmailDeep('dspsogjlpjzuqvbzaj@jbsze.net', { resolveMx })).toBe(true);
  });
  it('släpper en vanlig adress', async () => {
    const { isDisposableEmailDeep } = await import('./_abuse.js');
    const resolveMx = async () => [{ exchange: 'gmail-smtp-in.l.google.com', priority: 5 }];
    expect(await isDisposableEmailDeep('anna@gmail.com', { resolveMx })).toBe(false);
  });
  it('släpper igenom när uppslaget misslyckas', async () => {
    const { isDisposableEmailDeep } = await import('./_abuse.js');
    const resolveMx = async () => { throw new Error('ENOTFOUND'); };
    expect(await isDisposableEmailDeep('per@foretag.se', { resolveMx })).toBe(false);
  });
  it('känd domän fångas utan uppslag', async () => {
    const { isDisposableEmailDeep } = await import('./_abuse.js');
    expect(await isDisposableEmailDeep('x@mailinator.com', { resolveMx: async () => { throw new Error('ska inte anropas'); } })).toBe(true);
  });
});
