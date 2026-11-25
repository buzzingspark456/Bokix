import { describe, it, expect, beforeEach } from 'vitest';

// Enkla låtsaslagringar i stället för en riktig DOM.
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
let ls; let ss;
beforeEach(() => {
  ls = mem(); ss = mem();
  globalThis.window = { localStorage: ls, sessionStorage: ss, matchMedia: () => ({ matches: false }), navigator: {} };
});

describe('Kom ihåg mig i 7 dagar', () => {
  it('med kryss sparas inloggningen i localStorage, utan i sessionStorage', async () => {
    const { getAuthStorage, setRemember } = await import('./authStorage');
    setRemember(true);
    getAuthStorage().setItem('sb', 'session');
    expect(ls.getItem('sb')).toBe('session');
    setRemember(false);
    getAuthStorage().setItem('sb2', 'x');
    expect(ss.getItem('sb2')).toBe('x');
    expect(ls.getItem('sb2')).toBe(null);
  });
  it('efter sju dagar är inloggningen borta', async () => {
    const { getAuthStorage, setRemember } = await import('./authStorage');
    setRemember(true, Date.now() - 8 * 86400000);
    ls.setItem('sb', 'gammal');
    expect(getAuthStorage().getItem('sb')).toBe(null);
    expect(ls.getItem('sb')).toBe(null);
  });
});
