import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }))

function makeRes() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } }
}
const req = (ip) => ({ headers: { 'x-forwarded-for': ip }, socket: {} })

describe('checkRateLimit', () => {
  let checkRateLimit
  beforeEach(async () => {
    vi.resetModules()
    rpc.mockReset()
    process.env.VITE_SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    ;({ checkRateLimit } = await import('./_rateLimit.js'))
  })

  it('stoppar när den delade räknaren säger nej, även om minnet säger ja', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const res = makeRes()
    expect(await checkRateLimit(req('1.1.1.1'), res, { key: 't', max: 5 })).toBe(false)
    expect(res.statusCode).toBe(429)
  })

  it('släpper igenom när databasen inte svarar, men minnet gäller fortfarande', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } })
    expect(await checkRateLimit(req('2.2.2.2'), makeRes(), { key: 't', max: 2 })).toBe(true)
    expect(await checkRateLimit(req('2.2.2.2'), makeRes(), { key: 't', max: 2 })).toBe(true)
    expect(await checkRateLimit(req('2.2.2.2'), makeRes(), { key: 't', max: 2 })).toBe(false)
  })

  it('skickar aldrig IP eller e-post i klartext till databasen', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    await checkRateLimit(req('3.3.3.3'), makeRes(), { key: 'reset', identifier: 'kund@example.se', windowMs: 60_000, max: 5 })
    const [name, args] = rpc.mock.calls[0]
    expect(name).toBe('hit_rate_limit')
    expect(args.p_key).toMatch(/^reset:[0-9a-f]{32}$/)
    expect(args).toMatchObject({ p_max: 5, p_window_seconds: 60 })
  })
})
