import { describe, it, expect } from 'vitest'
import {
  isBooked, classifyAccount, isCashAccount, getPeriodBounds, sumFlowByType,
  groupCostsByAccount, groupCostsByCategory, computeCashBalanceAt,
  buildCashflowSeries, buildResultSeries, computeBalanceSheet, hasAnyBookedData,
} from './reportCalculations'

const accounts = [
  { code: '1930', name: 'Företagskonto' },      // tillgång (kassa)
  { code: '1510', name: 'Kundfordringar' },      // tillgång
  { code: '2440', name: 'Leverantörsskulder' },  // skuld_kapital
  { code: '3001', name: 'Försäljning' },         // intäkt
  { code: '5010', name: 'Lokalhyra' },           // kostnad (Lokal-kategori)
  { code: '5910', name: 'Reklam' },              // kostnad (Marknadsföring-kategori)
  { code: '7210', name: 'Löner' },               // kostnad (Personal-kategori)
  { code: '6100', name: 'Kontorsmaterial' },     // kostnad (Övrigt-kategori)
]

function ver(overrides) {
  return { status: 'booked', date: '2026-06-15', rows: [], ...overrides }
}

describe('isBooked', () => {
  it('treats a missing status as booked', () => {
    expect(isBooked({})).toBe(true)
    expect(isBooked({ status: 'booked' })).toBe(true)
  })
  it('excludes drafts', () => {
    expect(isBooked({ status: 'draft' })).toBe(false)
  })
})

describe('classifyAccount', () => {
  it('prefers an explicit type field over the code', () => {
    expect(classifyAccount({ code: '3001', type: 'kostnad' })).toBe('kostnad')
  })
  it('falls back to the BAS class digit', () => {
    expect(classifyAccount({ code: '1930' })).toBe('tillgang')
    expect(classifyAccount({ code: '2440' })).toBe('skuld_kapital')
    expect(classifyAccount({ code: '3001' })).toBe('intakt')
    expect(classifyAccount({ code: '5010' })).toBe('kostnad')
    expect(classifyAccount({ code: '8999' })).toBe('kostnad')
  })
  it('returns null for an unknown class or missing account', () => {
    expect(classifyAccount({ code: '9999' })).toBe(null)
    expect(classifyAccount(null)).toBe(null)
  })
})

describe('isCashAccount', () => {
  it('accepts the full 1900-1999 range, inclusive', () => {
    expect(isCashAccount({ code: '1900' })).toBe(true)
    expect(isCashAccount({ code: '1930' })).toBe(true)
    expect(isCashAccount({ code: '1999' })).toBe(true)
  })
  it('rejects everything outside the range, including non-numeric codes', () => {
    expect(isCashAccount({ code: '1899' })).toBe(false)
    expect(isCashAccount({ code: '2000' })).toBe(false)
    expect(isCashAccount({ code: 'BAS' })).toBe(false)
    expect(isCashAccount(undefined)).toBe(false)
  })
})

describe('getPeriodBounds', () => {
  const referenceDate = new Date(2026, 5, 15) // 15 juni 2026 (mitt i Q2)

  it('bounds "month" to the calendar month, capped at referenceDate', () => {
    const { start, end, label } = getPeriodBounds('month', { referenceDate })
    expect(start).toEqual(new Date(2026, 5, 1))
    expect(end).toEqual(referenceDate) // månaden är inte slut än — kapas vid idag
    expect(label).toBe('Denna månad')
  })

  it('bounds "quarter" to the calendar quarter', () => {
    const { start } = getPeriodBounds('quarter', { referenceDate })
    expect(start).toEqual(new Date(2026, 3, 1)) // Q2 börjar i april
  })

  it('uses the given custom range as-is', () => {
    const { start, end, label } = getPeriodBounds('custom', {
      referenceDate, customStart: '2026-01-01', customEnd: '2026-03-31',
    })
    expect(start).toEqual(new Date(2026, 0, 1))
    expect(end).toEqual(new Date(2026, 2, 31))
    expect(label).toBe('Anpassad period')
  })

  it('falls back to the fiscal year when no period matches', () => {
    const { start, label } = getPeriodBounds('year', { referenceDate, fiscalYearStart: '2020-01-01' })
    expect(start).toEqual(new Date(2026, 0, 1))
    expect(label).toBe('Detta räkenskapsår')
  })

  it('computes the comparison period as exactly one year earlier', () => {
    const { start, end, prevStart, prevEnd } = getPeriodBounds('month', { referenceDate })
    expect(prevStart).toEqual(new Date(start.getFullYear() - 1, start.getMonth(), start.getDate()))
    expect(prevEnd).toEqual(new Date(end.getFullYear() - 1, end.getMonth(), end.getDate()))
  })

  it('does not cap a period that has already fully ended', () => {
    // Referensdatum långt efter perioden — hela kvartalet ska räknas, inte kapas till referensdatumet.
    const { start, end } = getPeriodBounds('custom', {
      referenceDate: new Date(2026, 11, 31),
      customStart: '2026-01-01', customEnd: '2026-03-31',
    })
    expect(start).toEqual(new Date(2026, 0, 1))
    expect(end).toEqual(new Date(2026, 2, 31))
  })
})

