import { describe, it, expect } from 'vitest'
import { computeNeBalance, computeNeResult, NE_BALANCE_ROWS, NE_RESULT_ROWS, computeNeBalanceSuggestions, computeNeResultSuggestions } from './ne'

const accounts = [
  { code: '1930', name: 'Företagskonto' },        // b9, kassa/bank
  { code: '1510', name: 'Kundfordringar' },        // b7
  { code: '1220', name: 'Maskiner och inventarier' }, // b4
  { code: '2010', name: 'Eget kapital' },          // ingen NE-rad (B10 härlett)
  { code: '2440', name: 'Leverantörsskulder' },    // b15
  { code: '2730', name: 'Sociala avgifter' },      // b16 (26xx-29xx)
]

function ver(rows, overrides = {}) {
  return { status: 'booked', date: '2026-06-15', rows, ...overrides }
}

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

describe('computeNeBalanceSuggestions', () => {
  it('sums booked account balances into the right NE fields', () => {
    const verifications = [
      ver([
        { account: '1930', debet: 10000, kredit: 0 },
        { account: '2010', debet: 0, kredit: 10000 },
      ]),
      ver([
        { account: '1510', debet: 5000, kredit: 0 },
        { account: '1220', debet: 3000, kredit: 0 },
        { account: '2440', debet: 0, kredit: 6000 },
        { account: '2730', debet: 0, kredit: 2000 },
      ]),
    ]
    const { values, unmatched } = computeNeBalanceSuggestions(verifications, accounts, new Date('2026-12-31T23:59:59'))
    expect(values.b9).toBe(10000)  // kassa/bank
    expect(values.b7).toBe(5000)   // kundfordringar
    expect(values.b4).toBe(3000)   // maskiner och inventarier
    expect(values.b15).toBe(6000)  // leverantörsskulder
    expect(values.b16).toBe(2000)  // 2730 -> "26xx-29xx" övriga skulder
    // 2010 (eget kapital) täcks inte av någon rad — B10 är härlett, inte
    // ett eget konto-summerat fält, se filkommentaren i ne.js.
    expect(unmatched.some(a => a.code === '2010')).toBe(true)
  })

  it('excludes drafts and verifications after asOfDate, same as INK2R', () => {
    const verifications = [
      ver([{ account: '1930', debet: 1000, kredit: 0 }, { account: '2010', debet: 0, kredit: 1000 }], { status: 'draft' }),
      ver([{ account: '1930', debet: 500, kredit: 0 }, { account: '2010', debet: 0, kredit: 500 }], { date: '2027-01-05' }),
    ]
    const { values } = computeNeBalanceSuggestions(verifications, accounts, new Date('2026-12-31T23:59:59'))
    expect(values.b9).toBeUndefined()
  })
})

describe('computeNeResultSuggestions', () => {
  it('sums a full year of booked verifications, income positive, costs positive-cost', () => {
    const verifications = [
      ver([{ account: '3001', debet: 0, kredit: 100000 }, { account: '1930', debet: 100000, kredit: 0 }], { date: '2026-03-01' }),
      ver([{ account: '5010', debet: 20000, kredit: 0 }, { account: '1930', debet: 0, kredit: 20000 }], { date: '2026-04-01' }),
      ver([{ account: '7010', debet: 30000, kredit: 0 }, { account: '1930', debet: 0, kredit: 30000 }], { date: '2026-05-01' }),
    ]
    const { values } = computeNeResultSuggestions(verifications, '2026')
    expect(values.r1).toBe(100000)  // försäljning, momspliktig
    expect(values.r6).toBe(20000)   // övriga externa kostnader
    expect(values.r7).toBe(30000)   // anställd personal
  })

  it('splits a shared interest account by sign — credit (income) to R4, debit (cost) to R8', () => {
    const income = [ver([{ account: '8020', debet: 0, kredit: 500 }, { account: '1930', debet: 500, kredit: 0 }], { date: '2026-02-01' })]
    const cost = [ver([{ account: '8020', debet: 500, kredit: 0 }, { account: '1930', debet: 0, kredit: 500 }], { date: '2026-02-01' })]
    expect(computeNeResultSuggestions(income, '2026').values.r4).toBe(500)
    expect(computeNeResultSuggestions(cost, '2026').values.r8).toBe(500)
  })

  it('ignores verifications from other years', () => {
    const verifications = [ver([{ account: '3001', debet: 0, kredit: 100000 }, { account: '1930', debet: 100000, kredit: 0 }], { date: '2025-03-01' })]
    expect(computeNeResultSuggestions(verifications, '2026').values.r1).toBeUndefined()
  })
})
