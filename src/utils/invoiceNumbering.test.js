import { describe, it, expect } from 'vitest'
import { getNextInvoiceNumber } from './invoiceNumbering'

describe('getNextInvoiceNumber', () => {
  it('starts at 1001 when there are no existing invoices and no floor', () => {
    expect(getNextInvoiceNumber([], {})).toBe('1001')
  })

  it('continues one past the highest existing invoice number', () => {
    const invoices = [{ invoiceNumber: '1001' }, { invoiceNumber: '1005' }, { invoiceNumber: '1002' }]
    expect(getNextInvoiceNumber(invoices, {})).toBe('1006')
  })

  it('ignores non-numeric invoice numbers when finding the max', () => {
    const invoices = [{ invoiceNumber: '1001' }, { invoiceNumber: 'DRAFT-X' }]
    expect(getNextInvoiceNumber(invoices, {})).toBe('1002')
  })

  it('never returns below the configured floor, even with no invoices yet', () => {
    expect(getNextInvoiceNumber([], { nextInvoiceNumber: 5000 })).toBe('5000')
  })

  it('cannot be pushed backwards below numbers already in use, even if the floor is lower', () => {
    const invoices = [{ invoiceNumber: '1001' }, { invoiceNumber: '1002' }]
    expect(getNextInvoiceNumber(invoices, { nextInvoiceNumber: 100 })).toBe('1003')
  })

  it('lets a higher floor raise the series past the existing max', () => {
    const invoices = [{ invoiceNumber: '1001' }]
    expect(getNextInvoiceNumber(invoices, { nextInvoiceNumber: 3000 })).toBe('3000')
  })
})
