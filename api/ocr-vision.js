// Reservläsning av svåra kvitton med Google Cloud Vision. Appens egen
// avläsning (Tesseract i webbläsaren) körs alltid först; bara när den inte
// gav ett belopp att lita på skickar appen en nedskalad bild hit (se
// src/utils/ocrCloud.js), eller hela PDF:en när den egna läsningen inte
// klarade den. Nyckeln (GOOGLE_VISION_API_KEY) finns bara här på servern och
// skickas aldrig till webbläsaren. EU-ändpunkten används så att filen
// behandlas inom EU, och Google sparar inte filerna.
import { applySecurityHeaders } from './_security.js';
import { checkRateLimit } from './_rateLimit.js';
import { requireAuthedUser, requireActiveSubscription } from './_auth.js';
import { parseJsonBody } from './stripe/_parseBody.js';

const VISION_IMAGE_URL = 'https://eu-vision.googleapis.com/v1/images:annotate';
// En PDF läses av Vision själv (första sidan), så att en PDF som webbläsarens
// pdf.js inte klarar ändå går att läsa.
const VISION_FILE_URL = 'https://eu-vision.googleapis.com/v1/files:annotate';
// Base64 av en bild på 2000 px i JPEG är oftast under 1 MB. Vercels gräns
// för en request är 4,5 MB, så det här taket ligger klart under den.
const MAX_BASE64_CHARS = 3_500_000;
const VISION_TIMEOUT_MS = 15000;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Reservläsningen är inte påslagen.' });
    return;
  }

  const user = await requireAuthedUser(req, res);
  if (!user) return;
  // Varje läsning kostar pengar: gränsen per konto skyddar mot en klient som
  // skickar samma bild om och om igen.
  if (!(await checkRateLimit(req, res, { key: 'ocr-vision', windowMs: 60 * 60 * 1000, max: 60, identifier: user.id }))) return;
  if (!(await requireActiveSubscription(user, res))) return;

  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    res.status(400).json({ error: 'Ogiltig JSON.' });
    return;
  }
  const isPdf = typeof body?.pdf === 'string';
  const content = String((isPdf ? body.pdf : body?.image) || '').replace(/^data:[a-z/]+;base64,/, '');
  if (!content || content.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/=]+$/.test(content)) {
    res.status(400).json({ error: 'Filen saknas eller är för stor.' });
    return;
  }
  const features = [{ type: 'DOCUMENT_TEXT_DETECTION' }];
  const imageContext = { languageHints: ['sv', 'en'] };
  const request = isPdf
    ? { inputConfig: { content, mimeType: 'application/pdf' }, features, imageContext, pages: [1] }
    : { image: { content }, features, imageContext };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const response = await fetch(`${isPdf ? VISION_FILE_URL : VISION_IMAGE_URL}?key=${encodeURIComponent(apiKey)}`, {
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
      console.warn('[ocr-vision] Vision svarade med fel:', response.status, result?.error?.message || payload?.error?.message);
      res.status(502).json({ error: 'Reservläsningen svarade inte.' });
      return;
    }
    res.status(200).json({ text: result?.fullTextAnnotation?.text || '' });
  } catch (err) {
    console.warn('[ocr-vision] Anropet misslyckades:', err?.name || err);
    res.status(504).json({ error: 'Reservläsningen tog för lång tid.' });
  } finally {
    clearTimeout(timer);
  }
}
