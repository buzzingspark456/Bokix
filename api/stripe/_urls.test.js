import { describe, it, expect } from 'vitest';
import { stripeReturnBase } from './_urls.js';

describe('stripeReturnBase', () => {
  it('skickar kunden direkt till www.bokix.se i produktion, oavsett miljövariabeln', () => {
    expect(stripeReturnBase('https://bokix.vercel.app/', { env: { VERCEL_ENV: 'production' } })).toBe('https://www.bokix.se/');
  });
  it('använder miljövariabeln lokalt och i förhandsversioner', () => {
    expect(stripeReturnBase('bokix-preview.vercel.app', { env: { VERCEL_ENV: 'preview' } })).toBe('https://bokix-preview.vercel.app/');
    expect(stripeReturnBase('', { env: {} })).toBe('http://localhost:5173/');
  });
});
