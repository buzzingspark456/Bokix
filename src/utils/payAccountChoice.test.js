import { describe, it, expect } from 'vitest';
import { decidePayAccount } from './payAccountChoice';
import { detectPaymentMethod, parseReceiptText } from './ocrReceipt';
import { historyFromVerifications } from './receiptHistory';

const accounts = [
  { code: '1910', name: 'Kassa', active: true },
  { code: '1930', name: 'Företagskonto', active: true },
  { code: '1940', name: 'Sparkonto', active: true },
  { code: '2440', name: 'Leverantörsskulder', active: true },
];

describe('detectPaymentMethod', () => {
  it('läser en uttrycklig betalningsrad före lösa ord', () => {
    expect(detectPaymentMethod('Card 899.00\nBetalningssätt: Swish')).toEqual({ method: 'swish', explicit: true });
  });
  it('känner igen kort, kontant och Swish', () => {
    expect(detectPaymentMethod('Korttyp: Visa Debit\nTotalt 100').method).toBe('card');
    expect(detectPaymentMethod('Kontant 100,00\nVäxel 0,00').method).toBe('cash');
    expect(detectPaymentMethod('Betalt med Swish').method).toBe('swish');
  });
  it('räknar en faktura utan betalrad som obetald', () => {
    expect(detectPaymentMethod('Faktura 123\nFörfallodatum 2026-10-01\nBetala med kort på vår sida', { isInvoice: true }).method).toBe('invoice');
  });
  it('ger null när inget säger hur det betalades', () => {
    expect(detectPaymentMethod('Kaffe 40,00\nTotalt 40,00').method).toBeNull();
    expect(detectPaymentMethod('').method).toBeNull();
  });
  it('följer med ur parseReceiptText', () => {
    const parsed = parseReceiptText('Kvitto\nCircle K\n2026-05-01\nDiesel 500,00\nTotalt SEK 500,00\nMoms 25%: 100,00\nKortbetalning');
    expect(parsed.paymentMethod).toBe('card');
  });
});

describe('decidePayAccount', () => {
  it('historiken vinner över allt annat', () => {
    expect(decidePayAccount({ history: { payAccount: '1940' }, paymentMethod: 'cash', accounts })).toMatchObject({ code: '1940', state: 'history' });
  });
  it('kort och Swish blir bankkontot, säkert avläst', () => {
    expect(decidePayAccount({ paymentMethod: 'card', accounts })).toMatchObject({ code: '1930', state: 'found' });
    expect(decidePayAccount({ paymentMethod: 'swish', accounts })).toMatchObject({ code: '1930', state: 'found' });
  });
  it('kontant blir kassan, och obetald faktura blir leverantörsskulder', () => {
    expect(decidePayAccount({ paymentMethod: 'cash', accounts })).toMatchObject({ code: '1910', state: 'found' });
    expect(decidePayAccount({ paymentMethod: 'invoice', accounts })).toMatchObject({ code: '2440', state: 'found' });
  });
  it('är en gissning bara när inget säger något', () => {
    expect(decidePayAccount({ paymentMethod: null, accounts })).toMatchObject({ code: '1930', state: 'guess' });
    expect(decidePayAccount({ paymentMethod: 'cash', accounts: accounts.filter(a => a.code !== '1910') })).toMatchObject({ state: 'guess' });
  });
});

describe('historik för betalkonto', () => {
  const ver = (pay) => ({ status: 'booked', date: '2026-05-01', description: 'Circle K', rows: [
    { account: '5611', debet: 400, kredit: 0 }, { account: '2641', debet: 100, kredit: 0 }, { account: pay, debet: 0, kredit: 500 },
  ] });
  it('tar betalkontot som användes oftast förut', () => {
    expect(historyFromVerifications([ver('1930'), ver('1940'), ver('1940')], 'Circle K').payAccount).toBe('1940');
  });
});
