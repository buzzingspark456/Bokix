// Felaktiga inloggningsförsök per e-postadress i den här webbläsaren
// (2026-11-19). Efter tre fel visas Glömt lösenord, efter fem spärras
// formuläret en stund. Supabase har sin egen gräns på servern; det här är
// för att visa vad som händer i stället för ett fel i taget.

export const SHOW_FORGOT_AFTER = 3;
export const LOCK_AFTER = 5;
export const LOCK_MINUTES = 15;
const KEY = 'bokix.loginAttempts';

const norm = (email) => String(email || '').trim().toLowerCase();
function read(storage) {
  try { return JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function write(storage, all) {
  try { storage?.setItem(KEY, JSON.stringify(all)); } catch { /* privat läge */ }
}

/** { fails, lockedUntil } för adressen. Spärren släpper av sig själv. */
export function attemptsFor(email, { storage = globalThis.localStorage, now = Date.now() } = {}) {
  const rec = read(storage)[norm(email)];
  if (!rec) return { fails: 0, lockedUntil: 0 };
  if (rec.lockedUntil && rec.lockedUntil <= now) return { fails: 0, lockedUntil: 0 };
  return { fails: rec.fails || 0, lockedUntil: rec.lockedUntil || 0 };
}

export function recordFailure(email, { storage = globalThis.localStorage, now = Date.now() } = {}) {
  const all = read(storage);
  const cur = attemptsFor(email, { storage, now });
  const fails = cur.fails + 1;
  all[norm(email)] = { fails, lockedUntil: fails >= LOCK_AFTER ? now + LOCK_MINUTES * 60000 : 0 };
  write(storage, all);
  return all[norm(email)];
}

export function clearAttempts(email, { storage = globalThis.localStorage } = {}) {
  const all = read(storage);
  delete all[norm(email)];
  write(storage, all);
}

/** Fel lösenord eller e-post (inte nätfel eller för många anrop). */
export function isWrongCredentials(message) {
  return /invalid login credentials|invalid_credentials|felaktig|fel e-post|fel lösenord/i.test(String(message || ''));
}
