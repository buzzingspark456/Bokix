import { describe, it, expect } from 'vitest'
import { assembleCompany, versionsFromPayload, fromLoadResult, expectedFor, mergeVersions } from './tableStore.js'
import { buildStateDelta } from './stateMerge.js'

const payload = {
  id: 'uuid-1',
  version: 4,
  extra: { vatPeriods: { q: 1 }, basVersion: 2026 },
  has_settings: true,
  settings: { name: 'AB' },
  has_accounts: true,
  accounts: [{ code: '1930' }],
  list_fields: ['contacts', 'quotes', 'verifications'],
  lists: { verifications: [{ id: 'b' }, { id: 'a' }], contacts: [{ id: 'k' }] },
  versions: { verifications: [3, 1], contacts: [2] },
}

describe('assembleCompany', () => {
  it('sätter ihop blobbens form, tomma listor blir []', () => {
    expect(assembleCompany(payload)).toEqual({
      vatPeriods: { q: 1 }, basVersion: 2026, company: { name: 'AB' }, accounts: [{ code: '1930' }],
      contacts: [{ id: 'k' }], quotes: [], verifications: [{ id: 'b' }, { id: 'a' }],
    })
  })

  it('saknade fält och JSON-null hålls isär', () => {
    expect('company' in assembleCompany({ ...payload, has_settings: false, settings: null })).toBe(false)
    expect(assembleCompany({ ...payload, has_settings: true, settings: null }).company).toBeNull()
  })

  it('tål ett tomt svar', () => {
    expect(assembleCompany({})).toEqual({})
    expect(assembleCompany({ list_fields: ['contacts'], lists: null })).toEqual({ contacts: [] })
  })
})

describe('versionsFromPayload / fromLoadResult', () => {
  it('versionerna hamnar på rätt id', () => {
    expect(versionsFromPayload(payload)).toEqual({ company: 4, records: { contacts: { k: 2 }, quotes: {}, verifications: { b: 3, a: 1 } } })
  })

  it('hela svaret: övrigt state, företag, versioner', () => {
    const r = fromLoadResult({ updated_at: 't', top: { activeCompanyId: 'k1' }, companies: { k1: payload } })
    expect(r.updatedAt).toBe('t')
    expect(r.state.activeCompanyId).toBe('k1')
    expect(r.state.companies.k1.verifications).toHaveLength(2)
    expect(r.versions.k1.records.verifications.a).toBe(1)
  })
})

describe('expectedFor', () => {
  const versions = { k1: { company: 4, records: { verifications: { a: 1, b: 3 }, contacts: { k: 2 } } } }

  it('patch: versionerna för de poster som rörs, inte för nya', () => {
    const ops = [{ op: 'patch', path: ['companies', 'k1', 'verifications'], upsert: [{ id: 'a' }, { id: 'ny' }], remove: ['b'] }]
    expect(expectedFor(ops, versions)).toEqual({ k1: { records: { verifications: { a: 1, b: 3 } } } })
  })

  it('hel lista: alla versioner; allt annat: företagsraden', () => {
    const ops = [
      { op: 'set', path: ['companies', 'k1', 'contacts'], value: [] },
      { op: 'set', path: ['companies', 'k1', 'company', 'city'], value: 'X' },
      { op: 'patch_by', key: 'code', path: ['companies', 'k1', 'accounts'], upsert: [], remove: [] },
    ]
    expect(expectedFor(ops, versions)).toEqual({ k1: { records: { contacts: { k: 2 } }, company: 4 } })
  })

  it('nytt företag och personliga fält skickar inget', () => {
    expect(expectedFor([{ op: 'set', path: ['companies', 'nytt'], value: {} }, { op: 'set', path: ['activeCompanyId'], value: 'k1' }], versions)).toEqual({})
  })

  it('fungerar med riktiga ändringslistor från buildStateDelta', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, d: 1 }))
    const vs = { k1: { company: 4, records: { verifications: Object.fromEntries(many.map((x, i) => [x.id, i + 1])) } } }
    const base = { k1: { company: { name: 'AB' }, verifications: many } }
    // En ändrad och en ny: patch med bara den ändrades version.
    const local = { k1: { company: { name: 'AB' }, verifications: [{ id: 'v0', d: 2 }, ...many.slice(1), { id: 'ny', d: 1 }] } }
    const ops = buildStateDelta({ companies: base }, base, { companies: local }, local)
    expect(ops[0].op).toBe('patch')
    expect(expectedFor(ops, vs)).toEqual({ k1: { records: { verifications: { v0: 1 } } } })
    // Ny ordning: hela listan, alla versioner.
    const reordered = { k1: { company: { name: 'AB' }, verifications: [...many].reverse() } }
    const ops2 = buildStateDelta({ companies: base }, base, { companies: reordered }, reordered)
    expect(ops2[0].op).toBe('set')
    expect(expectedFor(ops2, vs).k1.records.verifications).toEqual(vs.k1.records.verifications)
  })
})

describe('mergeVersions', () => {
  const versions = { k1: { company: 4, records: { verifications: { a: 1, b: 3 }, contacts: { k: 2, m: 1 } } }, k2: { company: 1, records: {} } }

  it('nya versioner in, borttagna ut', () => {
    const ops = [{ op: 'patch', path: ['companies', 'k1', 'verifications'], upsert: [{ id: 'a' }, { id: 'c' }], remove: ['b'] }]
    const next = mergeVersions(versions, ops, { k1: { company: 4, records: { verifications: { a: 2, c: 1 } } } })
    expect(next.k1.records.verifications).toEqual({ a: 2, c: 1 })
    expect(next.k1.records.contacts).toEqual({ k: 2, m: 1 })
    expect(versions.k1.records.verifications).toEqual({ a: 1, b: 3 }) // ingen mutation
  })

  it('hel lista bytt: bara den nya listans poster finns kvar', () => {
    const ops = [{ op: 'set', path: ['companies', 'k1', 'contacts'], value: [{ id: 'm' }] }]
    expect(mergeVersions(versions, ops, { k1: { company: 4, records: {} } }).k1.records.contacts).toEqual({ m: 1 })
  })

  it('borttaget företag försvinner, nytt företag kommer in', () => {
    const ops = [{ op: 'unset', path: ['companies', 'k2'] }, { op: 'set', path: ['companies', 'k3'], value: {} }]
    const next = mergeVersions(versions, ops, { k3: { company: 1, records: { verifications: { x: 1 } } } })
    expect(next.k2).toBeUndefined()
    expect(next.k3).toEqual({ company: 1, records: { verifications: { x: 1 } } })
  })

  it('företagsradens nya version', () => {
    const next = mergeVersions(versions, [{ op: 'set', path: ['companies', 'k1', 'company', 'city'], value: 'X' }], { k1: { company: 5, records: {} } })
    expect(next.k1.company).toBe(5)
    expect(next.k1.records.verifications).toEqual({ a: 1, b: 3 })
  })
})
