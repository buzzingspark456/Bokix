import { describe, it, expect } from 'vitest'
import { formatPersonnummerInput, validatePersonnummer } from './personnummer'

describe('formatPersonnummerInput', () => {
  it('inserts a hyphen after 8 digits while typing', () => {
    expect(formatPersonnummerInput('198501011234')).toBe('19850101-1234')
  })

  it('leaves short input without a hyphen', () => {
    expect(formatPersonnummerInput('19850101')).toBe('19850101')
  })

  it('strips non-digit characters and caps at 12 digits', () => {
    expect(formatPersonnummerInput('19850101-1234extra')).toBe('19850101-1234')
  })
})

describe('validatePersonnummer', () => {
  // 19900101-1239: synthetic test value, Luhn checksum verified independently.
  it('accepts a valid personnummer', () => {
    expect(validatePersonnummer('19900101-1239')).toEqual({ valid: true, error: null })
  })

  it('rejects an empty value', () => {
    const result = validatePersonnummer('')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/krävs/)
  })

  it('rejects a value with the wrong digit count', () => {
    const result = validatePersonnummer('19900101123')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/12 siffror/)
  })

  it('rejects an out-of-range month', () => {
    const result = validatePersonnummer('19901301-2384')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/månad/)
  })

  it('rejects a calendar date that does not exist', () => {
    // 1990-02-30 does not exist
    const result = validatePersonnummer('19900230-1234')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/kalendern/)
  })

  it('accepts a coordination number (samordningsnummer, day + 60)', () => {
    const result = validatePersonnummer('19900161-1236')
    expect(result.valid).toBe(true)
  })

  it('rejects a value with an invalid Luhn checksum', () => {
    const result = validatePersonnummer('19900101-1238')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/Luhn/)
  })
})
