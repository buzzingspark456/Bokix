import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toSummary, toIsoDate, fiscalYearFromDocuments, lookupOrgNumber, isBolagsverketConfigured, _resetTokenCache, BolagsverketError } from './_bolagsverket.js'

// Bolagsverkets eget exempelsvar ur OpenAPI-specifikationen
// (components.examples.organisationer-aktiebolag-svar), förkortat.
const AB = {
  organisationsidentitet: { identitetsbeteckning: '5299999994' },
  organisationsnamn: {
    organisationsnamnLista: [
      { registreringsdatum: 1710460800000, namn: 'Mopedbolaget AB', organisationsnamntyp: { kod: 'SARSKILT_FORETAGSNAMN', klartext: 'Särskilt företagsnam' } },
      { registreringsdatum: 1584230400000, namn: 'Cykelbolaget AB', organisationsnamntyp: { kod: 'FORETAGSNAMN', klartext: 'Företagsnamn' } },
    ],
    fel: null, dataproducent: 'Bolagsverket',
  },
  organisationsform: { kod: 'AB', klartext: 'Aktiebolag', fel: null, dataproducent: 'Bolagsverket' },
  postadressOrganisation: { postadress: { postnummer: '12345', utdelningsadress: 'Jobbstigen 2', land: 'Sverige', coAdress: 'C/o Annat företag', postort: 'Grönköping' }, fel: null, dataproducent: 'SCB' },
  organisationsdatum: { registreringsdatum: 948585600000, fel: null, dataproducent: 'Bolagsverket', infortHosScb: 949536000000 },
  naringsgrenOrganisation: { fel: null, dataproducent: 'Bolagsverket', sni: [{ kod: '47642', klartext: 'Specialiserad butikshandel med cyklar' }, { kod: '     ', klartext: '' }] },
}

describe('toSummary', () => {
  it('ger samma form som FöretagsAPI-träffen', () => {
    expect(toSummary(AB, { fiscalYearStart: '2025-01-01', fiscalYearEnd: '2025-12-31' })).toEqual({
      name: 'Cykelbolaget AB', // företagsnamnet, inte det särskilda företagsnamnet
      orgNumber: '5299999994',
      legalForm: 'AB',
      street: 'Jobbstigen 2', postalCode: '12345', city: 'Grönköping',
      active: true,
      registrationDate: '2000-01-23',
      fiscalYearStart: '2025-01-01', fiscalYearEnd: '2025-12-31',
      sni: [{ code: '47642', text: 'Specialiserad butikshandel med cyklar' }],
      source: 'Bolagsverket',
    })
  })
  it('avregistrerat bolag är inte aktivt', () => {
    expect(toSummary({ ...AB, avregistreradOrganisation: { avregistreringsdatum: 1683244800000 } }).active).toBe(false)
  })
  it('enskild näringsidkare (kod E) blir EF, okänd kod visar klartexten', () => {
    expect(toSummary({ ...AB, organisationsform: { kod: 'E', klartext: 'Enskild näringsidkare' } }).legalForm).toBe('EF')
    expect(toSummary({ ...AB, organisationsform: { kod: 'XYZ', klartext: 'Europabolag' } }).legalForm).toBe('Europabolag')
  })
  it('en deluppgift med fel blir bara tom', () => {
    const s = toSummary({ ...AB, postadressOrganisation: { postadress: null, fel: { typ: 'OTILLGANGLIG_UPPGIFTSKALLA' } } })
    expect(s.street).toBe('')
    expect(s.name).toBe('Cykelbolaget AB')
  })
})

describe('toIsoDate', () => {
  it('klarar millisekunder, siffersträng och ISO', () => {
    expect(toIsoDate(948585600000)).toBe('2000-01-23')
    expect(toIsoDate('948585600000')).toBe('2000-01-23')
    expect(toIsoDate('2024-06-30')).toBe('2024-06-30')
    expect(toIsoDate(null)).toBe('')
  })
})

describe('fiscalYearFromDocuments', () => {
  it('senaste årsredovisningen avgör, starten är dagen efter ett år tidigare', () => {
    expect(fiscalYearFromDocuments([
      { dokumentId: 'a', rapporteringsperiodTom: '2023-06-30' },
      { dokumentId: 'b', rapporteringsperiodTom: '2024-06-30' },
    ])).toEqual({ fiscalYearStart: '2023-07-01', fiscalYearEnd: '2024-06-30' })
    expect(fiscalYearFromDocuments([{ rapporteringsperiodTom: '2024-12-31' }])).toEqual({ fiscalYearStart: '2024-01-01', fiscalYearEnd: '2024-12-31' })
  })
  it('ingen årsredovisning ger tomt', () => {
    expect(fiscalYearFromDocuments([])).toEqual({ fiscalYearStart: '', fiscalYearEnd: '' })
    expect(fiscalYearFromDocuments(undefined)).toEqual({ fiscalYearStart: '', fiscalYearEnd: '' })
  })
})

