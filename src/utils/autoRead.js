// Avläsning direkt när ett underlag kommer in (Underlag, 2026-11-18).
// En gång per underlag, aldrig om igen. Bara nya underlag (de senaste tre
// dygnen) läses av sig själva, så att gamla oavlästa kvitton inte äter upp
// månadens avläsningar. Det som saknas eller är osäkert fyller man i själv.

export const AUTO_READ_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const KEY = 'bokix.autoRead';

/** Uppladdningstiden ur id:t (exp_<millisekunder>), annars 0. */
export function uploadedAtMs(r) {
  return Number((/^exp_(\d{13})/.exec(String(r?.id || '')) || [])[1]) || 0;
}

/** Ett nytt, oläst underlag med fil som ingen fyllt i än. */
export function needsAutoRead(r, now = Date.now()) {
  if (!r?.receiptUrl || r.ocrDraft || r.supplier || r.costAccount || (Number(r.amount) || 0) !== 0) return false;
  const ts = uploadedAtMs(r);
  return ts > 0 && now - ts < AUTO_READ_MAX_AGE_MS;
}

/** Underlag som redan försökts i den här webbläsaren (även misslyckade). */
export function autoReadTried(storage = globalThis.localStorage) {
  try { return new Set(JSON.parse(storage?.getItem(KEY) || '[]')); } catch { return new Set(); }
}
export function markAutoReadTried(id, storage = globalThis.localStorage) {
  try {
    const list = [...autoReadTried(storage), id].slice(-500);
    storage?.setItem(KEY, JSON.stringify(list));
  } catch { /* privat läge: då kan samma underlag läsas en gång per besök */ }
}
