import { describe, it, expect } from 'vitest'
import { archiveKeepUntil, archiveCompany, snapshotAllUsers, ARCHIVE_BUCKET, DAILY_KEEP_DAYS } from './_archive.js'

const HOST = 'https://x.supabase.co/storage/v1/object/public'

/** Storage och user_data i minnet, precis så mycket av admin-klienten som arkivet använder. */
function makeAdmin({ rows = [], files = {} } = {}) {
  const buckets = { [ARCHIVE_BUCKET]: new Map(), 'bokix-uploads': new Map(Object.entries(files)) }
  let created = false
  const blob = (buf) => ({ type: 'application/octet-stream', arrayBuffer: async () => buf })
  return {
    buckets,
    get created() { return created },
    from(table) {
      if (table !== 'user_data') throw new Error(table)
      const q = { select: () => q, order: () => q, range: (a, b) => Promise.resolve({ data: rows.slice(a, b + 1), error: null }) }
      return q
    },
    storage: {
      getBucket: async (name) => ({ data: created && name === ARCHIVE_BUCKET ? { name } : null }),
      createBucket: async (name, opts) => { expect(opts.public).toBe(false); created = true; return { error: null } },
      from: (name) => {
        const b = buckets[name] || (buckets[name] = new Map())
        return {
          upload: async (path, body) => { b.set(path, Buffer.from(body)); return { error: null } },
          download: async (path) => (b.has(path) ? { data: blob(b.get(path)), error: null } : { data: null, error: { message: 'not found' } }),
          remove: async (paths) => { paths.forEach(p => b.delete(p)); return { error: null } },
        }
      },
    },
  }
}

const read = (admin, path) => JSON.parse(admin.buckets[ARCHIVE_BUCKET].get(path).toString('utf8'))

describe('archiveKeepUntil', () => {
  it('räknar sju år efter året då räkenskapsåret kan ha avslutats', () => {
    const now = new Date('2026-09-24T00:00:00Z')
    expect(archiveKeepUntil({ verifications: [{ date: '2026-03-01' }] }, now)).toBe('2034-12-31')
  })
  it('följer ett senare datum i bokföringen', () => {
    const now = new Date('2026-09-24T00:00:00Z')
    expect(archiveKeepUntil({ invoices: [{ date: '2027-01-15' }] }, now)).toBe('2035-12-31')
  })
  it('läser alla företag i ett helt konto', () => {
    const now = new Date('2026-09-24T00:00:00Z')
    expect(archiveKeepUntil({ companies: { a: {}, b: { expenses: [{ date: '2027-06-01' }] } } }, now)).toBe('2035-12-31')
  })
})

describe('archiveCompany', () => {
  it('sparar bokföringen och kopior av användarens egna filer i en privat bucket', async () => {
    const admin = makeAdmin({ files: { 'u1/kvitto.jpg': Buffer.from('bild') } })
    const companyData = {
      company: { name: 'Test AB', orgNr: '5560000000' },
      verifications: [{ date: '2026-02-01' }],
      expenses: [{ receiptUrl: `${HOST}/bokix-uploads/u1/kvitto.jpg` }, { receiptUrl: `${HOST}/bokix-uploads/annan/hemlig.jpg` }],
    }
    const now = new Date('2026-09-24T10:00:00Z')
    const result = await archiveCompany(admin, { userId: 'u1', companyId: 'c1', companyData, reason: 'delete', now })

    expect(admin.created).toBe(true)
    const json = read(admin, `${result.path}/bokforing.json`)
    expect(json.companyName).toBe('Test AB')
    expect(json.keepUntil).toBe('2034-12-31')
    expect(json.data.verifications).toHaveLength(1)
    expect(admin.buckets[ARCHIVE_BUCKET].get(`${result.path}/filer/bokix-uploads/u1/kvitto.jpg`).toString()).toBe('bild')
    // En sökväg utanför användarens eget prefix kopieras aldrig.
    expect([...admin.buckets[ARCHIVE_BUCKET].keys()].some(k => k.includes('annan'))).toBe(false)
  })

  it('noterar en fil som redan är borta i stället för att stoppa', async () => {
    const admin = makeAdmin()
    const companyData = { expenses: [{ receiptUrl: `${HOST}/bokix-uploads/u1/borta.jpg` }] }
    const result = await archiveCompany(admin, { userId: 'u1', companyId: 'c1', companyData, reason: 'reset' })
    expect(read(admin, `${result.path}/bokforing.json`).files[0].missing).toBe(true)
  })
})

describe('snapshotAllUsers', () => {
  const withBooks = { companies: { c1: { verifications: [{ date: '2026-01-10' }] } } }

  it('skriver dagskopia och månadskopia, hoppar över konton utan bokföring', async () => {
    const admin = makeAdmin({ rows: [{ user_id: 'u1', state: withBooks }, { user_id: 'u2', state: { companies: { c: {} } } }] })
    const summary = await snapshotAllUsers(admin, { now: new Date('2026-09-24T06:00:00Z') })
    expect(summary).toMatchObject({ users: 1, written: 1 })
    const keys = [...admin.buckets[ARCHIVE_BUCKET].keys()]
    expect(keys).toEqual(expect.arrayContaining(['u1/_kopior/dag-2026-09-24.json', 'u1/_kopior/man-2026-09.json', 'u1/_kopior/index.json']))
    expect(keys.some(k => k.startsWith('u2/'))).toBe(false)
  })

  it('skriver inget nytt när inget ändrats', async () => {
    const admin = makeAdmin({ rows: [{ user_id: 'u1', state: withBooks }] })
    await snapshotAllUsers(admin, { now: new Date('2026-09-24T06:00:00Z') })
    const again = await snapshotAllUsers(admin, { now: new Date('2026-09-25T06:00:00Z') })
    expect(again.written).toBe(0)
    expect(admin.buckets[ARCHIVE_BUCKET].has('u1/_kopior/dag-2026-09-25.json')).toBe(false)
  })

  it('gallrar dagskopior efter en dryg månad men behåller månadskopian', async () => {
    const rows = [{ user_id: 'u1', state: withBooks }]
    const admin = makeAdmin({ rows })
    await snapshotAllUsers(admin, { now: new Date('2026-09-01T06:00:00Z') })
    rows[0] = { user_id: 'u1', state: { companies: { c1: { verifications: [{ date: '2026-01-10' }, { date: '2026-10-01' }] } } } }
    const later = new Date(Date.parse('2026-09-01T06:00:00Z') + (DAILY_KEEP_DAYS + 2) * 86400000)
    const summary = await snapshotAllUsers(admin, { now: later })
    expect(summary.pruned).toBe(1)
    expect(admin.buckets[ARCHIVE_BUCKET].has('u1/_kopior/dag-2026-09-01.json')).toBe(false)
    expect(admin.buckets[ARCHIVE_BUCKET].has('u1/_kopior/man-2026-09.json')).toBe(true)
  })
})
