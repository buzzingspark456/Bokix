import { describe, it, expect } from 'vitest';
import { rowsFromLayout } from './visionRows';
import { parseReceiptText, reconcileByCashArithmetic } from './ocrReceipt';

const line = (text, x, y, w = 0.2, h = 0.02) => ({ text, box: { x, y, w, h } });

describe('rader efter läget på bilden', () => {
  // Google läser kolumn för kolumn: rubrikerna först, beloppen sedan.
  const KOLUMNER = [
    line('ICA Nära', 0.3, 0.05, 0.4),
    line('TOTAL', 0.1, 0.5), line('KONTANT', 0.1, 0.53), line('VÄXEL', 0.1, 0.56),
    line('33,90', 0.7, 0.501), line('50,00', 0.7, 0.531), line('16,10', 0.7, 0.561),
  ];

  it('lägger rubrik och belopp på samma rad igen', () => {
    expect(rowsFromLayout(KOLUMNER)).toBe('ICA Nära\nTOTAL 33,90\nKONTANT 50,00\nVÄXEL 16,10');
  });

  it('ger totalen, inte det betalda beloppet', () => {
    expect(parseReceiptText(rowsFromLayout(KOLUMNER)).amount).toBe(33.9);
  });

  it('ett foto som ligger på sidan läses ändå rad för rad', () => {
    const sidled = KOLUMNER.map(l => ({ text: l.text, box: { x: l.box.y, y: 1 - l.box.x - l.box.w, w: l.box.h, h: l.box.w } }));
    expect(rowsFromLayout(sidled).split('\n')).toContain('TOTAL 33,90');
  });

  it('utan läge blir det inget', () => {
    expect(rowsFromLayout(null)).toBeNull();
  });
});

describe('betalt minus växel', () => {
  it('gäller bara belopp vid sina ord, inte två varurader som går ihop', () => {
    const lines = ['Varor 24,00', 'Varor 28,00', 'Delsumma 52,00', 'TOTAL 55,10', 'KONTANT 55,10', 'VÄXEL 0,00'];
    const r = reconcileByCashArithmetic(lines, { amount: 55.1, amountVerified: false });
    expect(r.amount).toBe(55.1);
  });

  it('räknar fram totalen när betalt och växel står vid sina ord', () => {
    const lines = ['TOTAL', 'KONTANT 100,00', 'VÄXEL 73,40', '26,60'];
    expect(reconcileByCashArithmetic(lines, { amount: 100, amountVerified: false }).amount).toBe(26.6);
  });
});
