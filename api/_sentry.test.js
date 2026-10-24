import { describe, it, expect, vi, afterEach } from 'vitest'
import { withSentry } from './_sentry.js'

function fakeRes() {
  return {
    statusCode: 200, body: undefined, headersSent: false,
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; this.headersSent = true; return this },
  }
}

describe('withSentry', () => {
  afterEach(() => { delete process.env.VERCEL_ENV })

  it('släpper igenom vanliga svar oförändrade', async () => {
    const res = fakeRes()
    await withSentry(async (_req, r) => { r.status(201).json({ ok: true }) }, '/api/x')({ method: 'GET' }, res)
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ ok: true })
  })

  it('ett kastat fel blir ett 500-svar utan felets text', async () => {
    const res = fakeRes()
    await withSentry(async () => { throw new Error('hemlig detalj anna@b.se') }, '/api/x')({ method: 'POST' }, res)
    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('anna@b.se')
  })

  it('utanför Vercels produktion laddas Sentry aldrig', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = fakeRes()
    await withSentry(async (_req, r) => { r.status(500).json({ error: 'fel' }) }, '/api/x')({ method: 'GET' }, res)
    expect(res.statusCode).toBe(500)
    spy.mockRestore()
  })
})
