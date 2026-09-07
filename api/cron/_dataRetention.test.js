import { describe, it, expect } from 'vitest'
import { hasBookkeepingData, cleanAbandonedSignups, ABANDONED_SIGNUP_DAYS } from './_dataRetention.js'

const DAY = 86400000
const now = new Date('2026-09-06T03:00:00Z')
const old = new Date(now.getTime() - (ABANDONED_SIGNUP_DAYS + 5) * DAY).toISOString()

/** Minimal stubb av den delen av supabase-admin-klienten rutinen använder.
 * Räcker för att bevisa VILKA konton som väljs ut, vilket är hela poängen —
 * ett fel där raderar riktig kunddata. */
function makeAdmin({ rows, subs = [] }) {
  const deleted = { userData: [], authUsers: [], storage: [] }
  return {
    deleted,
    from(table) {
      const api = {
        select: () => api,
        lt: () => api,
        in: () => Promise.resolve({ data: subs, error: null }),
        delete: () => ({ eq: (_col, value) => { deleted.userData.push(value); return Promise.resolve({ error: null }) } }),
        then: undefined,
      }
      if (table === 'user_data') {
        api.select = () => ({ lt: () => Promise.resolve({ data: rows, error: null }) })
        api.delete = () => ({ eq: (_c, v) => { deleted.userData.push(v); return Promise.resolve({ error: null }) } })
      }
      return api
    },
    storage: {
      from: () => ({
        list: () => Promise.resolve({ data: [], error: null }),
        remove: (paths) => { deleted.storage.push(...paths); return Promise.resolve({ error: null }) },
      }),
    },
    auth: { admin: { deleteUser: (id) => { deleted.authUsers.push(id); return Promise.resolve({ error: null }) } } },
  }
}

describe('hasBookkeepingData', () => {
  it('en verifikation räcker för att kontot ska vara arkivpliktigt', () => {
    expect(hasBookkeepingData({ companies: { c1: { verifications: [{ id: 'v1' }] } } })).toBe(true)
  })

  it('fakturor, utgifter, lönekörningar och banktransaktioner räknas också', () => {
    expect(hasBookkeepingData({ companies: { c1: { invoices: [{}] } } })).toBe(true)
    expect(hasBookkeepingData({ companies: { c1: { expenses: [{}] } } })).toBe(true)
    expect(hasBookkeepingData({ companies: { c1: { payrollRuns: [{}] } } })).toBe(true)
    expect(hasBookkeepingData({ companies: { c1: { bankTransactions: [{}] } } })).toBe(true)
  })

  it('ett tomt konto med bara företagsuppgifter är inte arkivpliktigt', () => {
    expect(hasBookkeepingData({ companies: { c1: { company: { name: 'Exempel AB' } } } })).toBe(false)
    expect(hasBookkeepingData({})).toBe(false)
    expect(hasBookkeepingData(null)).toBe(false)
  })
})

describe('cleanAbandonedSignups', () => {
  it('tar bort ett gammalt konto utan prenumeration och utan bokförd data', async () => {
    const admin = makeAdmin({ rows: [{ user_id: 'u1', created_at: old, state: { companies: { c1: { company: { name: 'Test' } } } } }] })
    const result = await cleanAbandonedSignups(admin, { now })
    expect(result.removed).toBe(1)
    expect(admin.deleted.userData).toEqual(['u1'])
    expect(admin.deleted.authUsers).toEqual(['u1'])
  })

  // Har någon varit kund finns räkenskapsinformation, och den ska bevaras i
  // sju år (bokföringslagen 7 kap. 2 §) — även om prenumerationen är uppsagd.
  it('rör aldrig ett konto som har en prenumerationsrad', async () => {
    const admin = makeAdmin({
      rows: [{ user_id: 'u1', created_at: old, state: {} }],
      subs: [{ user_id: 'u1' }],
    })
    const result = await cleanAbandonedSignups(admin, { now })
    expect(result.removed).toBe(0)
    expect(admin.deleted.authUsers).toEqual([])
  })

  it('rör aldrig ett konto med bokförd data, även utan prenumeration', async () => {
    const admin = makeAdmin({
      rows: [{ user_id: 'u1', created_at: old, state: { companies: { c1: { verifications: [{ id: 'v1' }] } } } }],
    })
    const result = await cleanAbandonedSignups(admin, { now })
    expect(result.removed).toBe(0)
  })

  it('dry run räknar men raderar ingenting', async () => {
    const admin = makeAdmin({ rows: [{ user_id: 'u1', created_at: old, state: {} }] })
    const result = await cleanAbandonedSignups(admin, { now, dryRun: true })
    expect(result.removed).toBe(1)
    expect(result.dryRun).toBe(true)
    expect(admin.deleted.authUsers).toEqual([])
  })

  it('inga kandidater ger ett tomt resultat utan anrop', async () => {
    const admin = makeAdmin({ rows: [] })
    expect(await cleanAbandonedSignups(admin, { now })).toEqual({ candidates: 0, removed: 0 })
  })
})
