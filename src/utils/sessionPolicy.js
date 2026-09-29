// ── Inloggningens livslängd och passkeys ────────────────────────────────
// I appen på hemskärmen är man inloggad tills man loggar ut (se
// authStorage.js). Men en borttappad telefon med en gammal inloggning ska
// inte vara öppen för alltid: har appen inte använts på INACTIVE_DAYS
// dagar loggas man ut och får logga in igen.
//
// Egen liten fil utan Supabase-import, så den går att testa för sig.

export const INACTIVE_DAYS = 30;
const LAST_ACTIVE_KEY = 'bokix_last_active';
const DAY_MS = 86400000;

function readLastActive() {
  try {
    const v = Number(window.localStorage.getItem(LAST_ACTIVE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Kallas när appen används: öppnas, kommer tillbaka i förgrunden, loggas in i. */
export function markActive(now = Date.now()) {
  try { window.localStorage.setItem(LAST_ACTIVE_KEY, String(now)); } catch { /* privat läge */ }
}

/** Glöm tidsstämpeln vid utloggning, så nästa inloggning börjar om. */
export function clearActive() {
  try { window.localStorage.removeItem(LAST_ACTIVE_KEY); } catch { /* privat läge */ }
}

/**
 * Har appen stått oanvänd för länge? Saknas tidsstämpel (första gången
 * efter uppdateringen, eller rensad lagring) räknas det INTE som inaktivt:
 * ingen ska loggas ut av att regeln är ny.
 */
export function isInactiveTooLong(now = Date.now(), lastActive = readLastActive()) {
  if (!lastActive) return false;
  return now - lastActive > INACTIVE_DAYS * DAY_MS;
}

// Passkeys (Face ID, fingeravtryck, Windows Hello) finns i Supabase Auth
// som beta och måste slås på både i Supabase-panelen (Authentication →
// Passkeys) och här, med VITE_PASSKEYS=1 i Vercel. Utan flaggan syns inga
// knappar, så ingen kan klicka på något som inte är påslaget än.
export const PASSKEYS_ENABLED = import.meta.env.VITE_PASSKEYS === '1';

/** Kan den här enheten och webbläsaren använda passkeys, och är de påslagna? */
export function passkeysAvailable() {
  // Finns, inte typeof === 'function': i Safari (WebKit) är det ett objekt.
  return PASSKEYS_ENABLED && typeof window !== 'undefined' && Boolean(window.PublicKeyCredential);
}

// ── Appspärr med Face ID ────────────────────────────────────────────────
// Har man Face ID/fingeravtryck på den här enheten frågar appen efter det
// när den öppnas och när man kommer tillbaka efter en stund, som en bankapp.
// Spärren gäller en användare på en enhet: nyckeln bär användarens id.
const APP_LOCK_KEY = 'bokix_applock';
/** Så här länge får appen ligga i bakgrunden innan den spärras igen. */
export const APP_LOCK_AFTER_MS = 60 * 1000;

export function setAppLock(userId) {
  try {
    if (userId) window.localStorage.setItem(APP_LOCK_KEY, userId);
    else window.localStorage.removeItem(APP_LOCK_KEY);
  } catch { /* privat läge */ }
}

export function appLockEnabledFor(userId) {
  if (!userId || !passkeysAvailable()) return false;
  try { return window.localStorage.getItem(APP_LOCK_KEY) === userId; } catch { return false; }
}

/**
 * Be enheten om Face ID/fingeravtryck med en passkey för bokix.se. En lokal
 * spärr, som en bankapps: den som redan är inloggad visar att det är hen
 * som håller i telefonen. Kastar om det inte gick (eller avbröts).
 */
export async function verifyWithPasskey() {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  const host = window.location.hostname;
  const rpId = host === 'bokix.se' || host.endsWith('.bokix.se') ? 'bokix.se' : host;
  const cred = await navigator.credentials.get({
    publicKey: { challenge, rpId, userVerification: 'required', timeout: 60000 },
  });
  if (!cred) throw new Error('Ingen passkey');
  return true;
}

/** Användaren avbröt Face ID-/fingeravtrycksrutan: inget fel att visa. */
export function isPasskeyCancel(err) {
  const name = err?.name || err?.cause?.name || '';
  const msg = String(err?.message || '');
  return name === 'NotAllowedError' || name === 'AbortError' || /not allowed|aborted|cancel/i.test(msg);
}
