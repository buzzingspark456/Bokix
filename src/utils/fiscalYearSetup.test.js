import { describe, it, expect } from 'vitest';
import { fiscalYearFields, firstYearEndOptions, describeFiscalYear, defaultFirstYearEnd, suggestFiscalYear } from './fiscalYearSetup';

const now = new Date(2026, 8, 27); // 27 september 2026

describe('fiscalYearFields', () => {
  it('kalenderår', () => {
    expect(fiscalYearFields({ mode: 'calendar' }, now)).toEqual({ fiscalYear: '2026-01-01', firstFiscalYear: null });
  });
  it('brutet år som redan börjat i år, och ett som började i fjol', () => {
    expect(fiscalYearFields({ mode: 'other', startMonth: 7 }, now)).toEqual({ fiscalYear: '2026-07-01', firstFiscalYear: null });
    expect(fiscalYearFields({ mode: 'other', startMonth: 11 }, now)).toEqual({ fiscalYear: '2025-11-01', firstFiscalYear: null });
  });
  it('första året: de vanliga åren börjar dagen efter', () => {
    expect(fiscalYearFields({ mode: 'first', firstStart: '2026-03-15', firstEnd: '2027-06-30' }, now))
      .toEqual({ fiscalYear: '2027-07-01', firstFiscalYear: { start: '2026-03-15', end: '2027-06-30' } });
  });
  it('första året får inte vara längre än 18 månader eller sluta mitt i en månad', () => {
    expect(fiscalYearFields({ mode: 'first', firstStart: '2026-03-15', firstEnd: '2027-09-30' }, now).error).toBeTruthy();
    expect(fiscalYearFields({ mode: 'first', firstStart: '2026-03-15', firstEnd: '2026-12-15' }, now).error).toBeTruthy();
  });
  it('kräver ett val', () => {
    expect(fiscalYearFields({}, now).error).toBeTruthy();
    expect(fiscalYearFields({ mode: 'other' }, now).error).toBeTruthy();
  });
});

describe('firstYearEndOptions', () => {
  it('ger 18 månadsslut från startmånaden', () => {
    const opts = firstYearEndOptions('2026-03-15');
    expect(opts).toHaveLength(18);
    expect(opts[0]).toBe('2026-03-31');
    expect(opts[11]).toBe('2027-02-28');
    expect(opts[17]).toBe('2027-08-31');
    expect(defaultFirstYearEnd('2026-03-15')).toBe('2026-12-31');
  });
});

describe('describeFiscalYear', () => {
  it('beskriver valen', () => {
    expect(describeFiscalYear({ mode: 'calendar' }, now)).toBe('Kalenderår, 1 januari – 31 december');
    expect(describeFiscalYear({ mode: 'other', startMonth: 7 }, now)).toBe('1 juli – 30 juni');
    expect(describeFiscalYear({ mode: 'other', startMonth: 3 }, now)).toBe('1 mars – 28 februari');
    expect(describeFiscalYear({ mode: 'first', firstStart: '2026-03-15', firstEnd: '2026-12-31' }, now)).toBe('Första året 15 mars 2026 – 31 december 2026');
  });
});

describe('suggestFiscalYear', () => {
  const now = new Date(2026, 8, 27);
  it('kalenderår ur årsredovisningen', () => {
    expect(suggestFiscalYear({ fiscalYearStart: '2025-01-01', fiscalYearEnd: '2025-12-31' }, now).choice).toEqual({ mode: 'calendar' });
  });
  it('brutet år, även när senaste årsredovisningen var ett förlängt första år', () => {
    expect(suggestFiscalYear({ fiscalYearStart: '2024-07-01', fiscalYearEnd: '2025-06-30' }, now).choice).toEqual({ mode: 'other', startMonth: 7 });
    expect(suggestFiscalYear({ fiscalYearStart: '2024-03-15', fiscalYearEnd: '2025-04-30' }, now).choice).toEqual({ mode: 'other', startMonth: 5 });
  });
  it('nyregistrerat utan årsredovisning föreslår första året', () => {
    expect(suggestFiscalYear({ registrationDate: '2026-03-15' }, now).choice).toEqual({ mode: 'first', firstStart: '2026-03-15', firstEnd: '2026-12-31' });
  });
  it('vet inget om äldre företag utan årsredovisning', () => {
    expect(suggestFiscalYear({ registrationDate: '2019-03-15' }, now)).toBe(null);
    expect(suggestFiscalYear(null, now)).toBe(null);
  });
});
