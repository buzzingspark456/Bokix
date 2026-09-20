import { describe, it, expect } from 'vitest'
import { historyForSupplier } from './receiptHistory'

const r = (id, supplier, costAccount, vatRate, date = '2026-01-01') => ({ id, supplier, costAccount, vatRate, date })

describe('historyForSupplier', () => {
  const list = [
    r('1', 'Konsultbolaget AB', '6550', 25, '2026-01-10'),
    r('2', 'Konsultbolaget AB', '6550', 25, '2026-02-10'),
    r('3', 'Konsultbolaget AB', '6530', 25, '2026-03-10'),
    r('4', 'Circle K', '5611', 25),
  ]

  it('ger det konto och den momssats som oftast använts för leverantören', () => {
    expect(historyForSupplier(list, 'Konsultbolaget AB')).toEqual({ costAccount: '6550', vatRate: 25 })
  })

  it('jämför utan hänsyn till versaler och mellanslag i kanterna', () => {
    expect(historyForSupplier(list, '  circle k ')).toEqual({ costAccount: '5611', vatRate: 25 })
  })

  it('en okänd eller tom leverantör ger null', () => {
    expect(historyForSupplier(list, 'Någon Annan AB')).toBeNull()
    expect(historyForSupplier(list, '')).toBeNull()
    expect(historyForSupplier(list, null)).toBeNull()
    expect(historyForSupplier(undefined, 'Circle K')).toBeNull()
  })

  it('kvittot som läses av och kvitton utan konto räknas inte', () => {
    expect(historyForSupplier([r('1', 'Circle K', '5611', 25)], 'Circle K', '1')).toBeNull()
    expect(historyForSupplier([r('1', 'Circle K', '', 25)], 'Circle K')).toBeNull()
  })

  it('vid lika många förekomster vinner det senast använda', () => {
    const tie = [r('1', 'Bolaget', '6110', 25, '2026-01-01'), r('2', 'Bolaget', '6540', 0, '2026-06-01')]
    expect(historyForSupplier(tie, 'Bolaget')).toEqual({ costAccount: '6540', vatRate: 0 })
  })

  it('en momssats på 0 räknas, och saknad momssats ger null', () => {
    expect(historyForSupplier([r('1', 'Supabase', '6540', 0)], 'Supabase').vatRate).toBe(0)
    expect(historyForSupplier([{ id: '1', supplier: 'X', costAccount: '5460' }], 'X')).toEqual({ costAccount: '5460', vatRate: null })
  })
})

import { historyFromVerifications } from './receiptHistory';

describe('historyFromVerifications', () => {
  const ver = (over) => ({ status: 'booked', date: '2026-05-01', description: 'Elgiganten', rows: [
    { account: '5410', debet: 1000, kredit: 0 }, { account: '2641', debet: 250, kredit: 0 }, { account: '1930', debet: 0, kredit: 1250 },
  ], ...over });

  it('hittar konto och momssats ur en bokförd verifikation', () => {
    expect(historyFromVerifications([ver({})], ' elgiganten ')).toEqual({ costAccount: '5410', vatRate: 25, payAccount: '1930' });
  });

  it('räknar 12 % när momsen är 12 % av nettot', () => {
    const v = ver({ rows: [{ account: '4010', debet: 1000, kredit: 0 }, { account: '2641', debet: 120, kredit: 0 }, { account: '1930', debet: 0, kredit: 1120 }] });
    expect(historyFromVerifications([v], 'Elgiganten').vatRate).toBe(12);
  });

  it('hoppar över utkast, rättelser och andra leverantörer', () => {
    expect(historyFromVerifications([ver({ status: 'draft' }), ver({ source: 'expense_reversal' }), ver({ description: 'Annan' })], 'Elgiganten')).toBeNull();
  });

  it('ger null för tom leverantör', () => {
    expect(historyFromVerifications([ver({})], '')).toBeNull();
  });
});
