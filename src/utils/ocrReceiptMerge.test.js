import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseReceiptText, READING_SEPARATOR, repairDateDigits, detectPaymentMethod, repairNumberLabels, inkBoundsFromGray } from './ocrReceipt.js';

// Användarens Coop-kvitto (2026-10-04): ett vitt kvitto inskannat på en vit
// A4, logotypen bara grafik. Två riktiga avläsningar som var för sig har fel
// (2022-11-74, 193,78, "6716!") men tillsammans går ihop.
const coop = fs.readFileSync(new URL('./__fixtures__/coop-2022-11-14.txt', import.meta.url), 'utf8');
const today = new Date('2026-10-04');

describe('Coop-kvittot, två avläsningar vägda samman', () => {
  const r = parseReceiptText(coop, { confidence: 65, today });
  it('läser rätt fält', () => {
    expect(r.supplier).toBe('Coop');
    expect(r.amount).toBe(193.75);
    expect(r.amountVerified).toBe(true);
    expect(r.vatRate).toBe(12);
    expect(r.vatAmount).toBe(20.76);
    expect(r.vatVerified).toBe(true);
    expect(r.date).toBe('2022-11-14');
    expect(r.receiptNumber).toBe('96035-001-67161');
    expect(r.paymentMethod).toBe('card');
  });
  it('var och en av avläsningarna ensam är sämre', () => {
    const [a, b] = coop.split(READING_SEPARATOR);
    const ra = parseReceiptText(a, { today });
    const rb = parseReceiptText(b, { today });
    expect(ra.date === '2022-11-14' && rb.receiptNumber === '96035-001-67161').toBe(false);
  });
});

describe('felläst datum', () => {
  const base = ['ICA Nära', 'Totalt 100,00', 'Moms 12% 10,71'];
  it('ett omöjligt datum rättas när kortterminalens datum bekräftar det', () => {
    const r = parseReceiptText([base[0], 'Datum 2022-11-74 14:19', base[1], base[2], 'MASTERCARD 221114 141911'].join('\n'), { today: new Date('2022-11-20') });
    expect(r.date).toBe('2022-11-14');
    expect(r.dateGuessed).toBe(false);
  });
  it('utan bekräftelse används den vanligaste rättelsen, märkt Kontrollera', () => {
    const r = parseReceiptText([base[0], 'Datum 2022-11-74', base[1], base[2]].join('\n'), { today });
    expect(r.date).toBe('2022-11-14');
    expect(r.dateGuessed).toBe(true);
  });
  it('kortterminalens datum räcker när inget annat datum finns', () => {
    expect(parseReceiptText([...base, 'DEBIT MASTERCARD 221114 141911'].join('\n'), { today }).date).toBe('2022-11-14');
  });
  it('rättelserna sorteras med vanligaste förväxlingen först', () => {
    // 7 läst för 1 kommer före 7 läst för 2.
    const valid = repairDateDigits('1174').map(r => r.mmdd).filter(md => Number(md.slice(0, 2)) <= 12 && Number(md.slice(2)) <= 31);
    expect(valid[0]).toBe('1114');
  });
});

describe('enstaka regler', () => {
  it('org.-nummer och telefonnummer är aldrig belopp', () => {
    const r = parseReceiptText(['Kagerod', 'Tel 010-7416780', 'Org Nr: 738200-2850 SEK', 'Kvitto 1234', '2026-09-01', 'Smör 49,50'].join('\n'), { today });
    expect(r.amount === 2850 || r.amount === 7416780).toBe(false);
  });
  it('"ATT BETALA ( 10 ARTIKLAR ) 193,75" ger beloppet, inte antalet', () => {
    const r = parseReceiptText(['Butik AB', '2026-09-01', 'ATT BETALA ( 10 ARTIKLAR ) 193,75', 'Moms 12% 20,76'].join('\n'), { today });
    expect(r.amount).toBe(193.75);
  });
  it('kortterminalens rader betyder kortbetalning', () => {
    expect(detectPaymentMethod('Belopp SEK 193,75\n************8903\nAID A0000000041010').method).toBe('card');
    expect(detectPaymentMethod('KIRTKOP 193,75').method).toBe('card');
  });
  it('"Keittons 100234" läses som Kvittonr', () => {
    expect(repairNumberLabels(['Keittons 100234'])[0]).toBe('Kvittonr 100234');
    expect(repairNumberLabels(['Kycklingfilé 2 st'])[0]).toBe('Kycklingfilé 2 st');
  });
});

describe('textens yta i bilden', () => {
  it('hittar ett smalt kvitto mitt på en vit sida, utan fläcken i hörnet', () => {
    const w = 200, h = 300;
    const gray = new Float32Array(w * h).fill(240);
    for (let y = 30; y < 270; y += 6) for (let x = 80; x < 120; x++) if ((x + y) % 3) gray[y * w + x] = 20;
    gray[290 * w + 195] = 10;
    const b = inkBoundsFromGray(gray, w, h);
    expect(b.x0).toBeGreaterThan(0.3);
    expect(b.x1).toBeLessThan(0.7);
    expect(b.y0).toBeLessThan(0.12);
    expect(b.y1).toBeGreaterThan(0.85);
  });
});

// Datum skrivs på många sätt. Facit räknat för hand; idag = 2026-10-04.
describe('datumformat', () => {
  const read = (line, extra = []) => parseReceiptText(['Butik AB', ...extra, line, 'Totalt 100,00', 'Moms 25% 20,00'].join('\n'), { today }).date;
  it.each([
    ['2024-05-26', '2024-05-26'],
    ['Datum: 2024/05/26 14:32', '2024-05-26'],
    ['26.05.2024 14:32', '2024-05-26'],
    ['26-05-2024', '2024-05-26'],
    ['26/05/2024', '2024-05-26'],
    ['26 / 05 / 2024', '2024-05-26'],
    ['26.05.24 14:32', '2024-05-26'],
    ['26/5-24', '2024-05-26'],
    ['24-05-26 14:32', '2024-05-26'],
    ['Datum 20240526', '2024-05-26'],
    ['26 maj 2024', '2024-05-26'],
    ['Söndag 26 maj 2024', '2024-05-26'],
    ['26-May-2024', '2024-05-26'],
    ['26 MAY 24', '2024-05-26'],
    ['May 26, 2024', '2024-05-26'],
    ['May 26th, 2024', '2024-05-26'],
    ['26. Mai 2024', '2024-05-26'],
    ['26 september 2025', '2025-09-26'],
    ['26 sept. 2025', '2025-09-26'],
    ['2O24-O5-26', '2024-05-26'],
    ['26 rnaj 2024', '2024-05-26'],
  ])('%s', (line, want) => expect(read(line)).toBe(want));

  it('Elgiganten: "maj 2024" utan dag blir aldrig den första', () => {
    expect(read('Kampanjen gäller maj 2024')).toBe(null);
    expect(read('Datum 26-05-2024 14:32', ['Kampanjen gäller hela maj 2024'])).toBe('2024-05-26');
  });
  it('en datumetikett vinner över ett annat datum högre upp', () => {
    expect(read('Köpdatum: 2024-05-26', ['Öppet köp till 2024-06-25'])).toBe('2024-05-26');
  });
  it('förfallodatum är inte fakturadatum', () => {
    expect(read('Förfallodatum 2024-06-25', ['Fakturadatum 2024-05-26'])).toBe('2024-05-26');
  });
});
