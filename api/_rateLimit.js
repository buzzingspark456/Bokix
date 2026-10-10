import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { isIpBlocked } from './_abuse.js';

// Rate limiting i två steg:
//  1. Ett minne per serverinstans (som förut). Billigt och stoppar en
//     klient som spammar samma varma instans utan något databasanrop.
//  2. En delad räknare i Supabase (public.hit_rate_limit, se
//     supabase-2026-10-01-skydd.sql). Alla instanser och regioner räknar
//     mot samma rad, så gränsen håller även när anropen sprids över kalla
//     instanser — det minnet ensamt inte klarade.
// Går databasen inte att nå (eller SQL:en är inte körd) gäller bara steg 1:
// hellre ett svagare skydd en stund än att stänga ute riktiga användare.
const buckets = new Map();

let adminClient;
function getAdmin() {
  if (adminClient !== undefined) return adminClient;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  adminClient = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return adminClient;
}

/** Samma anropar-IP-uträkning som checkRateLimit redan gjorde inline —
 * bruten ut hit så andra rutter (t.ex. api/contact.js, som skickar med
 * `remoteip` till Googles reCAPTCHA-verifiering) kan återanvända EXAKT
 * samma logik istället för en tyst tredje kopia. */
export function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  return (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function hitMemory(bucketKey, windowMs, max, now) {
  // Enkel städning så minnet inte växer obegränsat under en lång varm
  // instans — körs bara ibland, inte på varje anrop.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }
  const bucket = buckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

// Svarar null om den delade räknaren inte gick att fråga (då avgör minnet).
async function hitShared(bucketKey, windowMs, max) {
  const admin = getAdmin();
  if (!admin) return null;
  try {
    const rpc = admin.rpc('hit_rate_limit', {
      p_key: bucketKey,
      p_max: max,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
    });
    // Timern rensas efteråt, annars håller den funktionen vid liv i onödan.
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => resolve({ error: new Error('timeout') }), 1500); });
    const { data, error } = await Promise.race([rpc, timeout]).finally(() => clearTimeout(timer));
    if (error || typeof data !== 'boolean') return null;
    return data;
  } catch {
    return null;
  }
}

/** Returnerar (ett promise som blir) true om anropet får fortsätta. Skriver
 * själv ett 429-svar och blir false annars — anropande kod ska bara göra
 * `if (!(await checkRateLimit(req, res, { key: '...' }))) return;` direkt
 * efter applySecurityHeaders(res).
 *
 * `identifier` (valfri): räknar per DEN här strängen istället för
 * anropande IP — t.ex. per e-postadress för
 * api/auth/request-password-reset.js, där hotet är att spamma EN
 * persons inkorg (går runt en IP-baserad gräns genom att bara byta
 * nätverk), inte att en enskild klient översvämmar endpointen. Utelämnad
 * = IP-baserat. Nyckeln hashas innan den sparas, så varken IP-adresser
 * eller e-postadresser hamnar i klartext i databasen. */
export async function checkRateLimit(req, res, { key, windowMs = 15 * 60 * 1000, max = 20, identifier }) {
  // Spärrade adresser (BLOCKED_IPS, se _abuse.js) stoppas här, i den kontroll
  // som alla publika endpoints redan gör.
  if (isIpBlocked(getClientIp(req))) {
    res.status(403).json({ error: 'Åtkomst nekad. Logga in med kontot som har tillgång till företaget, eller be ägaren bjuda in dig.' });
    return false;
  }
  const who = createHash('sha256').update(String(identifier || getClientIp(req))).digest('hex').slice(0, 32);
  const bucketKey = `${key}:${who}`;

  let allowed = hitMemory(bucketKey, windowMs, max, Date.now());
  if (allowed) {
    const shared = await hitShared(bucketKey, windowMs, max);
    if (shared === false) allowed = false;
  }

  if (!allowed) {
    res.status(429).json({ error: 'För många försök. Vänta en stund och försök igen.' });
    return false;
  }
  return true;
}
