import { describe, it, expect } from 'vitest';
import { mergeField, mergeCompany, mergeCompanies, applyRecordPatch, buildStateDelta, renumberVerificationCollisions } from './stateMerge.js';

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
    else if (op.op === 'patch' || op.op === 'patch_by') parent[key] = JSON.parse(JSON.stringify(applyRecordPatch(parent[key], op, op.op === 'patch_by' ? op.key : 'id')));
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

describe('buildStateDelta för kontoplanen', () => {
  it('skickar bara det ändrade kontot, identifierat med kontonumret', () => {
    const accounts = Array.from({ length: 40 }, (_, i) => ({ code: String(1000 + i), name: `Konto ${i}`, active: true }));
    const baseCompanies = { c1: { accounts } };
    const changed = { ...accounts[5], active: false };
    const local = { c1: { accounts: accounts.map((a, i) => (i === 5 ? changed : a)) } };
    const ops = buildStateDelta({}, baseCompanies, {}, local);
    expect(ops).toEqual([{ op: 'patch_by', key: 'code', path: ['companies', 'c1', 'accounts'], upsert: [changed], remove: [], prepend: false }]);
    expect(applyDelta({ companies: baseCompanies }, ops)).toEqual(JSON.parse(JSON.stringify({ companies: local })));
  });
});

describe('renumberVerificationCollisions (två som bokför samtidigt)', () => {
  const ver = (id, number, series = 'A') => ({ id, number, series, rows: [] })

  it('ny verifikation som fått samma nummer som en sparad får nästa lediga', () => {
    const saved = [ver('a1', 'A001'), ver('a2', 'A002')]
    const merged = [...saved, ver('x', 'A002')]
    const out = renumberVerificationCollisions(merged, saved)
    expect(out.map(v => v.number)).toEqual(['A001', 'A002', 'A003'])
    expect(out[0]).toBe(saved[0])
  })

  it('två nya med samma nummer: den första behåller, den andra flyttas', () => {
    const saved = [ver('a1', 'A001')]
    const out = renumberVerificationCollisions([...saved, ver('x', 'A002'), ver('y', 'A002')], saved)
    expect(out.map(v => v.number)).toEqual(['A001', 'A002', 'A003'])
  })

  it('ett gammalt krockande nummer som skickas igen flyttas också', () => {
    const saved = [ver('a1', 'A002'), ver('x', 'A003')]
    const out = renumberVerificationCollisions([ver('a1', 'A002'), ver('x', 'A002')], saved)
    expect(out.find(v => v.id === 'x').number).toBe('A003')
  })

  it('olika serier krockar inte, och inget ändras när numren är unika', () => {
    const saved = [ver('a1', 'A001')]
    const list = [...saved, ver('b', 'B001', 'B'), ver('c', 'A002')]
    expect(renumberVerificationCollisions(list, saved)).toBe(list)
  })

  it('mergeCompany numrerar om när ägare och konsult bokfört samtidigt', () => {
    const base = { verifications: [ver('a1', 'A001')] }
    const local = { verifications: [ver('a1', 'A001'), ver('mine', 'A002')] }
    const server = { verifications: [ver('a1', 'A001'), ver('theirs', 'A002')] }
    const out = mergeCompany(base, local, server)
    const byId = Object.fromEntries(out.verifications.map(v => [v.id, v.number]))
    expect(byId).toEqual({ a1: 'A001', theirs: 'A002', mine: 'A003' })
  })
})

describe('mergeField: objekt som ändrats på båda håll', () => {
  it('slås ihop fält för fält (F-skatten här, telefonnumret på en annan enhet)', () => {
    const base = { name: 'AB', fSkatt: 'gammal', phone: '1' }
    const local = { ...base, fSkatt: 'Godkänd för F-skatt' }
    const server = { ...base, phone: '2' }
    expect(mergeField(base, local, server)).toEqual({ name: 'AB', fSkatt: 'Godkänd för F-skatt', phone: '2' })
  })

  it('samma fält ändrat på båda håll: det lokala vinner, som förut', () => {
    expect(mergeField({ city: 'A' }, { city: 'B' }, { city: 'C' })).toEqual({ city: 'B' })
  })

  it('nästlat: påminnelse-cronens markering försvinner inte när kunden ändrar inställningar', () => {
    const base = { notifications: { enabled: true, agiRemindersSent: {} }, email: 'a@b.se' }
    const local = { ...base, email: 'ny@b.se' }
    const server = { ...base, notifications: { enabled: true, agiRemindersSent: { '2026-10': true } } }
    expect(mergeField(base, local, server)).toEqual({ notifications: { enabled: true, agiRemindersSent: { '2026-10': true } }, email: 'ny@b.se' })
  })

  it('borttaget fält här tas bort, nytt fält på servern kommer med', () => {
    const base = { a: 1, b: 2 }
    const local = { a: 1 }
    const server = { a: 1, b: 2, c: 3 }
    expect(mergeField(base, local, server)).toEqual({ a: 1, c: 3 })
  })

  it('listor i objektet slås ihop post för post', () => {
    const base = { bankAccounts: [{ id: 'x', name: 'X' }] }
    const local = { bankAccounts: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }] }
    const server = { bankAccounts: [{ id: 'x', name: 'X2' }] }
    expect(mergeField(base, local, server)).toEqual({ bankAccounts: [{ id: 'x', name: 'X2' }, { id: 'y', name: 'Y' }] })
  })

  it('inget objekt i basen: fortfarande fält för fält', () => {
    expect(mergeField(undefined, { a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })
})
