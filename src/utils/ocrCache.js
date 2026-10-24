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

// Versionen byts när avläsningen blir bättre (2: två läsningar och logotyp,
// 2026-10-04), så att ett kvitto läses om i stället för att den gamla, sämre
// texten återanvänds. Den gamla versionens poster rensas bort en gång.
const PREFIX = 'bokix_ocr2_';
const INDEX_KEY = 'bokix_ocr2_index';
const LEGACY = [{ prefix: 'bokix_ocr_', index: 'bokix_ocr_index' }];
let legacyPurged = false;

function purgeLegacy() {
  if (legacyPurged) return;
  legacyPurged = true;
  try {
    for (const { prefix, index } of LEGACY) {
      const raw = localStorage.getItem(index);
      if (raw === null) continue;
      let keys = [];
      try { keys = JSON.parse(raw) || []; } catch { keys = []; }
      keys.forEach(k => { try { localStorage.removeItem(prefix + k); } catch { /* ignorera */ } });
      localStorage.removeItem(index);
    }
  } catch { /* privat läge */ }
}
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
  purgeLegacy();
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
 * Returnerar { text, confidence, weakTokens, quality, layout, cached }. `weakTokens` (ord
 * med siffror som OCR var osäker på) är, som `confidence`, `null` för en cachad träff. `confidence` (Tesseracts
 * egen avläsningssäkerhet, 0–100, se ocrReceipt.js) och `quality` (bildens
 * mätvärden och ett råd om fotot) är bara `null` för en CACHAD träff — de
 * sparas aldrig (bara råtexten cachas, se filkommentaren överst), så en
 * tidigare framgångsrik avläsning behandlas som "ingen osäkerhet att ange" i
 * stället för att gissa en siffra.
 */
export async function readDocumentText(input, onProgress, options = {}) {
  try {
    return await readDocumentTextOnce(input, onProgress, options);
  } catch (err) {
    // Kundfel syns annars bara i kundens konsol (Bymarkens PDF-kvitton
    // 2026-10-23). Rapporten hamnar i /internal → Systemstatus.
    if (!options.reader) {
      const isPdf = input?.type === 'application/pdf' || /\.pdf(\?|$)/i.test(String(input?.name || (typeof input === 'string' ? input : '')));
      const { lastCloudReadStatus } = await import('./ocrCloud');
      const { reportOcrError } = await import('./errorReporting');
      reportOcrError(err, { fileType: isPdf ? 'pdf' : 'bild', cloud: lastCloudReadStatus() || 'inte provad' });
    }
    throw err;
  }
}

async function readDocumentTextOnce(input, onProgress, { force = false, reader, quad = null, cloud } = {}) {
  const key = ocrCacheKey(input);
  // Egna hörn (Justera kanter) betyder alltid en ny avläsning.
  if (!force && !quad) {
    const hit = getCachedOcrText(key);
    if (hit) return { text: hit, confidence: null, weakTokens: null, quality: null, layout: null, cached: true };
  }

  // I appen läser bara Vision (beslut 2026-10-24): ger Vision ingen text
  // (kvoten slut, fel, inget svar) blir det "Kunde inte läsas", och den
  // egna läsningen tar inte över. Egna hörn skickas som ett uträtat foto.
  const cloudRead = cloud === undefined ? (reader ? null : (await import('./ocrCloud')).readWithCloud) : cloud;
  if (cloudRead) {
    onProgress?.('Läser kvittot…');
    const text = await cloudRead(input, { quad });
    if (!text) throw new Error('Kunde inte läsas');
    setCachedOcrText(key, text);
    return { text, confidence: null, weakTokens: null, quality: null, layout: null, cached: false };
  }

  // Den egna läsningen: bara när en läsare skickas in (tester och verktyg).
  const ocr = await import('./ocrReceipt');
  const read = reader || ocr.ocrFile;
  const { text, confidence, weakTokens, quality, layout } = await (quad ? read(input, onProgress, { quad }) : read(input, onProgress));
  setCachedOcrText(key, text);
  // `layout` (var på fotot raderna stod) cachas inte: rutorna sparas på
  // kvittots utkast i stället, se Expenses.jsx.
  return { text, confidence, weakTokens: weakTokens || null, quality: quality || null, layout: layout || null, cached: false };
}

