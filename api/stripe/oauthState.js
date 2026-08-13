// Signerad, självverifierande state-parameter för Stripe Connect OAuth.
//
// Klassisk OAuth-state ska jämföras mot något servern sparade INNAN
// användaren skickades till Stripe (CSRF-skydd — se cookies.js för
// själva sessionsjämförelsen). Den delen kräver en cookie, men cookien
// ensam räcker inte: en angripare som på något sätt kan sätta sin egen
// cookie (t.ex. via en delad dator) skulle annars kunna länka sitt eget
// Stripe-konto till ett offers Bokix-företag. Därför signeras state:n
// också med en hemlig nyckel bara servern känner till, så innehållet
// (user_id/company_id) inte går att förfalska även om cookie-kontrollen
// på något sätt kringgås — försvar i flera lager, inte bara ett.
import crypto from 'crypto';

// Bugkritiskt: läses INTE in som en modul-nivå-konstant vid importtillfället.
// server.js kör `dotenv.config()` efter sina imports (ESM hoistar alla
// imports till toppen, före resten av modulens egen kod) — en konstant
// här skulle då fångas som tom sträng permanent, oavsett vad .env senare
// laddar in. Läses istället färskt vid varje anrop.
function getSecret() {
  return process.env.STRIPE_OAUTH_STATE_SECRET || '';
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
  if (!secret) throw new Error('STRIPE_OAUTH_STATE_SECRET är inte konfigurerad.');
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
