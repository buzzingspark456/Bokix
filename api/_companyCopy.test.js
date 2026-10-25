import { describe, it, expect } from 'vitest'
import { checkCompanyCopy } from './_companyCopy.js'

/**
 * Precis så mycket av Supabase-admin-klienten som kontrollen använder.
 * mismatchRuns: vad companies_mismatch svarar vid första, andra … anropet.
 */
function makeAdmin({ mismatchRuns = [[]], rpcError = null, resyncResult = 0, resyncError = null, failures = 0, countError = null } = {}) {
  const calls = []
  let run = 0
  return {
    calls,
    rpc: async (name) => {
      calls.push(name)
      if (name === 'companies_mismatch') {
        if (rpcError) return { data: null, error: rpcError }
        const data = mismatchRuns[Math.min(run, mismatchRuns.length - 1)]
        run++
        return { data, error: null }
      }
      if (name === 'companies_resync') return resyncError ? { data: null, error: resyncError } : { data: resyncResult, error: null }
      throw new Error('okänd rpc ' + name)
    },
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

const diff = (i, reason = 'olika') => ({ owner_user_id: `u${i}`, legacy_key: `c${i}`, reason })

describe('checkCompanyCopy', () => {
  it('inget larm och ingen rättning när allt stämmer', async () => {
    const admin = makeAdmin()
    const r = await checkCompanyCopy(admin)
    expect(r).toEqual({ skipped: false, mismatched: 0, resynced: 0, syncFailures: 0, detail: null, alert: false })
    expect(admin.calls).not.toContain('companies_resync')
  })

  it('rättar och larmar om att något behövde rättas', async () => {
    const admin = makeAdmin({ mismatchRuns: [[diff(1)], []], resyncResult: 1 })
    const r = await checkCompanyCopy(admin)
    expect(admin.calls.filter(c => c === 'companies_mismatch')).toHaveLength(2)
    expect(r).toMatchObject({ mismatched: 0, resynced: 1, alert: true })
    expect(r.detail).toContain('1 rättade automatiskt')
  })

  it('beskriver det som fortfarande skiljer efter rättningen', async () => {
    const r = await checkCompanyCopy(makeAdmin({ mismatchRuns: [[diff(1), diff(2)], [diff(2, 'saknas_i_tabellerna')]], resyncResult: 2 }))
    expect(r.mismatched).toBe(1)
    expect(r.detail).toContain('u2/c2: saknas_i_tabellerna')
    expect(r.alert).toBe(true)
  })

  it('räknar misslyckade speglingar det senaste dygnet', async () => {
    const now = Date.parse('2026-10-26T02:00:00Z')
    const admin = makeAdmin({ failures: 3 })
    const r = await checkCompanyCopy(admin, { now })
    expect(r).toMatchObject({ syncFailures: 3, alert: true })
    const countCall = admin.calls.find(c => c.table === 'system_events')
    expect(countCall.filters).toEqual({ kind: 'company_sync_failed', created_at: '2026-10-25T02:00:00.000Z' })
  })

  it('visar högst fem företag', async () => {
    const many = Array.from({ length: 8 }, (_, i) => diff(i))
    const r = await checkCompanyCopy(makeAdmin({ mismatchRuns: [many, many], resyncResult: 8 }))
    expect(r.detail).toContain('8 företag skiljer sig')
    expect(r.detail).toContain('u4/c4')
    expect(r.detail).not.toContain('u5/c5')
  })

  it('hoppar över tyst när SQL:en inte är körd', async () => {
    const r = await checkCompanyCopy(makeAdmin({ rpcError: { code: 'PGRST202', message: 'Could not find the function public.companies_mismatch' } }))
    expect(r).toEqual({ skipped: true })
  })

  it('kastar vid andra fel så att nattkörningen larmar', async () => {
    await expect(checkCompanyCopy(makeAdmin({ rpcError: { code: '57014', message: 'timeout' } }))).rejects.toThrow('timeout')
    await expect(checkCompanyCopy(makeAdmin({ mismatchRuns: [[diff(1)]], resyncError: { message: 'låst' } }))).rejects.toThrow('låst')
    await expect(checkCompanyCopy(makeAdmin({ countError: { message: 'nere' } }))).rejects.toThrow('nere')
  })
})
