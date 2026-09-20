// Sparar den avlästa RÅTEXTEN för ett dokument, så att samma fil inte behöver
// läsas om varje gång man öppnar den igen. Texten sparas, inte tolkningen:
// tolkningen (parseReceiptText) görs om varje gång och går på ett ögonblick,
// så förbättringar i tolkningen slår igenom även på redan lästa dokument.
//
// Nyckeln är filens signatur (namn, storlek, ändringstid) eller adressen utan
// query-delen (en signerad lagrings-URL byter token varje gång men pekar på
// samma fil). Cachen ligger i localStorage, är begränsad i antal och storlek,
// och allt är try/catch: privat läge eller full lagring ska aldrig stoppa en
// avläsning.

const PREFIX = 'bokix_ocr_';
const INDEX_KEY = 'bokix_ocr_index';
const MAX_ENTRIES = 40;
const MAX_TEXT_CHARS = 20000;

const memory = new Map();

/** Nyckel för en fil eller en adress, eller null om den inte går att känneteckna. */
export function ocrCacheKey(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    if (input.startsWith('data:')) return `data:${input.length}:${input.slice(-40)}`;
    return `url:${input.split('?')[0].split('#')[0]}`;
  }
  if (typeof input === 'object' && typeof input.size === 'number') {
    return `file:${input.name || ''}:${input.size}:${input.lastModified || 0}`;
  }
  return null;
}

function readIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeIndex(list) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(list)); } catch { /* full lagring */ }
}

export function getCachedOcrText(key) {
  if (!key) return null;
  if (memory.has(key)) return memory.get(key);
  try {
    const text = localStorage.getItem(PREFIX + key);
    if (typeof text === 'string' && text.length > 0) {
      memory.set(key, text);
      return text;
    }
  } catch { /* privat läge */ }
  return null;
}

export function setCachedOcrText(key, text) {
  if (!key || typeof text !== 'string' || !text.trim()) return;
  const value = text.slice(0, MAX_TEXT_CHARS);
  memory.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, value);
    const index = readIndex().filter(k => k !== key);
    index.push(key);
    // Äldsta först ut när gränsen nås.
    while (index.length > MAX_ENTRIES) {
      const old = index.shift();
      memory.delete(old);
      try { localStorage.removeItem(PREFIX + old); } catch { /* ignorera */ }
    }
    writeIndex(index);
  } catch { /* cachen är bara en bonus */ }
}

export function clearCachedOcrText(key) {
  if (!key) return;
  memory.delete(key);
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignorera */ }
  writeIndex(readIndex().filter(k => k !== key));
}

/**
 * Läser ett dokument, men hoppar över själva avläsningen om samma dokument
 * lästs förut. `force` (knappen "Läs av igen") läser alltid om.
 * Returnerar { text, cached }.
 */
export async function readDocumentText(input, onProgress, { force = false, reader } = {}) {
  const key = ocrCacheKey(input);
  if (!force) {
    const hit = getCachedOcrText(key);
    if (hit) return { text: hit, cached: true };
  }
  const read = reader || (await import('./ocrReceipt')).ocrFile;
  const text = await read(input, onProgress);
  setCachedOcrText(key, text);
  return { text, cached: false };
}
