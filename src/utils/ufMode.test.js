import { describe, it, expect } from 'vitest'
import {
  isUfCompany, ufPageState, ufBlockedPage, ufInvoiceQuota, ufFreePeriod,
  ufSettingsSections, invoiceCreatedAt,
  UF_INVOICE_LIMIT_PER_DAY, UF_FREE_MONTHS, UF_NAV_IDS, UF_NAV_LABELS, UF_BLOCKED_PAGES,
} from './ufMode'
import { ACCESS_PAGES } from './pageAccess'

const uf = { id: 'c1', name: 'Solkraft UF', isUf: true }
const vanligt = { id: 'c2', name: 'Nordström Konsult AB' }

describe('isUfCompany', () => {
  it('bara företag som faktiskt är märkta som UF', () => {
    expect(isUfCompany(uf)).toBe(true)
    expect(isUfCompany(vanligt)).toBe(false)
    expect(isUfCompany(null)).toBe(false)
    expect(isUfCompany(undefined)).toBe(false)
  })
})

describe('ufPageState', () => {
  it('rör inte vanliga företag — allt är öppet', () => {
    // Hela UF-läget ska vara ett no-op för alla andra. Skulle det här
    // testet falla har någon råkat stänga av sidor för betalande kunder.
    expect(ufPageState(vanligt, 'payroll')).toBe('open')
    expect(ufPageState(vanligt, 'quotes')).toBe('open')
    expect(ufPageState(null, 'projects')).toBe('open')
  })

  it('öppnar UF-sidorna och spärrar resten', () => {
    expect(ufPageState(uf, 'invoices')).toBe('open')
    expect(ufPageState(uf, 'verifications')).toBe('open')
    expect(ufPageState(uf, 'settings')).toBe('open')
    expect(ufPageState(uf, 'payroll')).toBe('blocked')
    expect(ufPageState(uf, 'quotes')).toBe('blocked')
    expect(ufPageState(uf, 'projects')).toBe('blocked')
  })

  it('en okänd sida spärras hellre än släpps in', () => {
    // En ny sida i appen ska inte tyst dyka upp i UF-läget bara för att
    // ingen kommit ihåg att ta ställning till den.
    expect(ufPageState(uf, 'nagot_nytt')).toBe('blocked')
  })
})

describe('ufBlockedPage', () => {
  it('varje spärrad sida har en förklaring och en väg vidare', () => {
    for (const id of ['quotes', 'projects', 'payroll']) {
      const page = ufBlockedPage(id)
      expect(page).toBeTruthy()
      expect(page.label.length).toBeGreaterThan(0)
      expect(page.body.length).toBeGreaterThan(0)
      // Vägen vidare måste peka på en sida UF faktiskt har, annars
      // skickar spärrsidan användaren till en annan spärrsida.
      expect(UF_NAV_IDS).toContain(page.instead.tab)
    }
  })

  it('okänd sida ger null, inte en krasch', () => {
    expect(ufBlockedPage('finns_inte')).toBeNull()
  })
})

describe('ufInvoiceQuota', () => {
  const now = new Date('2026-03-10T14:00:00')
  const madeAt = (iso) => ({ id: 'inv_x', createdAt: iso })

  it('vanliga företag har inget tak', () => {
    const q = ufInvoiceQuota(vanligt, [madeAt('2026-03-10T09:00:00')], now)
    expect(q.limited).toBe(false)
    expect(q.reached).toBe(false)
    expect(q.remaining).toBe(Infinity)
  })

  it('räknar bara dagens fakturor', () => {
    const invoices = [
      madeAt('2026-03-09T23:59:00'), // igår
      madeAt('2026-03-10T08:00:00'),
      madeAt('2026-03-10T12:00:00'),
      madeAt('2026-03-11T00:01:00'), // imorgon
    ]
    const q = ufInvoiceQuota(uf, invoices, now)
    expect(q.used).toBe(2)
    expect(q.remaining).toBe(UF_INVOICE_LIMIT_PER_DAY - 2)
    expect(q.reached).toBe(false)
  })

  it('spärrar när taket är nått', () => {
    const invoices = Array.from({ length: UF_INVOICE_LIMIT_PER_DAY }, () => madeAt('2026-03-10T10:00:00'))
    const q = ufInvoiceQuota(uf, invoices, now)
    expect(q.used).toBe(UF_INVOICE_LIMIT_PER_DAY)
    expect(q.remaining).toBe(0)
    expect(q.reached).toBe(true)
  })

  it('går inte att nolla genom att backdatera fakturadatumet', () => {
    // Hela poängen med att räkna på createdAt: `date` är ett fält
    // användaren själv skriver i.
    const invoices = Array.from({ length: UF_INVOICE_LIMIT_PER_DAY }, () => ({
      id: 'inv_x', createdAt: '2026-03-10T10:00:00', date: '2020-01-01',
    }))
    expect(ufInvoiceQuota(uf, invoices, now).reached).toBe(true)
  })

  it('läser tidsstämpeln ur id:t för fakturor utan createdAt', () => {
    const ms = new Date('2026-03-10T10:00:00').getTime()
    const invoices = Array.from({ length: UF_INVOICE_LIMIT_PER_DAY }, (_, i) => ({ id: `inv_${ms}_a${i}` }))
    expect(ufInvoiceQuota(uf, invoices, now).used).toBe(UF_INVOICE_LIMIT_PER_DAY)
  })

  it('en faktura utan läsbar tidsstämpel räknas inte', () => {
    expect(ufInvoiceQuota(uf, [{ id: 'gammalt-id' }], now).used).toBe(0)
  })

  it('tom lista är noll, inte en krasch', () => {
    expect(ufInvoiceQuota(uf, [], now).used).toBe(0)
    expect(ufInvoiceQuota(uf, undefined, now).used).toBe(0)
  })
})

