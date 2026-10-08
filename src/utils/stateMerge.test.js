import { describe, it, expect } from 'vitest';
import { mergeField, mergeCompany, mergeCompanies } from './stateMerge.js';

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
