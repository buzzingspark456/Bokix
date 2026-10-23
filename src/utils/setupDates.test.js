import { describe, it, expect } from 'vitest';
import { keyDatesForSetup, currentFiscalYearEnd } from './setupDates';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const NOW = new Date(2026, 9, 23); // 23 oktober 2026

describe('currentFiscalYearEnd', () => {
  it('kalenderår slutar 31 december i år', () => {
    expect(currentFiscalYearEnd({ fiscalYear: '2026-01-01' }, NOW)).toBe('2026-12-31');
  });
  it('brutet räkenskapsår och ett gammalt sparat startår flyttas fram', () => {
    expect(currentFiscalYearEnd({ fiscalYear: '2024-07-01' }, NOW)).toBe('2027-06-30');
  });
  it('första året gäller medan det pågår', () => {
    expect(currentFiscalYearEnd({ fiscalYear: '2027-07-01', firstFiscalYear: { start: '2026-03-01', end: '2027-06-30' } }, NOW)).toBe('2027-06-30');
  });
});

describe('keyDatesForSetup', () => {
  it('enskild firma med årsmoms: moms 12 maj, NE-deklaration 3 maj (2 maj är en söndag), bokslut 31 december', () => {
    const rows = keyDatesForSetup({ orgNr: '920927-3029', fiscalYear: '2026-01-01', vatRegistered: true, vatPeriod: 'yearly' }, NOW);
    const by = Object.fromEntries(rows.map(r => [r.key, iso(r.date)]));
    expect(by.vat).toBe('2027-05-12');
    expect(by.closing).toBe('2026-12-31');
    expect(by.income).toBe('2027-05-03');
    expect(by.annual).toBeUndefined();
  });

  it('aktiebolag med kvartalsmoms: kvartal 3 deklareras 12 november, årsredovisning 31 juli', () => {
    const rows = keyDatesForSetup({ orgNr: '556036-0793', fiscalYear: '2026-01-01', vatRegistered: true, vatPeriod: 'quarterly' }, NOW);
    const by = Object.fromEntries(rows.map(r => [r.key, iso(r.date)]));
    expect(by.vat).toBe('2026-11-12');
    expect(by.annual).toBe('2027-07-31');
  });

  it('ingen momsrad utan momsregistrering eller vald period', () => {
    expect(keyDatesForSetup({ orgNr: '556036-0793', fiscalYear: '2026-01-01', vatRegistered: false, vatPeriod: 'quarterly' }, NOW).some(r => r.key === 'vat')).toBe(false);
    expect(keyDatesForSetup({ orgNr: '556036-0793', fiscalYear: '2026-01-01', vatRegistered: true, vatPeriod: '' }, NOW).some(r => r.key === 'vat')).toBe(false);
  });
});
