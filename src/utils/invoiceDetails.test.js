import { describe, it, expect } from 'vitest';
import { luhnOk, readInvoiceDetails } from './invoiceDetails';
import { analyzeReceipt, bookingPreview } from './receiptScan';

const SANDLADAN = `Sandlådan Konsult
FAKTURA
F-2026004
FAKTURAINFORMATION FAKTURERAS TILL
Fakturadatum: 2026-08-12
Förfallodatum: 2026-09-11 Björk & Partner AB
Storgatan 10
111 44 Stockholm
Org.nr: 5566778899
VAT: SE556677889901
Att betala: 10 000,00 SEK
Bankgiro: 991-2346
IBAN: SE3550000000054910000003
Förfallodatum: 2026-09-11
Fakturanummer: F-2026004
OCR/Referens: 20260048
Demovägen 1 · 111 22 Stockholm · Org.nr: 199001011234 · Momsreg.nr: SE199001011234 · Godkänd för F-skatt`;

describe('luhnOk', () => {
  it('stämmer för giltiga nummer och inte för en felläst siffra', () => {
    expect(luhnOk('991-2346')).toBe(true);
    expect(luhnOk('20260048')).toBe(true);
    expect(luhnOk('556036-0793')).toBe(true);
    expect(luhnOk('991-2347')).toBe(false);
    expect(luhnOk('')).toBe(false);
  });
});

describe('readInvoiceDetails', () => {
  it('läser hela fakturan och tar säljarens org.nr, inte köparens', () => {
    const d = readInvoiceDetails(SANDLADAN, { invoiceDate: '2026-08-12' });
    expect(d.orgNr).toBe('900101-1234');
    expect(d.dueDate).toBe('2026-09-11');
    expect(d.ocrNumber).toBe('20260048');
    expect(d.ocrNumberGuessed).toBe(false);
    expect(d.bankgiro).toBe('991-2346');
    expect(d.bankgiroGuessed).toBe(false);
  });

  it('hoppar över företagets eget nummer', () => {
    const text = 'Org.nr 556036-0793\nOrg.nr 559000-0007 · Godkänd för F-skatt';
    expect(readInvoiceDetails(text, { own: { orgNr: '559000-0007' } }).orgNr).toBe('556036-0793');
  });

  it('gissar aldrig köparens nummer när säljarens saknas', () => {
    expect(readInvoiceDetails('Fakturera till\nBeta AB\nOrg.nr 556036-0793')).toBeNull();
  });

  it('läser värden som står på raden under rubriken', () => {
    const d = readInvoiceDetails('Fakturadatum Förfallodatum\n2026-03-01 2026-03-31\nOCR-nummer\n12345682\nBankgiro\n5050-1055\nPlusgiro\n123456-7');
    expect(d.dueDate).toBe('2026-03-31');
    expect(d.ocrNumber).toBe('12345682');
    expect(d.bankgiro).toBe('5050-1055');
    expect(d.plusgiro).toBe('123456-7');
  });

  it('märker ett nummer vars kontrollsiffra inte stämmer', () => {
    const d = readInvoiceDetails('Bankgiro 991-2347\nOCR 20260049');
    expect(d.bankgiroGuessed).toBe(true);
    expect(d.ocrNumberGuessed).toBe(true);
  });

  it('godtar inte ett förfallodatum före fakturadatumet', () => {
    expect(readInvoiceDetails('Förfallodatum 2026-01-01\nBG 991-2346', { invoiceDate: '2026-02-01' }).dueDate).toBeNull();
  });

  it('läser vanliga skrivsätt', () => {
    expect(readInvoiceDetails('Sista betalningsdag 31.03.2026').dueDate).toBe('2026-03-31');
    expect(readInvoiceDetails('Betalas senast 2026/03/31').dueDate).toBe('2026-03-31');
    expect(readInvoiceDetails('Due date: 20260331').dueDate).toBe('2026-03-31');
    expect(readInvoiceDetails('BG: 991 2346').bankgiro).toBe('991-2346');
    expect(readInvoiceDetails('Betalningsreferens: 1234 5682').ocrNumber).toBe('12345682');
  });

  it('tar inte ett fakturanummer med bokstäver som OCR', () => {
    expect(readInvoiceDetails('Betalningsreferens: F-2026004')).toBeNull();
  });

  it('svarar null på ett vanligt butikskvitto', () => {
    expect(readInvoiceDetails('ICA Nära\nMjölk 15,90\nTotalt 15,90\nMoms 12% 1,70')).toBeNull();
  });
});

describe('fakturan genom hela tolkningen', () => {
  const read = (text) => analyzeReceipt({ text });
  const FAKTURA = `Sandlådan Konsult AB
FAKTURA
Fakturanummer: 1042
Fakturadatum: 2026-08-12
Förfallodatum: 2026-09-11
Konsultarvode
Delsumma: 8 000,00 kr
Moms 25%: 2 000,00 kr
Att betala: 10 000,00 kr
Bankgiro: 991-2346
OCR: 20260048
Org.nr: 556036-0793 · Godkänd för F-skatt`;

  it('räknar ut exkl. moms och läser betaluppgifterna', async () => {
    const a = await read(FAKTURA);
    expect(a.netAmount).toBe(8000);
    expect(a.details.bankgiro).toBe('991-2346');
    expect(a.readText).toContain('Sandlådan');
  });

  it('en faktura med förfallodatum blir en leverantörsskuld som går jämnt ut', async () => {
    const rows = bookingPreview(await read(FAKTURA), '6550');
    expect(rows).toEqual([
      { account: '6550', debit: 8000 },
      { account: '2641', debit: 2000 },
      { account: '2440', credit: 10000 },
    ]);
  });

  it('kostnadsraden står utan konto när inget konto är känt', async () => {
    expect(bookingPreview(await read(FAKTURA))[0].account).toBeNull();
  });

  it('visar ingen kontering för något som inte är ett kvitto', async () => {
    expect(bookingPreview(await read('Hej, här är mitt CV. Jag har jobbat i tio år.'))).toBeNull();
  });

});
