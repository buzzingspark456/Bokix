import { describe, it, expect } from 'vitest'
import { validateEmailList, isValidEmail, isValidIban } from './validators'

describe('isValidEmail', () => {
  it('accepts a well-formed address', () => {
    expect(isValidEmail('anna@example.com')).toBe(true)
  })

  it('rejects an address without a domain', () => {
    expect(isValidEmail('anna@')).toBe(false)
  })

  it('treats an empty value as valid (required-ness is handled elsewhere)', () => {
    expect(isValidEmail('')).toBe(true)
  })
})

describe('validateEmailList', () => {
  it('accepts a comma-separated list of valid addresses', () => {
    expect(validateEmailList('a@example.com, b@example.com')).toEqual({ valid: true, invalid: null })
  })

  it('reports the specific address that is invalid', () => {
    expect(validateEmailList('a@example.com, not-an-email, b@example.com'))
      .toEqual({ valid: false, invalid: 'not-an-email' })
  })

  it('treats an empty/blank value as valid', () => {
    expect(validateEmailList('  ')).toEqual({ valid: true, invalid: null })
  })
})

describe('isValidIban', () => {
  it('accepts a well-known valid IBAN', () => {
    // Official IBAN example from the ISO 13616 registry.
    expect(isValidIban('SE45 5000 0000 0583 9825 7466')).toBe(true)
  })

  it('rejects an IBAN with a broken checksum', () => {
    expect(isValidIban('SE45 5000 0000 0583 9825 7467')).toBe(false)
  })

  it('rejects an IBAN with the wrong length for its country', () => {
    expect(isValidIban('SE45 5000 0000 0583 9825')).toBe(false)
  })

  it('treats an empty value as valid (required-ness is handled elsewhere)', () => {
    expect(isValidIban('')).toBe(true)
  })
})
