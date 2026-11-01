import { describe, it, expect } from 'vitest';
import { checkCompanyLinks } from './_companyCopy.js';
import { mergeMemberCompanyWrite } from './_memberView.js';

// Liten fejk av de frågor checkCompanyLinks ställer.
function makeAdmin({ companies = [], invites = [] }) {
  const companyQuery = () => {
    let rows = companies.filter(c => !c.deleted_at);
    const q = {
      select: () => q,
      is: (col, val) => { rows = rows.filter(c => (c[col] ?? null) === val); return q; },
      in: (col, list) => { rows = rows.filter(c => list.includes(c[col])); return q; },
      limit: () => q,
      then: (resolve) => resolve({ data: rows, error: null }),
    };
    return q;
  };
  const inviteQuery = () => {
    const q = { select: () => q, eq: () => q, limit: async () => ({ data: invites, error: null }) };
    return q;
  };
  return { from: (table) => (table === 'companies' ? companyQuery() : inviteQuery()) };
}

describe('checkCompanyLinks', () => {
  const ok = { owner_user_id: 'o1', legacy_key: 'k1', legacy_company_id: 'id1' };

  it('är tyst när allt stämmer, både via id och via nyckel', async () => {
    const r = await checkCompanyLinks(makeAdmin({
      companies: [ok],
      invites: [{ owner_user_id: 'o1', company_id: 'id1' }, { owner_user_id: 'o1', company_id: 'k1' }],
    }));
    expect(r.detail).toBeNull();
  });

  it('larmar för företag utan id och inbjudan som inte hittar sitt företag', async () => {
    const r = await checkCompanyLinks(makeAdmin({
      companies: [{ owner_user_id: 'o1', legacy_key: 'k1', legacy_company_id: null }],
      invites: [{ owner_user_id: 'o1', company_id: 'gammalt_id' }],
    }));
    expect(r.missingIds).toHaveLength(1);
    expect(r.brokenInvites).toHaveLength(1);
    expect(r.detail).toContain('o1/k1');
    expect(r.detail).toContain('o1/gammalt_id');
  });

  it('räknar inte ett borttaget företag som giltigt mål', async () => {
    const r = await checkCompanyLinks(makeAdmin({
      companies: [{ ...ok, deleted_at: '2026-10-01' }],
      invites: [{ owner_user_id: 'o1', company_id: 'id1' }],
    }));
    expect(r.brokenInvites).toHaveLength(1);
  });
});

describe('mergeMemberCompanyWrite', () => {
  it('låter aldrig en medlem ändra eller ta bort företagets id', () => {
    const base = { id: 'id1', name: 'Bolaget', city: 'Kåge' };
    expect(mergeMemberCompanyWrite(base, { id: 'annat', city: 'Umeå' })).toMatchObject({ id: 'id1', city: 'Umeå' });
    expect(mergeMemberCompanyWrite(base, { id: null })).toMatchObject({ id: 'id1' });
  });
});
