import { describe, it, expect } from 'vitest';
import { mergeField, mergeCompany, mergeCompanies, applyRecordPatch, buildStateDelta } from './stateMerge.js';

const v = (id, extra = {}) => ({ id, ...extra });

describe('mergeField', () => {
  it('tar serverns värde när inget ändrats här', () => {
    expect(mergeField('a', 'a', 'b')).toBe('b');
  });
  it('tar det lokala värdet när servern inte ändrats', () => {
    expect(mergeField('a', 'c', 'a')).toBe('c');
  });
  it('lokalt vinner när båda ändrat ett enkelt värde', () => {
    expect(mergeField('a', 'c', 'b')).toBe('c');
  });
  it('behåller båda nya verifikationerna när två personer lagt till var sin', () => {
    const base = [v(1)];
    const merged = mergeField(base, [v(1), v(2)], [v(1), v(3)]);
    expect(merged.map(x => x.id)).toEqual([1, 3, 2]);
  });
  it('tar bort en post som raderats här men inte ändrats på servern', () => {
    const merged = mergeField([v(1), v(2)], [v(1)], [v(1), v(2), v(3)]);
    expect(merged.map(x => x.id)).toEqual([1, 3]);
  });
  it('tar bort en post som raderats på servern om den inte ändrats här', () => {
    const merged = mergeField([v(1), v(2)], [v(1), v(2), v(4)], [v(1)]);
    expect(merged.map(x => x.id)).toEqual([1, 4]);
  });
  it('påminnelsemarkören från cronen blir kvar när en annan faktura ändras här', () => {
    const base = [v('f1', { status: 'sent' }), v('f2', { status: 'sent' })];
    const local = [v('f1', { status: 'sent' }), v('f2', { status: 'paid' })];
    const server = [v('f1', { status: 'sent', remindersSent: ['overdue_7d'] }), v('f2', { status: 'sent' })];
    const merged = mergeField(base, local, server);
    expect(merged).toEqual([v('f1', { status: 'sent', remindersSent: ['overdue_7d'] }), v('f2', { status: 'paid' })]);
  });
});

describe('mergeCompany', () => {
  it('ägarens egna ändringar sparas och konsultens finns kvar', () => {
    const base = { company: { name: 'X' }, verifications: [v(1)], expenses: [] };
    const local = { ...base, expenses: [v('k1')], __hasActiveMembers: true };
    const server = { ...base, verifications: [v(1), v(2)] };
    const merged = mergeCompany(base, local, server);
    expect(merged.expenses.map(x => x.id)).toEqual(['k1']);
    expect(merged.verifications.map(x => x.id)).toEqual([1, 2]);
    expect(merged.__hasActiveMembers).toBe(true);
  });
  it('utan bas skrivs det lokala som förut', () => {
    const local = { a: 1 };
    expect(mergeCompany(undefined, local, { a: 2 })).toBe(local);
  });
});

describe('mergeCompanies', () => {
  it('tar med ett företag som lagts upp på en annan enhet och tar inte tillbaka ett raderat', () => {
    const base = { a: { x: 1 }, b: { x: 1 } };
    const local = { a: { x: 2 } };
    const server = { a: { x: 1 }, b: { x: 1 }, c: { x: 1 } };
    expect(mergeCompanies(base, local, server)).toEqual({ a: { x: 2 }, c: { x: 1 } });
  });
});

describe('makeRecordPatch / applyRecordPatch', () => {
  it('skickar bara ändrade och borttagna poster och lägger dem på serverns lista', async () => {
    const { makeRecordPatch, applyRecordPatch } = await import('./stateMerge.js');
    const a = v(1); const b = v(2); const c = v(3);
    const after = [a, { ...b, text: 'ny' }, v(4)];
    const patch = makeRecordPatch([a, b, c], after);
    expect(patch.upsert.map(x => x.id)).toEqual([2, 4]);
    expect(patch.remove).toEqual([3]);
    // Ägaren har lagt till 5 under tiden: den blir kvar.
    const merged = applyRecordPatch([a, b, c, v(5)], patch);
    expect(merged.map(x => x.id)).toEqual([1, 2, 5, 4]);
    expect(merged[1].text).toBe('ny');
  });
  it('ger null för fält som inte är listor med id', async () => {
    const { makeRecordPatch } = await import('./stateMerge.js');
    expect(makeRecordPatch({ a: 1 }, { a: 2 })).toBeNull();
  });
});

