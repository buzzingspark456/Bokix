import { describe, it, expect } from 'vitest'
import { computeWorksheet, isAdjustment } from './worksheet'

const accounts = [
  { code: '1229', name: 'Ack. avskrivn. inventarier', type: 'tillgang' },
  { code: '1224', name: 'Datorer', type: 'tillgang' },
  { code: '1930', name: 'Företagskonto', type: 'tillgang' },
  { code: '2018', name: 'Egna insättningar', type: 'skuld_kapital' },
  { code: '2099', name: 'Årets resultat', type: 'skuld_kapital' },
  { code: '3001', name: 'Försäljning', type: 'intakt' },
  { code: '5010', name: 'Lokalhyra', type: 'kostnad' },
  { code: '7832', name: 'Avskrivningar', type: 'kostnad' },
]

const ver = (id, date, rows, extra = {}) => ({ id, date, rows, ...extra })
const start = '2026-01-01'
const end = '2026-12-31'

const base = [
  ver('v1', '2026-01-02', [{ account: '1930', debet: 100000, kredit: 0 }, { account: '2018', debet: 0, kredit: 100000 }]),
  ver('v2', '2026-02-01', [{ account: '1224', debet: 12000, kredit: 0 }, { account: '1930', debet: 0, kredit: 12000 }]),
  ver('v3', '2026-03-01', [{ account: '1930', debet: 50000, kredit: 0 }, { account: '3001', debet: 0, kredit: 50000 }]),
  ver('v4', '2026-04-01', [{ account: '5010', debet: 20000, kredit: 0 }, { account: '1930', debet: 0, kredit: 20000 }]),
]
const dep = ver('v5', '2026-12-31', [{ account: '7832', debet: 4000, kredit: 0 }, { account: '1229', debet: 0, kredit: 4000 }], { source: 'depreciation' })

const row = (ws, code) => ws.rows.find(r => r.code === code)

describe('computeWorksheet', () => {
  it('råbalansen summerar till noll (debet = kredit)', () => {
    const ws = computeWorksheet(base, accounts, start, end)
    expect(ws.totals.raw.debet).toBe(ws.totals.raw.kredit)
    expect(ws.rawInBalance).toBe(true)
  })

  it('separerar justeringar från löpande bokföring', () => {
    const ws = computeWorksheet([...base, dep], accounts, start, end)
    expect(row(ws, '7832').raw).toEqual({ debet: 0, kredit: 0 })
    expect(row(ws, '7832').adjustments).toEqual({ debet: 4000, kredit: 0 })
    expect(row(ws, '7832').adjusted).toEqual({ debet: 4000, kredit: 0 })
    expect(ws.hasAdjustments).toBe(true)
    expect(ws.totals.adjustments.debet).toBe(4000)
    expect(ws.totals.adjustments.kredit).toBe(4000)
  })

  it('justerad råbalans = råbalans + justeringar', () => {
    const ws = computeWorksheet([...base, dep], accounts, start, end)
    expect(ws.totals.adjusted.debet).toBe(ws.totals.raw.debet + ws.totals.adjustments.debet)
  })

  it('resultat och balans delar upp kontona efter klass', () => {
    const ws = computeWorksheet([...base, dep], accounts, start, end)
    expect(row(ws, '3001').income).toEqual({ debet: 0, kredit: 50000 })
    expect(row(ws, '3001').balance).toEqual({ debet: 0, kredit: 0 })
    expect(row(ws, '1930').balance).toEqual({ debet: 118000, kredit: 0 })
    expect(row(ws, '1930').income).toEqual({ debet: 0, kredit: 0 })
  })

  it('årets resultat = intäkter − kostnader, efter justering', () => {
    const before = computeWorksheet(base, accounts, start, end)
    const after = computeWorksheet([...base, dep], accounts, start, end)
    expect(before.yearResult).toBe(30000)
    expect(after.yearResult).toBe(26000)
  })

  it('balansräkningen balanserar när årets resultat läggs på balanssidan', () => {
    const ws = computeWorksheet([...base, dep], accounts, start, end)
    expect(ws.balanceInBalance).toBe(true)
    expect(ws.balanceWithResult.debet).toBe(ws.balanceWithResult.kredit)
  })

  it('en förlust hamnar på debetsidan i balanskolumnen och balanserar ändå', () => {
    const loss = [
      ver('v1', '2026-01-02', [{ account: '1930', debet: 10000, kredit: 0 }, { account: '2018', debet: 0, kredit: 10000 }]),
      ver('v2', '2026-02-01', [{ account: '5010', debet: 7000, kredit: 0 }, { account: '1930', debet: 0, kredit: 7000 }]),
    ]
    const ws = computeWorksheet(loss, accounts, start, end)
    expect(ws.yearResult).toBe(-7000)
    expect(ws.balanceInBalance).toBe(true)
    expect(ws.incomeBalanced.debet).toBe(ws.incomeBalanced.kredit)
  })

  it('bokslutsverifikationen inom året lämnas utanför, så resultatet syns', () => {
    const close = ver('v9', '2026-12-31', [
      { account: '3001', debet: 50000, kredit: 0 }, { account: '5010', debet: 0, kredit: 20000 },
      { account: '2099', debet: 0, kredit: 30000 },
    ], { source: 'year_end_close' })
    const ws = computeWorksheet([...base, close], accounts, start, end)
    expect(ws.yearResult).toBe(30000)
    expect(ws.balanceInBalance).toBe(true)
  })

  it('resultatkonton från tidigare år ingår inte i året men balansen går ihop via tidigare års resultat', () => {
    const prev = [
      ver('p1', '2025-03-01', [{ account: '1930', debet: 8000, kredit: 0 }, { account: '3001', debet: 0, kredit: 8000 }]),
    ]
    const ws = computeWorksheet([...prev, ...base], accounts, start, end)
    expect(row(ws, '3001').income.kredit).toBe(50000)
    expect(ws.priorResult).toBe(8000)
    expect(ws.balanceInBalance).toBe(true)
  })

  it('utkast och verifikationer efter periodens slut räknas inte', () => {
    const extra = [
      ver('d1', '2026-05-01', [{ account: '5010', debet: 999, kredit: 0 }, { account: '1930', debet: 0, kredit: 999 }], { status: 'draft' }),
      ver('f1', '2027-01-01', [{ account: '5010', debet: 999, kredit: 0 }, { account: '1930', debet: 0, kredit: 999 }]),
    ]
    const ws = computeWorksheet([...base, ...extra], accounts, start, end)
    expect(row(ws, '5010').raw.debet).toBe(20000)
  })

  it('tolkar även gamla debit/credit-fält', () => {
    const legacy = [ver('l1', '2026-05-01', [{ account: '1930', debit: '500', credit: 0 }, { account: '3001', debit: 0, credit: '500' }])]
    expect(computeWorksheet(legacy, accounts, start, end).yearResult).toBe(500)
  })
})

describe('isAdjustment', () => {
  it('känner igen bokslutsverifikationer och egna markeringar', () => {
    expect(isAdjustment({ source: 'depreciation' })).toBe(true)
    expect(isAdjustment({ source: 'accrual' })).toBe(true)
    expect(isAdjustment({ source: 'inventory' })).toBe(true)
    expect(isAdjustment({ source: 'manual', isAdjustment: true })).toBe(true)
    expect(isAdjustment({ source: 'invoice' })).toBe(false)
  })
})
