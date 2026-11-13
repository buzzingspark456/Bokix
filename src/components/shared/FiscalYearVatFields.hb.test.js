import { describe, it, expect } from 'vitest'
import { companySetupToCompany, companySetupFromCompany } from './FiscalYearVatFields'

describe('handelsbolag i räkenskapsårsvalet', () => {
  it('brutet år sparas inte för ett HB utan att alla delägare är bolag', () => {
    const r = companySetupToCompany({ mode: 'other', startMonth: 7, vatRegistered: false }, '969712-3456')
    expect(r.fiscalYear).toBeUndefined()
    expect(r.legalPartnersOnly).toBe(false)
  })
  it('brutet år sparas när alla delägare är bolag', () => {
    const r = companySetupToCompany({ mode: 'other', startMonth: 7, vatRegistered: false, legalPartnersOnly: true }, '969712-3456')
    expect(r.fiscalYear).toMatch(/-07-01$/)
    expect(r.legalPartnersOnly).toBe(true)
  })
  it('ett aktiebolag påverkas inte och får inget extra fält', () => {
    const r = companySetupToCompany({ mode: 'other', startMonth: 7, vatRegistered: false }, '556036-0793')
    expect(r.fiscalYear).toMatch(/-07-01$/)
    expect('legalPartnersOnly' in r).toBe(false)
  })
  it('ett HB som redan har brutet år räknas som att delägarna är bolag', () => {
    expect(companySetupFromCompany({ orgNr: '969712-3456', fiscalYear: '2026-07-01' }).legalPartnersOnly).toBe(true)
    expect(companySetupFromCompany({ orgNr: '969712-3456', fiscalYear: '2026-01-01' }).legalPartnersOnly).toBe(false)
  })
})
