import { describe, it, expect } from 'vitest'
import { ink2rRowForAccount, computeInk2r, INK2R_ROWS } from './ink2r'

const accounts = [
  { code: '1930', name: 'Företagskonto' },      // tillgång, kassa/bank
  { code: '1510', name: 'Kundfordringar' },      // tillgång, kundfordringar
  { code: '2081', name: 'Aktiekapital' },        // skuld_kapital, bundet eget kapital
  { code: '2440', name: 'Leverantörsskulder' },  // skuld_kapital
  { code: '2611', name: 'Utgående moms' },       // skuld_kapital
]

function ver(rows, overrides = {}) {
  return { status: 'booked', date: '2026-06-15', rows, ...overrides }
}

describe('ink2rRowForAccount', () => {
  it('places well-known accounts on the row the blankett describes', () => {
    expect(ink2rRowForAccount('1930')).toBe('2.26') // Kassa, bank och redovisningsmedel
    expect(ink2rRowForAccount('1510')).toBe('2.19')  // Kundfordringar
    expect(ink2rRowForAccount('2081')).toBe('2.27')  // Bundet eget kapital
    expect(ink2rRowForAccount('2440')).toBe('2.45')  // Leverantörsskulder
    // Utgående moms (26xx) landar enligt den verifierade kopplingstabellen
    // på 2.48 ("...och övriga skulder"), INTE 2.49 Skatteskulder som man
    // annars kan tro — bara kontogrupp 25xx (skattekontot) är 2.49.
    expect(ink2rRowForAccount('2611')).toBe('2.48')
  })
  it('returns null outside the balance sheet classes (1–2)', () => {
    expect(ink2rRowForAccount('3001')).toBeNull()
    expect(ink2rRowForAccount('7010')).toBeNull()
  })
  it('every row id it can produce exists in INK2R_ROWS', () => {
    const validRows = new Set(INK2R_ROWS.map(r => r.row))
    for (let code = 1000; code < 3000; code += 10) {
      const row = ink2rRowForAccount(String(code))
      if (row) expect(validRows.has(row)).toBe(true)
    }
  })
})

describe('computeInk2r', () => {
  it('sums booked verifications into the right rows and balances', () => {
    const verifications = [
      ver([
        { account: '1930', debet: 10000, kredit: 0 },
        { account: '2081', debet: 0, kredit: 10000 },
      ]),
      ver([
        { account: '1510', debet: 5000, kredit: 0 },
        { account: '2440', debet: 0, kredit: 3000 },
        { account: '2611', debet: 0, kredit: 2000 },
      ]),
    ]
    const result = computeInk2r(verifications, accounts, new Date('2026-12-31T23:59:59'))

    const byRow = Object.fromEntries(result.rows.map(r => [r.row, r.amount]))
    expect(byRow['2.26']).toBe(10000) // kassa/bank
    expect(byRow['2.19']).toBe(5000)  // kundfordringar
    expect(byRow['2.27']).toBe(10000) // bundet eget kapital
    expect(byRow['2.45']).toBe(3000)  // leverantörsskulder
    expect(byRow['2.48']).toBe(2000)  // moms (26xx) -> 2.48, inte 2.49

    expect(result.totalAssets).toBe(15000)
    expect(result.totalEquityAndLiabilities).toBe(15000)
    expect(result.balanced).toBe(true)
  })

  it('excludes drafts and verifications after asOfDate, same as computeBalanceSheet', () => {
    const verifications = [
      ver([{ account: '1930', debet: 1000, kredit: 0 }, { account: '2081', debet: 0, kredit: 1000 }], { status: 'draft' }),
      ver([{ account: '1930', debet: 500, kredit: 0 }, { account: '2081', debet: 0, kredit: 500 }], { date: '2027-01-05' }),
    ]
    const result = computeInk2r(verifications, accounts, new Date('2026-12-31T23:59:59'))
    expect(result.rows).toHaveLength(0)
    expect(result.totalAssets).toBe(0)
  })

  it('flags an out-of-balance ledger instead of hiding it', () => {
    const verifications = [
      ver([{ account: '1930', debet: 100, kredit: 0 }]), // no matching credit row on purpose
    ]
    const result = computeInk2r(verifications, accounts, new Date('2026-12-31T23:59:59'))
    expect(result.balanced).toBe(false)
  })
})
