import { describe, it, expect } from 'vitest'
import {
  markupPct, marginPct, priceFromMargin, priceFromMarkup, withVat, withoutVat, roundPrice,
  marginAfterDiscount, maxDiscountForMargin, breakEvenUnits, hourlyRate, pricingStatus,
} from './pricing'

describe('markup vs margin', () => {
  it('a 50 % markup is a 33.33 % margin, not 50 %', () => {
    expect(markupPct(150, 100)).toBe(50)
    expect(marginPct(150, 100)).toBe(33.33)
  })

  it('returns null instead of dividing by zero', () => {
    expect(markupPct(100, 0)).toBeNull()
    expect(marginPct(0, 10)).toBeNull()
  })

  it('a loss gives negative figures', () => {
    expect(marginPct(80, 100)).toBe(-25)
    expect(markupPct(80, 100)).toBe(-20)
  })
})

describe('price from target', () => {
  it('margin: cost 60 at 40 % margin → 100', () => {
    expect(priceFromMargin(60, 40)).toBe(100)
  })

  it('markup: cost 100 at 25 % markup → 125', () => {
    expect(priceFromMarkup(100, 25)).toBe(125)
  })

  it('a 100 % margin is unreachable', () => {
    expect(priceFromMargin(60, 100)).toBeNull()
    expect(priceFromMargin(60, 120)).toBeNull()
  })

  it('round trip: price from margin has that margin', () => {
    expect(marginPct(priceFromMargin(73, 35), 73)).toBeCloseTo(35, 0)
  })
})

describe('moms', () => {
  it('adds and removes 25 %', () => {
    expect(withVat(100, 25)).toBe(125)
    expect(withoutVat(125, 25)).toBe(100)
  })

  it('12 % livsmedel', () => {
    expect(withVat(100, 12)).toBe(112)
  })
})

describe('roundPrice', () => {
  it('rounds to whole kronor or to a price ending in 9', () => {
    expect(roundPrice(123.4, 'krona')).toBe(123)
    expect(roundPrice(123.4, 'nine')).toBe(129)
    expect(roundPrice(123.4)).toBe(123.4)
  })
})

describe('discounts', () => {
  it('a 10 % discount cuts margin much more than 10 points', () => {
    // pris 100, kostnad 60: marginal 40 % → 90 kr: 33.33 %
    expect(marginAfterDiscount(100, 60, 10)).toBe(33.33)
  })

  it('max discount that keeps a 30 % margin', () => {
    // golv = 60/0.7 = 85.71 → rabatt 14.29 %
    expect(maxDiscountForMargin(100, 60, 30)).toBe(14.29)
  })

  it('is 0 when the price is already below the floor', () => {
    expect(maxDiscountForMargin(70, 60, 30)).toBe(0)
  })
})

describe('break-even and hourly rate', () => {
  it('rounds units up', () => {
    expect(breakEvenUnits(10000, 100, 60)).toBe(250)
    expect(breakEvenUnits(10001, 100, 60)).toBe(251)
  })

  it('has no break-even when each unit loses money', () => {
    expect(breakEvenUnits(10000, 50, 60)).toBeNull()
  })

  it('hourly rate spreads costs and pay over billable hours, plus buffer', () => {
    expect(hourlyRate({ monthlyCosts: 10000, desiredMonthlyPay: 30000, billableHoursPerMonth: 100 })).toBe(400)
    expect(hourlyRate({ monthlyCosts: 10000, desiredMonthlyPay: 30000, billableHoursPerMonth: 100, bufferPct: 10 })).toBe(440)
    expect(hourlyRate({ monthlyCosts: 1, desiredMonthlyPay: 1, billableHoursPerMonth: 0 })).toBeNull()
  })
})

describe('pricingStatus', () => {
  it('flags articles without a purchase price, at a loss, below and at target', () => {
    expect(pricingStatus({ unitPrice: 100 }, 30).status).toBe('no_cost')
    expect(pricingStatus({ unitPrice: 80, purchasePrice: 100 }, 30).status).toBe('loss')
    expect(pricingStatus({ unitPrice: 110, purchasePrice: 100 }, 30).status).toBe('below')
    expect(pricingStatus({ unitPrice: 150, purchasePrice: 100 }, 30).status).toBe('ok')
  })

  it('suggests the price that reaches the target margin', () => {
    expect(pricingStatus({ unitPrice: 110, purchasePrice: 70 }, 30).suggested).toBe(100)
  })
})
