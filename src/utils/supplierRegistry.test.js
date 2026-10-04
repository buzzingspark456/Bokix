import { describe, it, expect } from 'vitest';
import { sellerTaxIds, prettifyCompanyName } from './supplierRegistry';

describe('sellerTaxIds', () => {
  it('hittar säljarens momsnummer men inte köparens', () => {
    const text = [
      'Stripe Payments Europe, Limited',
      'VAT IE3206488LH',
      'Bill to',
      'Exempel AB',
      'VAT SE556677889901',
    ].join('\n');
    expect(sellerTaxIds(text)).toEqual(['IE3206488LH']);
  });

  it('svenskt organisationsnummer blir momsnummer', () => {
    expect(sellerTaxIds('Telia Sverige AB\nOrg.nr 556430-0142')).toEqual(['SE556430014201']);
    expect(sellerTaxIds('Momsreg.nr SE 5564 3001 4201')).toEqual(['SE556430014201']);
  });

  it('räknar aldrig företagets eget nummer', () => {
    expect(sellerTaxIds('Org.nr 556677-8899\nVAT SE556677889901', { orgNr: '556677-8899' })).toEqual([]);
  });

  it('tar inte vanliga tal för momsnummer', () => {
    expect(sellerTaxIds('Kassa 3 Kvitto 4471\nTotalt 842,00\nSE 25 %')).toEqual([]);
  });
});

describe('prettifyCompanyName', () => {
  it('versaler blir läsbara', () => {
    expect(prettifyCompanyName('STRIPE PAYMENTS EUROPE LIMITED')).toBe('Stripe Payments Europe Limited');
    expect(prettifyCompanyName('TELIA SVERIGE AB')).toBe('Telia Sverige AB');
    expect(prettifyCompanyName('ELGIGANTEN AKTIEBOLAG')).toBe('Elgiganten Aktiebolag');
  });
  it('ett namn med små bokstäver lämnas som det är', () => {
    expect(prettifyCompanyName('Clas Ohlson AB')).toBe('Clas Ohlson AB');
  });
});
