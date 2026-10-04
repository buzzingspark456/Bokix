import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Delade, testbara delar av e-postinkorgen (api/inbox/index.js och
// api/inbox/email.js). Se supabase-2026-10-04-inkorg.sql.

/** Domänen adresserna ligger på. MX-posten pekar på Resend. */
export function getInboxDomain() {
  return (process.env.INBOX_DOMAIN || 'inbox.bokix.se').toLowerCase();
}

// Bara små bokstäver och siffror utan förväxlingsrisk (inga 0/o, 1/l/i).
const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Adressens lokala del: företagsnamnet förkortat plus sju slumptecken,
 * t.ex. "bokixab-k29fq7m". Slumpdelen gör adressen omöjlig att gissa.
 */
export function makeInboxToken(companyName, random = randomBytes(7)) {
  const slug = String(companyName || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 14) || 'foretag';
  const tail = Array.from(random).map(b => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join('');
  return `${slug}-${tail}`;
}

/** "Namn <x@y>" eller "x@y" → lokala delen om domänen stämmer, annars null. */
export function tokenFromAddress(address, domain = getInboxDomain()) {
  const m = /<?([^<>\s@]+)@([^<>\s]+?)>?$/.exec(String(address || '').trim());
  if (!m) return null;
  if (m[2].toLowerCase() !== domain) return null;
  return m[1].toLowerCase();
}

/**
 * Resend signerar webhooks med Svix: HMAC-SHA256 av "id.tidpunkt.kropp" med
 * hemlighetens base64-del (efter "whsec_"). Rubriken kan ha flera signaturer
 * ("v1,abc v1,def"). En tidpunkt mer än fem minuter fel avvisas, så ett
 * uppfångat anrop inte kan skickas igen senare.
 */
export function verifySvixSignature({ id, timestamp, signature }, body, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!id || !timestamp || !signature || !secret || typeof body !== 'string') return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return String(signature).split(' ').some((part) => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_EMAIL = 10;
const ALLOWED_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const EXT_TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Filtypen för en bilaga, eller null om den inte tas emot. */
export function attachmentType(att) {
  const type = String(att?.content_type || '').toLowerCase().split(';')[0].trim();
  if (ALLOWED_TYPES[type]) return type === 'image/jpg' ? 'image/jpeg' : type;
  // Vissa e-postprogram skickar PDF:er som application/octet-stream.
  const ext = String(att?.filename || '').toLowerCase().split('.').pop();
  return EXT_TYPES[ext] || null;
}

/**
 * Bilagorna som ska bli underlag. En liten inbäddad bild (logotypen i
 * avsändarens signatur) är inget kvitto och tas inte med.
 */
export function pickAttachments(list) {
  return (list || [])
    .filter((att) => {
      const type = attachmentType(att);
      if (!type) return false;
      if (typeof att.size === 'number' && att.size > MAX_ATTACHMENT_BYTES) return false;
      const inline = String(att.content_disposition || '').toLowerCase() === 'inline';
      if (type.startsWith('image/') && inline && (typeof att.size !== 'number' || att.size < 40 * 1024)) return false;
      return true;
    })
    .slice(0, MAX_ATTACHMENTS_PER_EMAIL);
}

/** Ett filnamn som går att spara: inga snedstreck, högst 120 tecken. */
export function safeFileName(name, type) {
  const ext = ALLOWED_TYPES[type] || 'bin';
  const base = String(name || '').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[^\p{L}\p{N}._ -]+/gu, '').replace(/^[.\s]+/, '').trim().slice(0, 100) || 'underlag';
  return `${base}.${ext}`;
}

/**
 * Gmail skickar en bekräftelse innan vidarebefordran slås på: "Confirmation
 * code: 123456789" (eller på svenska "Bekräftelsekod"). Koden visas i appen
 * så att användaren kan klistra in den i Gmail.
 */
export function gmailConfirmationCode(from, subject, text) {
  if (!/forwarding-noreply@google\.com/i.test(String(from || ''))) return null;
  const m = /(?:confirmation code|bekr[äa]ftelsekod)\s*:?\s*(\d{6,12})/i.exec(`${subject || ''}\n${text || ''}`)
    || /\(#(\d{6,12})\)/.exec(String(subject || ''));
  return m ? m[1] : null;
}
