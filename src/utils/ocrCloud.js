// Kvittoläsning med Google Cloud Vision (/api/ocr-vision, EU). Beslut
// 2026-10-24: i appen läses kvitton, både foton och PDF:er, BARA av Vision,
// upp till 20 000 läsningar i månaden (räknas på servern). Är kvoten slut
// (429) eller svarar Vision inte blir det "Kunde inte läsas"; den egna
// läsningen (Tesseract) tar inte över. Texten tolkas av parseReceiptText.
import { supabase } from '../supabaseClient';
import { reportOcrError } from './errorReporting';

const CLOUD_TIMEOUT_MS = 20000;
// Svarade servern att månadens kvot är slut skickas inget mer under besöket,
// så att ingen bild laddas upp i onödan.
let quotaReached = false;
// Hur senaste Vision-försöket gick ('ok', 'kvot slut', 'svarade 403' …), för
// felrapporten när hela avläsningen misslyckas (se ocrCache.js).
let lastCloudStatus = '';
export const lastCloudReadStatus = () => lastCloudStatus;
const docType = (doc) => (doc?.kind === 'pdf' ? 'pdf' : 'bild');

/** Behöver avläsningen hjälp? Oläsbart, inget belopp, gissat belopp eller moms som inte går ihop. */
export function needsCloudReading(parsed) {
  if (!parsed) return false;
  if (parsed.unreadable) return true;
  if (parsed.notReceipt) return false;
  return !parsed.amount || Boolean(parsed.amountGuessed) || Boolean(parsed.vatMismatch);
}

/**
 * Läser dokumentet med Vision. Returnerar texten, eller null om det inte gick
 * eller kvoten är slut (då blir det "Kunde inte läsas", se ocrCache.js).
 */
export async function readWithCloud(input, { quad = null } = {}) {
  if (quotaReached) { lastCloudStatus = 'kvot slut'; return null; }
  let doc = null;
  try {
    const { documentForCloud } = await import('./ocrReceipt');
    doc = await documentForCloud(input, { quad });
    if (!doc) { lastCloudStatus = 'inte skickad (för stor eller okänd fil)'; return null; }
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session?.access_token) { lastCloudStatus = 'inte inloggad'; return null; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
    try {
      const response = await fetch('/api/ocr-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ [doc.kind]: doc.content }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 429 && payload?.code === 'quota') quotaReached = true;
      if (!response.ok) {
        lastCloudStatus = quotaReached ? 'kvot slut' : `svarade ${response.status}`;
        // Kvoten är ett väntat läge; allt annat ska synas i /internal.
        if (!quotaReached) reportOcrError(`Vision svarade ${response.status}`, { fileType: docType(doc), cloud: String(payload?.error || '') });
        return null;
      }
      const text = typeof payload?.text === 'string' && payload.text.trim() ? payload.text : null;
      lastCloudStatus = text ? 'ok' : 'ingen text';
      return text;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn('[OCR] Reservläsningen misslyckades, behåller den egna:', err?.name || err);
    const timedOut = err?.name === 'AbortError';
    lastCloudStatus = timedOut ? 'tog för lång tid' : 'anropet misslyckades';
    reportOcrError(timedOut ? 'Vision tog för lång tid' : `Vision-anropet misslyckades: ${err?.message || err}`, { fileType: docType(doc) });
    return null;
  }
}
