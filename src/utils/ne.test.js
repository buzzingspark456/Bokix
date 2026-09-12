import { describe, it, expect } from 'vitest'
import { computeNeBalance, computeNeResult, NE_BALANCE_ROWS, NE_RESULT_ROWS } from './ne'

describe('computeNeBalance', () => {
  it('sums assets and liabilities separately, with equity derived (never entered directly)', () => {
    // Samma exempelsiffror som förekom på den riktiga blanketten den här
    // funktionen byggdes utifrån.
    const result = computeNeBalance({
      b2: 400000, b3: 300000, b4: 70000, b6: 37500, b9: 6000,
      b13: 300000,
    })
    expect(result.totalAssets).toBe(400000 + 300000 + 70000 + 37500 + 6000)
    expect(result.totalLiabilities).toBe(300000)
    expect(result.equity).toBe(result.totalAssets - 300000)
  })

  it('returns zero for every total when nothing is entered', () => {
    const result = computeNeBalance({})
    expect(result.totalAssets).toBe(0)
    expect(result.totalLiabilities).toBe(0)
    expect(result.equity).toBe(0)
  })

  it('every row has a unique key matching its blankett-fältnummer', () => {
    const keys = NE_BALANCE_ROWS.map(r => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has no input row for B10 — it is derived, not entered', () => {
    expect(NE_BALANCE_ROWS.some(r => r.key === 'b10')).toBe(false)
  })
})

describe('computeNeResult', () => {
  it('adds income rows and subtracts cost/depreciation rows, matching the real blankett example', () => {
    const result = computeNeResult({
      r1: 428550, r5: 50000, r6: 33750, r8: 8000, r9: 25000, r10: 30000,
    })
    expect(result.total).toBe(428550 - 50000 - 33750 - 8000 - 25000 - 30000)
  })

  it('returns zero when nothing is entered', () => {
    expect(computeNeResult({}).total).toBe(0)
  })

  it('every row has a unique key matching its blankett-fältnummer', () => {
    const keys = NE_RESULT_ROWS.map(r => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has no input row for R11 — it is derived, not entered', () => {
    expect(NE_RESULT_ROWS.some(r => r.key === 'r11')).toBe(false)
  })
})
