import { describe, it, expect } from 'vitest'
import {
  ledgerBalance, unhandledTransactions, reconcileBank, reconcileCash, latestReconciliations, isReconciledThrough,
} from './reconciliation'

const vers = [
  { id: 'v1', date: '2026-01-02', rows: [{ account: '1930', debet: 100000, kredit: 0 }, { account: '2018', debet: 0, kredit: 100000 }] },
  { id: 'v2', date: '2026-02-01', rows: [{ account: '5010', debet: 20000, kredit: 0 }, { account: '1930', debet: 0, kredit: 20000 }] },
  { id: 'v3', date: '2026-03-01', status: 'draft', rows: [{ account: '1930', debet: 999, kredit: 0 }] },
  { id: 'v4', date: '2027-01-05', rows: [{ account: '1930', debet: 5000, kredit: 0 }] },
  { id: 'v5', date: '2026-02-10', rows: [{ account: '1910', debet: 1500, kredit: 0 }] },
]

const txs = [
  { id: 't1', date: '2026-02-20', amount: -350, status: 'unmatched' },
  { id: 't2', date: '2026-02-21', amount: 1000, status: 'unmatched' },
  { id: 't3', date: '2026-02-22', amount: -500, status: 'booked' },
  { id: 't4', date: '2026-03-15', amount: -70, status: 'unmatched' },
  { id: 't5', date: '2026-02-23', amount: -10, status: 'unmatched', accountId: 'sparkonto' },
]

describe('ledgerBalance', () => {
  it('sums booked rows on the account up to the date only', () => {
    expect(ledgerBalance(vers, '1930', '2026-12-31')).toBe(80000)
  })

  it('ignores drafts and later verifications', () => {
    expect(ledgerBalance(vers, '1930', '2026-02-28')).toBe(80000)
    expect(ledgerBalance(vers, '1930', '2027-12-31')).toBe(85000)
  })
})

describe('unhandledTransactions', () => {
  it('returns only unmatched rows for the right account up to the date', () => {
    const got = unhandledTransactions(txs, 'default', '2026-02-28')
    expect(got.map(t => t.id)).toEqual(['t1', 't2'])
  })

  it('separates other bank accounts', () => {
    expect(unhandledTransactions(txs, 'sparkonto', '2026-12-31').map(t => t.id)).toEqual(['t5'])
  })
})

describe('reconcileBank', () => {
  const base = { verifications: vers, bankTransactions: txs, ledgerAccount: '1930', accountId: 'default', date: '2026-02-28' }

  it('is reconciled when the statement equals ledger plus unhandled transactions', () => {
    // 80 000 bokfört − 350 + 1 000 ej hanterat = 80 650
    const r = reconcileBank({ ...base, statementBalance: 80650 })
    expect(r.expectedBalance).toBe(80650)
    expect(r.pendingCount).toBe(2)
    expect(r.pendingNet).toBe(650)
    expect(r.difference).toBe(0)
    expect(r.reconciled).toBe(true)
  })

  it('reports an unexplained difference when something is missing', () => {
    const r = reconcileBank({ ...base, statementBalance: 80000 })
    expect(r.difference).toBe(-650)
    expect(r.reconciled).toBe(false)
  })

  it('a negative difference means the statement is lower than the books expect', () => {
    expect(reconcileBank({ ...base, statementBalance: 80600 }).difference).toBe(-50)
  })

  it('tolerates a string from a form field', () => {
    expect(reconcileBank({ ...base, statementBalance: '80650' }).reconciled).toBe(true)
  })
})

describe('reconcileCash', () => {
  it('compares the counted cash directly with the ledger', () => {
    expect(reconcileCash({ verifications: vers, countedAmount: 1500, date: '2026-12-31' })).toMatchObject({ ledgerBalance: 1500, difference: 0, reconciled: true })
    expect(reconcileCash({ verifications: vers, countedAmount: 1400, date: '2026-12-31' }).difference).toBe(-100)
  })
})

describe('history helpers', () => {
  const list = [
    { ledgerAccount: '1930', date: '2026-06-30', createdAt: '2026-07-01', difference: 0 },
    { ledgerAccount: '1930', date: '2026-12-31', createdAt: '2027-01-02', difference: 0 },
    { ledgerAccount: '1910', date: '2026-12-31', createdAt: '2027-01-02', difference: 50 },
  ]

  it('picks the latest per account', () => {
    const m = latestReconciliations(list)
    expect(m.get('1930').date).toBe('2026-12-31')
    expect(m.get('1910').difference).toBe(50)
  })

  it('knows whether something was reconciled through a date without a difference', () => {
    expect(isReconciledThrough(list, '2026-12-31')).toBe(true)
    expect(isReconciledThrough(list, '2027-01-01')).toBe(false)
    expect(isReconciledThrough([list[2]], '2026-12-31')).toBe(false)
    expect(isReconciledThrough([], '2026-12-31')).toBe(false)
  })
})
