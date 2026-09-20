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

import { withRoundingBalance } from './verificationAmounts'

describe('withRoundingBalance', () => {
  it('lämnar en balanserad verifikation orörd', () => {
    const rows = [{ account: '1930', debet: 100, kredit: 0 }, { account: '3001', debet: 0, kredit: 100 }]
    expect(withRoundingBalance(rows)).toBe(rows)
  })
  it('bokar en krona för mycket debet som kredit på 3740', () => {
    const rows = [{ account: '1510', debet: 373, kredit: 0 }, { account: '3001', debet: 0, kredit: 299 }, { account: '2611', debet: 0, kredit: 74 }]
    expect(withRoundingBalance(rows)).toEqual([...rows])
    const off = [{ account: '1510', debet: 374, kredit: 0 }, { account: '3001', debet: 0, kredit: 299 }, { account: '2611', debet: 0, kredit: 74 }]
    expect(withRoundingBalance(off).slice(-1)[0]).toEqual({ account: '3740', debet: 0, kredit: 1 })
  })
  it('bokar för mycket kredit som debet på 3740', () => {
    const rows = [{ account: '5460', debet: 100, kredit: 0 }, { account: '1930', debet: 0, kredit: 101 }]
    expect(withRoundingBalance(rows).slice(-1)[0]).toEqual({ account: '3740', debet: 1, kredit: 0 })
  })
  it('förstår ören och strängbelopp', () => {
    const rows = [{ account: '5460', debet: '80.40', kredit: '' }, { account: '2641', debet: '20.10', kredit: '' }, { account: '1930', debet: '', kredit: '101' }]
    expect(withRoundingBalance(rows).slice(-1)[0]).toEqual({ account: '3740', debet: 0.5, kredit: 0 })
  })
  it('rör inte en större skillnad än avrundning', () => {
    const rows = [{ account: '5460', debet: 100, kredit: 0 }, { account: '1930', debet: 0, kredit: 105 }]
    expect(withRoundingBalance(rows)).toBe(rows)
  })
  it('tål tomma rader', () => {
    expect(withRoundingBalance([])).toEqual([])
    expect(withRoundingBalance(undefined)).toEqual([])
  })
})
