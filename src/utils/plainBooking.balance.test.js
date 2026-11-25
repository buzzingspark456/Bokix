import { describe, it, expect } from 'vitest';
import { buildSimpleBooking } from './plainBooking';

// Enkelt läge ska alltid ge en riktig dubbel bokföring (2026-11-22): debet
// lika med kredit, inga negativa belopp, momsen på rätt konto och rätt summa.
const sum = (rows, k) => Math.round(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0) * 100) / 100;
const amounts = [0.01, 1, 9.99, 100, 125, 333.33, 1234.56, 99999.99];
const orgs = ['Aktiebolag', 'Enskild firma', 'Handelsbolag / Kommanditbolag', 'Ideell förening'];

describe('enkelt läge ger alltid balanserade verifikationer', () => {
  for (const org of orgs) for (const amount of amounts) {
    for (const rate of [25, 12, 6, 0]) {
      it(`köp ${amount} kr ${rate} % (${org})`, () => {
        const { rows, errors } = buildSimpleBooking({ kind: 'expense', amount, vatRate: rate, account: '5410', payAccount: '1930' }, { orgType: org });
        expect(errors).toEqual([]);
        expect(sum(rows, 'debet')).toBe(sum(rows, 'kredit'));
        expect(sum(rows, 'kredit')).toBe(Math.round(amount * 100) / 100);
        rows.forEach(r => { expect(r.debet).toBeGreaterThanOrEqual(0); expect(r.kredit).toBeGreaterThanOrEqual(0); });
        const vat = rows.find(r => r.account === '2641');
        if (rate === 0) expect(vat).toBeUndefined();
        else if (vat) expect(Math.abs(vat.debet - (amount - amount / (1 + rate / 100)))).toBeLessThanOrEqual(0.011);
      });
      it(`försäljning ${amount} kr ${rate} % (${org})`, () => {
        const { rows, errors } = buildSimpleBooking({ kind: 'income', amount, vatRate: rate, payAccount: '1930' }, { orgType: org });
        expect(errors).toEqual([]);
        expect(sum(rows, 'debet')).toBe(sum(rows, 'kredit'));
        expect(rows.find(r => r.account === '1930').debet).toBe(Math.round(amount * 100) / 100);
        if (rate === 0) expect(rows.find(r => /^26[123]1$/.test(r.account))).toBeUndefined();
      });
    }
    it(`flytt ${amount} kr (${org})`, () => {
      const { rows } = buildSimpleBooking({ kind: 'transfer', amount, fromAccount: '1930', toAccount: '1630' }, { orgType: org });
      expect(sum(rows, 'debet')).toBe(sum(rows, 'kredit'));
    });
  }
  it('blandad moms på kvittot balanserar', () => {
    const { rows } = buildSimpleBooking({ kind: 'expense', amount: 312.5, vatRate: 'mixed', vatAmount: 41.3, account: '7631', payAccount: '1930' }, { orgType: 'Aktiebolag' });
    expect(sum(rows, 'debet')).toBe(sum(rows, 'kredit'));
  });
  it('inte momsregistrerad: ingen moms alls', () => {
    const { rows } = buildSimpleBooking({ kind: 'expense', amount: 125, vatRate: 25, account: '5410' }, { orgType: 'Enskild firma', vatExempt: true });
    expect(rows.some(r => r.account.startsWith('26'))).toBe(false);
    expect(sum(rows, 'debet')).toBe(sum(rows, 'kredit'));
  });
  it('egna insättningar och uttag balanserar (EF och HB)', () => {
    for (const org of ['Enskild firma', 'Handelsbolag / Kommanditbolag']) for (const kind of ['owner_in', 'owner_out']) {
      const { rows } = buildSimpleBooking({ kind, amount: 5000, payAccount: '1930' }, { orgType: org });
      expect(sum(rows, 'debet')).toBe(sum(rows, 'kredit'));
    }
  });
});
