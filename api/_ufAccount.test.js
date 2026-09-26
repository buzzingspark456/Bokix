import { describe, it, expect, vi } from 'vitest';
import { closeUfAccount, deleteClosedUfAccounts, hasNonUfBookkeeping, ufDeleteAfter } from './_ufAccount.js';

// Minimal låtsasadmin. `users` = konton i auth, `rows` = user_data per
// användare, `subs` = prenumerationsstatusar per användare.
function makeAdmin({ users = [], rows = {}, subs = {}, uploadFails = false } = {}) {
  const calls = { deletedUsers: [], deletedRows: [], removed: [], updated: [], tableDeletes: [], uploaded: [] };
  const table = (name) => {
    const filters = {};
    const chain = {
      select: () => chain,
      eq: (col, val) => { filters[col] = val; return chain; },
      or: () => chain,
      maybeSingle: async () => ({ data: rows[filters.user_id] ? { state: rows[filters.user_id] } : null, error: null }),
      delete: () => {
        const del = {
          eq: async (col, val) => {
            if (name === 'user_data') calls.deletedRows.push(val);
            calls.tableDeletes.push(`${name}:${val}`);
            return { error: null };
          },
          or: async () => ({ error: null }),
        };
        return del;
      },
      then: (resolve) => resolve({ data: (subs[filters.user_id] || []).map(status => ({ status })), error: null }),
    };
    return chain;
  };
  return {
    calls,
    from: table,
    storage: {
      getBucket: async () => ({ data: { id: 'bokix-arkiv' }, error: null }),
      createBucket: async () => ({ error: null }),
      from: (bucket) => ({
        upload: async (path) => { if (uploadFails) return { error: { message: 'nere' } }; calls.uploaded.push(`${bucket}:${path}`); return { error: null }; },
        download: async () => ({ data: null, error: { message: 'saknas' } }),
        list: async (prefix) => ({ data: prefix && !prefix.includes('/') ? [{ id: 'f', name: 'fil.jpg' }] : [], error: null }),
        remove: async (paths) => { calls.removed.push(...paths.map(pth => `${bucket}:${pth}`)); return { error: null }; },
      }),
    },
    auth: {
      admin: {
        listUsers: async () => ({ data: { users }, error: null }),
        updateUserById: vi.fn(async (id, attrs) => { calls.updated.push({ id, attrs }); return { error: null }; }),
        deleteUser: async (id) => { calls.deletedUsers.push(id); return { error: null }; },
      },
    },
  };
}

const ufCompany = { company: { isUf: true }, verifications: [{ id: 1 }] };
const realCompany = { company: { isUf: false }, verifications: [{ id: 1 }] };

describe('UF-avslut', () => {
  it('raderingsdatumet är tre månader fram', () => {
    expect(ufDeleteAfter(new Date('2026-09-26T10:00:00Z'))).toBe('2026-12-26');
  });

  it('ett vanligt företag med bokföring räknas, ett tomt eller UF-företag gör det inte', () => {
    expect(hasNonUfBookkeeping({ companies: { a: ufCompany } })).toBe(false);
    expect(hasNonUfBookkeeping({ companies: { a: ufCompany, b: { company: {} } } })).toBe(false);
    expect(hasNonUfBookkeeping({ companies: { a: ufCompany, b: realCompany } })).toBe(true);
  });

  it('bara UF-konton kan avsluta', async () => {
    const r = await closeUfAccount(makeAdmin(), { id: 'u', user_metadata: {} });
    expect(r.status).toBe(400);
  });

  it('ett konto med ett vanligt företag med bokföring kan inte avslutas', async () => {
    const admin = makeAdmin({ rows: { u: { companies: { a: ufCompany, b: realCompany } } } });
    const r = await closeUfAccount(admin, { id: 'u', user_metadata: { uf: true } });
    expect(r.status).toBe(409);
    expect(admin.calls.updated).toHaveLength(0);
  });

  it('avslut sparar datumen i app_metadata', async () => {
    const admin = makeAdmin({ rows: { u: { companies: { a: ufCompany } } } });
    const r = await closeUfAccount(admin, { id: 'u', user_metadata: { uf: true }, app_metadata: { provider: 'email' } }, { now: new Date('2026-09-26T10:00:00Z') });
    expect(r.status).toBe(200);
    expect(r.body.deleteAfter).toBe('2026-12-26');
    expect(admin.calls.updated[0].attrs.app_metadata).toMatchObject({ provider: 'email', uf_delete_after: '2026-12-26' });
  });
});

