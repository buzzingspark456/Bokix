import { describe, it, expect } from 'vitest'
import { storageModeOf, readOwnerCompany, readOwnerCompanies } from './_companyStore.js'

const payload = (name, extra = {}) => ({
  id: 'u', version: 1, extra: {}, has_settings: true, settings: { id: 'eget_id', name }, has_accounts: true, accounts: [],
  list_fields: ['invoices'], all_list_fields: ['invoices', 'verifications'], lists: { invoices: [{ id: 'f1' }] }, versions: { invoices: [1] }, ...extra,
})

/** Precis så mycket av Supabase-admin-klienten som _companyStore använder. */
function makeAdmin({ mode = 'blob', modeError = null, blobState = null, rpc = {} } = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          calls.push(table)
          if (table === 'storage_modes') return modeError ? { data: null, error: modeError } : { data: mode ? { mode } : null, error: null }
          if (table === 'user_data') return { data: blobState ? { state: blobState } : null, error: null }
          return { data: null, error: null }
        },
      }
      return q
    },
    rpc: async (name, args) => {
      calls.push({ rpc: name, args })
      const r = rpc[name]
      return typeof r === 'function' ? r(args) : (r || { data: null, error: null })
    },
  }
}

const blobState = { companies: { k1: { company: { id: 'eget_id', name: 'Blob AB' }, invoices: [{ id: 'f1' }], verifications: [] } } }

describe('storageModeOf', () => {
  it('tables bara när raden säger det, annars blob (även vid fel)', async () => {
    expect(await storageModeOf(makeAdmin({ mode: 'tables' }), 'u1')).toBe('tables')
    expect(await storageModeOf(makeAdmin({ mode: null }), 'u1')).toBe('blob')
    expect(await storageModeOf(makeAdmin({ modeError: { message: 'relation does not exist' } }), 'u1')).toBe('blob')
  })
})

describe('readOwnerCompany', () => {
  it('blobläget läser blobben, som förut (nyckel eller company.id)', async () => {
    const admin = makeAdmin({ mode: 'blob', blobState })
    expect(await readOwnerCompany(admin, 'u1', 'k1')).toMatchObject({ key: 'k1', source: 'blob' })
    expect(await readOwnerCompany(admin, 'u1', 'eget_id')).toMatchObject({ key: 'k1', source: 'blob' })
    expect(await readOwnerCompany(admin, 'u1', 'okänt')).toBeNull()
    expect(admin.calls.some(c => c.rpc)).toBe(false)
  })

  it('tabelläget läser tabellerna, med bara de listor som behövs', async () => {
    const admin = makeAdmin({ mode: 'tables', rpc: { server_read_company: { data: { key: 'k1', payload: payload('Tabell AB') }, error: null } } })
    const r = await readOwnerCompany(admin, 'u1', 'k1', { kinds: ['invoices'] })
    expect(r).toMatchObject({ key: 'k1', source: 'tables' })
    expect(r.data.company.name).toBe('Tabell AB')
    expect(r.data.invoices).toEqual([{ id: 'f1' }])
    expect(admin.calls.find(c => c.rpc).args).toEqual({ p_owner: 'u1', p_company: 'k1', p_kinds: ['invoices'] })
    expect(admin.calls).not.toContain('user_data')
  })

  it('tabelläget: fel i tabellerna → blobben, och felet rapporteras', async () => {
    const errors = []
    const admin = makeAdmin({ mode: 'tables', blobState, rpc: { server_read_company: { data: null, error: { code: '57014', message: 'timeout' } } } })
    const r = await readOwnerCompany(admin, 'u1', 'k1', { onTableError: e => errors.push(e.message) })
    expect(r).toMatchObject({ key: 'k1', source: 'blob' })
    expect(errors).toEqual(['timeout'])
  })

  it('tabelläget: saknas i tabellerna men finns i blobben → blobben, och det rapporteras', async () => {
    const errors = []
    const admin = makeAdmin({ mode: 'tables', blobState, rpc: { server_read_company: { data: null, error: null } } })
    expect(await readOwnerCompany(admin, 'u1', 'k1', { onTableError: e => errors.push(e.message) })).toMatchObject({ source: 'blob' })
    expect(errors[0]).toMatch(/finns i blobben men inte i tabellerna/)
  })

  it('tabelläget: finns ingenstans → null utan rapport', async () => {
    const errors = []
    const admin = makeAdmin({ mode: 'tables', blobState, rpc: { server_read_company: { data: null, error: null } } })
    expect(await readOwnerCompany(admin, 'u1', 'okänt', { onTableError: e => errors.push(e) })).toBeNull()
    expect(errors).toEqual([])
  })

  it('funktionen saknas (SQL:en inte körd) → blobben, tyst', async () => {
    const errors = []
    const admin = makeAdmin({ mode: 'tables', blobState, rpc: { server_read_company: { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.server_read_company' } } } })
    expect(await readOwnerCompany(admin, 'u1', 'k1', { onTableError: e => errors.push(e) })).toMatchObject({ source: 'blob' })
    expect(errors).toEqual([])
  })
})

describe('readOwnerCompanies', () => {
  it('blobläget: alla företag ur blobben', async () => {
    expect(await readOwnerCompanies(makeAdmin({ mode: 'blob', blobState }), 'u1')).toEqual({ companies: blobState.companies, source: 'blob' })
  })

  it('tabelläget: alla företag ur tabellerna', async () => {
    const admin = makeAdmin({ mode: 'tables', rpc: { server_read_companies: { data: { k1: payload('A'), k2: payload('B') }, error: null } } })
    const r = await readOwnerCompanies(admin, 'u1', { kinds: ['invoices'] })
    expect(r.source).toBe('tables')
    expect(Object.keys(r.companies)).toEqual(['k1', 'k2'])
    expect(r.companies.k2.company.name).toBe('B')
  })

  it('tabelläget med fel → blobben', async () => {
    const admin = makeAdmin({ mode: 'tables', blobState, rpc: { server_read_companies: { data: null, error: { message: 'nere' } } } })
    expect((await readOwnerCompanies(admin, 'u1')).source).toBe('blob')
  })
})
