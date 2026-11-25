// Gratisverktyget Skanna kvitto: första kvittot läses av Google Cloud Vision
// via /api/ocr-free (en gång per person, räknas på servern), därefter läser
// sidan i webbläsaren. Webbläsaren minns också att läsningen är använd, så
// att ingen bild skickas i onödan; servern avgör ändå.
import { rowsFromLayout } from './visionRows';

const USED_KEY = 'bokix_free_ocr_used';
const TIMEOUT_MS = 20000;

export function freeGoogleReadLeft() {
  try { return localStorage.getItem(USED_KEY) !== '1'; } catch { return true; }
}

function markUsed() {
  try { localStorage.setItem(USED_KEY, '1'); } catch { /* privat läge: servern minns ändå */ }
}

/**
 * Läser filen med Google. Svarar { text, lines } när det gick, { used: true }
 * när gratisläsningen redan är använd, annars null (då läser sidan själv).
 */
export async function readFreeWithGoogle(file, captchaToken) {
  if (!freeGoogleReadLeft()) return { used: true };
  const { documentForCloud, laterPdfPagesText } = await import('./ocrReceipt');
  const doc = await documentForCloud(file).catch(() => null);
  if (!doc) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('/api/ocr-free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [doc.kind]: doc.content, captchaToken: captchaToken || undefined }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 429 && payload?.code === 'used') { markUsed(); return { used: true }; }
    if (!response.ok) return null;
    // Läsningen är förbrukad på servern i och med svaret, även om texten är tom.
    markUsed();
    const text = typeof payload?.text === 'string' && payload.text.trim() ? payload.text : null;
    if (!text) return null;
    const laterPages = await laterPdfPagesText(file);
    // Raderna efter var de står på bilden (visionRows.js), som i appen.
    const firstPage = (Array.isArray(payload.lines) && rowsFromLayout(payload.lines)) || text;
    return { text: laterPages ? `${firstPage}\n${laterPages}` : firstPage, lines: Array.isArray(payload.lines) ? payload.lines : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