// Samma regler som apply_user_data_delta i supabase-2026-10-17-delta-sparning.sql.
function applyDelta(state, ops) {
  const out = JSON.parse(JSON.stringify(state));
  const parentOf = (path) => path.slice(0, -1).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), out);
  for (const op of ops) {
    const parent = op.path.length > 1 ? parentOf(op.path) : out;
    if (!parent || typeof parent !== 'object' || Array.isArray(parent)) throw new Error('missing parent');
    const key = op.path.at(-1);
    if (op.op === 'set') parent[key] = JSON.parse(JSON.stringify(op.value));
    else if (op.op === 'unset') delete parent[key];
    else if (op.op === 'patch') parent[key] = JSON.parse(JSON.stringify(applyRecordPatch(parent[key], op)));
  }
  return out;
}

describe('buildStateDelta', () => {
  const v = (id, extra = {}) => ({ id, date: '2026-01-01', ...extra });
  const makeBase = () => {
    const company = { company: { name: 'AB' }, verifications: [v('a'), v('b'), v('c')], invoices: [v('i1')], accounts: [{ code: '1930' }] };
    return { snapshot: { activeCompanyId: 'c1', companies: {} }, companies: { c1: company } };
  };
  const check = (base, snapshot, companies) => {
    const ops = buildStateDelta(base.snapshot, base.companies, snapshot, companies);
    const server = applyDelta({ ...base.snapshot, companies: base.companies }, ops);
    expect(server).toEqual(JSON.parse(JSON.stringify({ ...snapshot, companies })));
    return ops;
  };

  it('skickar bara den nya och den ändrade posten, inte hela listan', () => {
    const base = makeBase();
    const c = base.companies.c1;
    const next = { ...c, verifications: [...c.verifications.slice(0, 2).map((x, i) => (i === 1 ? { ...x, date: '2026-02-02' } : x)), c.verifications[2], v('d')] };
    const ops = check(base, base.snapshot, { c1: next });
    expect(ops).toEqual([{ op: 'patch', path: ['companies', 'c1', 'verifications'], upsert: [next.verifications[1], next.verifications[3]], remove: [], prepend: false }]);
  });

  it('klarar en ny post först i listan och en borttagen post', () => {
    const base = makeBase();
    const c = base.companies.c1;
    const next = { ...c, verifications: [v('z'), c.verifications[0], c.verifications[2]] };
    const ops = check(base, base.snapshot, { c1: next });
    expect(ops[0]).toMatchObject({ op: 'patch', prepend: true, remove: ['b'] });
  });

  it('skickar hela listan när ordningen ändrats', () => {
    const base = makeBase();
    const c = base.companies.c1;
    const next = { ...c, verifications: [c.verifications[2], c.verifications[0], c.verifications[1]] };
    const ops = check(base, base.snapshot, { c1: next });
    expect(ops[0].op).toBe('set');
  });

  it('byter ut fält som inte är listor, tar bort fält och företag och lägger till nya', () => {
    const base = makeBase();
    base.companies.c2 = { company: { name: 'Gammalt' } };
    const c = base.companies.c1;
    const { invoices, ...rest } = c;
    const next = { ...rest, company: { name: 'AB nytt' } };
    const ops = check(base, { activeCompanyId: 'c3', companies: {} }, { c1: next, c3: { company: { name: 'Nytt' }, verifications: [] } });
    expect(ops.map(o => o.op).sort()).toEqual(['set', 'set', 'set', 'unset', 'unset']);
  });

  it('skickar ingenting när inget ändrats', () => {
    const base = makeBase();
    expect(buildStateDelta(base.snapshot, base.companies, base.snapshot, base.companies)).toEqual([]);
  });

  it('ger null utan bas', () => {
    expect(buildStateDelta(null, null, {}, {})).toBeNull();
  });
});

describe('buildStateDelta efter inloggningen', () => {
  it('skickar bara ändringen fast servern och appen har olika objekt med samma innehåll', () => {
    const list = Array.from({ length: 50 }, (_, i) => ({ id: `v${i}`, amount: i }));
    const baseCompanies = { c1: { company: { name: 'AB' }, verifications: list } };
    const local = JSON.parse(JSON.stringify(baseCompanies));
    local.c1.verifications = [...local.c1.verifications, { id: 'ny', amount: 1 }];
    const ops = buildStateDelta(null, baseCompanies, { activeCompanyId: 'c1' }, local);
    expect(ops).toEqual([
      { op: 'set', path: ['activeCompanyId'], value: 'c1' },
      { op: 'patch', path: ['companies', 'c1', 'verifications'], upsert: [{ id: 'ny', amount: 1 }], remove: [], prepend: false },
    ]);
  });
});
