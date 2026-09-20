import { describe, it, expect } from 'vitest'
import {
  partnerAccounts, validatePartners, allocateResult, buildAllocationVerification, isAllocationBooked,
  computePartnerStatement, MAX_PARTNERS,
} from './partners'

const two = [{ id: 'p1', name: 'Anna', sharePct: 60 }, { id: 'p2', name: 'Bo', sharePct: 40 }]
const balanced = (v) => Math.round(v.rows.reduce((s, r) => s + r.debet - r.kredit, 0) * 100) === 0

describe('partnerAccounts', () => {
  it('follows the BAS series per partner', () => {
    expect(partnerAccounts(0)).toMatchObject({ equity: '2010', uttag: '2013', insattning: '2018', resultat: '2019' })
    expect(partnerAccounts(1)).toMatchObject({ equity: '2020', uttag: '2023', insattning: '2028', resultat: '2029' })
    expect(partnerAccounts(3).resultat).toBe('2049')
    expect(MAX_PARTNERS).toBe(4)
  })
})

describe('validatePartners', () => {
  it('accepts shares that sum to 100', () => {
    expect(validatePartners(two)).toEqual([])
  })

  it('rejects wrong totals, empty names, no partners and too many', () => {
    expect(validatePartners([{ id: 'a', name: 'A', sharePct: 50 }]).join()).toMatch(/100/)
    expect(validatePartners([{ id: 'a', name: ' ', sharePct: 100 }]).join()).toMatch(/namn/)
    expect(validatePartners([]).join()).toMatch(/minst en/)
    const five = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: 'X', sharePct: 20 }))
    expect(validatePartners(five).join()).toMatch(/Högst 4/)
  })
})

describe('allocateResult', () => {
  it('splits by share', () => {
    expect(allocateResult(100000, two).map(s => s.amount)).toEqual([60000, 40000])
  })

  it('always sums exactly to the result, even with awkward shares', () => {
    const three = [{ id: 'a', sharePct: 33.33 }, { id: 'b', sharePct: 33.33 }, { id: 'c', sharePct: 33.34 }]
    const parts = allocateResult(1000.01, three).map(s => s.amount)
    expect(Math.round(parts.reduce((s, n) => s + n, 0) * 100) / 100).toBe(1000.01)
  })

  it('handles a loss', () => {
    expect(allocateResult(-1000, two).map(s => s.amount)).toEqual([-600, -400])
  })
})

describe('buildAllocationVerification', () => {
  it('moves a profit from 2099 to each partner result account', () => {
    const v = buildAllocationVerification('2026', 100000, two)
    expect(v.date).toBe('2026-12-31')
    expect(v.rows).toEqual([
      { account: '2099', debet: 100000, kredit: 0 },
      { account: '2019', debet: 0, kredit: 60000 },
      { account: '2029', debet: 0, kredit: 40000 },
    ])
    expect(balanced(v)).toBe(true)
  })

  it('reverses for a loss and still balances', () => {
    const v = buildAllocationVerification('2026', -1000, two)
    expect(v.rows[0]).toEqual({ account: '2099', debet: 0, kredit: 1000 })
    expect(v.rows[1]).toEqual({ account: '2019', debet: 600, kredit: 0 })
    expect(balanced(v)).toBe(true)
  })

  it('is detected as booked from its sourceId, ignoring drafts', () => {
    const v = buildAllocationVerification('2026', 100, two)
    expect(isAllocationBooked([v], '2026')).toBe(true)
    expect(isAllocationBooked([{ ...v, status: 'draft' }], '2026')).toBe(false)
    expect(isAllocationBooked([v], '2025')).toBe(false)
  })
})

describe('computePartnerStatement', () => {
  const vers = [
    { date: '2026-02-01', rows: [{ account: '1930', debet: 20000, kredit: 0 }, { account: '2018', debet: 0, kredit: 20000 }] },
    { date: '2026-03-01', rows: [{ account: '2023', debet: 5000, kredit: 0 }, { account: '1930', debet: 0, kredit: 5000 }] },
    { date: '2026-04-01', rows: [{ account: '2013', debet: 3000, kredit: 0 }, { account: '1930', debet: 0, kredit: 3000 }] },
    { date: '2025-04-01', rows: [{ account: '2013', debet: 999, kredit: 0 }] },
    { date: '2026-05-01', status: 'draft', rows: [{ account: '2013', debet: 777, kredit: 0 }] },
  ]

  it('reads each partner own accounts and their share of the result', () => {
    const s = computePartnerStatement(vers, two, '2026-01-01', '2026-12-31', 50000)
    expect(s[0]).toMatchObject({ share: 30000, insattningar: 20000, uttag: 3000 })
    expect(s[1]).toMatchObject({ share: 20000, insattningar: 0, uttag: 5000 })
  })
})
