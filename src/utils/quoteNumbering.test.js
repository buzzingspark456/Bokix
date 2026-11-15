import { describe, it, expect } from 'vitest'
import { getNextQuoteNumber } from './quoteNumbering'

describe('getNextQuoteNumber', () => {
  it('börjar på OFF-1001 utan offerter', () => {
    expect(getNextQuoteNumber([])).toBe('OFF-1001')
  })
  it('fortsätter OFF-serien', () => {
    expect(getNextQuoteNumber([{ invoiceNumber: 'OFF-1001' }, { invoiceNumber: 'OFF-1007' }])).toBe('OFF-1008')
  })
  it('fortsätter en annan serie med samma prefix', () => {
    expect(getNextQuoteNumber([{ invoiceNumber: 'O-1003' }, { invoiceNumber: 'O-1004' }])).toBe('O-1005')
  })
  it('behåller inledande nollor och klarar rena nummer', () => {
    expect(getNextQuoteNumber([{ invoiceNumber: 'Q0099' }])).toBe('Q0100')
    expect(getNextQuoteNumber([{ invoiceNumber: 42 }])).toBe('43')
  })
  it('hoppar över nummer utan siffror', () => {
    expect(getNextQuoteNumber([{ invoiceNumber: 'utkast' }, { invoiceNumber: 'OFF-1002' }])).toBe('OFF-1003')
  })
})
