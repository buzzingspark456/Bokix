import { describe, it, expect } from 'vitest'
import { computeVacationAdjustment, buildVacationLiabilityVerification, isVacationAdjustmentBooked } from './vacationLiability'

const balanced = (v) => Math.round(v.rows.reduce((s, r) => s + r.debet - r.kredit, 0) * 100) === 0
const date = '2026-12-31'

describe('computeVacationAdjustment', () => {
  it('compares the calculated liability with what is already on 2920 and 2940', () => {
    const vers = [
      { date: '2025-12-31', rows: [{ account: '7090', debet: 30000, kredit: 0 }, { account: '2920', debet: 0, kredit: 30000 }] },
      { date: '2025-12-31', rows: [{ account: '7519', debet: 9426, kredit: 0 }, { account: '2940', debet: 0, kredit: 9426 }] },
    ]
    const a = computeVacationAdjustment({ verifications: vers, date, liability: 50000, liabilityFee: 15710 })
    expect(a).toMatchObject({ balance2920: 30000, balance2940: 9426, diffLiability: 20000, diffFee: 6284 })
  })

  it('is the full liability the first year, when the accounts are empty', () => {
    const a = computeVacationAdjustment({ verifications: [], date, liability: 40000, liabilityFee: 12568 })
    expect(a.diffLiability).toBe(40000)
    expect(a.diffFee).toBe(12568)
  })

  it('ignores drafts and later verifications', () => {
    const vers = [
      { date: '2026-05-01', status: 'draft', rows: [{ account: '2920', debet: 0, kredit: 999 }] },
      { date: '2027-01-01', rows: [{ account: '2920', debet: 0, kredit: 999 }] },
    ]
    expect(computeVacationAdjustment({ verifications: vers, date, liability: 100, liabilityFee: 0 }).balance2920).toBe(0)
  })
})

describe('buildVacationLiabilityVerification', () => {
  it('an increased liability: D 7090 / K 2920 and D 7519 / K 2940', () => {
    const v = buildVacationLiabilityVerification({ date, diffLiability: 20000, diffFee: 6284 })
    expect(v.rows).toEqual([
      { account: '7090', debet: 20000, kredit: 0 },
      { account: '2920', debet: 0, kredit: 20000 },
      { account: '7519', debet: 6284, kredit: 0 },
      { account: '2940', debet: 0, kredit: 6284 },
    ])
    expect(balanced(v)).toBe(true)
    expect(v.source).toBe('accrual')
  })

  it('a reduced liability reverses the entry and still balances', () => {
    const v = buildVacationLiabilityVerification({ date, diffLiability: -5000, diffFee: -1571 })
    expect(v.rows[0]).toEqual({ account: '2920', debet: 5000, kredit: 0 })
    expect(v.rows[1]).toEqual({ account: '7090', debet: 0, kredit: 5000 })
    expect(balanced(v)).toBe(true)
  })

  it('books only the part that changed', () => {
    const v = buildVacationLiabilityVerification({ date, diffLiability: 1000, diffFee: 0 })
    expect(v.rows.map(r => r.account)).toEqual(['7090', '2920'])
  })

  it('returns null when the accounts already match', () => {
    expect(buildVacationLiabilityVerification({ date, diffLiability: 0, diffFee: 0 })).toBeNull()
  })
})

describe('isVacationAdjustmentBooked', () => {
  it('reads it from the sourceId and ignores drafts', () => {
    const v = buildVacationLiabilityVerification({ date, diffLiability: 100, diffFee: 0 })
    expect(isVacationAdjustmentBooked([v], date)).toBe(true)
    expect(isVacationAdjustmentBooked([{ ...v, status: 'draft' }], date)).toBe(false)
    expect(isVacationAdjustmentBooked([v], '2025-12-31')).toBe(false)
  })
})
