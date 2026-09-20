import { describe, it, expect } from 'vitest'
import {
  buildAccrualVerification, buildReversalVerification, reversalDateFor, accrualStatus,
  dueReversals, accrualsTotal,
} from './accruals'

const base = { id: 'p1', description: 'Hyra jan', date: '2026-12-31', amount: 5000, counterAccount: '5010' }
const balanced = (v) => Math.round(v.rows.reduce((s, r) => s + r.debet - r.kredit, 0) * 100) === 0

describe('reversalDateFor', () => {
  it('is the day after, across a year boundary', () => {
    expect(reversalDateFor('2026-12-31')).toBe('2027-01-01')
    expect(reversalDateFor('2028-02-28')).toBe('2028-02-29')
  })
})

describe('accrual verifications', () => {
  it('förutbetald kostnad: D 1710 / K kostnad, reversed the other way', () => {
    const acc = buildAccrualVerification({ ...base, kind: 'prepaid_expense' })
    expect(acc.rows).toEqual([
      { account: '1710', debet: 5000, kredit: 0 },
      { account: '5010', debet: 0, kredit: 5000 },
    ])
    const rev = buildReversalVerification({ ...base, kind: 'prepaid_expense' })
    expect(rev.date).toBe('2027-01-01')
    expect(rev.rows).toEqual([
      { account: '5010', debet: 5000, kredit: 0 },
      { account: '1710', debet: 0, kredit: 5000 },
    ])
  })

  it('upplupen kostnad: D kostnad / K 2990', () => {
    const acc = buildAccrualVerification({ ...base, kind: 'accrued_expense' })
    expect(acc.rows).toEqual([
      { account: '5010', debet: 5000, kredit: 0 },
      { account: '2990', debet: 0, kredit: 5000 },
    ])
  })

  it('upplupen intäkt: D 1790 / K intäkt', () => {
    const acc = buildAccrualVerification({ ...base, kind: 'accrued_income', counterAccount: '3001' })
    expect(acc.rows[0]).toEqual({ account: '1790', debet: 5000, kredit: 0 })
    expect(acc.rows[1]).toEqual({ account: '3001', debet: 0, kredit: 5000 })
  })

  it('förutbetald intäkt: D intäkt / K 2970', () => {
    const acc = buildAccrualVerification({ ...base, kind: 'prepaid_income', counterAccount: '3001' })
    expect(acc.rows[0]).toEqual({ account: '3001', debet: 5000, kredit: 0 })
    expect(acc.rows[1]).toEqual({ account: '2970', debet: 0, kredit: 5000 })
  })

  it('every kind balances, both ways, and the reversal nets the posting to zero per account', () => {
    ['prepaid_expense', 'accrued_expense', 'accrued_income', 'prepaid_income'].forEach(kind => {
      const a = buildAccrualVerification({ ...base, kind })
      const r = buildReversalVerification({ ...base, kind })
      expect(balanced(a)).toBe(true)
      expect(balanced(r)).toBe(true)
      const net = {}
      ;[...a.rows, ...r.rows].forEach(x => { net[x.account] = (net[x.account] || 0) + x.debet - x.kredit })
      Object.values(net).forEach(v => expect(v).toBe(0))
    })
  })

  it('rounds the amount to öre', () => {
    const v = buildAccrualVerification({ ...base, kind: 'accrued_expense', amount: 100.005 })
    expect(v.rows[0].debet).toBe(100.01)
  })
})

describe('status and due reversals', () => {
  const kind = 'prepaid_expense'
  const bookedVer = { source: 'accrual', sourceId: 'accrual_p1' }
  const reversalVer = { source: 'accrual', sourceId: 'accrual_p1_reversal' }

  it('reads booked / reversed from the verifications', () => {
    expect(accrualStatus({ ...base, kind }, [])).toEqual({ booked: false, reversed: false })
    expect(accrualStatus({ ...base, kind }, [bookedVer])).toEqual({ booked: true, reversed: false })
    expect(accrualStatus({ ...base, kind }, [bookedVer, reversalVer])).toEqual({ booked: true, reversed: true })
  })

  it('a draft verification does not count as booked', () => {
    expect(accrualStatus({ ...base, kind }, [{ ...bookedVer, status: 'draft' }]).booked).toBe(false)
  })

  it('flags a reversal as due only once its date has passed and it is not yet booked', () => {
    const a = { ...base, kind }
    expect(dueReversals([a], [bookedVer], '2026-12-31')).toHaveLength(0)
    expect(dueReversals([a], [bookedVer], '2027-01-01')).toHaveLength(1)
    expect(dueReversals([a], [bookedVer, reversalVer], '2027-06-01')).toHaveLength(0)
    expect(dueReversals([a], [], '2027-06-01')).toHaveLength(0)
  })

  it('totals only booked accruals', () => {
    const a = { ...base, kind }
    expect(accrualsTotal([a, { ...a, id: 'p2', amount: 300 }], [bookedVer])).toBe(5000)
  })
})
