import { describe, it, expect } from 'vitest'
import { detectOrgType, formatLegalForm, formatOrgNr } from './orgType'

describe('detectOrgType', () => {
  // Den FÖRSTA siffran kodar juridisk form (se orgType.js:s kommentar).
  it('identifies Aktiebolag (first digit 5)', () => {
    expect(detectOrgType('556123-4567')).toBe('Aktiebolag (AB)')
  })

  it('identifies Handelsbolag/Kommanditbolag (first digit 9)', () => {
    expect(detectOrgType('916123-4567')).toBe('Handelsbolag / Kommanditbolag')
  })

  it('identifies Ekonomisk förening (first digit 7)', () => {
    expect(detectOrgType('716123-4567')).toBe('Ekonomisk förening')
  })

  it('identifies Ideell förening / stiftelse (first digit 8)', () => {
    expect(detectOrgType('816123-4567')).toBe('Ideell förening / stiftelse')
  })

  it('identifies a state/region/municipality org number (first digit 2)', () => {
    expect(detectOrgType('202100-5448')).toBe('Stat, region eller kommun') // Skatteverket
  })

  // Regressionstest: den gamla implementationen kollade om de FÖRSTA två
  // siffrorna var 19/20 (ett sekel-prefix) för att känna igen en enskild
  // firma — det matchar aldrig den vanliga 10-siffriga formen som resten
  // av appen faktiskt använder (se formatOrgNr, som kapar vid 10 siffror).
  // Rätt regel är tredje siffran (0 eller 1 = personnummer/enskild firma),
  // verifierad mot sv.wikipedia.org/wiki/Organisationsnummer.
  it('identifies Enskild firma from a standard 10-digit personnummer (third digit = month\'s first digit, 0 or 1)', () => {
    expect(detectOrgType('850315-1234')).toBe('Enskild firma') // mars (03) → tredje siffran 0
    expect(detectOrgType('901015-1234')).toBe('Enskild firma') // oktober (10) → tredje siffran 1
  })

  it('still identifies Enskild firma from a full 12-digit personnummer (with century)', () => {
    expect(detectOrgType('19850315-1234')).toBe('Enskild firma')
    expect(detectOrgType('20010101-1234')).toBe('Enskild firma')
  })

  it('does not misclassify a real org number as a personnummer just because it starts with 19/20', () => {
    // Tredje siffran (5) är ≥2, så det här ska INTE tolkas som ett
    // personnummer bara för att de FÖRSTA två siffrorna råkar vara "19"
    // — det var precis den gamla (felaktiga) regeln.
    expect(detectOrgType('195523-4567')).not.toBe('Enskild firma')
  })

  it('returns null for too-short input', () => {
    expect(detectOrgType('5561')).toBe(null)
    expect(detectOrgType('')).toBe(null)
    expect(detectOrgType(null)).toBe(null)
  })
})

describe('formatLegalForm', () => {
  it('expands known Bolagsverket abbreviations', () => {
    expect(formatLegalForm('AB')).toBe('Aktiebolag')
    expect(formatLegalForm('HB')).toBe('Handelsbolag')
    expect(formatLegalForm('KB')).toBe('Kommanditbolag')
    expect(formatLegalForm('EF')).toBe('Enskild firma')
  })

  it('is case-insensitive', () => {
    expect(formatLegalForm('ab')).toBe('Aktiebolag')
  })

  it('returns an unmapped code unchanged rather than guessing', () => {
    expect(formatLegalForm('XYZ')).toBe('XYZ')
  })

  it('returns empty string for empty input', () => {
    expect(formatLegalForm('')).toBe('')
    expect(formatLegalForm(null)).toBe('')
  })
})

describe('formatOrgNr', () => {
  it('inserts a hyphen after 6 digits', () => {
    expect(formatOrgNr('5561234567')).toBe('556123-4567')
  })

  it('leaves short input without a hyphen', () => {
    expect(formatOrgNr('556123')).toBe('556123')
  })

  it('strips non-digits and caps at 10 digits', () => {
    expect(formatOrgNr('556123-4567-extra')).toBe('556123-4567')
  })
})
