import { describe, it, expect } from 'vitest'
import { getDebet, getKredit } from './verificationAmounts'

describe('getDebet / getKredit', () => {
  it('reads the current debet/kredit fields', () => {
    expect(getDebet({ debet: 500 })).toBe(500)
    expect(getKredit({ kredit: 250 })).toBe(250)
  })

  it('falls back to the legacy debit/credit fields', () => {
    expect(getDebet({ debit: 500 })).toBe(500)
    expect(getKredit({ credit: 250 })).toBe(250)
  })

  it('coerces string amounts to numbers instead of concatenating them', () => {
    // Regression: manually entered rows used to store amounts as raw strings
    // straight from a text input's e.target.value, never parsed.
    expect(getDebet({ debet: '0' })).toBe(0)
    expect(getDebet({ debet: '500.00' })).toBe(500)
  })

  it('defaults to 0 for missing, null, or non-numeric values', () => {
    expect(getDebet({})).toBe(0)
    expect(getDebet({ debet: null })).toBe(0)
    expect(getDebet({ debet: 'not-a-number' })).toBe(0)
    expect(getKredit(undefined)).toBe(0)
  })
})