describe('lookupOrgNumber', () => {
  const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body })
  let calls
  beforeEach(() => {
    process.env.BOLAGSVERKET_CLIENT_ID = 'id'
    process.env.BOLAGSVERKET_CLIENT_SECRET = 'hemligt'
    _resetTokenCache()
    calls = []
  })
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.BOLAGSVERKET_CLIENT_ID; delete process.env.BOLAGSVERKET_CLIENT_SECRET })

  function stub(routes) {
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      calls.push({ url, opts })
      for (const [part, res] of Object.entries(routes)) if (url.includes(part)) return typeof res === 'function' ? res() : res
      throw new Error('oväntat anrop ' + url)
    }))
  }

  it('hämtar token, företaget och räkenskapsåret', async () => {
    stub({
      '/oauth2/token': json(200, { access_token: 'tok', expires_in: 3600 }),
      '/organisationer': json(200, { organisationer: [AB] }),
      '/dokumentlista': json(200, { dokument: [{ dokumentId: 'x', rapporteringsperiodTom: '2024-12-31' }] }),
    })
    const [c] = await lookupOrgNumber('5299999994')
    expect(c.name).toBe('Cykelbolaget AB')
    expect(c.fiscalYearEnd).toBe('2024-12-31')
    const token = calls.find(c => c.url.includes('/oauth2/token'))
    expect(token.url).toBe('https://portal.api.bolagsverket.se/oauth2/token')
    expect(token.opts.body).toContain('scope=vardefulla-datamangder%3Aread')
    const org = calls.find(c => c.url.includes('/organisationer'))
    expect(org.url).toBe('https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/organisationer')
    expect(org.opts.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(org.opts.body)).toEqual({ identitetsbeteckning: '5299999994' })
  })

  it('återanvänder token mellan uppslag', async () => {
    stub({
      '/oauth2/token': json(200, { access_token: 'tok', expires_in: 3600 }),
      '/organisationer': json(200, { organisationer: [AB] }),
      '/dokumentlista': json(200, { dokument: [] }),
    })
    await lookupOrgNumber('5299999994')
    await lookupOrgNumber('5299999994')
    expect(calls.filter(c => c.url.includes('/oauth2/token'))).toHaveLength(1)
  })

  it('finns inte → tom lista, inget fel', async () => {
    stub({
      '/oauth2/token': json(200, { access_token: 'tok', expires_in: 3600 }),
      '/organisationer': json(200, { organisationer: [{ organisationsnamn: { fel: { typ: 'ORGANISATION_FINNS_EJ' } } }] }),
      '/dokumentlista': json(200, { dokument: [] }),
    })
    expect(await lookupOrgNumber('5560000000')).toEqual([])
  })

  it('dokumentlistan får fallera utan att uppslaget gör det', async () => {
    stub({
      '/oauth2/token': json(200, { access_token: 'tok', expires_in: 3600 }),
      '/organisationer': json(200, { organisationer: [AB] }),
      '/dokumentlista': json(500, {}),
    })
    const [c] = await lookupOrgNumber('5299999994')
    expect(c.name).toBe('Cykelbolaget AB')
    expect(c.fiscalYearEnd).toBe('')
  })

  it('429 och serverfel blir BolagsverketError med rätt status', async () => {
    stub({ '/oauth2/token': json(200, { access_token: 'tok', expires_in: 3600 }), '/organisationer': json(429, {}), '/dokumentlista': json(200, {}) })
    await expect(lookupOrgNumber('5299999994')).rejects.toMatchObject({ status: 429 })
    stub({ '/oauth2/token': json(200, { access_token: 'tok', expires_in: 3600 }), '/organisationer': json(503, {}), '/dokumentlista': json(200, {}) })
    await expect(lookupOrgNumber('5299999994')).rejects.toBeInstanceOf(BolagsverketError)
  })

  it('misslyckad inloggning blir ett fel, inte en tom träfflista', async () => {
    stub({ '/oauth2/token': json(401, { error: 'invalid_client' }), '/organisationer': json(200, {}), '/dokumentlista': json(200, {}) })
    await expect(lookupOrgNumber('5299999994')).rejects.toMatchObject({ status: 502 })
  })

  it('kräver båda nycklarna', () => {
    expect(isBolagsverketConfigured()).toBe(true)
    delete process.env.BOLAGSVERKET_CLIENT_SECRET
    expect(isBolagsverketConfigured()).toBe(false)
  })
})
