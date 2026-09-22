import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ocrCacheKey, getCachedOcrText, setCachedOcrText, clearCachedOcrText, readDocumentText } from './ocrCache';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: k => { data.delete(k); },
    data,
  };
}

describe('ocrCache', () => {
  beforeEach(() => {
    globalThis.localStorage = fakeStorage();
  });

  it('bygger nyckel ur filens signatur och ur adressen utan token', () => {
    expect(ocrCacheKey({ name: 'a.pdf', size: 10, lastModified: 5 })).toBe('file:a.pdf:10:5');
    expect(ocrCacheKey('https://x.se/f/kvitto.jpg?token=abc')).toBe('url:https://x.se/f/kvitto.jpg');
    expect(ocrCacheKey('https://x.se/f/kvitto.jpg?token=xyz')).toBe(ocrCacheKey('https://x.se/f/kvitto.jpg?token=abc'));
    expect(ocrCacheKey(null)).toBeNull();
  });

  it('sparar och hämtar text, och glömmer den när den rensas', () => {
    setCachedOcrText('k1', 'Hej kvitto');
    expect(getCachedOcrText('k1')).toBe('Hej kvitto');
    clearCachedOcrText('k1');
    expect(getCachedOcrText('k1')).toBeNull();
  });

  it('sparar inte tom text', () => {
    setCachedOcrText('tom', '   ');
    expect(getCachedOcrText('tom')).toBeNull();
  });

  it('släpper de äldsta posterna när gränsen nås', () => {
    for (let i = 0; i < 45; i++) setCachedOcrText(`n${i}`, `text ${i}`);
    expect(globalThis.localStorage.getItem('bokix_ocr_n0')).toBeNull();
    expect(globalThis.localStorage.getItem('bokix_ocr_n44')).toBe('text 44');
  });

  it('läser bara en gång per dokument, men om force är satt', async () => {
    const reader = vi.fn(async () => ({ text: 'Texten på kvittot', confidence: 88 }));
    const file = { name: 'k.jpg', size: 100, lastModified: 1 };
    const first = await readDocumentText(file, null, { reader });
    expect(first).toEqual({ text: 'Texten på kvittot', confidence: 88, cached: false });
    const second = await readDocumentText(file, null, { reader });
    // En cachad träff sparar bara texten (se filkommentaren i ocrCache.js) —
    // confidence blir null i stället för att gissa en gammal siffra.
    expect(second).toEqual({ text: 'Texten på kvittot', confidence: null, cached: true });
    expect(reader).toHaveBeenCalledTimes(1);
    await readDocumentText(file, null, { reader, force: true });
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it('fungerar utan localStorage', async () => {
    delete globalThis.localStorage;
    const reader = vi.fn(async () => ({ text: 'text', confidence: null }));
    const file = { name: 'z.jpg', size: 7, lastModified: 2 };
    expect((await readDocumentText(file, null, { reader })).text).toBe('text');
  });
});
