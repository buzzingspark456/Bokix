import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt';
import { KNOWN_SUPPLIERS } from './accountCategories';

// Samma vara ska ge samma konto oavsett butik: i varje butik som säljer allt
// möjligt och i en butik vi inte känner till.
const ITEMS = [
  ['Lenovo IdeaPad bärbar dator 15,6"', '5410'],
  ['Samsung 27" bildskärm', '5410'],
  ['Logitech trådlöst tangentbord', '5410'],
  ['HP skrivare DeskJet', '5410'],
  ['iPhone 15 128 GB', '5410'],
  ['Sony hörlurar WH-1000', '5410'],
  ['Batterier AA 8-pack', '5460'],
  ['USB-C kabel 2 m', '5460'],
  ['Laddare 20 W', '5460'],
  ['Förlängningssladd 5 m', '5460'],
  ['Kopieringspapper A4 500 ark', '6110'],
  ['Toner HP 305A', '6110'],
  ['Pärm A4 bred', '6110'],
  ['PlayStation 5 Slim', null],
  ['Nintendo Switch OLED', null],
  ['Xbox handkontroll', null],
];
const STORES = [...KNOWN_SUPPLIERS.filter(s => s.choices).map(s => s.name), 'Hörnbutiken AB'];
const receipt = (store, item) => `${store}
Storgatan 1, 111 22 Stockholm
Kvitto 4711
2026-05-26 14:02
${item} 499,00
Totalt 499,00
Moms 25% 99,80
Kort 499,00`;

describe.each(STORES.map(s => [s]))('%s', (store) => {
  it.each(ITEMS)('%s', (item, code) => {
    const r = parseReceiptText(receipt(store, item));
    if (code) {
      expect(r.accountCode).toBe(code);
      expect(r.accountGuessed).toBe(false);
    } else {
      expect(r.accountGuessed).toBe(true);
    }
  });
});

describe('vanliga fakturor och kvitton ändras inte av varulistan', () => {
  it.each([
    ['Telia Sverige AB\nFaktura\nMobiltelefoni abonnemang 299,00\nAtt betala 299,00\nMoms 25% 59,80', '6212'],
    ['Konsultbolaget AB\nFaktura\nKonsultarvode april 10 000,00\nAtt betala 12 500,00\nMoms 25% 2 500,00', '6550'],
    ['Circle K\nBensin 95 600,00\nTotalt 600,00\nMoms 25% 120,00', '5611'],
    ['Adobe Systems\nInvoice\nCreative Cloud licens 659,00\nTotal 659,00', '5420'],
  ])('%s', (text, code) => {
    expect(parseReceiptText(text).accountCode).toBe(code);
  });
});

// Riktiga dokument ur användarens egen bokföring (2026-11-03), utan e-post.
describe('riktiga fakturor', () => {
  it('säljaren, inte köparen under FAKTURERAS TILL, är leverantör', () => {
    const r = parseReceiptText(`UTKAST: inte en giltig faktura
Sandlådan Konsult
FAKTURA
F-2026004
FAKTURAINFORMATION
Fakturadatum: 2026-08-12
Förfallodatum: 2026-09-11
FAKTURERAS TILL
Björk & Partner AB
Storgatan 10
111 44 Stockholm
Org.nr: 5566778899
Systemunderhåll april 2026 16 tim 500,00 SEK 8 000,00 SEK
Delsumma: 8 000,00 SEK
Moms 25%: 2 000,00 SEK
Att betala: 10 000,00 SEK
Bankgiro: 991-2346
Demovägen 1 · 111 22 Stockholm · Org.nr: 199001011234 · Godkänd för F-skatt`);
    expect(r.supplier).toBe('Sandlådan Konsult');
    expect(r.amount).toBe(10000);
  });

  it('en faktura på 0 dollar får inget påhittat belopp ur antalet', () => {
    const r = parseReceiptText(`INVOICE
Supabase Pte. Ltd.
65 Chulia Street
Bill to:
Exempel Org
Invoice number FOXCXA-00005
Invoice date May 4, 2026
Amount due $0.00
Description Quantity Rate Amount
Free Plan
1 $0.00 $0.00
Reverse charge: Customer to account for VAT/GST to their relevant authority
Subtotal $0.00
Amount due $0.00
1 of 1`);
    expect(r.supplier).toBe('Supabase');
    expect(r.amount).toBeNull();
  });
});

describe('momsen läses från kvittot, aldrig efter butik eller datum', () => {
  const COOP = (moms) => `Coop Konsum
Kvitto 8842
2026-10-12 17:05
Mjölk 18,90
Bröd 32,00
Kaffe 38,80
Totalt 89,70
${moms}
Kort 89,70`;
  it.each([
    ['tabell med alla satser, 25 först', 'Moms%  Moms  Netto  Brutto\n25,00  0,00  0,00  0,00\n12,00  0,00  0,00  0,00\n6,00  5,08  84,62  89,70'],
    ['suddiga siffror med O', 'Moms%  Moms  Netto  Brutto\n6,0O  5,O8  84,62  89,7O'],
    ['tabell utan rubrik', '6,00  5,08  84,62  89,70'],
    ['varav moms', 'Varav moms 6% 5,08'],
    ['bokstavskod', 'A 6% 5,08\nTotal moms 5,08'],
  ])('%s ger 6 %', (_, moms) => {
    const r = parseReceiptText(COOP(moms));
    expect(r.vatRate).toBe(6);
    expect(r.vatAmount).toBe(5.08);
    expect(r.vatRateGuessed).toBe(false);
  });

  it('utan läsbar moms gissas ingen sats i kvittovyn', async () => {
    const { buildReceiptPlan } = await import('./receiptScan');
    const r = parseReceiptText(COOP('M0ns ??'));
    const step = buildReceiptPlan({ parsed: r, registryName: '', supplierName: r.supplier, amountSek: r.amount }, { costAccount: '7690', vatRate: 25 }).find(s => s.key === 'vatRate');
    expect(step.state).toBe('missing');
    expect(step.patch.vatRate).toBe('');
  });

  it('ord som TOTAL och Org.nr ändras inte', async () => {
    const { fixDigitLetters } = await import('./ocrReceipt');
    expect(fixDigitLetters('TOTAL 1O0,00 Org.nr 2O26')).toBe('TOTAL 100,00 Org.nr 2026');
  });
});
