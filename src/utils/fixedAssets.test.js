import { describe, it, expect } from 'vitest'
import {
  accumulatedThrough, depreciationForMonth, bookValueAt, scheduleOf, monthlyAmount,
  pendingDepreciation, buildDepreciationVerification, buildDisposalVerification,
  unregisteredAcquisitions, registerSummary, categoryForAccount, lastDayOfMonth,
} from './fixedAssets'

const laptop = {
  id: 'a1', name: 'Laptop', acquisitionDate: '2026-01-15', cost: 12000, residualValue: 0,
  usefulLifeMonths: 36, assetAccount: '1224', accumulatedAccount: '1229', expenseAccount: '7832',
}

describe('linear depreciation', () => {
  it('starts in the acquisition month and is cost/life per month', () => {
    expect(monthlyAmount(laptop)).toBe(333.33)
    expect(depreciationForMonth(laptop, '2025-12')).toBe(0)
    expect(depreciationForMonth(laptop, '2026-01')).toBe(333.33)
    expect(depreciationForMonth(laptop, '2026-02')).toBe(333.34)
  })

  it('sums to exactly the depreciable base over the whole life — no rounding remainder', () => {
    const total = scheduleOf(laptop).reduce((s, r) => s + r.amount, 0)
    expect(Math.round(total * 100) / 100).toBe(12000)
    expect(scheduleOf(laptop)).toHaveLength(36)
  })

  it('never depreciates below the residual value', () => {
    const car = { ...laptop, cost: 100000, residualValue: 20000, usefulLifeMonths: 40 }
    expect(accumulatedThrough(car, '2030-12')).toBe(80000)
    expect(bookValueAt(car, '2030-12')).toBe(20000)
    expect(depreciationForMonth(car, '2031-01')).toBe(0)
  })

  it('has book value equal to cost before the start month', () => {
    expect(bookValueAt(laptop, '2025-12')).toBe(12000)
  })

  it('stops the month before disposal', () => {
    const sold = { ...laptop, disposedDate: '2026-04-10' }
    expect(depreciationForMonth(sold, '2026-03')).toBeGreaterThan(0)
    expect(depreciationForMonth(sold, '2026-04')).toBe(0)
    expect(accumulatedThrough(sold, '2026-12')).toBe(1000)
  })
})

