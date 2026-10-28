import { describe, it, expect } from 'vitest';
import { requestCountry, isOutsideSweden } from './_country.js';

const req = (country) => ({ headers: country === undefined ? {} : { 'x-vercel-ip-country': country } });

describe('_country', () => {
  it('Sverige och okänt land räknas inte som utlandet', () => {
    expect(isOutsideSweden(req('SE'))).toBe(false);
    expect(isOutsideSweden(req('se'))).toBe(false);
    expect(isOutsideSweden(req(undefined))).toBe(false);
    expect(isOutsideSweden(req('garbage!'))).toBe(false);
  });

  it('ett annat land stoppas', () => {
    expect(isOutsideSweden(req('BR'))).toBe(true);
    expect(requestCountry(req('in'))).toBe('IN');
  });
});
