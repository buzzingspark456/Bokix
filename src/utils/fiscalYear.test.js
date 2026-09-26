import { describe, it, expect } from 'vitest';
import { inPeriod, periodLabel, activeFiscalYear, lockedPeriodFor, periodEnd } from './fiscalYear';
import { fiscalYearBounds, companyFiscalYearSetting } from './reportCalculations';

describe('inPeriod', () => {
  it('kalenderår som sträng, som förut', () => {
    expect(inPeriod('2026-05-01', '2026')).toBe(true);
    expect(inPeriod('2025-12-31', '2026')).toBe(false);
  });
  it('brutet år', () => {
    const p = { start: '2025-07-01', end: '2026-06-30' };
    expect(inPeriod('2025-07-01', p)).toBe(true);
    expect(inPeriod('2026-06-30', p)).toBe(true);
    expect(inPeriod('2026-07-01', p)).toBe(false);
    expect(inPeriod('2026-06', p)).toBe(true);
  });
});

describe('activeFiscalYear', () => {
  const now = new Date(2026, 8, 27);
  it('kalenderår ger nyckeln "2026"', () => {
    expect(activeFiscalYear({ fiscalYear: '2026-01-01' }, now)).toMatchObject({ start: '2026-01-01', end: '2026-12-31', key: '2026', isCalendar: true });
  });
  it('brutet år', () => {
    expect(activeFiscalYear({ fiscalYear: '2025-07-01' }, now)).toMatchObject({ start: '2026-07-01', end: '2027-06-30', key: '2026/2027', isCalendar: false });
    expect(activeFiscalYear({ fiscalYear: '2025-11-01' }, now)).toMatchObject({ start: '2025-11-01', end: '2026-10-31', key: '2025/2026' });
  });
  it('första året gäller till sitt slut', () => {
    const c = { fiscalYear: '2028-01-01', firstFiscalYear: { start: '2026-03-15', end: '2027-12-31' } };
    expect(activeFiscalYear(c, now)).toMatchObject({ start: '2026-03-15', end: '2027-12-31', key: '2026/2027' });
    expect(activeFiscalYear(c, new Date(2028, 1, 1))).toMatchObject({ start: '2028-01-01', end: '2028-12-31', key: '2028' });
  });
  it('ett kort första år inom samma kalenderår får datum i namnet', () => {
    expect(periodLabel({ start: '2026-03-15', end: '2026-12-31' })).toBe('2026-03-15 – 2026-12-31');
    expect(periodEnd('2026')).toBe('2026-12-31');
  });
});

describe('lockedPeriodFor', () => {
  it('gamla lås per kalenderår och nya med datum', () => {
    const locks = { 2024: { result: 1 }, '2025/2026': { start: '2025-07-01', end: '2026-06-30' } };
    expect(lockedPeriodFor('2024-03-01', locks)).toBe('2024');
    expect(lockedPeriodFor('2026-01-15', locks)).toBe('2025/2026');
    expect(lockedPeriodFor('2026-07-01', locks)).toBe(null);
  });
});

describe('fiscalYearBounds med första räkenskapsår', () => {
  const company = { fiscalYear: '2028-01-01', firstFiscalYear: { start: '2026-03-15', end: '2027-12-31' } };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  it('första året gäller inom sitt intervall, sedan de vanliga åren', () => {
    const a = fiscalYearBounds(companyFiscalYearSetting(company), new Date(2027, 5, 1));
    expect([iso(a.start), iso(a.end)]).toEqual(['2026-03-15', '2027-12-31']);
    const b = fiscalYearBounds(companyFiscalYearSetting(company), new Date(2028, 5, 1));
    expect([iso(b.start), iso(b.end)]).toEqual(['2028-01-01', '2028-12-31']);
  });
  it('strängen fungerar som förut', () => {
    const c = fiscalYearBounds('2025-07-01', new Date(2026, 8, 1));
    expect([iso(c.start), iso(c.end)]).toEqual(['2026-07-01', '2027-06-30']);
    expect(companyFiscalYearSetting({ fiscalYear: '2026-01-01' })).toBe('2026-01-01');
  });
});
