import { describe, it, expect } from 'vitest';
import { needsAutoRead, autoReadTried, markAutoReadTried } from './autoRead';

const now = Date.parse('2026-11-18T12:00:00Z');
const fresh = { id: `exp_${now - 60000}`, receiptUrl: 'x.jpg', amount: 0 };

describe('avläsning när underlaget kommer in', () => {
  it('läser ett nytt underlag med fil', () => {
    expect(needsAutoRead(fresh, now)).toBe(true);
  });
  it('läser inte om: utkast, ifyllt, utan fil eller gammalt', () => {
    expect(needsAutoRead({ ...fresh, ocrDraft: { v: 1 } }, now)).toBe(false);
    expect(needsAutoRead({ ...fresh, supplier: 'Coop' }, now)).toBe(false);
    expect(needsAutoRead({ ...fresh, amount: 120 }, now)).toBe(false);
    expect(needsAutoRead({ ...fresh, receiptUrl: '' }, now)).toBe(false);
    expect(needsAutoRead({ ...fresh, id: `exp_${now - 5 * 86400000}` }, now)).toBe(false);
  });
  it('kommer ihåg vad som försökts', () => {
    const mem = {}; const storage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
    markAutoReadTried('a', storage);
    markAutoReadTried('b', storage);
    expect([...autoReadTried(storage)]).toEqual(['a', 'b']);
  });
});
