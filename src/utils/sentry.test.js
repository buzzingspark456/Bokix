import { describe, it, expect } from 'vitest'
import { scrubText, scrubEvent } from './sentry.js'

describe('sentry: inga personuppgifter skickas', () => {
  it('tar bort e-post, personnummer, org.nr och långa nummer', () => {
    expect(scrubText('Kunde inte skicka till anna.svensson@firma.se')).toBe('Kunde inte skicka till [e-post]')
    expect(scrubText('pnr 920927-3029 och 199209273029')).toBe('pnr [nummer] och [nummer]')
    expect(scrubText('orgnr 556123-4567')).toBe('orgnr [nummer]')
    expect(scrubText('bankgiro 12345678')).toBe('bankgiro [nummer]')
    expect(scrubText('Faktura 1001 kunde inte sparas')).toBe('Faktura 1001 kunde inte sparas')
  })

  it('rensar händelsen: ingen användare, ingen frågesträng, inga konsolrader', () => {
    const event = scrubEvent({
      user: { email: 'a@b.se' },
      message: 'fel för a@b.se',
      exception: { values: [{ value: 'Ogiltigt org.nr 5561234567' }] },
      request: { url: 'https://www.bokix.se/app?token=hemligt', headers: { Authorization: 'x' }, cookies: 'y' },
      breadcrumbs: [
        { category: 'console', message: 'state: {...}' },
        { category: 'fetch', data: { url: '/api/calendar?u=1&k=nyckel' } },
        { category: 'navigation', data: { from: '/a?x=1', to: '/b#c' } },
      ],
    })
    expect(event.user).toBeUndefined()
    expect(event.message).toBe('fel för [e-post]')
    expect(event.exception.values[0].value).toBe('Ogiltigt org.nr [nummer]')
    expect(event.request).toEqual({ url: 'https://www.bokix.se/app' })
    expect(event.breadcrumbs).toHaveLength(2)
    expect(event.breadcrumbs[0].data.url).toBe('/api/calendar')
    expect(event.breadcrumbs[1].data).toEqual({ from: '/a', to: '/b' })
  })
})
