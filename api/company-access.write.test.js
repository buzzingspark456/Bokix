import { describe, it, expect } from 'vitest'
import { writeMemberField } from './company-access.js'
import { applyRecordPatch } from '../src/utils/stateMerge.js'

// Fejkad user_data-rad där ägaren hinner spara mellan medlemmens läsning och
// skrivning: första skrivningen krockar på updated_at, andra går igenom.
function makeAdmin(row, { ownerSavesOnce } = {}) {
  let reads = 0
  return {
    row,
    from: (table) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => {
        if (table === 'storage_modes') return { data: null, error: null }
        reads += 1
        if (ownerSavesOnce && reads === 1) {
          const snapshot = structuredClone(row)
          // Ägaren sparar en ny verifikation direkt efter medlemmens läsning.
          row.state.companies.c1.verifications.push({ id: 'owner', number: 'A002', series: 'A' })
          row.updated_at = 't2'
          return { data: snapshot, error: null }
        }
        return { data: structuredClone(row), error: null }
      } }) }),
      update: (patch) => ({ eq: () => ({ eq: (_c, expected) => ({ select: async () => {
        if (expected !== row.updated_at) return { data: [], error: null }
        row.state = patch.state
        row.updated_at = 't3'
        return { data: [{ user_id: 'o' }], error: null }
      } }) }) }),
    }),
  }
}

describe('writeMemberField (villkorad skrivning)', () => {
  it('försöker igen när ägaren sparat emellan, och ägarens verifikation finns kvar', async () => {
    const row = { updated_at: 't1', state: { companies: { c1: { verifications: [{ id: 'a1', number: 'A001', series: 'A' }] } } } }
    const admin = makeAdmin(row, { ownerSavesOnce: true })
    const patch = { upsert: [{ id: 'member', number: 'A002', series: 'A' }], remove: [] }
    const ok = await writeMemberField(admin, 'o', 'c1', 'verifications', (cd) => applyRecordPatch(cd.verifications, patch))
    expect(ok).toBe(true)
    expect(row.state.companies.c1.verifications.map(v => v.id)).toEqual(['a1', 'owner', 'member'])
  })

  it('ger upp (409) efter tre krockar i stället för att skriva över', async () => {
    const row = { updated_at: 't1', state: { companies: { c1: { verifications: [] } } } }
    const admin = makeAdmin(row)
    admin.from = ((orig) => (t) => ({ ...orig(t), update: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) }) }))(admin.from)
    expect(await writeMemberField(admin, 'o', 'c1', 'verifications', () => [])).toBe(false)
  })
})

// Konto som bara sparar i tabellerna: företaget läses ur tabellerna och
// skrivs med server_apply_company_ops, villkorat på företagets updated_at.
function makeTablesAdmin({ conflicts = 0 } = {}) {
  const db = { updated_at: 't1', verifications: [{ id: 'a1', number: 'A001', series: 'A' }] }
  const calls = []
  return {
    db, calls,
    from: (table) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      calls.push(table)
      return table === 'storage_modes' ? { data: { mode: 'tables_only' }, error: null } : { data: null, error: null }
    } }) }) }),
    rpc: async (name, args) => {
      calls.push({ rpc: name, args })
      if (name === 'server_read_company') {
        return { data: { key: 'c1', payload: { updated_at: db.updated_at, extra: {}, has_settings: true, settings: { id: 'c1' }, list_fields: ['verifications'], lists: { verifications: structuredClone(db.verifications) } } }, error: null }
      }
      if (name === 'server_apply_company_ops') {
        if (conflicts > 0) {
          conflicts -= 1
          db.verifications.push({ id: 'owner' + conflicts, number: 'A00' + (5 + conflicts), series: 'A' })
          db.updated_at = 't' + Math.random()
        }
        if (args.p_expected_updated_at !== db.updated_at) return { data: false, error: null }
        const op = args.p_ops[0]
        db.verifications = op.op === 'patch' ? applyRecordPatch(db.verifications, op) : op.value
        db.updated_at = 'ny'
        return { data: true, error: null }
      }
      return { data: null, error: { message: 'okänd ' + name } }
    },
  }
}

describe('writeMemberField (endast tabeller)', () => {
  it('läser och skriver tabellerna, aldrig blobben', async () => {
    const admin = makeTablesAdmin()
    const patch = { upsert: [{ id: 'member', number: 'A002', series: 'A' }], remove: [] }
    expect(await writeMemberField(admin, 'o', 'c1', 'verifications', (cd) => applyRecordPatch(cd.verifications, patch))).toBe(true)
    expect(admin.db.verifications.map(v => v.id)).toEqual(['a1', 'member'])
    expect(admin.calls).not.toContain('user_data')
    const write = admin.calls.find(c => c.rpc === 'server_apply_company_ops').args
    expect(write).toMatchObject({ p_owner: 'o', p_key: 'c1', p_expected_updated_at: 't1' })
    expect(write.p_ops[0].path).toEqual(['companies', 'c1', 'verifications'])
    // Bara den nya posten, inte hela listan (hela listan skrev om alla poster).
    expect(write.p_ops[0]).toMatchObject({ op: 'patch', remove: [], prepend: false })
    expect(write.p_ops[0].upsert.map(v => v.id)).toEqual(['member'])
    expect(admin.calls.find(c => c.rpc === 'server_read_company').args.p_kinds).toEqual(['verifications'])
  })

  it('krock: läser om, och ägarens samtidiga verifikation finns kvar', async () => {
    const admin = makeTablesAdmin({ conflicts: 1 })
    const patch = { upsert: [{ id: 'member', number: 'A002', series: 'A' }], remove: [] }
    expect(await writeMemberField(admin, 'o', 'c1', 'verifications', (cd) => applyRecordPatch(cd.verifications, patch))).toBe(true)
    expect(admin.db.verifications.map(v => v.id)).toEqual(['a1', 'owner0', 'member'])
  })

  it('ger upp efter tre krockar', async () => {
    const admin = makeTablesAdmin({ conflicts: 3 })
    expect(await writeMemberField(admin, 'o', 'c1', 'verifications', () => [])).toBe(false)
  })
})
