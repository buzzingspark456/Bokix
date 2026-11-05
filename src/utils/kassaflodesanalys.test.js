import { describe, it, expect } from 'vitest';
import { computeCashflowStatement } from './reportCalculations';

const acc = (code, name, type) => ({ code, name, type });
const ACCOUNTS = [
  acc('1220', 'Inventarier', 'tillgang'), acc('1229', 'Ackumulerade avskrivningar på inventarier', 'tillgang'),
  acc('1510', 'Kundfordringar', 'tillgang'), acc('1930', 'Företagskonto', 'tillgang'),
  acc('2013', 'Övriga egna uttag', 'skuld_kapital'), acc('2350', 'Banklån', 'skuld_kapital'),
  acc('2440', 'Leverantörsskulder', 'skuld_kapital'), acc('2611', 'Utgående moms 25 %', 'skuld_kapital'),
  acc('3001', 'Försäljning', 'intakt'), acc('5010', 'Lokalhyra', 'kostnad'), acc('7832', 'Avskrivningar inventarier', 'kostnad'),
];
let n = 0;
const ver = (date, rows, extra = {}) => ({ id: `v${++n}`, date, status: 'booked', rows: rows.map(([account, debet, kredit]) => ({ account, debet, kredit })), ...extra });
const VERS = [
  ver('2025-12-31', [['1930', 10000, 0], ['2350', 0, 10000]]), // fjolår: lån
  ver('2026-01-10', [['1510', 12500, 0], ['3001', 0, 10000], ['2611', 0, 2500]]), // faktura
  ver('2026-02-10', [['1930', 12500, 0], ['1510', 0, 12500]]), // kunden betalar
  ver('2026-03-01', [['5010', 4000, 0], ['2440', 0, 4000]]), // hyra, obetald
  ver('2026-04-01', [['1220', 6000, 0], ['1930', 0, 6000]]), // dator köpt
  ver('2026-06-30', [['7832', 1000, 0], ['1229', 0, 1000]]), // avskrivning
  ver('2026-07-01', [['2013', 2000, 0], ['1930', 0, 2000]]), // eget uttag
  ver('2026-08-01', [['2350', 3000, 0], ['1930', 0, 3000]]), // amortering
  ver('2026-12-31', [['3001', 10000, 0], ['8999', 0, 5000], ['2099', 0, 5000]], { source: 'year_end_close' }),
];

describe('kassaflödesanalys', () => {
  const s = computeCashflowStatement(VERS, ACCOUNTS, { start: new Date('2026-01-01T00:00:00'), end: new Date('2026-12-31T00:00:00') });

  it('delarna blir exakt förändringen på banken', () => {
    expect(s.openingCash).toBe(10000);
    expect(s.closingCash).toBe(11500);
    expect(s.flow).toBe(1500);
    expect(s.balanced).toBe(true);
  });

  it('löpande: resultat 5 000 + avskrivning 1 000 + leverantörsskuld 4 000 + moms 2 500', () => {
    // 10 000 − 4 000 − 1 000 = 5 000 i resultat; kundfordran tillbaka på noll.
    expect(s.operating).toBe(12500);
  });

  it('investering är datorn och finansiering uttag och amortering', () => {
    expect(s.investing).toBe(-6000);
    expect(s.financing).toBe(-5000);
  });

  it('bokslutet räknas inte', () => {
    const resultRow = s.items[0].rows.find(r => r.code === 'resultat');
    expect(resultRow.amount).toBe(5000);
  });
});
