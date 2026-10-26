import { describe, it, expect } from 'vitest';
import { parseReceiptText, supplierFromWeb } from './ocrReceipt.js';

// Leverantören när logotypen inte går att läsa: e-post- och webbadresser,
// och att en kort träff i listan (SJ) inte får vinna över dem.
describe('leverantör ur e-post och webbadress', () => {
  it('Stripes logotyp läst som SJ blir Stripe, utan tågresans moms', () => {
    const text = [
      'SJ',
      'Invoice',
      'Invoice number 8F2A1C3D-0001',
      'Date of issue October 1, 2026',
      'Bill to',
      'Exempel AB',
      'kund@exempel.se',
      'Description Qty Unit price Amount',
      'Stripe Billing 1 €20.00 €20.00',
      'Total €20.00',
      'Amount due €20.00',
      'Questions? Contact support@stripe.com',
    ].join('\n');
    const r = parseReceiptText(text);
    expect(r.supplier).toBe('Stripe');
    expect(r.vatRate).not.toBe(6);
  });

  it('SJ:s egen biljett förblir SJ', () => {
    const text = [
      'SJ',
      'Kvitto',
      'Stockholm C - Göteborg C',
      '2026-09-12',
      'Totalt 495,00 kr',
      'Varav moms 6% 28,02',
      'www.sj.se',
    ].join('\n');
    expect(parseReceiptText(text).supplier).toBe('SJ');
  });

  it('köparens e-post räknas inte', () => {
    expect(supplierFromWeb(['Säljaren AB', 'hej@saljaren.se', 'Fakturanummer 12', 'Faktura till', 'Kunden AB', 'info@kunden.se', 'info@kunden.se'])).toBe('Saljaren');
  });

  it('e-postleverantörer och betaltjänster räknas inte', () => {
    expect(supplierFromWeb(['kontakt: minbutik@gmail.com', 'Betala med Klarna: www.klarna.com'])).toBe(null);
  });

  it('tål mellanslag kring punkterna', () => {
    expect(supplierFromWeb(['www. vercel .com'])).toBe('Vercel');
  });

  it('en faktura utan läsbar logotyp får namnet ur adressen', () => {
    const text = [
      '~~ %',
      'INVOICE',
      'Invoice number 0042',
      'Date 2026-09-30',
      'Pro plan 1 $20.00',
      'Total $20.00',
      'billing@vercel.com',
    ].join('\n');
    expect(parseReceiptText(text).supplier).toBe('Vercel');
  });

  it('ett vanligt kvitto behåller butikens namn när adressen stämmer', () => {
    const text = [
      'Café Harlem',
      'Storgatan 1',
      '111 22 Stockholm',
      '2026-09-30 12:14',
      'Kaffe 35,00',
      'Totalt 35,00',
      'Moms 12% 3,75',
      'www.harlem.se',
    ].join('\n');
    expect(parseReceiptText(text).supplier).toBe('Café Harlem');
  });
});

describe('betalkvitton med "Receipt from …"', () => {
  const stripeReceipt = [
    'Receipt from Stripe',
    'Receipt #2104-3381',
    'AMOUNT PAID',
    'SEK 1 250,00',
    'DATE PAID',
    'Oct 20, 2026',
    'PAYMENT METHOD',
    'Visa - 4242',
    'SUMMARY',
    'Stripe Billing Starter x 1 SEK 1 000,00',
    'VAT (25%) SEK 250,00',
    'Amount paid SEK 1 250,00',
    'If you have any questions, contact us at support@stripe.com',
  ].join('\n');

  it('säljaren står i rubriken och är säker när e-postadressen säger samma sak', () => {
    const r = parseReceiptText(stripeReceipt);
    expect(r.supplier).toBe('Stripe');
    expect(r.supplierConfirmed).toBe(true);
    expect(r.amount).toBe(1250);
    expect(r.vatRate).toBe(25);
  });

  it('rubriker som Amount paid och Payment method blir aldrig leverantör', () => {
    const text = stripeReceipt.replace('Receipt from Stripe\n', '').replace('support@stripe.com', 'oss');
    expect(String(parseReceiptText(text).supplier || '')).not.toMatch(/amount|payment|date paid|summary/i);
  });

  it('"Kvitto från" på svenska fungerar likadant, men utan adress är det bara ett förslag', () => {
    const r = parseReceiptText(['Kvitto från Hemmafixarna', 'Datum 2026-10-20', 'Totalt 500,00 kr', 'Moms 25 % 100,00'].join('\n'));
    expect(r.supplier).toBe('Hemmafixarna');
    expect(r.supplierConfirmed).toBe(false);
  });
});
