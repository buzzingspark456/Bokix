import { describe, it, expect } from 'vitest'
import { reconcileSieOpenings, applySieOpeningReconcile, SIE_OPENING_DESCRIPTION } from './sieOpeningReconcile'
import { computeBalanceSheet } from './reportCalculations'

const row = (account, debet, kredit) => ({ account, accountName: account, debet: String(debet), kredit: String(kredit) })
const opening = (id, date, rows) => ({ id, date, description: SIE_OPENING_DESCRIPTION, source: 'sie_import', status: 'booked', rows })
const ver = (id, date, rows) => ({ id, date, description: 'x', source: 'sie_import', status: 'booked', rows })
const accounts = ['1930', '1940', '2081', '2099', '2440', '3001', '5010'].map(code => ({ code, name: code }))
const balanceOf = (verifications, code, date) => {
  const bs = computeBalanceSheet(verifications, accounts, new Date(`${date}T00:00:00`))
  const r = [...bs.assets, ...bs.equityAndLiabilities].find(x => x.code === code)
  return r ? r.amount : 0
}

// 2025: IB, en försäljning (+40 000 på 1940), en kostnad (−10 000). Bokslutat i
// det gamla programmet, så 2026 års #IB har resultatet 30 000 på 2099.
const ib2025 = opening('ib25', '2025-01-01', [row('1940', 100000, 0), row('2081', 0, 100000)])
const year2025 = [
  ver('a1', '2025-03-01', [row('1940', 40000, 0), row('3001', 0, 40000)]),
  ver('a2', '2025-06-01', [row('5010', 10000, 0), row('1940', 0, 10000)]),
]
const ib2026 = opening('ib26', '2026-01-01', [row('1940', 130000, 0), row('2081', 0, 100000), row('2099', 0, 30000)])

describe('reconcileSieOpenings', () => {
  it('lämnar en ensam ingående balans orörd (ingen historik före)', () => {
    const r = reconcileSieOpenings([ib2026])
    expect(r.needsRepair).toBe(false)
    expect(r.removals).toEqual([])
  })

  it('tar bort dubbletten när föregående års verifikationer redan ger saldot', () => {
    const before = [ib2025, ...year2025, ib2026]
    expect(balanceOf(before, '1940', '2026-01-31')).toBe(260000) // felet kunden såg

    const r = reconcileSieOpenings(before)
    expect(r.needsRepair).toBe(true)
    const after = applySieOpeningReconcile(before, r)
    expect(balanceOf(after, '1940', '2026-01-31')).toBe(130000)
    expect(balanceOf(after, '2081', '2026-01-31')).toBe(100000)
    // Förra årets resultat ligger kvar på resultatkontona (ej bokslutat i
    // Bokix), så 2099 får det inte en gång till.
    const fixed = after.find(v => v.id === 'ib26')
    expect(fixed).toBeUndefined()
  })

  it('bokar bara skillnaden när filens #IB avviker från historiken', () => {
    const ib = opening('ib26', '2026-01-01', [row('1940', 129000, 0), row('2440', 0, 0), row('1930', 1000, 0), row('2081', 0, 100000), row('2099', 0, 30000)])
    const list = [ib2025, ...year2025, ib]
    const after = applySieOpeningReconcile(list, reconcileSieOpenings(list))
    expect(balanceOf(after, '1940', '2026-01-31')).toBe(129000)
    expect(balanceOf(after, '1930', '2026-01-31')).toBe(1000)
    const v = after.find(x => x.id === 'ib26')
    const d = v.rows.reduce((s, r) => s + Number(r.debet) - Number(r.kredit), 0)
    expect(Math.abs(d)).toBeLessThan(0.005)
    expect(v.sieOpeningTarget).toEqual(ib.rows)
  })

  it('fungerar även när 2026 importerades före 2025', () => {
    const list = [ib2026, ib2025, ...year2025]
    const after = applySieOpeningReconcile(list, reconcileSieOpenings(list))
    expect(balanceOf(after, '1940', '2026-01-31')).toBe(130000)
  })

  it('är idempotent', () => {
    const ib = opening('ib26', '2026-01-01', [row('1940', 129000, 0), row('1930', 1000, 0), row('2081', 0, 100000), row('2099', 0, 30000)])
    const list = [ib2025, ...year2025, ib]
    const once = applySieOpeningReconcile(list, reconcileSieOpenings(list))
    const again = reconcileSieOpenings(once)
    expect(again.needsRepair).toBe(false)
    expect(again.updates).toEqual([])
  })

  it('rör inte andra verifikationer', () => {
    const list = [ib2025, ...year2025, ib2026]
    const after = applySieOpeningReconcile(list, reconcileSieOpenings(list))
    expect(after.filter(v => v.id.startsWith('a'))).toEqual(year2025)
    expect(after.find(v => v.id === 'ib25').rows).toEqual(ib2025.rows)
  })
})
