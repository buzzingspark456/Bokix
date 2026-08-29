// Egen, liten kopia av api/stripe/_oauthState.js — samma resonemang som
// _cookies.js i den här mappen för varför den inte återanvänds rakt av
// (skild hemlighet per leverantör). Signerad, självverifierande state för
// Zettles OAuth-flöde: CSRF-skydd (jämförs mot en cookie, se _cookies.js)
// PLUS ett innehåll (user_id/company_id) som inte går att förfalska även
// om cookie-kontrollen på något sätt kringgås.
import crypto from 'crypto';

// Läses INTE in som en modul-nivå-konstant — samma "server.js:s dotenv.
// config() körs efter dess imports"-skäl som redan dokumenterat i Stripe-
// varianten av den här filen.
function getSecret() {
  return process.env.ZETTLE_OAUTH_STATE_SECRET || '';
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

export function createSignedState(payload) {
  const secret = getSecret();
  if (!secret) throw new Error('ZETTLE_OAUTH_STATE_SECRET är inte konfigurerad.');
  const data = { ...payload, nonce: crypto.randomBytes(12).toString('hex'), ts: Date.now() };
  const json = base64url(Buffer.from(JSON.stringify(data), 'utf8'));
  const sig = base64url(crypto.createHmac('sha256', secret).update(json).digest());
  return `${json}.${sig}`;
}

/** Returnerar den avkodade payloaden om signaturen stämmer och state:n
 * inte är för gammal, annars null. Anropande kod ansvarar själv för att
 * DESSUTOM jämföra mot cookien — den här funktionen kollar bara att
 * innehållet inte manipulerats. */
export function verifySignedState(state, maxAgeMs = 10 * 60 * 1000) {
  const secret = getSecret();
  if (!secret || !state || typeof state !== 'string' || !state.includes('.')) return null;
  const [json, sig] = state.split('.');
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