describe('sumFlowByType', () => {
  const start = new Date(2026, 5, 1)
  const end = new Date(2026, 5, 30)

  it('sums intäkter kredit-normerat (kredit minus debet)', () => {
    const verifications = [ver({ rows: [{ account: '3001', debet: 0, kredit: 1000 }] })]
    expect(sumFlowByType(verifications, accounts, 'intakt', start, end)).toBe(1000)
  })

  it('sums kostnader debet-normerat (debet minus kredit)', () => {
    const verifications = [ver({ rows: [{ account: '6100', debet: 400, kredit: 0 }] })]
    expect(sumFlowByType(verifications, accounts, 'kostnad', start, end)).toBe(400)
  })

  it('excludes drafts and verifications utanför perioden', () => {
    const verifications = [
      ver({ status: 'draft', rows: [{ account: '3001', debet: 0, kredit: 1000 }] }),
      ver({ date: '2026-07-01', rows: [{ account: '3001', debet: 0, kredit: 1000 }] }), // efter perioden
    ]
    expect(sumFlowByType(verifications, accounts, 'intakt', start, end)).toBe(0)
  })

  it('ignorerar rader på konton av annan typ', () => {
    const verifications = [ver({ rows: [{ account: '1930', debet: 1000, kredit: 0 }] })]
    expect(sumFlowByType(verifications, accounts, 'intakt', start, end)).toBe(0)
  })
})

describe('groupCostsByAccount', () => {
  const start = new Date(2026, 5, 1)
  const end = new Date(2026, 5, 30)

  it('summerar per konto, störst först, och exkluderar icke-positiva summor', () => {
    const verifications = [
      ver({ rows: [{ account: '5010', debet: 500, kredit: 0 }, { account: '6100', debet: 1200, kredit: 0 }] }),
      ver({ rows: [{ account: '5010', debet: 0, kredit: 500 }] }), // nettar ut 5010 till 0 — ska filtreras bort
    ]
    const { rows, total } = groupCostsByAccount(verifications, accounts, start, end)
    expect(rows).toEqual([{ code: '6100', name: 'Kontorsmaterial', amount: 1200 }])
    expect(total).toBe(1200)
  })
})

describe('groupCostsByCategory', () => {
  const start = new Date(2026, 5, 1)
  const end = new Date(2026, 5, 30)

  it('buckets accounts into the four fixed categories', () => {
    const verifications = [ver({
      rows: [
        { account: '7210', debet: 10000, kredit: 0 }, // Personal
        { account: '5910', debet: 2000, kredit: 0 },  // Marknadsföring
        { account: '5010', debet: 3000, kredit: 0 },  // Lokal
        { account: '6100', debet: 500, kredit: 0 },   // Övrigt
      ],
    })]
    const { categories, total } = groupCostsByCategory(verifications, accounts, start, end)
    expect(categories).toEqual([
      { name: 'Personal', amount: 10000 },
      { name: 'Lokal', amount: 3000 },
      { name: 'Marknadsföring', amount: 2000 },
      { name: 'Övrigt', amount: 500 },
    ])
    expect(total).toBe(15500)
  })
})

describe('computeCashBalanceAt', () => {
  it('accumulates only cash-account rows up to and including the given date', () => {
    const verifications = [
      ver({ date: '2026-01-10', rows: [{ account: '1930', debet: 5000, kredit: 0 }] }),
      ver({ date: '2026-02-10', rows: [{ account: '1930', debet: 0, kredit: 2000 }] }),
      ver({ date: '2026-03-10', rows: [{ account: '1930', debet: 1000, kredit: 0 }] }), // efter cutoff
      ver({ date: '2026-01-15', rows: [{ account: '1510', debet: 9999, kredit: 0 }] }), // inte kassakonto
    ]
    expect(computeCashBalanceAt(verifications, accounts, new Date(2026, 1, 28))).toBe(3000)
  })
})

describe('buildCashflowSeries / buildResultSeries', () => {
  const start = new Date(2026, 0, 1)
  const end = new Date(2026, 2, 31) // Q1

  it('genererar en punkt per kalendermånad plus periodens slutdatum', () => {
    const series = buildCashflowSeries([], accounts, start, end)
    expect(series.map(p => p.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01', '2026-03-31'])
  })

  it('genererar en resultatrad per kalendermånad med intäkt/kostnad', () => {
    const verifications = [ver({ date: '2026-02-15', rows: [{ account: '3001', debet: 0, kredit: 1000 }] })]
    const series = buildResultSeries(verifications, accounts, start, end)
    expect(series).toHaveLength(3)
    expect(series[1].intakt).toBe(1000)
    expect(series[0].intakt).toBe(0)
  })
})

describe('computeBalanceSheet', () => {
  it('speglar skuld/eget kapital-saldon (kreditnormerat blir positivt)', () => {
    const verifications = [ver({
      date: '2026-01-10',
      rows: [
        { account: '1930', debet: 10000, kredit: 0 },
        { account: '2440', debet: 0, kredit: 10000 },
      ],
    })]
    const { assets, equityAndLiabilities, totalAssets, totalEquityAndLiabilities } =
      computeBalanceSheet(verifications, accounts, new Date(2026, 0, 31))
    expect(assets).toEqual([{ code: '1930', name: 'Företagskonto', amount: 10000 }])
    expect(equityAndLiabilities).toEqual([{ code: '2440', name: 'Leverantörsskulder', amount: 10000 }])
    expect(totalAssets).toBe(10000)
    expect(totalEquityAndLiabilities).toBe(10000)
  })

  it('filtrerar bort saldon under 0,5 kr (avrundningsbrus)', () => {
    const verifications = [ver({ date: '2026-01-10', rows: [{ account: '1930', debet: 0.2, kredit: 0 }] })]
    const { assets } = computeBalanceSheet(verifications, accounts, new Date(2026, 0, 31))
    expect(assets).toEqual([])
  })
})

describe('hasAnyBookedData', () => {
  it('is false for an empty or all-draft list', () => {
    expect(hasAnyBookedData([])).toBe(false)
    expect(hasAnyBookedData([{ status: 'draft' }])).toBe(false)
  })
  it('is true as soon as one verification is booked', () => {
    expect(hasAnyBookedData([{ status: 'draft' }, { status: 'booked' }])).toBe(true)
  })
})
