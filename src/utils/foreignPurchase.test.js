import { describe, it, expect } from 'vitest';
import { detectForeignPurchase, parseReceiptText } from './ocrReceipt';

const googleEu = `Google Ireland Limited
Gordon House, Barrow Street, Dublin 4, Ireland
VAT ID: IE6388047V
Faktura 5031234567
Datum 2026-08-10
Google Workspace subscription
Totalt SEK 1 000,00
Reverse charge`;

const vercelUs = `Vercel Inc.
440 N Barranca Ave, Covina, CA 91723
United States
Invoice 12345
Date 2026-08-11
Pro plan subscription
Total SEK 250,00`;

describe('köp av tjänster från utlandet', () => {
  it('EU: säljaren anger ett momsnummer med annat EU-lands landskod', () => {
    const f = detectForeignPurchase(googleEu, { knownService: true });
    expect(f).toMatchObject({ foreign: true, region: 'eu', unclear: false });
    expect(f.evidence).toContain('IE6388047V');
  });

  it('utanför EU: adress i USA och inget EU- eller svenskt momsnummer', () => {
    expect(detectForeignPurchase(vercelUs, { knownService: true })).toMatchObject({ foreign: true, region: 'nonEu', unclear: false });
  });

  it('svenskt momsnummer betyder inte utlandet', () => {
    const swedish = 'Telia Sverige AB\nVAT SE556430010501\nMobilabonnemang subscription\nTotalt 399,00';
    expect(detectForeignPurchase(swedish)).toMatchObject({ foreign: false, region: null });
  });

  it('en vara från EU är inte omvänd skattskyldighet för tjänst, det avgör användaren', () => {
    const goods = 'Amazon EU S.a.r.l\nVAT LU20260743\nOrder shipped\nTracking number 123\nTotal 500,00';
    expect(detectForeignPurchase(goods)).toMatchObject({ foreign: true, region: null, unclear: true });
  });

  it('ett känt utländskt program utan uppgift om land lämnas åt användaren', () => {
    expect(detectForeignPurchase('GitHub\nInvoice\nTeam plan\nTotal 4.00', { knownService: true })).toMatchObject({ foreign: true, region: null, unclear: true });
  });

  it('vanliga svenska kvitton påverkas inte', () => {
    expect(detectForeignPurchase('Kvitto\nCircle K\nDiesel 500,00\nTotalt 500,00')).toMatchObject({ foreign: false });
  });
});

describe('parseReceiptText med tjänst från utlandet', () => {
  it('EU-tjänst ger konto 4535, ingen svensk moms och en säker avläsning', () => {
    const p = parseReceiptText(googleEu);
    expect(p.accountCode).toBe('4535');
    expect(p.accountGuessed).toBe(false);
    expect(p.vatRate).toBe(0);
    expect(p.reverseCharge).toMatchObject({ region: 'eu' });
  });

  it('tjänst från USA ger konto 4531', () => {
    const p = parseReceiptText(vercelUs);
    expect(p.accountCode).toBe('4531');
    expect(p.reverseCharge).toMatchObject({ region: 'nonEu' });
  });

  it('utan tydligt land markeras kontot som något att kontrollera', () => {
    const p = parseReceiptText('GitHub\nInvoice 99\nDate 2026-08-11\nTeam plan\nTotalt SEK 40,00');
    expect(p.reverseCharge).toBeNull();
    expect(p.reverseChargeUnclear).toBe(true);
    expect(p.accountGuessed).toBe(true);
  });

  it('ett svenskt kvitto får ingen omvänd moms', () => {
    const p = parseReceiptText('Kvitto\nWillys\n2026-08-10\nMat 200,00\nTotalt 200,00\nMoms 12%: 21,43');
    expect(p.reverseCharge).toBeNull();
    expect(p.reverseChargeUnclear).toBe(false);
  });
});
