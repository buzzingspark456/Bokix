import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt';
import { KNOWN_SUPPLIERS } from './accountCategories';

// Varje svensk butik i listan, varje momssats och flera kvittoformat. Det som
// står på kvittot ska alltid vinna över vad butiken brukar ta. Beloppen är
// räknade för hand: moms = brutto × sats / (100 + sats).
const CASES = [
  { rate: 25, gross: 1250, vat: 250, net: 1000 },
  { rate: 12, gross: 112, vat: 12, net: 100 },
  { rate: 6, gross: 530, vat: 30, net: 500 },
];
const money = (n) => n.toFixed(2).replace('.', ',');

const FORMATS = {
  'momsrad med sats': ({ rate, gross, vat }) => `Totalt ${money(gross)}\nMoms ${rate}% ${money(vat)}`,
  'momstabell med sats': ({ rate, gross, vat, net }) => `Totalt ${money(gross)}\nMoms% Moms Netto Brutto\n${rate}% ${money(vat)} ${money(net)} ${money(gross)}`,
  'tabell utan procenttecken': ({ rate, gross, vat, net }) => `Att betala ${money(gross)} kr\nSats Moms Netto Brutto\n${rate},00 ${money(vat)} ${money(net)} ${money(gross)}`,
  'varav moms': ({ gross, vat }) => `Summa ${money(gross)} kr\nVarav moms ${money(vat)} kr`,
  'punkt som decimal': ({ rate, gross, vat }) => `TOTAL SEK ${gross.toFixed(2)}\nMOMS ${rate}% ${vat.toFixed(2)}`,
};

const CHAINS = KNOWN_SUPPLIERS.filter(s => s.vat > 0);

describe.each(CHAINS.map(s => [s.name]))('%s', (name) => {
  const header = `${name}\nStorgatan 12\n111 22 Stockholm\nOrg.nr 556036-0793\nKvitto 48213\n2026-03-14 12:31`;
  for (const [format, build] of Object.entries(FORMATS)) {
    for (const c of CASES) {
      it(`${format}, ${c.rate} %`, () => {
        const r = parseReceiptText(`${header}\nVara ${money(c.gross)}\n${build(c)}\nKort ${money(c.gross)}`);
        expect(r.supplier).toBe(name);
        expect(r.amount).toBe(c.gross);
        expect(r.vatRate).toBe(c.rate);
        expect(r.vatAmount).toBe(c.vat);
        expect(r.vatRateGuessed).toBe(false);
        expect(r.date).toBe('2026-03-14');
        expect(r.receiptNumber).toBe('48213');
      });
    }
  }
});

describe('blandade satser i alla butiker', () => {
  it.each(CHAINS.map(s => [s.name]))('%s', (name) => {
    const r = parseReceiptText(`${name}
2026-03-14 12:31
Totalt 650,00
Moms% Moms Netto Brutto
12% 12,00 100,00 112,00
25% 107,60 430,40 538,00`);
    expect(r.amount).toBe(650);
    expect(r.vatAmount).toBe(119.6);
    expect(r.vatRates).not.toBeNull();
  });
});
