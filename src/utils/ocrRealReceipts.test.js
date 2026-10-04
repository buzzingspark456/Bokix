import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseReceiptText, estimateSkewFromGray, chainFromFingerprint } from './ocrReceipt.js';

// Riktiga kvitton som användaren skickade 2026-10-04, lästa av vår egen
// avläsning (två läsningar per kvitto). Facit är läst för hand ur bilderna.
// Textfilerna är Tesseracts faktiska utdata, så testerna prövar tolkningen
// mot riktiga läsfel och inte mot en städad text.
const today = new Date('2026-10-04');
const read = (name) => parseReceiptText(fs.readFileSync(new URL(`./__fixtures__/kvitto-${name}.txt`, import.meta.url), 'utf8'), { today });

describe('riktiga kvitton', () => {
  it('ICA Supermarket Forshaga (digitalt kvitto, två momssatser)', () => {
    const r = read('r3');
    expect(r.supplier).toBe('ICA');
    expect(r.date).toBe('2022-10-08');
    expect(r.receiptNumber).toBe('5412');
    expect(r.amount).toBe(123.9);
    expect(r.vatRates).toEqual([25, 12]);
    expect(r.vatAmount).toBe(20.71);
    expect(r.paymentMethod).toBe('card');
  });
  it('IKEA Älmhult, betalt kontant (Tax invoice är inte en obetald faktura)', () => {
    for (const name of ['r4', 'r10']) {
      const r = read(name);
      expect(r.supplier).toBe('IKEA');
      expect(r.date).toBe('2018-03-26');
      expect(r.amount).toBe(599);
      expect(r.paymentMethod).toBe('cash');
    }
  });
  it('Willys utan logga: kedjan känns igen på Willys Plus', () => {
    const r = read('r5');
    expect(r.supplier).toBe('Willys');
    expect(r.amount).toBe(493.37);
  });
  it('Willys med öresavrundning: totalen efter avrundningen', () => {
    expect(read('r8').amount).toBe(261.5);
  });
  it('ICA Supermarket Skurup', () => {
    const r = read('r9');
    expect(r.supplier).toBe('ICA');
    expect(r.date).toBe('2026-01-30');
    expect(r.amount).toBe(67);
    expect(r.vatRate).toBe(12);
    expect(r.vatAmount).toBe(7.18);
    expect(r.paymentMethod).toBe('card');
  });
  it('Harvey Norman i Malaysia: ringgit, datum DD.MM.YY', () => {
    const r = read('r11');
    expect(r.supplier).toMatch(/^Harvey Norman/);
    expect(r.date).toBe('2018-02-11');
    expect(r.amount).toBe(60);
    expect(r.currency).toBe('MYR');
  });
});

describe('kedjans kännetecken', () => {
  it.each([
    ['Bonusgrundande belopp: 575,41', 'ICA'],
    ['gupermarke', 'ICA'],
    ['Poänggrundande belopp detta köp', 'Coop'],
    ['Med Willys Plus har du sparat', 'Willys'],
    ['Tack för besöket', null],
  ])('%s → %s', (text, chain) => expect(chainFromFingerprint(text)).toBe(chain));
});

describe('lutning', () => {
  const lines = (deg) => {
    const w = 300, h = 300; const g = new Float32Array(w * h).fill(235);
    const a = deg * Math.PI / 180;
    for (let row = 40; row < 260; row += 18) {
      for (let x = 40; x < 260; x++) {
        if (x % 7 < 3) continue; // ord med mellanrum
        const y = Math.round(row + (x - 150) * Math.tan(a));
        for (let t = 0; t < 3; t++) if (y + t >= 0 && y + t < h) g[(y + t) * w + x] = 30;
      }
    }
    return [g, w, h];
  };
  it('hittar 12° lutning', () => expect(Math.abs(estimateSkewFromGray(...lines(12)) - 12)).toBeLessThan(1.5));
  it('rak text ger 0', () => expect(estimateSkewFromGray(...lines(0))).toBe(0));
});

describe('riktiga fakturor', () => {
  it('faktura med etiketter i en rad och värden under, grå brödtext, "Belopp utan moms"', () => {
    const r = parseReceiptText(fs.readFileSync(new URL('./__fixtures__/faktura-i20.txt', import.meta.url), 'utf8'), { today });
    expect(r.supplier).toBe('Exempelföretag Ab');
    expect(r.receiptNumber).toBe('1234');
    expect(r.date).toBe('2020-10-25');
    expect(r.amount).toBe(1620);
    expect(r.vatAmount).toBe(270);
    expect(r.paymentMethod).toBe('invoice');
  });
  it('fakturamall med Totalt och Moms(25.00%)', () => {
    const r = parseReceiptText(fs.readFileSync(new URL('./__fixtures__/faktura-i22.txt', import.meta.url), 'utf8'), { today });
    expect(r.date).toBe('2020-08-18');
    expect(r.amount).toBe(4869.38);
    expect(r.vatAmount).toBe(973.88);
  });
});

// Regler från provkörningen mot SROIE (973 inskannade kvitton med facit,
// ICDAR 2019) — 41 av dem lästes; texterna ingår inte i repot.
describe('regler från provkörningen mot främmande kvitton', () => {
  const p = (lines) => parseReceiptText(lines.join('\n'), { today });
  it('"Total QTY: 4" är ett antal, inte totalen', () => {
    expect(p(['SWEET FOREST CAFE', 'Date: 14/02/2018', 'Total QTY: 4', 'Total (Inclusive of GST): 30.30', 'CASH : 50.00', 'CHANGE : 19.70']).amount).toBe(30.3);
  });
  it('"Total Payable" vinner över andra rader som heter Total', () => {
    expect(p(['GARDENIA BAKERIES (KL) SDN BHD', 'Total 0% supplies: 39.01', 'Total Payable: 20.21']).amount).toBe(20.21);
  });
  it('kontanter minus växel rättar en felläst total (89,00 → 99,00)', () => {
    const r = p(['ASO ELECTRICAL TRADING SDN BHD', 'Total : 89.00', 'CASH : 100.00', 'Change : 1.00']);
    expect(r.amount).toBe(99);
    expect(r.amountVerified).toBe(true);
  });
  it('namnet med bolagsform vinner över ort och rubrik', () => {
    expect(p(['tan woon yann', 'BOOK TA .K (TAMAN DAYA) SDN BHD', '78941 7-W', 'NO.53, JALAN SAGU 18,', 'TAMAN DAYA,', '81100 JOHOR BAHRU,', 'JOHOR', 'TAX INVOICE', 'Total 9.00']).supplier).toMatch(/SDN BHD$/);
  });
  it('"20-01-16" är 20 januari 2016 utomlands men 2020-01-16 på ett svenskt kvitto', () => {
    expect(p(['SHOP SDN BHD', '20-01-16 11:49', 'Total 57.40']).date).toBe('2016-01-20');
    expect(p(['Butik AB', '20-01-16 11:49', 'Totalt 57,40', 'Moms 25% 11,48']).date).toBe('2020-01-16');
  });
});
