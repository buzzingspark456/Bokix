// Reservläsning för svåra kvitton. Den egna avläsningen (Tesseract i
// webbläsaren) körs alltid först. Bara när den inte gav ett belopp att lita
// på skickas en nedskalad bild till /api/ocr-vision (Google Cloud Vision, EU).
// Texten tolkas sedan av samma parseReceiptText, och den läsning som ger
// bäst resultat vinner. Beslut 2026-10-23: Vision är reserv, inte förstaval,
// så att så få bilder som möjligt lämnar webbläsaren.
import { supabase } from '../supabaseClient';

const CLOUD_TIMEOUT_MS = 20000;

/** Behöver avläsningen hjälp? Oläsbart, inget belopp, gissat belopp eller moms som inte går ihop. */
export function needsCloudReading(parsed) {
  if (!parsed) return false;
  if (parsed.unreadable) return true;
  if (parsed.notReceipt) return false;
  return !parsed.amount || Boolean(parsed.amountGuessed) || Boolean(parsed.vatMismatch);
}

/** Läser dokumentet med Vision. Returnerar texten, eller null om det inte gick (då gäller den egna läsningen). */
export async function readWithCloud(input) {
  try {
    const { documentImageForCloud } = await import('./ocrReceipt');
    const image = await documentImageForCloud(input);
    if (!image) return null;
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
    try {
      const response = await fetch('/api/ocr-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image }),
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const payload = await response.json().catch(() => ({}));
      return typeof payload?.text === 'string' && payload.text.trim() ? payload.text : null;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn('[OCR] Reservläsningen misslyckades, behåller den egna:', err?.name || err);
    return null;
  }
}
