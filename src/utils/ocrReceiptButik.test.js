import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt';

// Riktiga upplägg: kassakvitton från matbutiker säljer mer än mat, och
// listans 12 % får aldrig se avläst ut. Facit är räknat för hand.
describe('matbutik med annat än mat', () => {
  const LIDL = (rows) => `Lidl Sverige KB
Storgatan 1
Org.nr 556033-7528
2026-09-15 14:22
Byxor                199,00 B
${rows}
Kort                 199,00`;

  it('byxor på Lidl blir 25 %, inte 12 %, och får inget matförslag', () => {
    const r = parseReceiptText(LIDL('Totalt 199,00\nMoms% Moms Netto Brutto\nB 25% 39,80 159,20 199,00'));
    expect(r.supplier).toBe('Lidl');
    expect(r.amount).toBe(199);
    expect(r.vatRate).toBe(25);
    expect(r.vatAmount).toBe(39.8);
    expect(r.vatRateGuessed).toBe(false);
    expect(r.accountCode).toBe('5480');
    expect(r.accountChoices).toBeNull();
  });

  it('en momsrad med sats går före listans 12 %, även utan läsbart momsbelopp', () => {
    const r = parseReceiptText(LIDL('Totalt 199,00\nMoms 25%'));
    expect(r.vatRate).toBe(25);
    expect(r.vatRateGuessed).toBe(false);
  });

  it('utan moms på kvittot är listans sats en gissning, aldrig avläst', () => {
    const r = parseReceiptText(LIDL('Totalt 199,00'));
    expect(r.vatRateGuessed).toBe(true);
  });

  it('mat och kläder på samma kvitto är flera satser och behåller matförslagen', () => {
    const r = parseReceiptText(`Lidl Sverige KB
2026-09-15 14:22
Mjölk 11,20 A
Byxor 199,00 B
Totalt 210,20
Moms% Moms Netto Brutto
A 12% 1,20 10,00 11,20
B 25% 39,80 159,20 199,00`);
    expect(r.amount).toBe(210.2);
    expect(r.vatRates).not.toBeNull();
    expect(r.vatAmount).toBe(41);
  });

  it('vanlig mat på ICA är fortfarande 12 % med matförslag', () => {
    const r = parseReceiptText(`ICA Supermarket Solna
2026-09-15 10:00
Mjölk 22,40
Totalt 22,40
Moms 12% 2,40`);
    expect(r.vatRate).toBe(12);
    expect(r.vatRateGuessed).toBe(false);
    expect(r.accountChoices).not.toBeNull();
  });
});

describe('felläst totalsumma', () => {
  it('899.00 utan punkt ser aldrig avläst ut', () => {
    const r = parseReceiptText(`Elgiganten
Kvitto
Totalt inkl. moms 89900
Card 89900`);
    expect(r.amountGuessed).toBe(true);
  });
});

describe('Elgiganten-kvitto med momstabell', () => {
  const ELGIGANTEN = `ELGIGANTEN
Kvitto
Elgiganten Skellefteå
Varugatan 6
93176 Skellefteå
Ordernummer: 2026-05-26 18:34
2302039269 SMILLA
Take now
26th May 2026
220282 25% 899.00
PlayStation 5 (PS5) DualSense trådlös kontroll (vit)
Totalt inkl. moms 899.00
Card 899.00
Betald summa 899.00
Återstår att betala 0.00
Moms Belopp Moms Totalt
25% 719.20 179.80 899.00
Sum 719.20 179.80 899.00`;

  it('läser belopp, moms, datum och leverantör', () => {
    const r = parseReceiptText(ELGIGANTEN);
    expect(r.supplier).toBe('Elgiganten');
    expect(r.amount).toBe(899);
    expect(r.vatRate).toBe(25);
    expect(r.vatAmount).toBe(179.8);
    expect(r.date).toBe('2026-05-26');
  });
});
