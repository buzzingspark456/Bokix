// Gratisverktyget Skanna kvitto (/verktyg/skanna-kvitto): en besökare utan
// konto får sitt FÖRSTA kvitto läst av Google Cloud Vision, samma läsning
// som appen använder. Därefter läses kvitton i webbläsaren (Tesseract).
// Beslut 2026-10-26.
//
// Spärrarna, i den ordning de prövas:
//   1. Rate limit per IP (stoppar en klient som hamrar på endpointen, och
//      spärrade adresser i BLOCKED_IPS).
//   2. Turnstile, osynlig (samma som bokningssidan), när nyckeln är satt.
//   3. En gång per person: räknas på IP-adressen, HMAC-hashad så att den
//      aldrig sparas i klartext, i ett år. IPv6 räknas per /64, eftersom en
//      och samma uppkoppling kan byta adress inom sitt prefix.
//   4. Ett tak per dygn för alla besökare tillsammans (FREE_DAILY_LIMIT).
//   5. Samma månadskvot som appen (_vision.js).
// Går räknarna inte att nå används inte Vision: sidan läser då kvittot i
// webbläsaren i stället, hellre det än en obegränsad räkning från Google.
import { createHmac } from 'crypto';
import { applySecurityHeaders } from './_security.js';
import { checkRateLimit, hitShared, getClientIp } from './_rateLimit.js';
import { hasTurnstileSecretKey, verifyTurnstile } from './_turnstile.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { documentFromBody, readWithVision, MONTHLY_LIMIT, monthQuotaKey, MONTH_WINDOW_MS } from './_vision.js';
import { withSentry } from './_sentry.js';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const FREE_DAILY_LIMIT = Number(process.env.OCR_FREE_DAILY_LIMIT) || 300;

/** Vem besökaren är, för "en gång per person": IPv4 som den är, IPv6 per /64. */
export function visitorKey(ip, secret = process.env.SIGNED_TOKEN_SECRET || '') {
  const raw = String(ip || 'unknown').trim().toLowerCase();
  const normalized = raw.includes(':') ? raw.split(':').slice(0, 4).join(':') : raw;
  return createHmac('sha256', `ocr-free:${secret}`).update(normalized).digest('hex').slice(0, 32);
}

async function handler(req, res) {
  applySecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Googles läsning är inte påslagen.', code: 'off' });
    return;
  }

  if (!(await checkRateLimit(req, res, { key: 'ocr-free', windowMs: 60 * 60 * 1000, max: 10 }))) return;

  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    res.status(400).json({ error: 'Ogiltig JSON.' });
    return;
  }
  const doc = documentFromBody(body);
  if (!doc) {
    res.status(400).json({ error: 'Filen saknas eller är för stor.' });
    return;
  }

  const ip = getClientIp(req);
  if (hasTurnstileSecretKey()) {
    const captcha = await verifyTurnstile(body?.captchaToken, ip);
    if (!captcha.ok) {
      res.status(403).json({ error: 'Kontrollen att du är en människa gick inte igenom.', code: 'captcha' });
      return;
    }
  }

  const once = await hitShared(`ocr-free-once:${visitorKey(ip)}`, YEAR_MS, 1);
  if (once === false) {
    res.status(429).json({ error: 'Gratisläsningen med Google är redan använd.', code: 'used' });
    return;
  }
  if (once !== true) {
    console.warn('[ocr-free] Räknaren (hit_rate_limit) gick inte att nå, Vision används inte.');
    res.status(503).json({ error: 'Googles läsning går inte att använda just nu.', code: 'unavailable' });
    return;
  }

  const day = new Date().toISOString().slice(0, 10);
  if ((await hitShared(`ocr-free-day:${day}`, DAY_MS + 60 * 60 * 1000, FREE_DAILY_LIMIT)) !== true) {
    res.status(429).json({ error: 'Dagens gratisläsningar med Google är slut.', code: 'busy' });
    return;
  }
  if ((await hitShared(monthQuotaKey(), MONTH_WINDOW_MS, MONTHLY_LIMIT)) !== true) {
    res.status(429).json({ error: 'Månadens kvot är slut.', code: 'quota' });
    return;
  }

  const read = await readWithVision(doc, apiKey);
  if (!read.ok) {
    res.status(read.status).json({ error: read.error });
    return;
  }
  res.status(200).json({ text: read.text, lines: read.lines });
}

export default withSentry(handler, '/api/ocr-free');
