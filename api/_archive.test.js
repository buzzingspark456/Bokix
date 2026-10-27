import { describe, it, expect } from 'vitest'
import { gunzipSync } from 'node:zlib'
import { isSafeOwnPath, archiveKeepUntil, archiveCompany, snapshotAllUsers, pruneExpiredArchives, legalSubset, ARCHIVE_BUCKET, DAILY_KEEP_DAYS } from './_archive.js'

const HOST = 'https://x.supabase.co/storage/v1/object/public'

/** Storage och user_data i minnet, precis så mycket av admin-klienten som arkivet använder. */
function makeAdmin({ rows = [], files = {} } = {}) {
  const buckets = { [ARCHIVE_BUCKET]: new Map(), 'bokix-uploads': new Map(Object.entries(files)) }
  let created = false
  const reads = []
  const blob = (buf) => ({ type: 'application/octet-stream', arrayBuffer: async () => buf })
  return {
    buckets,
    reads,
    get created() { return created },
    from(table) {
      // Inga konton i tabelläget.
      if (table === 'storage_modes') {
        const s = { select: () => s, in: () => s, then: (ok) => ok({ data: [], error: null }), eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }
        return s
      }
      if (table !== 'user_data') throw new Error(table)
      const q = {
        select: () => q, order: () => q, range: (a, b) => Promise.resolve({ data: rows.slice(a, b + 1), error: null }),
        eq: (col, val) => ({ maybeSingle: async () => { reads.push(val); return { data: rows.find(r => r[col] === val) || null, error: null } } }),
      }
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
          // Mappar som i Supabase: poster utan id är mappar.
          list: async (prefix) => {
            const pre = prefix ? `${prefix}/` : ''
            const names = new Map()
            for (const key of b.keys()) {
              if (!key.startsWith(pre)) continue
              const rest = key.slice(pre.length)
              const [first, ...more] = rest.split('/')
              names.set(first, more.length ? null : 'fil')
            }
            return { data: [...names].map(([name, isFile]) => (isFile ? { name, id: name } : { name })), error: null }
          },
        }
      },
    },
  }
}

const read = (admin, path) => {
  let buf = admin.buckets[ARCHIVE_BUCKET].get(path)
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)
  return JSON.parse(buf.toString('utf8'))
}

describe('archiveKeepUntil', () => {
  it('räknar sju år efter året då räkenskapsåret kan ha avslutats', () => {
    const now = new Date('2026-09-24T00:00:00Z')
    expect(archiveKeepUntil({ verifications: [{ date: '2026-03-01' }] }, now)).toBe('2034-12-31')
  })
  it('följer ett senare datum i bokföringen', () => {
    const now = new Date('2026-09-24T00:00:00Z')
    expect(archiveKeepUntil({ invoices: [{ date: '2027-01-15' }] }, now)).toBe('2035-12-31')
  })
})

describe('legalSubset: bara det lagen kräver', () => {
  const company = {
    company: { name: 'Test AB', orgNr: '5560000000', smtpPassword: 'hemligt', googleRefreshToken: 'x' },
    accounts: [{ code: '1930', name: 'Bank' }, { code: '5410', name: 'Förbrukning' }, { code: '9999', name: 'Oanvänt' }],
    verifications: [{ id: 'v1', source: 'expense', sourceId: 'e1', rows: [{ account: '1930' }, { account: '5410' }] }],
    invoices: [{ id: 'i1', status: 'sent', customerId: 'k1' }, { id: 'i2', status: 'draft', customerId: 'k2' }],
    expenses: [{ id: 'e1', receiptUrl: 'x' }, { id: 'e2', status: 'draft' }],
    contacts: [{ id: 'k1', name: 'Kund' }, { id: 'k2', name: 'Utkastkund' }, { id: 'k3', name: 'Aldrig fakturerad' }],
    bankTransactions: [{ id: 'b1', status: 'matched' }, { id: 'b2', status: 'unmatched' }, { id: 'b3', status: 'ignored' }],
    payrollRuns: [{ id: 'r1', completedSteps: ['calculated', 'booked'] }, { id: 'r2', completedSteps: ['calculated'] }],
    quotes: [{ id: 'q1' }], articles: [{ id: 'a1' }], employees: [{ id: 'emp1', ssn: '19900101-1234' }],
  }
  const s = legalSubset(company)

  it('behåller det bokförda', () => {
    expect(s.verifications).toHaveLength(1)
    expect(s.invoices.map(i => i.id)).toEqual(['i1'])
    expect(s.expenses.map(e => e.id)).toEqual(['e1'])
    expect(s.bankTransactions.map(t => t.id)).toEqual(['b1'])
    expect(s.payrollRuns.map(r => r.id)).toEqual(['r1'])
  })
  it('tar bara med konton och kontakter som används', () => {
    expect(s.accounts.map(a => a.code)).toEqual(['1930', '5410'])
    expect(s.contacts.map(c => c.id)).toEqual(['k1'])
  })
  it('sparar inte utkast, offerter, ångrade bankimporter, anställdas profiler eller hemligheter', () => {
    expect(s.quotes).toBeUndefined()
    expect(s.articles).toBeUndefined()
    expect(s.employees).toBeUndefined()
    expect(s.company.smtpPassword).toBeUndefined()
    expect(s.company.googleRefreshToken).toBeUndefined()
    expect(s.company.name).toBe('Test AB')
  })
})