describe('Radering av avslutade UF-konton', () => {
  const now = new Date('2027-01-10T03:00:00Z');
  const closed = (id, until, extra = {}) => ({ id, user_metadata: { uf: true }, app_metadata: { uf_closed_at: '2026-09-26', uf_delete_after: until }, ...extra });

  it('arkiverar bokföringen i sju år och stänger sedan kontot', async () => {
    const admin = makeAdmin({ users: [closed('u1', '2026-12-26')], rows: { u1: { companies: { a: ufCompany } } } });
    const s = await deleteClosedUfAccounts(admin, { now });
    expect(s.archived).toBe(1);
    expect(s.deleted).toBe(1);
    // Skatteverket: verifikationerna ska sparas i sju år, även för UF.
    const archive = admin.calls.uploaded.find(u => u.endsWith('/bokforing.json.gz'));
    expect(archive).toMatch(/^bokix-arkiv:u1\/a\/.*-uf-avslut-t\d{4}-12-31\/bokforing\.json\.gz$/);
    expect(Number(archive.match(/-t(\d{4})-12-31/)[1])).toBeGreaterThanOrEqual(2034);
    expect(admin.calls.deletedUsers).toEqual(['u1']);
    expect(admin.calls.deletedRows).toEqual(['u1']);
  });

  it('tar inte bort något om arkiveringen misslyckas', async () => {
    const admin = makeAdmin({ users: [closed('u9', '2026-12-26')], rows: { u9: { companies: { a: ufCompany } } }, uploadFails: true });
    const s = await deleteClosedUfAccounts(admin, { now });
    expect(s.deleted).toBe(0);
    expect(s.errors).toHaveLength(1);
    expect(admin.calls.deletedUsers).toHaveLength(0);
    expect(admin.calls.deletedRows).toHaveLength(0);
    expect(admin.calls.removed).toHaveLength(0);
  });

  it('rör inte ett konto vars datum inte passerats, eller som aldrig avslutats', async () => {
    const admin = makeAdmin({ users: [closed('u2', '2027-03-01'), { id: 'u3', user_metadata: { uf: true }, app_metadata: {} }, { id: 'u4', user_metadata: {}, app_metadata: { uf_closed_at: 'x', uf_delete_after: '2026-01-01' } }] });
    const s = await deleteClosedUfAccounts(admin, { now });
    expect(s.deleted).toBe(0);
    expect(admin.calls.deletedUsers).toHaveLength(0);
  });

  it('ett konto som börjat betala sparas och avslutet tas bort', async () => {
    const admin = makeAdmin({ users: [closed('u5', '2026-12-26')], subs: { u5: ['active'] } });
    const s = await deleteClosedUfAccounts(admin, { now });
    expect(s.reopened).toBe(1);
    expect(admin.calls.deletedUsers).toHaveLength(0);
    expect(admin.calls.updated[0].attrs.app_metadata).not.toHaveProperty('uf_delete_after');
  });

  it('ett konto med ett vanligt företag med bokföring raderas aldrig', async () => {
    const admin = makeAdmin({ users: [closed('u6', '2026-12-26')], rows: { u6: { companies: { a: ufCompany, b: realCompany } } } });
    const s = await deleteClosedUfAccounts(admin, { now });
    expect(s.kept).toBe(1);
    expect(admin.calls.deletedUsers).toHaveLength(0);
  });

  it('dryRun raderar ingenting', async () => {
    const admin = makeAdmin({ users: [closed('u7', '2026-12-26')], rows: { u7: { companies: { a: ufCompany } } } });
    const s = await deleteClosedUfAccounts(admin, { now, dryRun: true });
    expect(s.due).toBe(1);
    expect(admin.calls.deletedUsers).toHaveLength(0);
    expect(admin.calls.removed).toHaveLength(0);
  });
});
