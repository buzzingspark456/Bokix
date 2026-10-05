import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Bara uppslagsgrenen (action: 'lookup'): vilken källa som används.
vi.mock('./_rateLimit.js', () => ({ checkRateLimit: async () => true }))
vi.mock('./_security.js', () => ({ applySecurityHeaders: () => {} }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))
const lookupOrgNumber = vi.fn()
vi.mock('./_bolagsverket.js', async (orig) => ({
  ...(await orig()),
  lookupOrgNumber: (...a) => lookupOrgNumber(...a),
}))

function makeRes() {
  return { statusCode: 200, body: null, setHeader() {}, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }
}
const post = (body) => ({ method: 'POST', headers: {}, body: { action: 'lookup', ...body } })

describe('company-access lookup', () => {
  let handler
  beforeEach(async () => {
    lookupOrgNumber.mockReset()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ companies: [{ name: 'Från FöretagsAPI', orgNumber: '5560000000' }] }) })))
    ;({ default: handler } = await import('./company-access.js'))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.BOLAGSVERKET_CLIENT_ID; delete process.env.BOLAGSVERKET_CLIENT_SECRET; delete process.env.FORETAGSAPI_KEY
  })

  it('organisationsnummer går till Bolagsverket när nycklarna finns', async () => {
    process.env.BOLAGSVERKET_CLIENT_ID = 'id'; process.env.BOLAGSVERKET_CLIENT_SECRET = 's'; process.env.FORETAGSAPI_KEY = 'k'
    lookupOrgNumber.mockResolvedValue([{ name: 'Cykelbolaget AB', orgNumber: '5299999994', source: 'Bolagsverket' }])
    const res = makeRes()
    await handler(post({ mode: 'orgnr', query: '529999-9994' }), res)
    expect(lookupOrgNumber).toHaveBeenCalledWith('5299999994')
    expect(res.body.companies[0].name).toBe('Cykelbolaget AB')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('Bolagsverkets 429 skickas vidare till klienten', async () => {
    process.env.BOLAGSVERKET_CLIENT_ID = 'id'; process.env.BOLAGSVERKET_CLIENT_SECRET = 's'
    const { BolagsverketError } = await import('./_bolagsverket.js')
    lookupOrgNumber.mockRejectedValue(new BolagsverketError('För många uppslag', 429))
    const res = makeRes()
    await handler(post({ mode: 'orgnr', query: '5299999994' }), res)
    expect(res.statusCode).toBe(429)
  })

  it('Bolagsverket nere → reserv via FöretagsAPI', async () => {
    process.env.BOLAGSVERKET_CLIENT_ID = 'id'; process.env.BOLAGSVERKET_CLIENT_SECRET = 's'; process.env.FORETAGSAPI_KEY = 'k'
    const { BolagsverketError } = await import('./_bolagsverket.js')
    lookupOrgNumber.mockRejectedValue(new BolagsverketError('nere', 502))
    const res = makeRes()
    await handler(post({ mode: 'orgnr', query: '5560000000' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.companies[0].name).toBe('Från FöretagsAPI')
  })

  it('utan Bolagsverket-nycklar används FöretagsAPI som förut', async () => {
    process.env.FORETAGSAPI_KEY = 'k'
    const res = makeRes()
    await handler(post({ mode: 'orgnr', query: '5560000000' }), res)
    expect(lookupOrgNumber).not.toHaveBeenCalled()
    expect(res.body.companies[0].name).toBe('Från FöretagsAPI')
  })

  it('namnsökning utan FöretagsAPI-nyckel ger ett begripligt besked', async () => {
    process.env.BOLAGSVERKET_CLIENT_ID = 'id'; process.env.BOLAGSVERKET_CLIENT_SECRET = 's'
    const res = makeRes()
    await handler(post({ mode: 'name', query: 'Cykel' }), res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toMatch(/organisationsnummer/)
  })
})
