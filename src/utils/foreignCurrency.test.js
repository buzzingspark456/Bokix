import { describe, it, expect } from 'vitest'
import { parseNumber, sekFrom, impliedRate, rateToInput, amountToInput, describeForeign, foreignForSave } from './foreignCurrency'

describe('parseNumber', () => {
  it('läser komma, punkt och mellanslag', () => {
    expect(parseNumber('1 234,56')).toBe(1234.56)
    expect(parseNumber('25.5')).toBe(25.5)
    expect(parseNumber('10,4123')).toBe(10.4123)
  })
  it('ger NaN för tomt och text', () => {
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber(null)).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
  })
})

describe('sekFrom och impliedRate', () => {
  it('räknar kronor med hela ören', () => {
    expect(sekFrom(25, 10.4123)).toBe(260.31)
    expect(sekFrom('25,00', '10,4123')).toBe(260.31)
    expect(sekFrom(1.5, 10)).toBe(15)
  })
  it('saknad eller noll ger NaN', () => {
    expect(sekFrom(0, 10)).toBeNaN()
    expect(sekFrom(25, '')).toBeNaN()
  })
  it('kursen räknas om ur ett kronbelopp banken drog', () => {
    expect(impliedRate(262, 25)).toBe(10.48)
    expect(impliedRate('262,00', '25,00')).toBe(10.48)
    expect(impliedRate(260.31, 25)).toBe(10.4124)
    expect(impliedRate(0, 25)).toBeNaN()
  })
  it('ett kronbelopp som skrivits in ger tillbaka samma belopp med den härledda kursen', () => {
    for (const [sek, amount] of [[262, 25], [1.5, 0.15], [1234.56, 99.99], [10.01, 3]]) {
      expect(Math.abs(sekFrom(amount, impliedRate(sek, amount)) - sek)).toBeLessThan(0.006)
    }
  })
})

describe('text i fält', () => {
  it('rateToInput och amountToInput', () => {
    expect(rateToInput(10.4123)).toBe('10,4123')
    expect(rateToInput(10.5)).toBe('10,5')
    expect(rateToInput(0)).toBe('')
    expect(amountToInput(25)).toBe('25,00')
    expect(amountToInput(1.5)).toBe('1,50')
    expect(amountToInput('')).toBe('')
  })
})

describe('describeForeign och foreignForSave', () => {
  it('beskriver omräkningen', () => {
    expect(describeForeign({ code: 'USD', amount: 25, rate: 10.4123 })).toBe('25,00 USD × kurs 10,4123')
    expect(describeForeign(null)).toBe('')
    expect(describeForeign({ code: 'USD', amount: 25, rate: 0 })).toBe('')
  })
  it('sparar bara en komplett ruta', () => {
    expect(foreignForSave({ code: 'USD', amount: '25,00', rate: '10,4123', rateDate: '2024-05-10', source: 'ecb' }))
      .toEqual({ code: 'USD', amount: 25, rate: 10.4123, rateDate: '2024-05-10', source: 'ecb' })
    expect(foreignForSave({ code: 'USD', amount: '', rate: '10' })).toBeUndefined()
    expect(foreignForSave({ code: 'USD', amount: '25', rate: '' })).toBeUndefined()
    expect(foreignForSave(null)).toBeUndefined()
  })
  it('en kurs som ändrats för hand sparas som manuell', () => {
    expect(foreignForSave({ code: 'EUR', amount: '10', rate: '11', source: 'manual' }).source).toBe('manual')
    expect(foreignForSave({ code: 'EUR', amount: '10', rate: '11' }).source).toBe('manual')
  })
})
