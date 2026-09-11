import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt.js';

describe('parseReceiptText', () => {
  it('extraherar digital faktura från Supabase korrekt', () => {
    const text = `
      INVOICE
      Supabase Inc.
      Invoice Number: INV-2024-001
      Date: 2024-05-12
      Bill To: Mitt Bolag AB
      Description: Supabase Pro Plan
      Subtotal: $25.00
      Total: 193,75 SEK
      VAT: 0%
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-05-12');
    expect(result.amount).toBe(193.75);
    expect(result.vatRate).toBe(0);
    expect(result.supplier).toBe('Supabase');
    expect(result.accountCode).toBe('6540');
  });

  it('extraherar kvitto från ICA med 12% moms och konto 5010', () => {
    const text = `
      ICA Supermarket
      Org.nr: 556000-1234
      Datum: 2024-03-15
      Mjölk 18,50
      Bröd 32,90
      Kaffe 54,00
      Totalt SEK 105,40
      Varav moms 12%: 11,29
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-03-15');
    expect(result.amount).toBe(105.4);
    expect(result.vatRate).toBe(12);
    expect(result.supplier).toBe('ICA');
    expect(result.accountCode).toBe('5010');
  });

  it('extraherar bensin kvitto från Circle K med 25% moms och konto 5611', () => {
    const text = `
      CIRCLE K SVERIGE AB
      Station: Nacka
      2024-01-20 14:22
      Miles 95 Bensin
      Liter: 42,50  Pris/l: 21,19
      ATT BETALA SEK 900,58
      Moms 25%: 180,12
      KORT VISA **** 1234
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-01-20');
    expect(result.amount).toBe(900.58);
    expect(result.vatRate).toBe(25);
    expect(result.supplier).toBe('Circle K');
    expect(result.accountCode).toBe('5611');
  });

  it('extraherar SL-biljett med 6% moms och konto 5810', () => {
    const text = `
      SL Enkelbiljett
      Datum: 12/04/2024
      Pris: 42,00 kr
      Moms 6%: 2,38
      Totalt 42,00
    `;
    const result = parseReceiptText(text);
    expect(result.date).toBe('2024-04-12');
    expect(result.amount).toBe(42);
    expect(result.vatRate).toBe(6);
    expect(result.supplier).toBe('SL');
    expect(result.accountCode).toBe('5810');
  });

  it('hanterar tom eller ogiltig text utan att krascha', () => {
    const res1 = parseReceiptText('');
    expect(res1.date).toBeNull();
    expect(res1.amount).toBeNull();

    const res2 = parseReceiptText(null);
    expect(res2.date).toBeNull();
    expect(res2.amount).toBeNull();
  });
});
