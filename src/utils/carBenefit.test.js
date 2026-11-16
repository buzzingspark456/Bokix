import { describe, it, expect } from 'vitest';
import { calcCarBenefit } from './carBenefit';

describe('bilförmån 2026', () => {
  it('Skatteverkets eget exempel: 72 045 kr per år', () => {
    const r = calcCarBenefit({ year: 2026, newCarPrice: 300000, extras: 22000, vehicleTax: 4050 });
    expect(r.parts).toEqual({ base: 17168, interest: 8967, price: 41860, tax: 4050 });
    expect(r.yearly).toBe(72045);
    expect(r.monthly).toBe(6004);
  });
  it('elbil sätts ned med 350 000 kr, högst 50 %', () => {
    expect(calcCarBenefit({ year: 2026, newCarPrice: 600000, fuel: 'el' }).reducedPrice).toBe(300000);
    expect(calcCarBenefit({ year: 2026, newCarPrice: 500000, fuel: 'el' }).reducedPrice).toBe(250000);
    expect(calcCarBenefit({ year: 2026, newCarPrice: 500000, fuel: 'laddhybrid' }).reducedPrice).toBe(360000);
  });
  it('år utan värden ger null', () => {
    expect(calcCarBenefit({ year: 2027, newCarPrice: 300000 })).toBeNull();
  });
});
