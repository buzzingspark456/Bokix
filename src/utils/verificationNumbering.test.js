import { describe, it, expect } from 'vitest';
import { VERIFICATION_SERIES, seriesForSource, seriesName, getMaxUsedNumber, getNextNumber, seriesOfVerification } from './verificationNumbering.js';

describe('verifikationsserier', () => {
  it('har serierna A–E, H, I, K, L, M', () => {
    expect(VERIFICATION_SERIES).toEqual(['A', 'B', 'C', 'D', 'E', 'H', 'I', 'K', 'L', 'M']);
  });

  it('lägger varje sorts bokning i sin serie, och allt annat i A', () => {
    expect(seriesForSource('invoice')).toBe('B');
    expect(seriesForSource('invoice_payment')).toBe('C');
    expect(seriesForSource('supplier_invoice')).toBe('D');
    expect(seriesForSource('supplier_invoice_payment')).toBe('E');
    expect(seriesForSource('accrual')).toBe('H');
    expect(seriesForSource('year_end_close')).toBe('I');
    expect(seriesForSource('payroll')).toBe('K');
    expect(seriesForSource('zettle_ledger')).toBe('L');
    expect(seriesForSource('vat_declaration')).toBe('M');
    expect(seriesForSource('expense')).toBe('A');
    expect(seriesForSource(undefined)).toBe('A');
  });

  it('använder företagets egna namn före standardnamnet', () => {
    expect(seriesName('B')).toBe('Kundfakturor');
    expect(seriesName('B', { verificationSeriesNames: { B: 'Försäljning' } })).toBe('Försäljning');
    expect(seriesName('B', { verificationSeriesNames: { B: '  ' } })).toBe('Kundfakturor');
  });
});

describe('numrering', () => {
  const vers = [{ number: 'A001' }, { number: 'A007' }, { number: 'B002' }, { number: 'V12' }, { number: 'AB5' }];

  it('räknar varje serie för sig och bryr sig inte om gamla V-nummer', () => {
    expect(getMaxUsedNumber(vers, 'A')).toBe(7);
    expect(getMaxUsedNumber(vers, 'B')).toBe(2);
    expect(getMaxUsedNumber(vers, 'C')).toBe(0);
    expect(getNextNumber(vers, 'A')).toBe('A008');
    expect(getNextNumber(vers, 'C')).toBe('C001');
  });

  it('följer ett golv som är högre än senaste numret', () => {
    expect(getNextNumber(vers, 'A', 50)).toBe('A050');
    expect(getNextNumber(vers, 'A', 3)).toBe('A008');
  });

  it('hittar serien för sparade verifikat', () => {
    expect(seriesOfVerification({ series: 'D', number: 'D004' })).toBe('D');
    expect(seriesOfVerification({ number: 'V12' })).toBe('V');
    expect(seriesOfVerification({ number: 'B3' })).toBe('B');
    expect(seriesOfVerification({})).toBe('A');
  });
});