describe('archiveCompany', () => {
  it('sparar det bokförda komprimerat, med kopior av bara de bokförda filerna', async () => {
    const admin = makeAdmin({ files: { 'u1/kvitto.jpg': Buffer.from('bild'), 'u1/utkast.jpg': Buffer.from('utkast') } })
    const companyData = {
      company: { name: 'Test AB', orgNr: '5560000000' },
      verifications: [{ id: 'v1', date: '2026-02-01', sourceId: 'e1' }],
      expenses: [
        { id: 'e1', receiptUrl: `${HOST}/bokix-uploads/u1/kvitto.jpg` },
        { id: 'e2', status: 'draft', receiptUrl: `${HOST}/bokix-uploads/u1/utkast.jpg` },
        { id: 'e3', verificationId: 'v9', receiptUrl: `${HOST}/bokix-uploads/annan/hemlig.jpg` },
      ],
    }
    const now = new Date('2026-09-24T10:00:00Z')
    const result = await archiveCompany(admin, { userId: 'u1', companyId: 'c1', companyData, reason: 'delete', now })

    expect(admin.created).toBe(true)
    expect(result.path).toMatch(/-delete-t2034-12-31$/)
    const json = read(admin, `${result.path}/bokforing.json.gz`)
    expect(json.keepUntil).toBe('2034-12-31')
    expect(json.data.expenses.map(e => e.id)).toEqual(['e1', 'e3'])
    const keys = [...admin.buckets[ARCHIVE_BUCKET].keys()]
    expect(keys).toContain(`${result.path}/filer/bokix-uploads/u1/kvitto.jpg`)
    expect(keys.some(k => k.includes('utkast'))).toBe(false)
    // En sökväg utanför användarens eget prefix kopieras aldrig.
    expect(keys.some(k => k.includes('annan'))).toBe(false)
  })

  it('skriver inget arkiv alls när inget är bokfört', async () => {
    const admin = makeAdmin()
    const result = await archiveCompany(admin, { userId: 'u1', companyId: 'c1', companyData: { quotes: [{ id: 'q' }], bankTransactions: [{ status: 'unmatched' }] }, reason: 'reset' })
    expect(result.skipped).toBe(true)
    expect(admin.buckets[ARCHIVE_BUCKET].size).toBe(0)
  })
})