describe('pendingDepreciation', () => {
  it('lists every unbooked month up to the cut-off, grouped by month', () => {
    const p = pendingDepreciation([laptop], [], '2026-03')
    expect(p.months.map(m => m.month)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(p.total).toBe(1000)
  })

  it('skips months already booked for that asset', () => {
    const booked = [{ id: 'v1', source: 'depreciation', date: '2026-01-31', depreciationAssetIds: ['a1'] }]
    const p = pendingDepreciation([laptop], booked, '2026-02')
    expect(p.months.map(m => m.month)).toEqual(['2026-02'])
  })

  it('still offers a month booked for OTHER assets only', () => {
    const booked = [{ id: 'v1', source: 'depreciation', date: '2026-01-31', depreciationAssetIds: ['other'] }]
    expect(pendingDepreciation([laptop], booked, '2026-01').months).toHaveLength(1)
  })

  it('never offers months in a locked fiscal year, and reports how many it skipped', () => {
    const p = pendingDepreciation([laptop], [], '2026-03', ['2026'])
    expect(p.months).toHaveLength(0)
    expect(p.blockedByLock).toBe(3)
  })

  it('ignores draft depreciation verifications', () => {
    const drafts = [{ id: 'v1', source: 'depreciation', status: 'draft', date: '2026-01-31', depreciationAssetIds: ['a1'] }]
    expect(pendingDepreciation([laptop], drafts, '2026-01').months).toHaveLength(1)
  })
})

describe('buildDepreciationVerification', () => {
  it('books on the last day of the month and balances', () => {
    const v = buildDepreciationVerification('2026-02', [{ asset: laptop, amount: 333.34 }])
    expect(v.date).toBe('2026-02-28')
    expect(v.rows).toEqual([
      { account: '7832', debet: 333.34, kredit: 0 },
      { account: '1229', debet: 0, kredit: 333.34 },
    ])
    expect(v.depreciationAssetIds).toEqual(['a1'])
  })

  it('merges rows on the same account across assets and still balances', () => {
    const desk = { ...laptop, id: 'a2', assetAccount: '1220' }
    const v = buildDepreciationVerification('2026-03', [{ asset: laptop, amount: 100 }, { asset: desk, amount: 50.5 }])
    expect(v.rows).toHaveLength(2)
    const d = v.rows.reduce((s, r) => s + r.debet, 0)
    const k = v.rows.reduce((s, r) => s + r.kredit, 0)
    expect(d).toBe(150.5)
    expect(k).toBe(150.5)
  })
})

describe('buildDisposalVerification', () => {
  const balanced = (v) => Math.round(v.rows.reduce((s, r) => s + r.debet - r.kredit, 0) * 100) === 0

  it('books a gain when the price exceeds book value', () => {
    // 12 månader avskrivet = 4000 → bokfört värde 8000, såld för 9000 → vinst 1000
    const v = buildDisposalVerification(laptop, { date: '2027-01-20', proceeds: 9000 })
    expect(balanced(v)).toBe(true)
    expect(v.rows.find(r => r.account === '3973').kredit).toBe(1000)
    expect(v.rows.find(r => r.account === '1224').kredit).toBe(12000)
  })

  it('books a loss when the price is below book value', () => {
    const v = buildDisposalVerification(laptop, { date: '2027-01-20', proceeds: 5000 })
    expect(balanced(v)).toBe(true)
    expect(v.rows.find(r => r.account === '7970').debet).toBe(3000)
  })

  it('writes off (utrangering) with no proceeds', () => {
    const v = buildDisposalVerification(laptop, { date: '2027-01-20', proceeds: 0 })
    expect(balanced(v)).toBe(true)
    expect(v.description).toMatch(/Utrangering/)
    expect(v.rows.find(r => r.account === '7970').debet).toBe(8000)
  })
})

describe('unregisteredAcquisitions', () => {
  const ver = (id, rows, extra = {}) => ({ id, date: '2026-02-01', description: 'Köp', rows, ...extra })

  it('finds debits on asset accounts that are not linked yet', () => {
    const found = unregisteredAcquisitions([
      ver('v1', [{ account: '1224', debet: 15000, kredit: 0 }, { account: '1930', debet: 0, kredit: 15000 }]),
    ], [])
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ account: '1224', amount: 15000, category: 'dator' })
  })

  it('skips already linked, accumulated-depreciation and depreciation postings', () => {
    const found = unregisteredAcquisitions([
      ver('v1', [{ account: '1224', debet: 15000, kredit: 0 }]),
      ver('v2', [{ account: '1229', debet: 500, kredit: 0 }]),
      ver('v3', [{ account: '1224', debet: 0, kredit: 500 }], { source: 'depreciation' }),
    ], [{ sourceVerificationId: 'v1' }])
    expect(found).toHaveLength(0)
  })
})

describe('registerSummary and helpers', () => {
  it('sums cost, accumulated and book value, excluding disposed assets', () => {
    const sold = { ...laptop, id: 'a2', disposedDate: '2026-06-01' }
    const s = registerSummary([laptop, sold], '2026-12')
    expect(s.cost).toBe(12000)
    expect(s.accumulated).toBe(4000)
    expect(s.bookValue).toBe(8000)
  })

  it('maps accounts to categories', () => {
    expect(categoryForAccount('1224')).toBe('dator')
    expect(categoryForAccount('1226')).toBe('bil')
    expect(categoryForAccount('1210')).toBe('maskin')
    expect(categoryForAccount('1110')).toBe('byggnad')
    expect(categoryForAccount('1930')).toBe(null)
  })

  it('finds the last day of a month, including leap years', () => {
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29')
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28')
  })
})
