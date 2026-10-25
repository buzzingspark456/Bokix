import { describe, it, expect } from 'vitest'
import { checkCompanyCopy } from './_companyCopy.js'

/**
 * Supabase-admin i minnet: konton att kontrollera, skillnader per konto (före
 * och efter rättning), cron_progress och system_events.
 */
function makeAdmin({ owners = [], diffs = {}, fixable = {}, failures = 0, progress = null, missing = false, ownerError = null } = {}) {
  const store = { progress, calls: [] }
  const left = { ...diffs }
  return {
    store,
    rpc: async (name, args) => {
      store.calls.push({ name, args })
      if (missing) return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } }
      if (name === 'companies_owners_to_check') {
        if (ownerError) return { data: null, error: ownerError }
        const list = owners.filter(o => !args.p_after || o > args.p_after).slice(0, args.p_limit)
        return { data: list.map(o => ({ owner_user_id: o })), error: null }
      }
      if (name === 'companies_mismatch_for') return { data: left[args.p_owner] || [], error: null }
      if (name === 'companies_resync_for') {
        const n = (left[args.p_owner] || []).length
        if (fixable[args.p_owner] !== false) delete left[args.p_owner]
        return { data: n, error: null }
      }
      throw new Error('okänd rpc ' + name)
    },
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        gte: () => Promise.resolve({ count: failures, error: null }),
        maybeSingle: async () => ({ data: store.progress ? { cursor_value: JSON.stringify(store.progress) } : null, error: null }),
        upsert: async (row) => { if (table === 'cron_progress') store.progress = JSON.parse(row.cursor_value); return { error: null } },
      }
      return q
    },
  }
}

const id = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`
const diff = (o, reason = 'olika') => [{ owner_user_id: o, legacy_key: 'k', reason }]
const SATURDAY = Date.parse('2026-10-24T02:30:00Z')
const SUNDAY = Date.parse('2026-10-25T02:30:00Z')

describe('checkCompanyCopy', () => {
  it('allt stämmer: inget larm, genomgången klar och sparad', async () => {
    const admin = makeAdmin({ owners: [id(1), id(2)] })
    const r = await checkCompanyCopy(admin, { now: SATURDAY })
    expect(r).toMatchObject({ checked: 2, complete: true, mismatched: 0, resynced: 0, alert: false, detail: null })
    expect(admin.store.progress).toEqual({ after: null, lastPassStart: new Date(SATURDAY).toISOString() })
    expect(admin.store.calls.some(c => c.name === 'companies_resync_for')).toBe(false)
  })

  it('första gången (ingen sparad genomgång): alla konton', async () => {
    const admin = makeAdmin({ owners: [id(1)] })
    const r = await checkCompanyCopy(admin, { now: SATURDAY })
    expect(r.full).toBe(true)
    expect(admin.store.calls[0].args.p_since).toBeNull()
  })

  it('vanlig natt: bara konton ändrade sedan förra genomgången', async () => {
    const admin = makeAdmin({ owners: [id(1)], progress: { after: null, lastPassStart: '2026-10-23T02:30:00.000Z' } })
    await checkCompanyCopy(admin, { now: SATURDAY })
    expect(admin.store.calls[0].args.p_since).toBe('2026-10-23T02:30:00.000Z')
  })

  it('söndag: alla konton, även om förra genomgången finns', async () => {
    const admin = makeAdmin({ owners: [id(1)], progress: { after: null, lastPassStart: '2026-10-24T02:30:00.000Z' } })
    const r = await checkCompanyCopy(admin, { now: SUNDAY })
    expect(r.full).toBe(true)
    expect(admin.store.calls[0].args.p_since).toBeNull()
  })

  it('rättar ett konto som skiljer sig, och larmar om att det behövdes', async () => {
    const admin = makeAdmin({ owners: [id(1), id(2)], diffs: { [id(2)]: diff(id(2)) } })
    const r = await checkCompanyCopy(admin, { now: SATURDAY })
    expect(r).toMatchObject({ resynced: 1, mismatched: 0, alert: true })
    expect(r.detail).toContain('1 rättade automatiskt')
  })

  it('det som inte går att rätta beskrivs i larmet', async () => {
    const admin = makeAdmin({ owners: [id(1)], diffs: { [id(1)]: diff(id(1), 'saknas_i_tabellerna') }, fixable: { [id(1)]: false } })
    const r = await checkCompanyCopy(admin, { now: SATURDAY })
    expect(r.mismatched).toBe(1)
    expect(r.detail).toContain(`${id(1)}/k: saknas_i_tabellerna`)
  })

  it('hinner inte klart: sparar var den var och fortsätter nästa natt där', async () => {
    const owners = Array.from({ length: 5 }, (_, i) => id(i + 1))
    const admin = makeAdmin({ owners })
    let calls = 0
    const r1 = await checkCompanyCopy({ ...admin, rpc: async (n, a) => { if (n === 'companies_mismatch_for' && ++calls > 2) await new Promise(res => setTimeout(res, 30)); return admin.rpc(n, a) } }, { now: SATURDAY, deadline: Date.now() + 40 })
    expect(r1.complete).toBe(false)
    expect(admin.store.progress.after).toBeTruthy()
    const resumeAfter = admin.store.progress.after
    const r2 = await checkCompanyCopy(admin, { now: SATURDAY + DAY })
    expect(r2.complete).toBe(true)
    expect(admin.store.calls.filter(c => c.name === 'companies_owners_to_check').at(-1).args.p_after).toBe(resumeAfter)
    expect(r1.checked + r2.checked).toBe(5)
  })

  it('räknar misslyckade speglingar det senaste dygnet', async () => {
    const r = await checkCompanyCopy(makeAdmin({ owners: [id(1)], failures: 3 }), { now: SATURDAY })
    expect(r).toMatchObject({ syncFailures: 3, alert: true })
  })

  it('SQL:en inte körd: hoppar över tyst', async () => {
    expect(await checkCompanyCopy(makeAdmin({ missing: true }), { now: SATURDAY })).toEqual({ skipped: true })
  })

  it('andra fel kastas så att jobbet larmar', async () => {
    await expect(checkCompanyCopy(makeAdmin({ ownerError: { code: '57014', message: 'timeout' } }), { now: SATURDAY })).rejects.toThrow('timeout')
  })
})

const DAY = 24 * 60 * 60 * 1000