describe('invoiceCreatedAt', () => {
  it('createdAt går före id-tidsstämpeln', () => {
    const inv = { id: 'inv_1000000000000_ab', createdAt: '2026-03-10T10:00:00' }
    expect(invoiceCreatedAt(inv).getFullYear()).toBe(2026)
  })
  it('null när ingetdera finns', () => {
    expect(invoiceCreatedAt({ id: 'x' })).toBeNull()
    expect(invoiceCreatedAt(null)).toBeNull()
  })
})

describe('ufFreePeriod', () => {
  it('räknar i hela månader från startdagen', () => {
    const p = ufFreePeriod('2026-01-15T09:00:00', new Date('2026-01-15T09:00:00'))
    expect(p.known).toBe(true)
    expect(p.endsAt.getMonth()).toBe(new Date('2026-01-15').getMonth() + UF_FREE_MONTHS)
    expect(p.expired).toBe(false)
  })

  it('sista dagen är fortfarande inte utgången', () => {
    // Dagar kvar räknas mellan kalenderdagar — annars visas "0 dagar
    // kvar" och expired=true redan under sista dygnet.
    const p = ufFreePeriod('2026-01-15T09:00:00', new Date('2026-04-15T23:00:00'))
    expect(p.daysLeft).toBe(0)
    expect(p.expired).toBe(false)
  })

  it('dagen efter är utgången', () => {
    const p = ufFreePeriod('2026-01-15T09:00:00', new Date('2026-04-16T00:30:00'))
    expect(p.expired).toBe(true)
  })

  it('saknad starttid låser inte ute någon', () => {
    const p = ufFreePeriod(null, new Date())
    expect(p.known).toBe(false)
    expect(p.expired).toBe(false)
  })

  it('oläsbar starttid låser inte heller ute någon', () => {
    expect(ufFreePeriod('inte-ett-datum', new Date()).expired).toBe(false)
  })
})

describe('ufSettingsSections', () => {
  const sections = [{ id: 'profile' }, { id: 'company' }, { id: 'users' }, { id: 'subscription' }]

  it('rör inte vanliga företag', () => {
    expect(ufSettingsSections(vanligt, sections)).toEqual(sections)
  })

  it('döljer användarinbjudningar för UF', () => {
    const ids = ufSettingsSections(uf, sections).map(s => s.id)
    expect(ids).not.toContain('users')
    expect(ids).toContain('subscription')
    expect(ids).toContain('company')
  })
})

describe('UF-läget täcker varje sida appen har', () => {
  it('varje sida är antingen med i UF-läget eller uttryckligen avstängd', () => {
    // ACCESS_PAGES (pageAccess.js) är den underhållna listan över appens
    // sidor. Faller det här testet har någon lagt till en ny sida utan att
    // ta ställning till UF-läget — och förvalet (ufPageState) spärrar den
    // då tyst, med en generell text i stället för en förklaring.
    for (const page of ACCESS_PAGES) {
      const known = UF_NAV_IDS.includes(page.id) || Object.keys(UF_BLOCKED_PAGES).includes(page.id)
      expect(known, `sidan "${page.id}" saknar ett UF-beslut i ufMode.js`).toBe(true)
    }
  })

  it('ingen sida står som både öppen och avstängd', () => {
    for (const id of Object.keys(UF_BLOCKED_PAGES)) {
      expect(UF_NAV_IDS).not.toContain(id)
    }
  })

  it('varje öppen sida har ett namn', () => {
    // Namnen visas i menyn, på spärrsidan och på /uf — en sida utan namn
    // hade renderat sitt id ("verifications") för en besökare.
    for (const id of UF_NAV_IDS) {
      expect(UF_NAV_LABELS[id], `sidan "${id}" saknar etikett`).toBeTruthy()
    }
  })
})
