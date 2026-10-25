import { describe, it, expect } from 'vitest'
import { hasBookkeepingData, cleanAbandonedSignups, ABANDONED_SIGNUP_DAYS, cleanOldContactMessages, CONTACT_MESSAGE_DAYS } from './_dataRetention.js'

const DAY = 86400000
const now = new Date('2026-09-06T03:00:00Z')
const old = new Date(now.getTime() - (ABANDONED_SIGNUP_DAYS + 5) * DAY).toISOString()

/** Minimal stubb av den delen av supabase-admin-klienten rutinen använder.
 * Räcker för att bevisa VILKA konton som väljs ut, vilket är hela poängen —
 * ett fel där raderar riktig kunddata. */
function makeAdmin({ rows, subs = [], users = {}, members = [], pastMemberships = [], ownerStates = {} }) {
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
      if (table === 'company_members') {
        return { select: () => ({
          or: (expr) => ({ eq: () => ({ limit: () => Promise.resolve({ data: members.filter(m => expr.includes(m)).map(m => ({ id: m })), error: null }) }) }),
          // Alla inbjudningar (även borttagna) där kontot var inbjudet.
          eq: (_col, id) => Promise.resolve({ data: pastMemberships.filter(m => m.member_user_id === id), error: null }),
        }) }
      }
      if (table === 'storage_modes') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }
      }
      if (table === 'user_data') {
        api.select = () => ({
          lt: () => ({ order: () => ({ range: (a, b) => Promise.resolve({ data: rows.slice(a, b + 1), error: null }) }) }),
          // Ägarens bokföring (readOwnerState i blobläget).
          eq: (_c, id) => ({ maybeSingle: () => Promise.resolve({ data: ownerStates[id] ? { state: ownerStates[id] } : null, error: null }) }),
        })
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
    auth: { admin: {
      deleteUser: (id) => { deleted.authUsers.push(id); return Promise.resolve({ error: null }) },
      // Förval: ett vanligt konto skapat lika länge sedan som raden.
      getUserById: (id) => Promise.resolve({ data: { user: id in users ? users[id] : { id, email: `${id}@example.se`, created_at: old, app_metadata: {}, user_metadata: {} } }, error: null }),
    } },
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

  it('gränsen är sju dagar', () => {
    expect(ABANDONED_SIGNUP_DAYS).toBe(7)
  })

  it('rör aldrig ett UF-konto (eget avslut i _ufAccount.js)', async () => {
    const admin = makeAdmin({
      rows: [
        { user_id: 'u1', created_at: old, state: {} },
        { user_id: 'u2', created_at: old, state: { companies: { c1: { company: { isUf: true } } } } },
      ],
      users: { u1: { id: 'u1', email: 'a@b.se', created_at: old, app_metadata: { uf: true }, user_metadata: {} } },
    })
    expect((await cleanAbandonedSignups(admin, { now })).removed).toBe(0)
    expect(admin.deleted.authUsers).toEqual([])
  })

  it('rör aldrig våra gratiskonton', async () => {
    const admin = makeAdmin({
      rows: [{ user_id: 'u1', created_at: old, state: {} }],
      users: { u1: { id: 'u1', email: 'AlwakiAbdullah1@gmail.com', created_at: old, app_metadata: {}, user_metadata: {} } },
    })
    expect((await cleanAbandonedSignups(admin, { now })).removed).toBe(0)
  })

  it('rör aldrig ett konto i ett delat företag', async () => {
    const admin = makeAdmin({ rows: [{ user_id: 'u1', created_at: old, state: {} }], members: ['u1'] })
    expect((await cleanAbandonedSignups(admin, { now })).removed).toBe(0)
  })

  it('rör aldrig ett konto som är yngre än sju dagar eller inte går att läsa', async () => {
    const fresh = new Date(now.getTime() - 2 * DAY).toISOString()
    const admin = makeAdmin({
      rows: [{ user_id: 'u1', created_at: old, state: {} }, { user_id: 'u2', created_at: old, state: {} }],
      users: { u1: { id: 'u1', email: 'a@b.se', created_at: fresh, app_metadata: {}, user_metadata: {} }, u2: null },
    })
    expect((await cleanAbandonedSignups(admin, { now })).removed).toBe(0)
  })

  it('inga kandidater ger ett tomt resultat utan anrop', async () => {
    const admin = makeAdmin({ rows: [] })
    expect(await cleanAbandonedSignups(admin, { now })).toEqual({ candidates: 0, removed: 0 })
  })
})

describe('cleanOldContactMessages', () => {
  function contactAdmin(result) {
    const calls = []
    const chain = {
      delete() { calls.push('delete'); return chain },
      lt(col, value) { calls.push(['lt', col, value]); return chain },
      select() { return Promise.resolve(result) },
    }
    return { calls, from: (table) => { calls.push(['from', table]); return chain } }
  }

  it('raderar meddelanden äldre än ett år', async () => {
    const now = new Date('2026-09-29T00:00:00Z')
    const admin = contactAdmin({ data: [{ id: 1 }, { id: 2 }], error: null })
    const res = await cleanOldContactMessages(admin, { now })
    expect(res).toEqual({ removed: 2 })
    expect(admin.calls).toContainEqual(['from', 'contact_messages'])
    const cutoff = new Date(now.getTime() - CONTACT_MESSAGE_DAYS * 86400000).toISOString()
    expect(admin.calls).toContainEqual(['lt', 'created_at', cutoff])
  })

  it('tål att tabellen saknas', async () => {
    const admin = contactAdmin({ data: null, error: { message: 'relation "contact_messages" does not exist' } })
    expect(await cleanOldContactMessages(admin)).toEqual({ removed: 0, missingTable: true })
  })
})

describe('cleanAbandonedSignups: tidigare inbjuden', () => {
  const rows = [{ user_id: 'ella', state: { companies: {} }, created_at: old }]
  const ownerStates = { agare: { companies: { c1: { expenses: [{ id: 'e1', receiptUrl: 'https://x.supabase.co/storage/v1/object/public/bokix-uploads/ella/receipts/a.pdf' }] } } } }

  it('raderas inte när ägarens bokföring använder kvitton hon laddat upp', async () => {
    const admin = makeAdmin({ rows, pastMemberships: [{ owner_user_id: 'agare', member_user_id: 'ella' }], ownerStates })
    const r = await cleanAbandonedSignups(admin, { now })
    expect(admin.deleted.authUsers).toEqual([])
    expect(admin.deleted.storage).toEqual([])
    expect(r.deleted || 0).toBe(0)
  })

  it('raderas som vanligt när ägaren inte använder något av hennes', async () => {
    const admin = makeAdmin({ rows, pastMemberships: [{ owner_user_id: 'agare', member_user_id: 'ella' }], ownerStates: { agare: { companies: { c1: { expenses: [] } } } } })
    await cleanAbandonedSignups(admin, { now })
    expect(admin.deleted.authUsers).toEqual(['ella'])
  })
})