describe('snapshotAllUsers', () => {
  const withBooks = { companies: { c1: { verifications: [{ id: 'v1', date: '2026-01-10' }] } } }

  it('skriver komprimerad dagskopia och månadskopia, hoppar över konton utan bokföring', async () => {
    const admin = makeAdmin({ rows: [{ user_id: 'u1', state: withBooks }, { user_id: 'u2', state: { companies: { c: {} } } }] })
    const summary = await snapshotAllUsers(admin, { now: new Date('2026-09-24T06:00:00Z') })
    expect(summary).toMatchObject({ users: 1, written: 1, monthly: 1 })
    const keys = [...admin.buckets[ARCHIVE_BUCKET].keys()]
    expect(keys).toEqual(expect.arrayContaining(['u1/_kopior/dag-2026-09-24.json.gz', 'u1/_kopior/man-2026-09.json.gz', 'u1/_kopior/index.json']))
    expect(keys.some(k => k.startsWith('u2/'))).toBe(false)
  })

  it('hämtar inte bokföringen för konton som inte ändrats sedan förra kopian', async () => {
    const rows = [{ user_id: 'u1', updated_at: '2026-09-23T10:00:00Z', state: withBooks }]
    const admin = makeAdmin({ rows })
    await snapshotAllUsers(admin, { now: new Date('2026-09-24T06:00:00Z') })
    expect(admin.reads).toEqual(['u1'])
    const again = await snapshotAllUsers(admin, { now: new Date('2026-09-25T06:00:00Z') })
    expect(admin.reads).toEqual(['u1'])
    expect(again).toMatchObject({ users: 0, written: 0, unchanged: 1 })
    rows[0] = { ...rows[0], updated_at: '2026-09-25T09:00:00Z' }
    await snapshotAllUsers(admin, { now: new Date('2026-09-26T06:00:00Z') })
    expect(admin.reads).toEqual(['u1', 'u1'])
    // Nytt år: läses igen, så att arkivtiden följer med.
    await snapshotAllUsers(admin, { now: new Date('2027-01-02T06:00:00Z') })
    expect(admin.reads).toEqual(['u1', 'u1', 'u1'])
  })

  it('skriver inget nytt när inget ändrats', async () => {
    const admin = makeAdmin({ rows: [{ user_id: 'u1', state: withBooks }] })
    await snapshotAllUsers(admin, { now: new Date('2026-09-24T06:00:00Z') })
    const again = await snapshotAllUsers(admin, { now: new Date('2026-10-25T06:00:00Z') })
    expect(again).toMatchObject({ written: 0, monthly: 0 })
  })

  it('ingen ny månadskopia när bara det obokförda ändrats (t.ex. en bankimport man ångrar)', async () => {
    const rows = [{ user_id: 'u1', state: withBooks }]
    const admin = makeAdmin({ rows })
    await snapshotAllUsers(admin, { now: new Date('2026-09-24T06:00:00Z') })
    rows[0] = { user_id: 'u1', state: { companies: { c1: { ...withBooks.companies.c1, bankTransactions: [{ id: 'b', status: 'unmatched' }] } } } }
    const s = await snapshotAllUsers(admin, { now: new Date('2026-10-05T06:00:00Z') })
    expect(s).toMatchObject({ written: 1, monthly: 0 })
    expect(admin.buckets[ARCHIVE_BUCKET].has('u1/_kopior/man-2026-10.json.gz')).toBe(false)
  })

  it('gallrar dagskopior efter två veckor men behåller månadskopian', async () => {
    const rows = [{ user_id: 'u1', state: withBooks }]
    const admin = makeAdmin({ rows })
    await snapshotAllUsers(admin, { now: new Date('2026-09-01T06:00:00Z') })
    rows[0] = { user_id: 'u1', state: { companies: { c1: { verifications: [{ id: 'v1', date: '2026-01-10' }, { id: 'v2', date: '2026-09-10' }] } } } }
    const later = new Date(Date.parse('2026-09-01T06:00:00Z') + (DAILY_KEEP_DAYS + 2) * 86400000)
    const summary = await snapshotAllUsers(admin, { now: later })
    expect(summary.pruned).toBe(1)
    expect(admin.buckets[ARCHIVE_BUCKET].has('u1/_kopior/dag-2026-09-01.json.gz')).toBe(false)
    expect(admin.buckets[ARCHIVE_BUCKET].has('u1/_kopior/man-2026-09.json.gz')).toBe(true)
  })

  it('läser ett index från före komprimeringen och gallrar dess gamla filer', async () => {
    const rows = [{ user_id: 'u1', state: withBooks }]
    const admin = makeAdmin({ rows })
    admin.buckets[ARCHIVE_BUCKET].set('u1/_kopior/dag-2026-09-01.json', Buffer.from('{}'))
    admin.buckets[ARCHIVE_BUCKET].set('u1/_kopior/index.json', Buffer.from(JSON.stringify({ hash: 'gammal', daily: ['2026-09-01'], monthly: [{ month: '2026-09', keepUntil: '2034-12-31' }] })))
    await snapshotAllUsers(admin, { now: new Date('2026-09-30T06:00:00Z') })
    expect(admin.buckets[ARCHIVE_BUCKET].has('u1/_kopior/dag-2026-09-01.json')).toBe(false)
  })
})

describe('pruneExpiredArchives', () => {
  it('raderar arkiv vars tid gått ut och rör inte de andra', async () => {
    const admin = makeAdmin()
    const b = admin.buckets[ARCHIVE_BUCKET]
    b.set('u1/c1/2019-01-01-delete-t2026-12-31/bokforing.json.gz', Buffer.from('x'))
    b.set('u1/c1/2019-01-01-delete-t2026-12-31/filer/bokix-uploads/u1/k.jpg', Buffer.from('x'))
    b.set('u1/c1/2026-09-01-reset-t2034-12-31/bokforing.json.gz', Buffer.from('x'))
    b.set('u1/_kopior/index.json', Buffer.from('{}'))
    const s = await pruneExpiredArchives(admin, { now: new Date('2027-01-02T00:00:00Z') })
    expect(s).toEqual({ expired: 1, removed: 2 })
    expect([...b.keys()].sort()).toEqual(['u1/_kopior/index.json', 'u1/c1/2026-09-01-reset-t2034-12-31/bokforing.json.gz'])
  })
})

