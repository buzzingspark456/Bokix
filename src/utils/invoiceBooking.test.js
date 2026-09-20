import { describe, it, expect } from 'vitest'
import { invoiceBookingRows, invoiceLineNet } from './invoiceBooking'
import { withRoundingBalance } from './verificationAmounts'
import { grossInvoiceAmount } from './reportCalculations'

const revenueAccounts = { 25: '3001', 12: '3002', 6: '3003', 0: '3004' }
const vatAccounts = { 25: '2611', 12: '2621', 6: '2631', 0: null }
const book = (rows) => invoiceBookingRows(rows, { revenueAccounts, vatAccounts })
const sum = (rows, k) => Math.round(rows.reduce((s, r) => s + r[k], 0) * 100) / 100

describe('invoiceBookingRows', () => {
  it('en enkel rad: fordran, intäkt och utgående moms, balanserad', () => {
    const rows = book([{ qty: 1, unitPrice: 1000, vatRate: 25 }])
    expect(rows).toEqual([
      { account: '1510', debet: 1250, kredit: 0 },
      { account: '3001', debet: 0, kredit: 1000 },
      { account: '2611', debet: 0, kredit: 250 },
    ])
  })

  it('bokar ören och inte hela kronor', () => {
    const rows = book([{ qty: 3, unitPrice: 99.5, vatRate: 25 }])
    expect(rows[0]).toEqual({ account: '1510', debet: 373.13, kredit: 0 })
    expect(rows[1]).toEqual({ account: '3001', debet: 0, kredit: 298.5 })
    expect(rows[2]).toEqual({ account: '2611', debet: 0, kredit: 74.63 })
    expect(sum(rows, 'debet')).toBe(sum(rows, 'kredit'))
  })

  it('radrabatten räknas med', () => {
    const rows = book([{ qty: 2, unitPrice: 500, vatRate: 25, discount: 10 }])
    expect(invoiceLineNet({ qty: 2, unitPrice: 500, discount: 10 })).toBe(900)
    expect(rows).toEqual([
      { account: '1510', debet: 1125, kredit: 0 },
      { account: '3001', debet: 0, kredit: 900 },
      { account: '2611', debet: 0, kredit: 225 },
    ])
  })

  it('flera momssatser ger ett intäktskonto och ett momskonto per sats', () => {
    const rows = book([
      { qty: 1, unitPrice: 1000, vatRate: 25 },
      { qty: 1, unitPrice: 500, vatRate: 12 },
      { qty: 1, unitPrice: 200, vatRate: 0 },
    ])
    expect(rows[0].account).toBe('1510')
    expect(rows.map(r => r.account).sort()).toEqual(['1510', '2611', '2621', '3001', '3002', '3004'])
    expect(rows[0].debet).toBe(1250 + 560 + 200)
  })

  it('samma sats på flera rader summeras till en rad', () => {
    const rows = book([{ qty: 1, unitPrice: 100, vatRate: 25 }, { qty: 2, unitPrice: 50, vatRate: 25 }])
    expect(rows.filter(r => r.account === '3001')).toEqual([{ account: '3001', debet: 0, kredit: 200 }])
  })

  it('en okänd momssats bokas på 3001 utan momsrad', () => {
    const rows = book([{ qty: 1, unitPrice: 100, vatRate: 20 }])
    expect(rows.some(r => r.account === '3001')).toBe(true)
    expect(rows.some(r => r.account === '2611')).toBe(false)
  })

  it('en kreditfaktura bokas åt andra hållet', () => {
    const rows = book([{ qty: 1, unitPrice: -1000, vatRate: 25 }])
    expect(rows).toEqual([
      { account: '1510', debet: 0, kredit: 1250 },
      { account: '3001', debet: 1000, kredit: 0 },
      { account: '2611', debet: 250, kredit: 0 },
    ])
  })

  it('tomma och ogiltiga rader ger bara en nollad fordran', () => {
    expect(book([])).toEqual([{ account: '1510', debet: 0, kredit: 0 }])
    expect(book(undefined)[0].debet).toBe(0)
    expect(book([{ qty: 'x', unitPrice: null, vatRate: 25 }])[0].debet).toBe(0)
  })

  it('skillnaden mellan totalen och de avrundade raderna hamnar på 3740, aldrig som obalans', () => {
    // 3 rader à 0,10 kr + 25 %: totalen 0,375 -> 0,38, raderna 0,30 + 0,08 (0,075)
    const rows = book([{ qty: 3, unitPrice: 0.1, vatRate: 25 }])
    const balanced = withRoundingBalance(rows)
    expect(sum(balanced, 'debet')).toBe(sum(balanced, 'kredit'))
  })

  it('över många slumpade fakturor balanserar bokningen alltid efter avrundningsskyddet', () => {
    let seed = 42
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let n = 0; n < 500; n++) {
      const rows = Array.from({ length: 1 + Math.floor(rand() * 5) }, () => ({
        qty: Math.round(rand() * 10 * 100) / 100 + 0.01,
        unitPrice: Math.round(rand() * 2000 * 100) / 100,
        vatRate: [25, 12, 6, 0][Math.floor(rand() * 4)],
        discount: Math.floor(rand() * 4) * 5,
      }))
      const booked = withRoundingBalance(book(rows))
      expect(Math.abs(sum(booked, 'debet') - sum(booked, 'kredit'))).toBeLessThan(0.005)
      // Fordran är exakt det fakturan visar att betala.
      expect(Math.abs(booked[0].debet - Math.round(grossInvoiceAmount({ rows }) * 100) / 100)).toBeLessThan(0.0051)
    }
  })
})

describe('grossInvoiceAmount med rabatt', () => {
  it('räknar radrabatten, så fordran och det kunden ska betala är samma belopp', () => {
    expect(grossInvoiceAmount({ rows: [{ qty: 2, unitPrice: 500, vatRate: 25, discount: 10 }] })).toBe(1125)
    expect(grossInvoiceAmount({ rows: [{ qty: 2, unitPrice: 500, vatRate: 25 }] })).toBe(1250)
  })
})
