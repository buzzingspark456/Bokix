// Generisk signerad, självverifierande token — samma HMAC+timing-safe-
// jämförelse-mönster som api/stripe/_oauthState.js redan bevisat fungerar
// för Stripe Connects OAuth-state, men kopierad hit som en EGEN, orelaterad
// kopia istället för importerad därifrån: den här filen har inget med
// Stripe att göra (används först av signup-e-postverifieringen, se
// api/auth/request-password-reset.js), och en delad `api/stripe/`-fil
// kändes fel att koppla ett helt orelaterat flöde till bara för att spara
// på att skriva samma ~30 rader igen. Hjälpmodul (`_`-prefix) — räknas
// inte mot Vercels 12-funktionsgräns (Hobby-plan, se company-access.js:s
// filkommentar för samma resonemang om den gränsen).
import crypto from 'crypto';

// Läses INTE in som modul-nivå-konstant — se _oauthState.js:s identiska
// kommentar om varför (server.js:s dotenv.config() körs efter importerna).
function getSecret() {
  return process.env.SIGNED_TOKEN_SECRET || '';
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

export function createSignedToken(payload) {
  const secret = getSecret();
  if (!secret) throw new Error('SIGNED_TOKEN_SECRET är inte konfigurerad.');
  const data = { ...payload, nonce: crypto.randomBytes(12).toString('hex'), ts: Date.now() };
  const json = base64url(Buffer.from(JSON.stringify(data), 'utf8'));
  const sig = base64url(crypto.createHmac('sha256', secret).update(json).digest());
  return `${json}.${sig}`;
}

/** Returnerar den avkodade payloaden om signaturen stämmer och token:en
 * inte är för gammal, annars null. */
export function verifySignedToken(token, maxAgeMs = 10 * 60 * 1000) {
  const secret = getSecret();
  if (!secret || !token || typeof token !== 'string' || !token.includes('.')) return null;
  const [json, sig] = token.split('.');
  if (!json || !sig) return null;

  const expectedSig = base64url(crypto.createHmac('sha256', secret).update(json).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(fromBase64url(json).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload?.ts || Date.now() - payload.ts > maxAgeMs) return null;
  return payload;
}
