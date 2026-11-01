import { describe, it, expect } from 'vitest'
import { sharedFieldsToSave } from './stateMerge.js'
import { ACCESS_PAGES, accountantPageAccess, canWriteField, defaultPageAccess } from './pageAccess.js'
import { COMPANY_WRITABLE_FIELDS } from './companyFields.js'

const FIELDS = ['employees', 'contacts', 'agiReports']
const all = () => true

describe('sharedFieldsToSave', () => {
  it('räknar inte en ny kopia med samma innehåll som ändring', () => {
    const last = { contacts: [{ id: 'a', name: 'Kund' }] }
    const current = { contacts: [{ id: 'a', name: 'Kund' }] }
    expect(sharedFieldsToSave(last, current, FIELDS, all)).toEqual({ same: ['contacts'], changed: [] })
  })

  it('räknar saknat fält och tom lista som samma sak', () => {
    expect(sharedFieldsToSave({}, { employees: [] }, FIELDS, all)).toEqual({ same: ['employees'], changed: [] })
  })

  it('skickar ett fält som verkligen ändrats', () => {
    const last = { contacts: [{ id: 'a', name: 'Kund' }] }
    const current = { contacts: [{ id: 'a', name: 'Ny kund' }] }
    expect(sharedFieldsToSave(last, current, FIELDS, all).changed).toEqual(['contacts'])
  })

  it('hoppar över fält användaren inte får skriva, så de inte försöks om', () => {
    const last = { employees: [] }
    const current = { employees: [{ id: 'e1' }], contacts: [{ id: 'c1' }] }
    expect(sharedFieldsToSave(last, current, FIELDS, f => f !== 'employees').changed).toEqual(['contacts'])
  })
})

describe('behörighet för varje företagsfält', () => {
  it('varje fält som går att spara hör till en sida', () => {
    const placed = new Set(ACCESS_PAGES.flatMap(p => p.fields))
    expect(COMPANY_WRITABLE_FIELDS.filter(f => !placed.has(f))).toEqual([])
  })

  it('en revisor med alla sidor kan spara allt, även AGI', () => {
    const access = accountantPageAccess()
    expect(COMPANY_WRITABLE_FIELDS.filter(f => !canWriteField(access, f, 'editor'))).toEqual([])
  })

  it('utan lönebehörighet går AGI inte att spara', () => {
    expect(canWriteField(defaultPageAccess('editor'), 'agiReports', 'editor')).toBe(false)
  })
})
