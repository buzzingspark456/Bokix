import { describe, it, expect } from 'vitest'
import {
  PLAN_TIERS, ALL_PLAN_IDS, YEARLY_MINIMUM_MONTHS,
  resolvePlan, planFromId, planIncludesPayroll, resolveCancellation,
} from './plans'

describe('katalogen', () => {
  it('fyra giltiga planer: två nivåer × två betalsätt', () => {
    expect(ALL_PLAN_IDS.sort()).toEqual([
      'employer_monthly', 'employer_yearly', 'solo_monthly', 'solo_yearly',
    ])
  })

  it('bara nivån "med personal" innehåller lönemodulen', () => {
    expect(PLAN_TIERS.find(t => t.id === 'solo').includesPayroll).toBe(false)
    expect(PLAN_TIERS.find(t => t.id === 'employer').includesPayroll).toBe(true)
  })
})

describe('priser', () => {
  it('månadsplanerna kostar det prissidan visar', () => {
    expect(resolvePlan('solo', 'monthly')).toMatchObject({ price: 129, amountOre: 12900 })
    expect(resolvePlan('employer', 'monthly')).toMatchObject({ price: 179, amountOre: 17900 })
  })

  // Kärnan i årsplanen: ett LÄGRE MÅNADSPRIS, inte en årsfaktura. Går det
  // här sönder debiteras kunden ett förskott hen aldrig valt.
  it('årsplanen debiteras månadsvis till det lägre priset', () => {
    expect(resolvePlan('solo', 'yearly')).toMatchObject({ price: 109, amountOre: 10900, stripeInterval: 'month' })
    expect(resolvePlan('employer', 'yearly')).toMatchObject({ price: 149, amountOre: 14900, stripeInterval: 'month' })
  })

  it('båda planerna debiteras per månad i Stripe', () => {
    for (const id of ALL_PLAN_IDS) {
      expect(planFromId(id).stripeInterval).toBe('month')
    }
  })

  it('besparingen är hela kronor per månad och jämna hundra per år', () => {
    expect(resolvePlan('solo', 'yearly')).toMatchObject({ savingPerMonth: 20, savingPerYear: 240 })
    expect(resolvePlan('employer', 'yearly')).toMatchObject({ savingPerMonth: 30, savingPerYear: 360 })
  })

  it('månadsplanen har varken besparing eller minsta avtalstid', () => {
    expect(resolvePlan('solo', 'monthly')).toMatchObject({ savingPerYear: 0, minimumMonths: 0 })
  })

  it('årsplanen har tre månaders minsta avtalstid', () => {
    expect(resolvePlan('employer', 'yearly').minimumMonths).toBe(YEARLY_MINIMUM_MONTHS)
  })

  // En okänd sträng får aldrig leda till ett debiterat belopp.
  it('okänd nivå eller okänt betalsätt ger null', () => {
    expect(resolvePlan('enterprise', 'monthly')).toBeNull()
    expect(resolvePlan('solo', 'weekly')).toBeNull()
    expect(planFromId('nonsens')).toBeNull()
    expect(planFromId(null)).toBeNull()
  })
})

describe('planIncludesPayroll', () => {
  it('följer nivån', () => {
    expect(planIncludesPayroll('employer_yearly')).toBe(true)
    expect(planIncludesPayroll('solo_monthly')).toBe(false)
  })

  // Konton skapade innan nivåerna fanns har ingen plan sparad och har
  // betalat 179 kr — de ska ha allt, inte låsas ute från något de betalat för.
  it('saknad plan ger full funktionalitet', () => {
    expect(planIncludesPayroll(undefined)).toBe(true)
    expect(planIncludesPayroll('en_gammal_okänd_plan')).toBe(true)
  })
})

describe('resolveCancellation', () => {
  const start = '2026-01-15'

  it('månadsplanen avslutas alltid vid periodens slut', () => {
    const r = resolveCancellation({ planId: 'employer_monthly', startedAt: start, canceledAt: '2026-01-20' })
    expect(r.atPeriodEnd).toBe(true)
    expect(r.cancelAt).toBeNull()
  })

  // Säger kunden upp i månad ett ska abonnemanget löpa ut när minimitiden
  // gör det — inte direkt, och inte om nio månader till.
  it('årsplanen löper till minimitidens slut om man säger upp tidigt', () => {
    const r = resolveCancellation({ planId: 'employer_yearly', startedAt: start, canceledAt: '2026-02-01' })
    expect(r.atPeriodEnd).toBe(false)
    expect(r.monthsElapsed).toBe(0)
    expect(r.cancelAt.toISOString().slice(0, 10)).toBe('2026-04-15')
  })

  it('efter minimitiden beter sig årsplanen som månadsplanen', () => {
    const r = resolveCancellation({ planId: 'employer_yearly', startedAt: start, canceledAt: '2026-04-15' })
    expect(r.monthsElapsed).toBe(3)
    expect(r.atPeriodEnd).toBe(true)
    expect(r.cancelAt).toBeNull()
  })

  // En påbörjad månad är inte en passerad månad.
  it('dagen före tredje månadsskiftet räknas fortfarande som månad två', () => {
    const r = resolveCancellation({ planId: 'employer_yearly', startedAt: start, canceledAt: '2026-04-14' })
    expect(r.monthsElapsed).toBe(2)
    expect(r.atPeriodEnd).toBe(false)
  })

  it('ogiltigt startdatum faller tillbaka på periodens slut i stället för att krascha', () => {
    const r = resolveCancellation({ planId: 'employer_yearly', startedAt: 'inte-ett-datum' })
    expect(r.atPeriodEnd).toBe(true)
    expect(r.cancelAt).toBeNull()
  })

  it('okänd plan behandlas som månadsplan', () => {
    expect(resolveCancellation({ planId: 'finns_inte', startedAt: start }).atPeriodEnd).toBe(true)
  })
})
