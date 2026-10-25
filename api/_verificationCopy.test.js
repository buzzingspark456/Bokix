import { describe, it, expect } from 'vitest'
import { checkVerificationCopy } from './_verificationCopy.js'

/** Precis så mycket av Supabase-admin-klienten som kontrollen använder. */
function makeAdmin({ mismatch = [], rpcError = null, failures = 0, countError = null } = {}) {
  const calls = []
  return {
    calls,
    rpc: async (name) => { calls.push(name); return rpcError ? { data: null, error: rpcError } : { data: mismatch, error: null } },
    from(table) {
      const filters = {}
      const q = {
        select: () => q,
        eq: (k, v) => { filters[k] = v; return q },
        gte: (k, v) => { filters[k] = v; calls.push({ table, filters }); return Promise.resolve(countError ? { count: null, error: countError } : { count: failures, error: null }) },
      }
      return q
    },
  }
}

describe('checkVerificationCopy', () => {
  it('ingen detalj när tabellen stämmer och inget misslyckats', async () => {
    const r = await checkVerificationCopy(makeAdmin())
    expect(r).toEqual({ skipped: false, mismatched: 0, syncFailures: 0, detail: null })
  })

  it('beskriver företag som skiljer sig', async () => {
    const r = await checkVerificationCopy(makeAdmin({ mismatch: [{ user_id: 'u1', company_id: 'c1', blob_count: 10, table_count: 9 }] }))
    expect(r.mismatched).toBe(1)
    expect(r.detail).toContain('u1/c1: blobben 10, tabellen 9')
  })

  it('räknar misslyckade kopieringar det senaste dygnet', async () => {
    const now = Date.parse('2026-10-25T02:00:00Z')
    const admin = makeAdmin({ failures: 3 })
    const r = await checkVerificationCopy(admin, { now })
    expect(r.syncFailures).toBe(3)
    expect(r.detail).toContain('3 misslyckade kopieringar')
    const countCall = admin.calls.find(c => c.table === 'system_events')
    expect(countCall.filters).toEqual({ kind: 'verif_sync_failed', created_at: '2026-10-24T02:00:00.000Z' })
  })

  it('visar högst fem företag', async () => {
    const mismatch = Array.from({ length: 8 }, (_, i) => ({ user_id: `u${i}`, company_id: 'c', blob_count: 1, table_count: 0 }))
    const r = await checkVerificationCopy(makeAdmin({ mismatch }))
    expect(r.detail).toContain('8 företag skiljer sig')
    expect(r.detail).toContain('u4/c')
    expect(r.detail).not.toContain('u5/c')
  })

  it('hoppar över tyst när SQL:en inte är körd', async () => {
    const r = await checkVerificationCopy(makeAdmin({ rpcError: { code: 'PGRST202', message: 'Could not find the function public.verifications_mismatch' } }))
    expect(r).toEqual({ skipped: true })
  })

  it('kastar vid andra fel så att nattkörningen larmar', async () => {
    await expect(checkVerificationCopy(makeAdmin({ rpcError: { code: '57014', message: 'timeout' } }))).rejects.toThrow('timeout')
    await expect(checkVerificationCopy(makeAdmin({ countError: { message: 'nere' } }))).rejects.toThrow('nere')
  })
})
