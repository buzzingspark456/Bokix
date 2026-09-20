import { describe, it, expect } from 'vitest'
import { buildYearEndClosing, computeYearResult, resultAccountFor } from './yearEnd'
import { sumFlowByType, computeBalanceSheet, computeLedger, isClosingEntry } from './reportCalculations'
import { computeInk2rResultat } from './ink2rResultat'
import { computeNeResultSuggestions } from './ne'

const accounts = [
  { code: '1930', name: 'Företagskonto', type: 'tillgang' },
  { code: '2019', name: 'Årets resultat', type: 'skuld_kapital' },
  { code: '2029', name: 'Årets resultat, delägare 2', type: 'skuld_kapital' },
  { code: '2099', name: 'Årets resultat', type: 'skuld_kapital' },
  { code: '3001', name: 'Försäljning', type: 'intakt' },
  { code: '5010', name: 'Lokalhyra', type: 'kostnad' },
  { code: '8310', name: 'Ränteintäkter', type: 'intakt' },
  { code: '8410', name: 'Räntekostnader', type: 'kostnad' },
]
const ver = (id, date, rows, extra = {}) => ({ id, date, rows, ...extra })
const year = [
  ver('v1', '2026-03-01', [{ account: '1930', debet: 100000, kredit: 0 }, { account: '3001', debet: 0, kredit: 100000 }]),
  ver('v2', '2026-04-01', [{ account: '5010', debet: 30000, kredit: 0 }, { account: '1930', debet: 0, kredit: 30000 }]),
  ver('v3', '2026-05-01', [{ account: '1930', debet: 500, kredit: 0 }, { account: '8310', debet: 0, kredit: 500 }]),
  ver('v4', '2026-06-01', [{ account: '8410', debet: 1200.5, kredit: 0 }, { account: '1930', debet: 0, kredit: 1200.5 }]),
  ver('v5', '2025-12-01', [{ account: '5010', debet: 999, kredit: 0 }, { account: '1930', debet: 0, kredit: 999 }]),
  ver('v6', '2026-07-01', [{ account: '5010', debet: 5, kredit: 0 }, { account: '1930', debet: 0, kredit: 5 }], { status: 'draft' }),
]
const sum = (rows, key) => Math.round(rows.reduce((s, r) => s + (r[key] || 0), 0) * 100) / 100

describe('resultAccountFor', () => {
  it('enskild firma 2019, övriga 2099', () => {
    expect(resultAccountFor('Enskild firma')).toBe('2019')
    expect(resultAccountFor('Aktiebolag (AB)')).toBe('2099')
    expect(resultAccountFor('Ekonomisk förening')).toBe('2099')
    expect(resultAccountFor(null)).toBe('2099')
  })
})

describe('computeYearResult', () => {
  it('räknar klass 3–8, bara året, inga utkast', () => {
    expect(computeYearResult(year, '2026')).toBe(69299.5)
  })
})

describe('buildYearEndClosing', () => {
  it('aktiebolag: bokar resultatet på 2099 och balanserar', () => {
    const { verification, result, destination } = buildYearEndClosing({ verifications: year, year: '2026', orgType: 'Aktiebolag (AB)' })
    expect(result).toBe(69299.5)
    expect(destination).toBe('2099')
    expect(sum(verification.rows, 'debet')).toBe(sum(verification.rows, 'kredit'))
    expect(verification.rows.find(r => r.account === '2099')).toEqual({ account: '2099', debet: 0, kredit: 69299.5 })
    expect(verification.source).toBe('year_end_close')
    expect(verification.date).toBe('2026-12-31')
  })

  it('stänger även klass 8 (finansiella poster)', () => {
    const { verification } = buildYearEndClosing({ verifications: year, year: '2026', orgType: 'Aktiebolag (AB)' })
    expect(verification.rows.find(r => r.account === '8310')).toEqual({ account: '8310', debet: 500, kredit: 0 })
    expect(verification.rows.find(r => r.account === '8410')).toEqual({ account: '8410', debet: 0, kredit: 1200.5 })
  })

  it('enskild firma: bokar resultatet på 2019', () => {
    const { verification, destination } = buildYearEndClosing({ verifications: year, year: '2026', orgType: 'Enskild firma' })
    expect(destination).toBe('2019')
    expect(verification.rows.find(r => r.account === '2019')).toEqual({ account: '2019', debet: 0, kredit: 69299.5 })
    expect(verification.rows.some(r => r.account === '2099')).toBe(false)
    expect(sum(verification.rows, 'debet')).toBe(sum(verification.rows, 'kredit'))
  })

  it('förlust bokas som debet på eget kapital', () => {
    const loss = [ver('l1', '2026-02-01', [{ account: '5010', debet: 1000, kredit: 0 }, { account: '1930', debet: 0, kredit: 1000 }])]
    const { verification, result } = buildYearEndClosing({ verifications: loss, year: '2026', orgType: 'Enskild firma' })
    expect(result).toBe(-1000)
    expect(verification.rows.find(r => r.account === '2019')).toEqual({ account: '2019', debet: 1000, kredit: 0 })
    expect(sum(verification.rows, 'debet')).toBe(sum(verification.rows, 'kredit'))
  })

  it('handelsbolag med delägare: fördelas direkt på delägarnas resultatkonton', () => {
    const partners = [{ id: 'a', name: 'A', sharePct: 50 }, { id: 'b', name: 'B', sharePct: 50 }]
    const { verification, destination } = buildYearEndClosing({ verifications: year, year: '2026', orgType: 'Handelsbolag / Kommanditbolag', partners })
    expect(destination).toBe('partners')
    expect(verification.rows.find(r => r.account === '2019').kredit).toBe(34649.75)
    expect(verification.rows.find(r => r.account === '2029').kredit).toBe(34649.75)
    expect(verification.rows.some(r => r.account === '2099')).toBe(false)
    expect(sum(verification.rows, 'debet')).toBe(sum(verification.rows, 'kredit'))
  })

  it('handelsbolag: udda öre går till sista delägaren och verifikationen balanserar', () => {
    const partners = [{ id: 'a', name: 'A', sharePct: 33.33 }, { id: 'b', name: 'B', sharePct: 33.33 }, { id: 'c', name: 'C', sharePct: 33.34 }]
    const { verification } = buildYearEndClosing({ verifications: year, year: '2026', orgType: 'Handelsbolag / Kommanditbolag', partners })
    expect(sum(verification.rows, 'debet')).toBe(sum(verification.rows, 'kredit'))
  })

  it('inga resultatkonton med aktivitet ger ingen verifikation', () => {
    const { verification, result } = buildYearEndClosing({ verifications: [], year: '2026', orgType: 'Aktiebolag (AB)' })
    expect(verification).toBeNull()
    expect(result).toBe(0)
  })

  it('kan köras om utan att bokslutsverifikationen räknas med', () => {
    const closing = buildYearEndClosing({ verifications: year, year: '2026', orgType: 'Aktiebolag (AB)' }).verification
    expect(computeYearResult([...year, { ...closing, id: 'c' }], '2026')).toBe(69299.5)
  })
})

