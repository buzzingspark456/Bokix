import { describe, it, expect } from 'vitest'
import {
  roundKr, computeVatPeriod, validateVatPeriod, compareToPreviousPeriod,
  quarterToRange, previousQuarterRange, findLockedVatPeriod,
} from './vatCalculation'

function verification({ id, date, status = 'booked', rows }) {
  return { id, date, status, rows }
}

describe('roundKr', () => {
  it('rounds to the nearest whole krona', () => {
    expect(roundKr(100.4)).toBe(100)
    expect(roundKr(100.5)).toBe(101)
  })

  it('treats missing/undefined as 0', () => {
    expect(roundKr(undefined)).toBe(0)
  })
})

describe('computeVatPeriod', () => {
  const verifications = [
    // Sale at 25%: 1000 kr underlag (3001, kredit) + 250 kr output VAT (2611, kredit)
    verification({
      id: 'v1', date: '2026-01-15', rows: [
        { account: '1510', debet: 1250 },
        { account: '3001', kredit: 1000 },
        { account: '2611', kredit: 250 },
      ],
    }),
    // Purchase with input VAT: 200 kr (2641, debet)
    verification({
      id: 'v2', date: '2026-01-20', rows: [
        { account: '4000', debet: 800 },
        { account: '2641', debet: 200 },
        { account: '2440', kredit: 1000 },
      ],
    }),
    // Outside the period entirely — must not be counted
    verification({
      id: 'v3', date: '2026-04-01', rows: [
        { account: '3001', kredit: 999 },
        { account: '2611', kredit: 250 },
      ],
    }),
    // Draft inside the period — must be excluded (not yet booked)
    verification({
      id: 'v4', date: '2026-02-01', status: 'draft', rows: [
        { account: '3001', kredit: 5000 },
        { account: '2611', kredit: 1250 },
      ],
    }),
  ]

  it('sums sales, output VAT, and input VAT only for booked verifications within the period', () => {
    const result = computeVatPeriod({ verifications, periodStart: '2026-01-01', periodEnd: '2026-03-31' })
    expect(result.underlagByRate[25]).toBe(1000)
    expect(result.outputVatByRate[25]).toBe(250)
    expect(result.inputVat).toBe(200)
    expect(result.outputVatTotal).toBe(250)
    expect(result.netToPay).toBe(50) // 250 output - 200 input
    expect(result.touchedVerificationIds.sort()).toEqual(['v1', 'v2'])
  })

  it('returns zeroes for a period with no matching verifications', () => {
    const result = computeVatPeriod({ verifications, periodStart: '2020-01-01', periodEnd: '2020-01-31' })
    expect(result.outputVatTotal).toBe(0)
    expect(result.inputVat).toBe(0)
    expect(result.netToPay).toBe(0)
  })
})

describe('validateVatPeriod', () => {
  it('flags an unbalanced verification', () => {
    const verifications = [
      verification({ id: 'v1', date: '2026-01-15', rows: [{ account: '1510', debet: 1000 }, { account: '3001', kredit: 900 }] }),
    ]
    const result = validateVatPeriod({ verifications, periodStart: '2026-01-01', periodEnd: '2026-01-31' })
    expect(result.canProceed).toBe(false)
    expect(result.errors.some(e => e.type === 'unbalanced')).toBe(true)
  })

  it('flags a sales row with no matching VAT row', () => {
    const verifications = [
      verification({
        id: 'v1', date: '2026-01-15', rows: [
          { account: '1510', debet: 1000 },
          { account: '3001', kredit: 1000 },
        ],
      }),
    ]
    const result = validateVatPeriod({ verifications, periodStart: '2026-01-01', periodEnd: '2026-01-31' })
    expect(result.canProceed).toBe(false)
    expect(result.errors.some(e => e.type === 'missing_vat_rate')).toBe(true)
  })

  it('flags source documents in the period with no VAT-touching booking at all', () => {
    const result = validateVatPeriod({
      verifications: [],
      invoices: [{ date: '2026-01-10', status: 'sent' }],
      expenses: [],
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
    })
    expect(result.canProceed).toBe(false)
    expect(result.errors.some(e => e.type === 'missing_booking')).toBe(true)
  })

  it('passes a balanced, fully VAT-booked period with no source-doc mismatch', () => {
    const verifications = [
      verification({
        id: 'v1', date: '2026-01-15', rows: [
          { account: '1510', debet: 1250 },
          { account: '3001', kredit: 1000 },
          { account: '2611', kredit: 250 },
        ],
      }),
    ]
    const result = validateVatPeriod({ verifications, invoices: [], expenses: [], periodStart: '2026-01-01', periodEnd: '2026-01-31' })
    expect(result.canProceed).toBe(true)
    expect(result.errors).toEqual([])
  })
})

describe('compareToPreviousPeriod', () => {
  const calc = (total25) => ({ underlagByRate: { 25: total25, 12: 0, 6: 0 } })

  it('warns when sales more than double compared to the previous period', () => {
    const warnings = compareToPreviousPeriod(calc(3000), calc(1000))
    expect(warnings.length).toBe(1)
  })

  it('warns when sales drop below a fifth of the previous period', () => {
    const warnings = compareToPreviousPeriod(calc(100), calc(1000))
    expect(warnings.length).toBe(1)
  })

  it('stays quiet for a normal fluctuation', () => {
    const warnings = compareToPreviousPeriod(calc(1100), calc(1000))
    expect(warnings.length).toBe(0)
  })
})

describe('quarterToRange / previousQuarterRange', () => {
  it('computes the calendar range for a quarter', () => {
    expect(quarterToRange(2026, 1)).toEqual(['2026-01-01', '2026-03-31'])
    expect(quarterToRange(2026, 4)).toEqual(['2026-10-01', '2026-12-31'])
  })

  it('rolls Q1 back to Q4 of the previous year', () => {
    expect(previousQuarterRange(2026, 1)).toEqual(quarterToRange(2025, 4))
  })

  it('steps back one quarter within the same year otherwise', () => {
    expect(previousQuarterRange(2026, 3)).toEqual(quarterToRange(2026, 2))
  })
})

describe('findLockedVatPeriod', () => {
  const vatPeriods = {
    '2026-Q1': { periodStart: '2026-01-01', periodEnd: '2026-03-31', bookedAt: '2026-04-05' },
  }

  it('finds the locked period containing a date', () => {
    expect(findLockedVatPeriod('2026-02-10', vatPeriods)).toBe(vatPeriods['2026-Q1'])
  })

  it('returns null when the date falls outside any locked period', () => {
    expect(findLockedVatPeriod('2026-05-01', vatPeriods)).toBeNull()
  })

  it('returns null when there are no locked periods yet', () => {
    expect(findLockedVatPeriod('2026-02-10', null)).toBeNull()
  })
})
