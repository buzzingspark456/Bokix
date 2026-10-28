// Själva anropet till Google Cloud Vision, delat av appens kvittoläsning
// (api/ocr-vision.js) och gratisverktyget Skanna kvitto (api/ocr-free.js).
// EU-ändpunkten används så att filen behandlas inom EU, och Google sparar
// inte filerna. Nyckeln (GOOGLE_VISION_API_KEY) lämnar aldrig servern.
import { visionLines } from './_visionLayout.js';

const VISION_IMAGE_URL = 'https://eu-vision.googleapis.com/v1/images:annotate';
// En PDF läses av Vision själv (första sidan), så att även en PDF som
// webbläsarens pdf.js inte klarar går att läsa.
const VISION_FILE_URL = 'https://eu-vision.googleapis.com/v1/files:annotate';
// Base64 av en bild på 2000 px i JPEG är oftast under 1 MB. Vercels gräns
// för en request är 4,5 MB, så det här taket ligger klart under den.
const MAX_BASE64_CHARS = 3_500_000;
const VISION_TIMEOUT_MS = 15000;

// Läsningar per kalendermånad för appen och gratisverktyget tillsammans.
// Beslut 2026-10-24: 20 000. De första 1 000 är gratis hos Google, resten
// kostar runt 1,50 USD per 1 000. Går att ändra med OCR_VISION_MONTHLY_LIMIT.
export const MONTHLY_LIMIT = Number(process.env.OCR_VISION_MONTHLY_LIMIT) || 20000;
export const monthQuotaKey = (now = new Date()) => `ocr-vision-month:${now.toISOString().slice(0, 7)}`;
export const MONTH_WINDOW_MS = 32 * 24 * 60 * 60 * 1000;

// Tak per kund och månad, så att ett enda konto (med sina inbjudna) inte kan
// tömma kvoten ovan för alla (granskningen 2026-10-28). Ett vanligt företag
// läser några hundra kvitton i månaden. UF-konton är gratis att skapa och
// får ett lägre tak. Går att ändra med OCR_VISION_ACCOUNT_LIMIT och
// OCR_VISION_UF_LIMIT.
export const ACCOUNT_MONTHLY_LIMIT = Number(process.env.OCR_VISION_ACCOUNT_LIMIT) || 1500;
export const UF_MONTHLY_LIMIT = Number(process.env.OCR_VISION_UF_LIMIT) || 300;
export const accountQuotaKey = (accountId, now = new Date()) => `ocr-vision-konto:${accountId}:${now.toISOString().slice(0, 7)}`;

/** Filen ur request-kroppen ({ image } eller { pdf }, base64), eller null om den saknas eller är för stor. */
export function documentFromBody(body) {
  const isPdf = typeof body?.pdf === 'string';
  const content = String((isPdf ? body.pdf : body?.image) || '').replace(/^data:[a-z/]+;base64,/, '');
  if (!content || content.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/=]+$/.test(content)) return null;
  return { isPdf, content };
}

/**
 * Läser dokumentet med Vision. Svarar { ok: true, text, lines } eller
 * { ok: false, status, error } med ett allmänt fel som går att visa.
 */
export async function readWithVision({ isPdf, content }, apiKey, { fetchImpl = fetch } = {}) {
  const features = [{ type: 'DOCUMENT_TEXT_DETECTION' }];
  const imageContext = { languageHints: ['sv', 'en'] };
  const request = isPdf
    ? { inputConfig: { content, mimeType: 'application/pdf' }, features, imageContext, pages: [1] }
    : { image: { content }, features, imageContext };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${isPdf ? VISION_FILE_URL : VISION_IMAGE_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [request] }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    // En PDF ger ett svar per sida inuti svaret för filen.
    const result = isPdf ? (payload?.responses?.[0]?.responses?.[0] || payload?.responses?.[0]) : payload?.responses?.[0];
    if (!response.ok || result?.error) {
      // Googles felmeddelande kan nämna nyckeln eller projektet: logga det
      // här, men skicka bara ett allmänt fel till webbläsaren.
      console.warn('[vision] Vision svarade med fel:', response.status, result?.error?.message || payload?.error?.message);
      return { ok: false, status: 502, error: 'Reservläsningen svarade inte.' };
    }
    // Raderna med läge: kvittovyn markerar var uppgifterna stod (_visionLayout.js).
    return { ok: true, text: result?.fullTextAnnotation?.text || '', lines: visionLines(result?.fullTextAnnotation) };
  } catch (err) {
    console.warn('[vision] Anropet misslyckades:', err?.name || err);
    return { ok: false, status: 504, error: 'Reservläsningen tog för lång tid.' };
  } finally {
    clearTimeout(timer);
  }
}
