// Kvittoläsning med Google Cloud Vision (/api/ocr-vision, EU). Beslut
// 2026-10-23: kvitton, både foton och PDF:er, läses av Vision FÖRST så
// länge månadens gratiskvot räcker (800 läsningar, räknas på servern). När
// kvoten är slut svarar servern 429 och appens egen avläsning (Tesseract i
// webbläsaren, pdf.js för PDF) används resten av månaden. Texten tolkas av
// samma parseReceiptText som den egna läsningens.
import { supabase } from '../supabaseClient';

const CLOUD_TIMEOUT_MS = 20000;
// Svarade servern att månadens kvot är slut skickas inget mer under besöket,
// så att ingen bild laddas upp i onödan.
let quotaReached = false;

/** Behöver avläsningen hjälp? Oläsbart, inget belopp, gissat belopp eller moms som inte går ihop. */
export function needsCloudReading(parsed) {
  if (!parsed) return false;
  if (parsed.unreadable) return true;
  if (parsed.notReceipt) return false;
  return !parsed.amount || Boolean(parsed.amountGuessed) || Boolean(parsed.vatMismatch);
}

/**
 * Läser dokumentet med Vision. Returnerar texten, eller null om det inte gick
 * eller kvoten är slut (då gäller den egna läsningen).
 */
export async function readWithCloud(input) {
  if (quotaReached) return null;
  try {
    const { documentForCloud } = await import('./ocrReceipt');
    const doc = await documentForCloud(input);
    if (!doc) return null;
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
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
      if (!response.ok) return null;
      return typeof payload?.text === 'string' && payload.text.trim() ? payload.text : null;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn('[OCR] Reservläsningen misslyckades, behåller den egna:', err?.name || err);
    return null;
  }
}
