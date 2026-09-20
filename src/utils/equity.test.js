import { describe, it, expect } from 'vitest'
import { computeEquityStatement, isEquityAccount } from './equity'

const accounts = [
  { code: '1930', name: 'Företagskonto', type: 'tillgang' },
  { code: '2013', name: 'Övriga egna uttag', type: 'skuld_kapital' },
  { code: '2018', name: 'Övriga egna insättningar', type: 'skuld_kapital' },
  { code: '2091', name: 'Balanserad vinst', type: 'skuld_kapital' },
  { code: '2099', name: 'Årets resultat', type: 'skuld_kapital' },
  { code: '3001', name: 'Försäljning', type: 'intakt' },
  { code: '5010', name: 'Lokalhyra', type: 'kostnad' },
]
const ver = (id, date, rows, extra = {}) => ({ id, date, rows, ...extra })
const start = '2026-01-01'
const end = '2026-12-31'
const row = (s, code) => s.rows.find(r => r.code === code)

const year = [
  ver('v1', '2026-01-02', [{ account: '1930', debet: 50000, kredit: 0 }, { account: '2018', debet: 0, kredit: 50000 }]),
  ver('v2', '2026-03-01', [{ account: '1930', debet: 80000, kredit: 0 }, { account: '3001', debet: 0, kredit: 80000 }]),
  ver('v3', '2026-04-01', [{ account: '5010', debet: 30000, kredit: 0 }, { account: '1930', debet: 0, kredit: 30000 }]),
  ver('v4', '2026-06-01', [{ account: '2013', debet: 10000, kredit: 0 }, { account: '1930', debet: 0, kredit: 10000 }]),
]

describe('computeEquityStatement', () => {
  it('visar insättning, uttag och årets resultat som förändring', () => {
    const s = computeEquityStatement(year, accounts, start, end)
    expect(row(s, '2018').movement).toBe(50000)
    expect(row(s, '2013').movement).toBe(-10000)
    expect(s.yearResult).toBe(50000)
    expect(s.totals.closing).toBe(90000)
  })

  it('utgående eget kapital = ingående + förändring', () => {
    const s = computeEquityStatement(year, accounts, start, end)
    expect(s.totals.closing).toBe(s.totals.opening + s.totals.movement)
  })

  it('går ihop med balansräkningen: tillgångar = eget kapital + skulder (här inga skulder)', () => {
    const s = computeEquityStatement(year, accounts, start, end)
    // 1930: 50 000 + 80 000 − 30 000 − 10 000 = 90 000
    expect(s.totals.closing).toBe(90000)
  })

  it('tidigare års bokslutade resultat ligger i ingående saldo på 2099', () => {
    const prev = [
      ver('p1', '2025-03-01', [{ account: '1930', debet: 20000, kredit: 0 }, { account: '3001', debet: 0, kredit: 20000 }]),
      ver('p2', '2025-12-31', [{ account: '3001', debet: 20000, kredit: 0 }, { account: '2099', debet: 0, kredit: 20000 }], { source: 'year_end_close' }),
    ]
    const s = computeEquityStatement([...prev, ...year], accounts, start, end)
    expect(row(s, '2099').opening).toBe(20000)
    expect(s.totals.opening).toBe(20000)
    expect(s.totals.closing).toBe(110000)
  })

  it('tidigare års ej bokslutade resultat blir en egen ingående post', () => {
    const prev = [ver('p1', '2025-03-01', [{ account: '1930', debet: 20000, kredit: 0 }, { account: '3001', debet: 0, kredit: 20000 }])]
    const s = computeEquityStatement([...prev, ...year], accounts, start, end)
    const synthetic = s.rows.find(r => r.synthetic && !r.isResult)
    expect(synthetic.opening).toBe(20000)
    expect(s.totals.closing).toBe(110000)
  })

  it('bokslutsverifikationen inom året flyttar inte om resultatet', () => {
    const close = ver('c', '2026-12-31', [
      { account: '3001', debet: 80000, kredit: 0 }, { account: '5010', debet: 0, kredit: 30000 }, { account: '2099', debet: 0, kredit: 50000 },
    ], { source: 'year_end_close' })
    const s = computeEquityStatement([...year, close], accounts, start, end)
    expect(row(s, '2099')).toBeUndefined()
    expect(s.yearResult).toBe(50000)
    expect(s.totals.closing).toBe(90000)
  })

  it('en förlust ger negativt resultat och minskar eget kapital', () => {
    const loss = [
      ver('a', '2026-01-02', [{ account: '1930', debet: 10000, kredit: 0 }, { account: '2018', debet: 0, kredit: 10000 }]),
      ver('b', '2026-02-01', [{ account: '5010', debet: 4000, kredit: 0 }, { account: '1930', debet: 0, kredit: 4000 }]),
    ]
    const s = computeEquityStatement(loss, accounts, start, end)
    expect(s.yearResult).toBe(-4000)
    expect(s.totals.closing).toBe(6000)
  })

  it('utkast och senare verifikationer räknas inte', () => {
    const extra = [
      ver('d', '2026-05-01', [{ account: '2018', debet: 0, kredit: 999 }], { status: 'draft' }),
      ver('f', '2027-01-01', [{ account: '2018', debet: 0, kredit: 999 }]),
    ]
    expect(row(computeEquityStatement([...year, ...extra], accounts, start, end), '2018').movement).toBe(50000)
  })

  it('känner igen eget kapital-konton', () => {
    expect(isEquityAccount('2018')).toBe(true)
    expect(isEquityAccount('2099')).toBe(true)
    expect(isEquityAccount('2440')).toBe(false)
    expect(isEquityAccount('1930')).toBe(false)
  })
})
