import { describe, it, expect } from 'vitest'
import { accessForPage, canWriteField, visiblePages, defaultPageAccess, ACCESS_PAGES } from './pageAccess'

// Behörigheter är åtkomstkontroll, inte kosmetik — samma allvar i testerna
// som för bokföringslogiken. Går något här sönder ser fel person fel data.

describe('accessForPage', () => {
  it('utan lista gäller rollen, precis som innan behörigheterna fanns', () => {
    expect(accessForPage(null, 'invoices', 'editor')).toBe('edit')
    expect(accessForPage(null, 'invoices', 'viewer')).toBe('view')
    expect(accessForPage(undefined, 'payroll', 'editor')).toBe('edit')
  })

  it('rollen är ett tak — en läsare kan aldrig få redigera via listan', () => {
    expect(accessForPage({ invoices: 'edit' }, 'invoices', 'viewer')).toBe('view')
  })

  it('en sida som inte står i listan faller tillbaka på rollen', () => {
    // Annars skulle en NY sida i appen bli osynlig för alla befintliga
    // medlemmar tills ägaren gått in och tagit ställning till den.
    expect(accessForPage({ invoices: 'edit' }, 'bank', 'editor')).toBe('edit')
  })

  it('none döljer sidan', () => {
    expect(accessForPage({ payroll: 'none' }, 'payroll', 'editor')).toBe('none')
  })
})

describe('canWriteField', () => {
  const access = { invoices: 'edit', payroll: 'none', verifications: 'view' }

  it('en läsare får aldrig skriva, oavsett lista', () => {
    expect(canWriteField({ invoices: 'edit' }, 'invoices', 'viewer')).toBe(false)
  })

  it('fält som hör till en sida med redigering går igenom', () => {
    expect(canWriteField(access, 'invoices', 'editor')).toBe(true)
  })

  it('fält som bara hör till stängda sidor blockeras', () => {
    // employees/payrollRuns skrivs bara från lönesidan, som är 'none'.
    expect(canWriteField(access, 'employees', 'editor')).toBe(false)
    expect(canWriteField(access, 'payrollRuns', 'editor')).toBe(false)
  })

  it('ett delat fält går igenom om NÅGON öppen sida skriver det', () => {
    // 'verifications' skrivs av flera sidor — fakturasidan får redigera,
    // alltså är fältet skrivbart. Den gränsen står också i UI-texten.
    expect(canWriteField(access, 'verifications', 'editor')).toBe(true)
  })

  it('utan lista skrivs allt, som förut', () => {
    expect(canWriteField(null, 'employees', 'editor')).toBe(true)
  })
})

describe('visiblePages och förval', () => {
  it('döljer bara det som satts till none', () => {
    const pages = visiblePages({ payroll: 'none', taxes: 'view' }, 'editor')
    expect(pages).not.toContain('payroll')
    expect(pages).toContain('taxes')
    expect(pages).toContain('invoices')
  })

  it('förvalet ger allt utom lön, och följer rollen', () => {
    const editor = defaultPageAccess('editor')
    expect(editor.payroll).toBe('none')
    expect(editor.invoices).toBe('edit')
    const viewer = defaultPageAccess('viewer')
    expect(viewer.invoices).toBe('view')
  })

  it('varje sida i katalogen har ett id och en etikett', () => {
    for (const page of ACCESS_PAGES) {
      expect(page.id).toBeTruthy()
      expect(page.label).toBeTruthy()
    }
  })
})
