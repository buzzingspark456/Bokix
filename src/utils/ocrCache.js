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
  const ocr = await import('./ocrReceipt');
  const read = reader || ocr.ocrFile;
  const cloudRead = cloud === undefined ? (reader ? null : (await import('./ocrCloud')).readWithCloud) : cloud;
  const { needsCloudReading } = await import('./ocrCloud');

  // 1. Foton och PDF:er läses av Vision först, så länge månadens kvot räcker
  // (se ocrCloud.js). Svarar Vision används dess text, även när tolkningen
  // är osäker: den egna läsningen tar inte över (beslut 2026-10-24). Egna
  // hörn (Justera kanter) är en beskärning för den egna läsningen och går dit.
  let firstCloudText = null;
  let cloudTried = false;
  if (cloudRead && !quad) {
    firstCloudText = await cloudRead(input);
    cloudTried = true;
    if (firstCloudText) {
      setCachedOcrText(key, firstCloudText);
      return { text: firstCloudText, confidence: null, weakTokens: null, quality: null, layout: null, cached: false };
    }
  }

  // 2. Den egna läsningen, bara när Vision inte gav någon text: kvoten slut,
  // Vision svarade inte, filen för stor, eller egna hörn.
  let local;
  try {
    local = await (quad ? read(input, onProgress, { quad }) : read(input, onProgress));
  } catch (err) {
    // Den egna läsningen kraschade (en PDF som pdf.js inte klarar i den här
    // webbläsaren, en bild som inte går att avkoda): Vision får försöka innan
    // felet visas. Kundfel 2026-10-23, PDF-kvitto i Verifikationer.
    const cloudText = firstCloudText || (cloudRead && !cloudTried ? await cloudRead(input) : null);
    if (!cloudText) throw err;
    setCachedOcrText(key, cloudText);
    return { text: cloudText, confidence: null, weakTokens: null, quality: null, layout: null, cached: false };
  }
  let { text, confidence, weakTokens, quality, layout } = local;

  // 3. Den bästa av Visions osäkra läsning och den egna. Har Vision inte
  // provats (egna hörn) får den försöka när den egna läsningen av en bild
  // inte räckte. En cachad träff provas inte igen: "Läs av igen" gör det.
  const isImageReading = (confidence !== null && confidence !== undefined) || Boolean(quality);
  let cloudText = firstCloudText;
  if (!cloudText && cloudRead && !cloudTried && isImageReading && needsCloudReading(ocr.parseReceiptText(text, { confidence, weakTokens }))) {
    onProgress?.('Läser kvittot en gång till…');
    cloudText = await cloudRead(input);
  }
  if (cloudText && ocr.readingScore({ text: cloudText, confidence: 100 }) > ocr.readingScore({ text, confidence })) {
    // Visions text är säker på tecknen; Tesseracts rutor och osäkra ord
    // hör till den andra läsningen och gäller inte längre.
    text = cloudText;
    confidence = null;
    weakTokens = null;
    layout = null;
  }
  setCachedOcrText(key, text);
  // `layout` (var på fotot raderna stod) cachas inte: rutorna sparas på
  // kvittots utkast i stället, se Expenses.jsx.
  return { text, confidence, weakTokens: weakTokens || null, quality: quality || null, layout: layout || null, cached: false };
}
