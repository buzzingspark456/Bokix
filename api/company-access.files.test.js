import { describe, it, expect } from 'vitest'
import { canReadCompanyFile } from './company-access.js'

const OWNER = '11111111-1111-4111-8111-111111111111'
const ELLA = '22222222-2222-4222-8222-222222222222' // inbjuden revisor
const BOB = '33333333-3333-4333-8333-333333333333' // annan inbjuden i samma företag
const STRANGER = '44444444-4444-4444-8444-444444444444'
const OTHER_OWNER = '55555555-5555-4555-8555-555555555555'

const ellaFile = `${ELLA}/receipts/1_a.pdf`
const url = (p) => `https://x.supabase.co/storage/v1/object/public/bokix-uploads/${p}`

/** Ägarens bokföring (blobläget) och inbjudningarna, så mycket som kontrollen läser. */
function makeAdmin({ members, states }) {
  return {
    from(table) {
      const filters = []
      const q = {
        select: () => q,
        eq: (col, val) => { filters.push(r => r[col] === val); return q },
        or: (expr) => {
          const parts = expr.split(',').map(p => p.split('.eq.'))
          filters.push(r => parts.some(([col, val]) => r[col] === val))
          return q
        },
        maybeSingle: async () => {
          if (table === 'storage_modes') return { data: null, error: null }
          if (table === 'user_data') return { data: { state: states[q.user] ?? null }, error: null }
          return { data: null, error: null }
        },
        then: (resolve) => resolve({ data: members.filter(r => filters.every(f => f(r))), error: null }),
      }
      if (table === 'user_data') q.eq = (col, val) => { q.user = val; return q }
      return q
    },
  }
}

const company = (extra = {}) => ({ company: { id: 'c1', name: 'AB' }, expenses: [{ id: 'e1', receiptUrl: url(ellaFile) }], verifications: [], ...extra })
const ellaMember = { owner_user_id: OWNER, member_user_id: ELLA, company_id: 'c1', role: 'editor', page_access: null, status: 'active' }
const bobMember = { owner_user_id: OWNER, member_user_id: BOB, company_id: 'c1', role: 'viewer', page_access: null, status: 'active' }

describe('canReadCompanyFile', () => {
  it('ägaren får öppna ett kvitto som den inbjudna laddat upp', async () => {
    const admin = makeAdmin({ members: [ellaMember], states: { [OWNER]: { companies: { c1: company() } } } })
    expect(await canReadCompanyFile(admin, OWNER, ellaFile)).toBe(true)
  })

  it('även efter att den inbjudna tagits bort (bokföringen ska gå att läsa i sju år)', async () => {
    const admin = makeAdmin({ members: [{ ...ellaMember, status: 'revoked' }], states: { [OWNER]: { companies: { c1: company() } } } })
    expect(await canReadCompanyFile(admin, OWNER, ellaFile)).toBe(true)
  })

  it('en annan inbjuden i samma företag får öppna det', async () => {
    const admin = makeAdmin({ members: [ellaMember, bobMember], states: { [OWNER]: { companies: { c1: company() } } } })
    expect(await canReadCompanyFile(admin, BOB, ellaFile)).toBe(true)
  })

  it('men inte om hen inte får se kvittosidan', async () => {
    const noExpenses = { ...bobMember, page_access: { expenses: 'none', verifications: 'none', review: 'none' } }
    const admin = makeAdmin({ members: [ellaMember, noExpenses], states: { [OWNER]: { companies: { c1: { company: { id: 'c1' }, expenses: [{ id: 'e1', receiptUrl: url(ellaFile) }] } } } } })
    expect(await canReadCompanyFile(admin, BOB, ellaFile)).toBe(false)
  })

  it('ingen inbjudning mellan dem: nekas, även om sökvägen står i ens egen bokföring', async () => {
    const admin = makeAdmin({ members: [ellaMember], states: { [OTHER_OWNER]: { companies: { c9: company() } } } })
    expect(await canReadCompanyFile(admin, OTHER_OWNER, ellaFile)).toBe(false)
    expect(await canReadCompanyFile(admin, STRANGER, ellaFile)).toBe(false)
  })

  it('inbjuden i ett annat av ägarens företag: nekas', async () => {
    const otherCompany = { ...bobMember, company_id: 'c2' }
    const admin = makeAdmin({ members: [ellaMember, otherCompany], states: { [OWNER]: { companies: { c1: company(), c2: { company: { id: 'c2' }, expenses: [] } } } } })
    expect(await canReadCompanyFile(admin, BOB, ellaFile)).toBe(false)
  })

  it('filen finns inte i företagets data: nekas', async () => {
    const admin = makeAdmin({ members: [ellaMember], states: { [OWNER]: { companies: { c1: company({ expenses: [] }) } } } })
    expect(await canReadCompanyFile(admin, OWNER, ellaFile)).toBe(false)
  })

  it('egen mapp ja; konstigt mappnamn nekas utan fråga', async () => {
    const admin = makeAdmin({ members: [], states: {} })
    expect(await canReadCompanyFile(admin, ELLA, ellaFile)).toBe(true)
    expect(await canReadCompanyFile(admin, OWNER, 'x,owner_user_id.eq.y/receipts/a.pdf')).toBe(false)
  })
})
