import { describe, it, expect } from 'vitest'
import {
  freeEquityAt, checkDividend, dividendPerShare, buildDividendDecision, buildDividendPayment, dividendStatus,
} from './dividend'

const accounts = [
  { code: '1930', name: 'Bank', type: 'tillgang' },
  { code: '2081', name: 'Aktiekapital', type: 'skuld_kapital' },
  { code: '2091', name: 'Balanserad vinst', type: 'skuld_kapital' },
  { code: '2099', name: 'Årets resultat', type: 'skuld_kapital' },
  { code: '2898', name: 'Outtagen utdelning', type: 'skuld_kapital' },
  { code: '3001', name: 'Försäljning', type: 'intakt' },
  { code: '5010', name: 'Hyra', type: 'kostnad' },
]
const ver = (id, date, rows, extra = {}) => ({ id, date, rows, ...extra })
const balanced = (v) => Math.round(v.rows.reduce((s, r) => s + r.debet - r.kredit, 0) * 100) === 0

const vers = [
  ver('a', '2025-01-02', [{ account: '1930', debet: 25000, kredit: 0 }, { account: '2081', debet: 0, kredit: 25000 }]),
  ver('a2', '2025-03-01', [{ account: '1930', debet: 80000, kredit: 0 }, { account: '3001', debet: 0, kredit: 80000 }]),
  ver('b', '2025-12-31', [{ account: '2099', debet: 0, kredit: 80000 }, { account: '3001', debet: 80000, kredit: 0 }], { source: 'year_end_close' }),
  ver('c', '2026-03-01', [{ account: '1930', debet: 50000, kredit: 0 }, { account: '3001', debet: 0, kredit: 50000 }]),
  ver('d', '2026-04-01', [{ account: '5010', debet: 20000, kredit: 0 }, { account: '1930', debet: 0, kredit: 20000 }]),
]

describe('freeEquityAt', () => {
  it('counts closed prior result in 2099 plus this year unclosed result, but not aktiekapital', () => {
    const f = freeEquityAt(vers, accounts, '2026-12-31')
    expect(f.total).toBe(110000) // 80 000 (2099) + 30 000 löpande
    expect(f.unclosedResult).toBe(30000)
    expect(f.byAccount).toEqual([{ code: '2099', amount: 80000 }])
  })

  it('is limited to the given date', () => {
    expect(freeEquityAt(vers, accounts, '2025-12-31').total).toBe(80000)
  })

  it('ignores drafts', () => {
    const withDraft = [...vers, ver('x', '2026-05-01', [{ account: '2091', debet: 0, kredit: 9999 }], { status: 'draft' })]
    expect(freeEquityAt(withDraft, accounts, '2026-12-31').total).toBe(110000)
  })
})

describe('checkDividend', () => {
  it('passes within free equity and fails above it', () => {
    expect(checkDividend({ verifications: vers, accounts, date: '2026-12-31', amount: 100000 }).withinFreeEquity).toBe(true)
    expect(checkDividend({ verifications: vers, accounts, date: '2026-12-31', amount: 110000.01 }).withinFreeEquity).toBe(false)
  })

  it('never reports a negative maximum', () => {
    const deficit = [ver('d', '2026-01-02', [{ account: '5010', debet: 5000, kredit: 0 }, { account: '1930', debet: 0, kredit: 5000 }])]
    const c = checkDividend({ verifications: deficit, accounts, date: '2026-12-31', amount: 1 })
    expect(c.freeEquity).toBe(-5000)
    expect(c.maxDividend).toBe(0)
    expect(c.withinFreeEquity).toBe(false)
  })

  it('reports outstanding declared but unpaid dividend', () => {
    const decided = [...vers, ver('e', '2026-06-01', [{ account: '2099', debet: 40000, kredit: 0 }, { account: '2898', debet: 0, kredit: 40000 }])]
    expect(checkDividend({ verifications: decided, accounts, date: '2026-12-31', amount: 0 }).outstanding).toBe(40000)
  })
})

describe('dividend entries', () => {
  const d = { id: 'd1', date: '2026-06-01', amount: 40000, sourceAccount: '2099', note: 'Årsstämma' }

  it('decision: D fritt eget kapital / K 2898', () => {
    const v = buildDividendDecision(d)
    expect(v.rows).toEqual([{ account: '2099', debet: 40000, kredit: 0 }, { account: '2898', debet: 0, kredit: 40000 }])
    expect(balanced(v)).toBe(true)
  })

  it('payment: D 2898 / K bank', () => {
    const v = buildDividendPayment(d, { date: '2026-06-15' })
    expect(v.rows).toEqual([{ account: '2898', debet: 40000, kredit: 0 }, { account: '1930', debet: 0, kredit: 40000 }])
    expect(v.date).toBe('2026-06-15')
  })

  it('status is read from the verifications', () => {
    const decision = buildDividendDecision(d)
    expect(dividendStatus(d, [])).toEqual({ decided: false, paid: false })
    expect(dividendStatus(d, [decision])).toEqual({ decided: true, paid: false })
    expect(dividendStatus(d, [decision, buildDividendPayment(d, { date: '2026-06-15' })])).toEqual({ decided: true, paid: true })
  })

  it('per share', () => {
    expect(dividendPerShare(40000, 500)).toBe(80)
    expect(dividendPerShare(40000, 0)).toBeNull()
  })
})
