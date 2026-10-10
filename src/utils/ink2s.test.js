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

describe('INK2S i SRU och förslag (2026-10-10)', async () => {
  const { ink2sSruRows, suggestInk2s, resolveInk2sValues } = await import('./ink2s')
  const { generateInk2rSru } = await import('./sruExport')
  const fy = { start: '2025-01-01', end: '2025-12-31' }
  const v = (date, rows, extra = {}) => ({ id: date + Math.random(), date, rows, ...extra })

  it('skriver resultat, justeringar och överskott med rätt koder', () => {
    const r = computeInk2s({ '4.3c': 1000, '4.13': -500 }, 50000)
    expect(ink2sSruRows(r)).toEqual([['7650', 50000], ['7653', 1000], ['7762', 500], ['7670', 50500]])
  })
  it('förlust och underskott', () => {
    const r = computeInk2s({}, -20000)
    expect(ink2sSruRows(r)).toEqual([['7750', 20000], ['7770', 20000]])
  })
  it('föreslår skatt, ej avdragsgilla kostnader, skattefri ränta och schablonintäkt', () => {
    const verifications = [
      v('2024-12-31', [{ account: '2125', debet: 0, kredit: 100000 }, { account: '8811', debet: 100000, kredit: 0 }]),
      v('2025-03-01', [{ account: '6072', debet: 1200, kredit: 0 }, { account: '1930', debet: 0, kredit: 1200 }]),
      v('2025-05-01', [{ account: '1630', debet: 40, kredit: 0 }, { account: '8314', debet: 0, kredit: 40 }]),
      v('2025-12-31', [{ account: '8910', debet: 9000, kredit: 0 }, { account: '2512', debet: 0, kredit: 9000 }]),
    ]
    const s = suggestInk2s({ verifications, fy, previousUnderskott: 3000 })
    expect(s.suggestions).toEqual({ '4.3a': 9000, '4.3c': 1200, '4.5c': 40, '4.6a': 1960, '4.14a': 3000 })
  })
  it('det användaren skrivit går före förslaget, även 0', () => {
    const vals = resolveInk2sValues({ '4.3c': '0', '4.3a': '' }, { '4.3a': 9000, '4.3c': 1200 })
    expect(vals['4.3a']).toBe(9000)
    expect(vals['4.3c']).toBe(0)
  })
  it('SRU-filen får INK2S-raderna och överskottet på huvudblanketten', () => {
    const ink2s = computeInk2s({ '4.3c': 1000 }, 50000)
    const { blankettSru } = generateInk2rSru({ orgNr: '5566778899', name: 'AB', postalCode: '11122', city: 'Sthlm' }, { rows: [] }, [{ row: '3.26', amount: 50000 }], fy, new Date(2026, 0, 1), ink2s)
    expect(blankettSru).toMatch(/#BLANKETT INK2-2025P4[\s\S]*#UPPGIFT 7104 51000/)
    expect(blankettSru).toMatch(/#BLANKETT INK2S-2025P4[\s\S]*#UPPGIFT 7653 1000[\s\S]*#UPPGIFT 7670 51000/)
  })
})
