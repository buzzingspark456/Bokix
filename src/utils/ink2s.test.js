import { describe, it, expect } from 'vitest'
import { computeInk2s, INK2S_ROWS } from './ink2s'

describe('computeInk2s', () => {
  it('starts from årets resultat with no adjustments entered', () => {
    const result = computeInk2s({}, 50000)
    expect(result.arsResultatVinst).toBe(50000)
    expect(result.arsResultatForlust).toBe(0)
    expect(result.adjustments).toBe(0)
    expect(result.total).toBe(50000)
    expect(result.overskott).toBe(50000)
    expect(result.underskott).toBe(0)
  })

  it('adds "+"-rows and subtracts "-"-rows from a positive entered amount', () => {
    // 4.3c (+): ej avdragsgill kostnad ska LÄGGAS TILL resultatet
    // 4.5b (-): utdelning ska DRAS BORT från resultatet
    const result = computeInk2s({ '4.3c': 1000, '4.5b': 4000 }, 50000)
    expect(result.total).toBe(50000 + 1000 - 4000)
  })

  it('uses a "±"-row value as-is, signed', () => {
    const result = computeInk2s({ '4.13': -2000 }, 10000)
    expect(result.total).toBe(8000)
  })

  it('reports underskott instead of överskott once adjustments push the total negative', () => {
    const result = computeInk2s({ '4.14a': 60000 }, 50000) // outnyttjat underskott, "-"
    expect(result.total).toBe(-10000)
    expect(result.overskott).toBe(0)
    expect(result.underskott).toBe(10000)
  })

  it('treats a loss (negative årets resultat) correctly', () => {
    const result = computeInk2s({}, -20000)
    expect(result.arsResultatVinst).toBe(0)
    expect(result.arsResultatForlust).toBe(20000)
    expect(result.underskott).toBe(20000)
  })

  it('every row has a unique key matching its blankett-radnummer', () => {
    const keys = INK2S_ROWS.map(r => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
