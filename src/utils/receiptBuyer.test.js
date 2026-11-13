import { describe, it, expect } from 'vitest'
import { buyerDetailsCheck } from './receiptBuyer'

const company = { name: 'Exempel AB', orgNr: '556677-8899' }
describe('buyerDetailsCheck', () => {
  it('behövs inte upp till 4 000 kr eller utan moms', () => {
    expect(buyerDetailsCheck({ grossAmount: 4000, vatRate: 25, readText: '', company })).toBeNull()
    expect(buyerDetailsCheck({ grossAmount: 9000, vatRate: 0, readText: '', company })).toBeNull()
  })
  it('hittar företagets namn eller organisationsnummer', () => {
    expect(buyerDetailsCheck({ grossAmount: 5000, vatRate: 25, readText: 'Kund: EXEMPEL AB\nStorgatan 1', company })).toBe('ok')
    expect(buyerDetailsCheck({ grossAmount: 5000, vatRate: 25, readText: 'Org.nr 556677-8899', company })).toBe('ok')
  })
  it('varnar när köparen saknas', () => {
    expect(buyerDetailsCheck({ grossAmount: 5000, vatAmount: 1000, readText: 'ICA Maxi Kvitto 5000', company })).toBe('missing')
    expect(buyerDetailsCheck({ grossAmount: 5000, vatRate: 25, readText: 'Exempelbolaget', company })).toBe('missing')
  })
})
