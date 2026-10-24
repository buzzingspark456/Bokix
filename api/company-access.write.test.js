import { describe, it, expect } from 'vitest'
import { writeMemberField } from './company-access.js'
import { applyRecordPatch } from '../src/utils/stateMerge.js'

// Fejkad user_data-rad där ägaren hinner spara mellan medlemmens läsning och
// skrivning: första skrivningen krockar på updated_at, andra går igenom.
function makeAdmin(row, { ownerSavesOnce } = {}) {
  let reads = 0
  return {
    row,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => {
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
    admin.from = ((orig) => () => ({ ...orig(), update: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) }) }))(admin.from)
    expect(await writeMemberField(admin, 'o', 'c1', 'verifications', () => [])).toBe(false)
  })
})