describe('rapporter efter att året är låst', () => {
  const closing = buildYearEndClosing({ verifications: year, year: '2026', orgType: 'Aktiebolag (AB)' }).verification
  const all = [...year, { ...closing, id: 'close' }]
  const start = new Date('2026-01-01T00:00:00')
  const end = new Date('2026-12-31T00:00:00')

  it('resultatsummor påverkas inte av bokslutsverifikationen', () => {
    expect(isClosingEntry(closing)).toBe(true)
    expect(sumFlowByType(all, accounts, 'intakt', start, end)).toBe(sumFlowByType(year, accounts, 'intakt', start, end))
    expect(sumFlowByType(all, accounts, 'kostnad', start, end)).toBe(sumFlowByType(year, accounts, 'kostnad', start, end))
    expect(sumFlowByType(all, accounts, 'intakt', start, end)).toBe(100500)
  })

  it('INK2R- och NE-underlaget behåller årets resultatposter', () => {
    const ink2 = computeInk2rResultat(all, 2026)
    const ink2Open = computeInk2rResultat(year, 2026)
    expect(ink2.rows).toEqual(ink2Open.rows)
    expect(ink2.rows.length).toBeGreaterThan(0)
    expect(computeNeResultSuggestions(all, 2026).values).toEqual(computeNeResultSuggestions(year, 2026).values)
  })

  it('balansräkningen balanserar efter bokslutet och huvudboken visar verifikationen', () => {
    const bs = computeBalanceSheet(all.filter(v => v.id !== 'v5'), accounts, end)
    expect(bs.totalAssets).toBeCloseTo(bs.totalEquityAndLiabilities, 2)
    expect(bs.equityAndLiabilities.find(r => r.code === '2099').amount).toBe(69299.5)
    const ledger = computeLedger(all, accounts, start, end)
    expect(ledger.accounts.some(a => a.code === '2099')).toBe(true)
  })
})

import { buildResultReclassification, legacyLockedYears } from './yearEnd'

describe('rättelse av år som låstes före bolagsformen', () => {
  it('flyttar en vinst från 2099 till 2019 med en balanserad verifikation', () => {
    const v = buildResultReclassification({ year: '2025', result: 69299.5, date: '2026-09-19' })
    expect(v.rows).toEqual([{ account: '2099', debet: 69299.5, kredit: 0 }, { account: '2019', debet: 0, kredit: 69299.5 }])
    expect(v.sourceId).toBe('equity_reclass_2025')
    expect(v.source).toBe('equity_reclass')
    expect(v.date).toBe('2026-09-19')
  })
  it('en förlust flyttas åt andra hållet', () => {
    const v = buildResultReclassification({ year: '2025', result: -1000, date: '2026-09-19' })
    expect(v.rows).toEqual([{ account: '2019', debet: 1000, kredit: 0 }, { account: '2099', debet: 0, kredit: 1000 }])
  })
  it('noll ger ingen verifikation', () => {
    expect(buildResultReclassification({ year: '2025', result: 0, date: '2026-09-19' })).toBeNull()
  })
  it('hittar bara lås utan sparat resultatkonto och med ett resultat', () => {
    expect(legacyLockedYears({
      2024: { lockedAt: 'x', result: 500 },
      2025: { lockedAt: 'x', result: 800, resultAccount: '2019' },
      2023: { lockedAt: 'x', result: 0 },
      2022: { lockedAt: 'x', result: -300 },
    })).toEqual([{ year: '2022', result: -300 }, { year: '2024', result: 500 }])
    expect(legacyLockedYears(undefined)).toEqual([])
  })
})
