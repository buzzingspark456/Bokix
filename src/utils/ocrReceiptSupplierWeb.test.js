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
