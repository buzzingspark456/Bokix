import { describe, it, expect } from 'vitest'
import { buildCompany, compareCompany, sameJson, listOrder, loadCompanyFromTables, PAGE_SIZE, RECORD_KINDS } from './companyTables.js'
import { runShadowRead, nextMark } from './shadowRead.js'

const v = (id, extra = {}) => ({ id, date: '2026-10-01', rows: [], ...extra })

describe('sameJson', () => {
  it('bryr sig inte om nyckelordning men om listornas ordning', () => {
    expect(sameJson({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true)
    expect(sameJson({ c: [1, 2] }, { c: [2, 1] })).toBe(false)
    expect(sameJson({ a: null }, {})).toBe(false)
    expect(sameJson(null, null)).toBe(true)
  })
})

describe('buildCompany', () => {
  it('bygger blobbens form ur raden och posterna', () => {
    const row = { settings: { name: 'AB' }, accounts: [{ code: '1930' }], extra: { vatPeriods: {}, basVersion: 2026 }, list_fields: ['invoices', 'verifications'] }
    const records = [{ kind: 'verifications', id: 'b', data: v('b') }, { kind: 'verifications', id: 'a', data: v('a') }, { kind: 'quotes', id: 'q', data: { id: 'q' } }]
    const c = buildCompany(row, records)
    expect(c.company).toEqual({ name: 'AB' })
    expect(c.accounts).toEqual([{ code: '1930' }])
    expect(c.basVersion).toBe(2026)
    expect(c.verifications.map(x => x.id)).toEqual(['a', 'b'])
    expect(c.invoices).toEqual([])
    expect('quotes' in c).toBe(false) // inte i list_fields
  })

  it('listorna läggs i positionsordning, id avgör vid lika', () => {
    const row = { settings: {}, accounts: [], extra: {}, list_fields: ['contacts'] }
    const recs = [
      { kind: 'contacts', id: 'c', position: 2, data: { id: 'c' } },
      { kind: 'contacts', id: 'a', position: 3, data: { id: 'a' } },
      { kind: 'contacts', id: 'b', position: -1, data: { id: 'b' } },
      { kind: 'contacts', id: 'd', position: 2, data: { id: 'd' } },
    ]
    expect(buildCompany(row, recs).contacts.map(x => x.id)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('saknad settings/accounts ger ingen nyckel', () => {
    const c = buildCompany({ settings: null, accounts: null, extra: {}, list_fields: [] }, [])
    expect('company' in c).toBe(false)
    expect('accounts' in c).toBe(false)
  })
})

describe('compareCompany', () => {
  const blob = { company: { name: 'AB' }, accounts: [{ code: '1930' }], verifications: [v('a'), v('b')], invoices: [], vatPeriods: { q: 1 } }

  it('lika när bara nyckelordningen skiljer', () => {
    const table = { vatPeriods: { q: 1 }, invoices: [], verifications: [v('a'), v('b')], accounts: [{ code: '1930' }], company: { name: 'AB' } }
    expect(compareCompany(blob, table)).toEqual([])
  })

  it('listans ordning räknas (Kunder, Artiklar och Tid visar sparad ordning)', () => {
    const table = { ...blob, verifications: [v('b'), v('a')] }
    expect(compareCompany(blob, table)).toEqual([{ field: 'verifications', missing: 0, changed: 0, extra: 0, invalid: 0, dupes: 0, order: true }])
  })

  it('räknar saknade, ändrade och extra poster utan innehåll', () => {
    const table = { ...blob, verifications: [v('a', { rows: [1] }), v('c')] }
    expect(compareCompany(blob, table)).toEqual([{ field: 'verifications', missing: 1, changed: 1, extra: 1, invalid: 0, dupes: 0 }])
  })

  it('poster utan id och dubbla id i blobben syns', () => {
    const b = { ...blob, contacts: [{ name: 'utan id' }, { id: 'x' }, { id: 'x' }] }
    const t = { ...blob, contacts: [{ id: 'x' }] }
    expect(compareCompany(b, t)).toEqual([{ field: 'contacts', missing: 0, changed: 0, extra: 0, invalid: 1, dupes: 1 }])
  })

  it('fält som saknas eller skiljer', () => {
    const t = { ...blob, vatPeriods: { q: 2 } }
    delete t.accounts
    expect(compareCompany(blob, t)).toEqual([{ field: 'accounts', issue: 'saknas_i_tabellerna' }, { field: 'vatPeriods', issue: 'olika' }])
  })
})

describe('listOrder', () => {
  it('känner igen datumordning', () => {
    expect(listOrder([v('a', { date: '2026-01-01' }), v('b', { date: '2026-02-01' })])).toBe('date_asc')
    expect(listOrder([v('a', { date: '2026-02-01' }), v('b', { date: '2026-01-01' })])).toBe('date_desc')
    expect(listOrder([v('a', { date: '2026-02-01' }), v('b', { date: '2026-01-01' }), v('c', { date: '2026-03-01' })])).toBe('annan')
    expect(listOrder([{ id: 'x' }, { id: 'y' }])).toBe('utan_datum')
    expect(listOrder([v('a')])).toBe('kort')
  })
})

/** Supabase-klient i minnet: companies, company_records och user_data. */
function fakeSupabase({ companies = [], records = [], updatedAt = 't1', fail = null } = {}) {
  const calls = []
  const table = (name) => {
    const filters = []
    let range = null
    const q = {
      select: () => q,
      eq: (k, val) => { filters.push(r => r[k] === val); return q },
      is: (k, val) => { filters.push(r => (r[k] ?? null) === val); return q },
      order: () => q,
      range: (a, b) => { range = [a, b]; return run() },
      maybeSingle: () => run(true),
    }
    const run = (single) => {
      calls.push({ name, range })
      if (fail === name) return Promise.resolve({ data: null, error: { message: 'permission denied' } })
      const src = name === 'companies' ? companies : name === 'company_records' ? records : [{ user_id: 'u1', updated_at: updatedAt }]
      let rows = src.filter(r => filters.every(f => f(r)))
      if (name === 'company_records') rows = [...rows].sort((a, b) => (a.kind + a.id < b.kind + b.id ? -1 : 1))
      if (range) rows = rows.slice(range[0], range[1] + 1)
      return Promise.resolve({ data: single ? (rows[0] || null) : rows, error: null })
    }
    return q
  }
  return { from: table, calls }
}

describe('loadCompanyFromTables', () => {
  it('hämtar sida för sida tills en sida inte är full', async () => {
    const records = Array.from({ length: PAGE_SIZE * 2 + 5 }, (_, i) => ({ company_id: 'c1', kind: 'verifications', id: `v${String(i).padStart(5, '0')}`, data: v(`v${i}`), deleted_at: null }))
    const sb = fakeSupabase({ companies: [{ id: 'c1', owner_user_id: 'u1', legacy_key: 'k', deleted_at: null, settings: {}, accounts: [], extra: {}, list_fields: ['verifications'] }], records })
    const r = await loadCompanyFromTables(sb, { ownerUserId: 'u1', key: 'k' })
    expect(r.records).toBe(PAGE_SIZE * 2 + 5)
    expect(r.pages).toBe(3)
    expect(r.company.verifications).toHaveLength(PAGE_SIZE * 2 + 5)
  })

  it('null när företaget saknas, fel kastas', async () => {
    expect(await loadCompanyFromTables(fakeSupabase(), { ownerUserId: 'u1', key: 'k' })).toBeNull()
    await expect(loadCompanyFromTables(fakeSupabase({ fail: 'companies' }), { ownerUserId: 'u1', key: 'k' })).rejects.toThrow('permission denied')
  })
})

describe('runShadowRead', () => {
  const companyRow = { id: 'c1', owner_user_id: 'u1', legacy_key: 'k', deleted_at: null, settings: { name: 'AB' }, accounts: [], extra: {}, list_fields: ['verifications'] }
  const state = { activeCompanyId: 'k', companies: { k: { company: { name: 'AB' }, accounts: [], verifications: [v('a'), v('b')] }, delat: { __shared: {}, verifications: [] } } }
  const recs = [v('a'), v('b')].map(d => ({ company_id: 'c1', kind: 'verifications', id: d.id, data: d, deleted_at: null }))

  it('lika: inga skillnader, delade företag hoppas över', async () => {
    const r = await runShadowRead(fakeSupabase({ companies: [companyRow], records: recs }), { userId: 'u1', state, updatedAt: 't1' })
    expect(r.mismatched).toBe(0)
    expect(r.companies).toHaveLength(1)
    expect(r.records).toBe(2)
    expect(r.companies[0].order).toEqual({ verifications: 'date_asc' })
  })

  it('skillnad rapporteras', async () => {
    const r = await runShadowRead(fakeSupabase({ companies: [companyRow], records: recs.slice(0, 1) }), { userId: 'u1', state, updatedAt: 't1' })
    expect(r.mismatched).toBe(1)
    expect(r.companies[0].diffs[0]).toMatchObject({ field: 'verifications', missing: 1 })
  })

  it('företag som saknas i tabellerna', async () => {
    const r = await runShadowRead(fakeSupabase(), { userId: 'u1', state, updatedAt: 't1' })
    expect(r.mismatched).toBe(1)
  })

  it('hoppar över om blobben ändrades under läsningen', async () => {
    const r = await runShadowRead(fakeSupabase({ companies: [companyRow], records: recs, updatedAt: 't2' }), { userId: 'u1', state, updatedAt: 't1' })
    expect(r).toEqual({ skipped: 'ändrad_under_läsningen' })
  })
})

describe('nextMark', () => {
  const now = Date.parse('2026-10-25T12:00:00Z')
  const DAY = 24 * 60 * 60 * 1000
  it('en rapport räknas som klar för ett dygn', () => {
    expect(nextMark({ mismatched: 0 }, now)).toBe(now)
    expect(nextMark({ error: 'x' }, now)).toBe(now)
  })
  it('en läsning som avstod försöker igen om en timme', () => {
    const mark = nextMark({ skipped: 'ändrad_under_läsningen' }, now)
    expect(now + 60 * 60 * 1000 - mark).toBe(DAY) // om en timme har ett dygn gått sedan "mark"
  })
})

describe('RECORD_KINDS', () => {
  it('samma lista som private.record_kinds() i SQL-filen', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const sql = fs.readFileSync(path.resolve(import.meta.dirname, '../../supabase-2026-10-25-foretag-och-poster.sql'), 'utf8')
    const block = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION private.record_kinds()'), sql.indexOf(']::text[]'))
    const kinds = [...block.matchAll(/'([a-zA-Z]+)'/g)].map(m => m[1])
    expect(kinds).toEqual(RECORD_KINDS)
  })
})

describe('SQL-filerna hålls i takt', () => {
  it('refresh_company_row är identisk i foretag-och-poster.sql och steg-4a.sql', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const grab = (file) => {
      const sql = fs.readFileSync(path.resolve(import.meta.dirname, '../../' + file), 'utf8').replace(/\r/g, '')
      const start = sql.indexOf('CREATE OR REPLACE FUNCTION private.refresh_company_row')
      return sql.slice(start, sql.indexOf('$$;', start))
    }
    expect(grab('supabase-2026-10-25-steg-4a.sql')).toEqual(grab('supabase-2026-10-25-foretag-och-poster.sql'))
  })
})

describe('SQL-filerna hålls i takt (trigger)', () => {
  it('sync_companies och in_tables_mode är identiska i foretag-och-poster.sql och steg-4b.sql', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const grab = (file, name) => {
      const sql = fs.readFileSync(path.resolve(import.meta.dirname, '../../' + file), 'utf8').replace(/\r/g, '')
      const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}`)
      return sql.slice(start, sql.indexOf('$$;', sql.indexOf('$$', sql.indexOf('AS $$', start) + 5)))
    }
    for (const name of ['private.sync_companies()', 'private.in_tables_mode(']) {
      expect(grab('supabase-2026-10-25-steg-4b.sql', name)).toEqual(grab('supabase-2026-10-25-foretag-och-poster.sql', name))
    }
  })
})

describe('SQL-filerna är hela', () => {
  it('inga trasiga $$ i supabase-*.sql (ensamt AS $ eller $;) och $$ i par', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = path.resolve(import.meta.dirname, '../..')
    for (const f of fs.readdirSync(root).filter(n => /^supabase-.*\.sql$/.test(n))) {
      const lines = fs.readFileSync(path.join(root, f), 'utf8').replace(/\r/g, '').split('\n')
      const broken = lines.filter(l => /^AS \$$/.test(l) || /^\$;$/.test(l))
      // $$ öppnar och stänger varje funktionskropp, så de ska komma i par.
      const dollars = (lines.join('\n').match(/\$\$/g) || []).length
      expect({ f, broken }).toEqual({ f, broken: [] })
      expect({ f, even: dollars % 2 === 0 }).toEqual({ f, even: true })
    }
  })
})
