import { describe, it, expect } from 'vitest'
import { computeInk2rResultat } from './ink2rResultat'

function ver(rows, overrides = {}) {
  return { status: 'booked', date: '2026-06-15', rows, ...overrides }
}

describe('computeInk2rResultat', () => {
  it('splits revenue and cost onto the right rows with the right sign', () => {
    const verifications = [
      ver([{ account: '3001', debet: 0, kredit: 10000 }, { account: '1930', debet: 10000, kredit: 0 }]),
      ver([{ account: '4000', debet: 4000, kredit: 0 }, { account: '1930', debet: 0, kredit: 4000 }]),
    ]
    const result = computeInk2rResultat(verifications, 2026)
    const byRow = Object.fromEntries(result.rows.map(r => [r.row, r.amount]))
    expect(byRow['3.1']).toBe(10000)  // nettoomsättning, positiv
    expect(byRow['3.6']).toBe(4000)   // handelsvaror, positiv kostnad
    expect(byRow['3.26']).toBe(6000)  // årets resultat, vinst
    expect(byRow['3.27']).toBeUndefined()
    expect(result.total).toBe(6000)
  })

  it('routes mottagna (8820) och lämnade (8830) koncernbidrag to separate rows', () => {
    const mottagna = computeInk2rResultat([ver([{ account: '8820', debet: 0, kredit: 5000 }])], 2026)
    expect(Object.fromEntries(mottagna.rows.map(r => [r.row, r.amount]))['3.20']).toBe(5000)

    const lamnade = computeInk2rResultat([ver([{ account: '8830', debet: 5000, kredit: 0 }])], 2026)
    expect(Object.fromEntries(lamnade.rows.map(r => [r.row, r.amount]))['3.19']).toBe(5000)
  })

  it('routes konto 8810 (periodiseringsfond) to återföring vs avsättning by sign', () => {
    const aterforing = computeInk2rResultat([ver([{ account: '8810', debet: 0, kredit: 3000 }])], 2026)
    expect(Object.fromEntries(aterforing.rows.map(r => [r.row, r.amount]))['3.21']).toBe(3000)

    const avsattning = computeInk2rResultat([ver([{ account: '8810', debet: 3000, kredit: 0 }])], 2026)
    expect(Object.fromEntries(avsattning.rows.map(r => [r.row, r.amount]))['3.22']).toBe(3000)
  })

  it('resolves the correct plus/minus field code for a dual-code row', () => {
    const vinst = computeInk2rResultat([ver([{ account: '8000', debet: 0, kredit: 4000 }])], 2026)
    const vinstRow = vinst.rows.find(r => r.row === '3.12')
    expect(vinstRow.fieldCode).toBe('7414') // Om netto +

    const forlust = computeInk2rResultat([ver([{ account: '8000', debet: 4000, kredit: 0 }])], 2026)
    const forlustRow = forlust.rows.find(r => r.row === '3.12')
    expect(forlustRow.fieldCode).toBe('7518') // Om netto -
  })

  it('never silently drops a class 3-8 account from the total, even in undocumented gaps', () => {
    // 8650 ligger i den odokumenterade luckan mellan koncernbidrag
    // (8820-8839) och periodiseringsfond (8810-8819) — se FALLBACK_RANGES.
    const verifications = [
      ver([{ account: '3001', debet: 0, kredit: 20000 }]),
      ver([{ account: '8650', debet: 3000, kredit: 0 }]),
    ]
    const result = computeInk2rResultat(verifications, 2026)
    expect(result.unmatched).toHaveLength(0)
    expect(result.total).toBe(17000) // 20000 intäkt - 3000 fallback-bokslutsdisposition
  })

  it('excludes drafts and verifications outside the given year', () => {
    const verifications = [
      ver([{ account: '3001', debet: 0, kredit: 1000 }], { status: 'draft' }),
      ver([{ account: '3001', debet: 0, kredit: 1000 }], { date: '2025-12-31' }),
    ]
    const result = computeInk2rResultat(verifications, 2026)
    expect(result.rows).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('shows a loss as row 3.27', () => {
    const verifications = [
      ver([{ account: '3001', debet: 0, kredit: 1000 }]),
      ver([{ account: '5010', debet: 4000, kredit: 0 }]),
    ]
    const result = computeInk2rResultat(verifications, 2026)
    const byRow = Object.fromEntries(result.rows.map(r => [r.row, r.amount]))
    expect(byRow['3.27']).toBe(3000)
    expect(byRow['3.26']).toBeUndefined()
    expect(result.total).toBe(-3000)
  })
})
