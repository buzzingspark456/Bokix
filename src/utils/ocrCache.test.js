import fs from 'fs';
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
    expect(globalThis.localStorage.getItem('bokix_ocr2_n0')).toBeNull();
    expect(globalThis.localStorage.getItem('bokix_ocr2_n44')).toBe('text 44');
  });

  it('läser bara en gång per dokument, men om force är satt', async () => {
    const reader = vi.fn(async () => ({ text: 'Texten på kvittot', confidence: 88 }));
    const file = { name: 'k.jpg', size: 100, lastModified: 1 };
    const first = await readDocumentText(file, null, { reader });
    expect(first).toEqual({ text: 'Texten på kvittot', confidence: 88, weakTokens: null, quality: null, layout: null, cached: false });
    const second = await readDocumentText(file, null, { reader });
    // En cachad träff sparar bara texten (se filkommentaren i ocrCache.js) —
    // confidence och bildens mätvärden blir null i stället för gamla siffror.
    expect(second).toEqual({ text: 'Texten på kvittot', confidence: null, weakTokens: null, quality: null, layout: null, cached: true });
    expect(reader).toHaveBeenCalledTimes(1);
    await readDocumentText(file, null, { reader, force: true });
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it('läser alltid om med egna hörn och skickar dem vidare', async () => {
    const reader = vi.fn(async () => ({ text: 'Texten på kvittot', confidence: 80 }));
    const file = { name: 'h.jpg', size: 50, lastModified: 3 };
    await readDocumentText(file, null, { reader });
    const quad = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }];
    const result = await readDocumentText(file, null, { reader, quad });
    expect(result.cached).toBe(false);
    expect(reader).toHaveBeenCalledTimes(2);
    expect(reader).toHaveBeenLastCalledWith(file, null, { quad });
  });

  it('låter reservläsningen ta över när den egna inte gav något belopp', async () => {
    const good = fs.readFileSync(new URL('./__fixtures__/kvitto-r3.txt', import.meta.url), 'utf8');
    const reader = vi.fn(async () => ({ text: 'ICA\nTack för besöket\nVälkommen åter', confidence: 41, layout: { lines: [] } }));
    const cloud = vi.fn(async () => good);
    const result = await readDocumentText({ name: 'c.jpg', size: 9, lastModified: 4 }, null, { reader, cloud });
    expect(cloud).toHaveBeenCalledTimes(1);
    expect(result.text).toBe(good);
    expect(result.confidence).toBeNull();
    expect(result.layout).toBeNull();
  });

  it('läser ett foto med Vision först, utan den egna läsningen när Vision är säker', async () => {
    const good = fs.readFileSync(new URL('./__fixtures__/kvitto-r3.txt', import.meta.url), 'utf8');
    const reader = vi.fn(async () => ({ text: 'skräp', confidence: 30 }));
    const cloud = vi.fn(async () => good);
    const result = await readDocumentText({ name: 'd.jpg', size: 9, lastModified: 5 }, null, { reader, cloud });
    expect(result.text).toBe(good);
    expect(cloud).toHaveBeenCalledTimes(1);
    expect(reader).not.toHaveBeenCalled();
  });

  it('använder den egna läsningen när kvoten är slut, och frågar inte Vision en gång till', async () => {
    const good = fs.readFileSync(new URL('./__fixtures__/kvitto-r3.txt', import.meta.url), 'utf8');
    const cloud = vi.fn(async () => null);
    const result = await readDocumentText({ name: 'k.jpg', size: 9, lastModified: 9 }, null, { reader: async () => ({ text: 'ICA\nTack', confidence: 40 }), cloud });
    expect(result.text).toBe('ICA\nTack');
    const ok = await readDocumentText({ name: 'l.jpg', size: 9, lastModified: 10 }, null, { reader: async () => ({ text: good, confidence: 90 }), cloud });
    expect(ok.text).toBe(good);
  });

  it('läser en PDF med Vision först också', async () => {
    const good = fs.readFileSync(new URL('./__fixtures__/kvitto-r3.txt', import.meta.url), 'utf8');
    const reader = vi.fn(async () => ({ text: 'Faktura utan belopp', confidence: null, quality: null }));
    const cloud = vi.fn(async () => good);
    const result = await readDocumentText({ name: 'e.pdf', size: 9, lastModified: 6 }, null, { reader, cloud });
    expect(result.text).toBe(good);
    expect(reader).not.toHaveBeenCalled();
  });

  it('frågar Vision bara en gång per läsning', async () => {
    const cloud = vi.fn(async () => 'ICA\nTack');
    await readDocumentText({ name: 'm.jpg', size: 9, lastModified: 11 }, null, { reader: async () => ({ text: 'ICA', confidence: 30 }), cloud });
    expect(cloud).toHaveBeenCalledTimes(1);
  });

  it('låter reservläsningen försöka när den egna läsningen kraschar, och visar felet om den inte heller klarar det', async () => {
    const reader = async () => { throw new Error('pdf.js kraschade'); };
    const ok = await readDocumentText({ name: 'f.pdf', size: 9, lastModified: 7 }, null, { reader, cloud: async () => 'ICA Maxi\nTotalt 125,00' });
    expect(ok.text).toBe('ICA Maxi\nTotalt 125,00');
    await expect(readDocumentText({ name: 'g.pdf', size: 9, lastModified: 8 }, null, { reader, cloud: async () => null })).rejects.toThrow('pdf.js kraschade');
  });

  it('fungerar utan localStorage', async () => {
    delete globalThis.localStorage;
    const reader = vi.fn(async () => ({ text: 'text', confidence: null }));
    const file = { name: 'z.jpg', size: 7, lastModified: 2 };
    expect((await readDocumentText(file, null, { reader })).text).toBe('text');
  });
});