describe('övergången till komprimerade kopior', () => {
  it('tar bort den okomprimerade kopian från samma dag och månad', async () => {
    const rows = [{ user_id: 'u1', state: { companies: { c1: { verifications: [{ id: 'v1', date: '2026-01-10' }] } } } }]
    const admin = makeAdmin({ rows })
    const b = admin.buckets[ARCHIVE_BUCKET]
    b.set('u1/_kopior/dag-2026-09-24.json', Buffer.from('{}'))
    b.set('u1/_kopior/man-2026-09.json', Buffer.from('{}'))
    b.set('u1/_kopior/index.json', Buffer.from(JSON.stringify({ hash: 'gammal', daily: ['2026-09-24'], monthly: [{ month: '2026-09', keepUntil: '2034-12-31' }] })))
    await snapshotAllUsers(admin, { now: new Date('2026-09-24T20:00:00Z') })
    expect([...b.keys()].sort()).toEqual(['u1/_kopior/dag-2026-09-24.json.gz', 'u1/_kopior/index.json', 'u1/_kopior/man-2026-09.json.gz'])
  })
})

describe('isSafeOwnPath', () => {
  it('släpper bara igenom egna sökvägar utan ..', () => {
    expect(isSafeOwnPath('u1/kvitton/a.pdf', 'u1')).toBe(true);
    expect(isSafeOwnPath('u1/../u2/a.pdf', 'u1')).toBe(false);
    expect(isSafeOwnPath('u1//a.pdf', 'u1')).toBe(false);
    expect(isSafeOwnPath('u2/a.pdf', 'u1')).toBe(false);
    expect(isSafeOwnPath('u1\\..\\u2', 'u1')).toBe(false);
  });
});

describe('snapshotAllUsers: konto som bara sparar i tabellerna', () => {
  const U = '6545414d-a28e-4f96-8ef6-c098801e6c85'
  // user_data.updated_at står still (blobben rörs inte), bara companies ändras.
  function makeTablesAdmin(db) {
    const base = makeAdmin({ rows: [{ user_id: U, updated_at: '2026-10-01T00:00:00+00:00', state: { companies: {} } }] })
    const orig = base.from.bind(base)
    base.tableReads = 0
    base.from = (table) => {
      if (table === 'storage_modes') {
        const q = { select: () => q, eq: () => q, in: (col, v) => (col === 'user_id' ? Promise.resolve({ data: v.includes(U) ? [{ user_id: U }] : [], error: null }) : q), maybeSingle: async () => ({ data: { mode: 'tables_only' }, error: null }) }
        return q
      }
      if (table === 'companies') {
        const q = { select: () => q, in: async () => ({ data: [{ owner_user_id: U, updated_at: db.companyUpdatedAt }], error: null }) }
        return q
      }
      if (table === 'user_data') {
        // readOwnerState läser bara aktivt företag ur blobben.
        const q = orig('user_data')
        q.eq = () => ({ maybeSingle: async () => ({ data: { active: 'c1' }, error: null }) })
        return q
      }
      return orig(table)
    }
    base.rpc = async (name) => {
      if (name !== 'server_read_companies') return { data: null, error: { message: name } }
      base.tableReads += 1
      return { data: { c1: { extra: {}, has_settings: true, settings: { id: 'c1' }, list_fields: ['verifications'], lists: { verifications: db.verifications } } }, error: null }
    }
    return base
  }

  it('ser ändringar i tabellerna fast blobben står still', async () => {
    const db = { companyUpdatedAt: '2026-10-02T00:00:00+00:00', verifications: [{ id: 'v1', date: '2026-01-10' }] }
    const admin = makeTablesAdmin(db)
    expect(await snapshotAllUsers(admin, { now: new Date('2026-10-03T06:00:00Z') })).toMatchObject({ written: 1 })
    expect(await snapshotAllUsers(admin, { now: new Date('2026-10-04T06:00:00Z') })).toMatchObject({ written: 0, unchanged: 1 })
    expect(admin.tableReads).toBe(1)
    db.companyUpdatedAt = '2026-10-04T12:00:00+00:00'
    db.verifications = [...db.verifications, { id: 'v2', date: '2026-10-04' }]
    expect(await snapshotAllUsers(admin, { now: new Date('2026-10-05T06:00:00Z') })).toMatchObject({ written: 1 })
    const index = read(admin, `${U}/_kopior/index.json`)
    expect(index.updatedAt).toBe('2026-10-01T00:00:00+00:00|2026-10-04T12:00:00+00:00')
  })
})
