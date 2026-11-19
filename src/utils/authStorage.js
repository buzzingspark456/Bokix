// ── Var inloggningen sparas ─────────────────────────────────────────────
// I webbläsaren: sessionStorage (kundönskemål: inloggad så länge fliken är
// öppen, ny inloggning nästa gång). Öppnad som app från hemskärmen
// (display-mode standalone, se manifest.webmanifest): localStorage, så att
// man förblir inloggad tills man loggar ut, som i en vanlig app.
//
// Egen liten fil utan Supabase-import, eftersom både supabaseClient.js och
// AppRouter.jsx (som inte får dra in Supabase i marknadsbunten) läser den.
export function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

// "Kom ihåg mig i 7 dagar" (2026-11-19): med kryss sparas inloggningen i
// localStorage och gäller även när webbläsaren stängs, i högst sju dagar
// från inloggningen. Sedan krävs lösenordet igen. Utan kryss: sessionStorage
// som förut. Hemskärmsappen sparar alltid i localStorage.
export const REMEMBER_DAYS = 7;
const REMEMBER_KEY = 'bokix_remember_until';

export function rememberUntil() {
  try { return Number(window.localStorage.getItem(REMEMBER_KEY)) || 0; } catch { return 0; }
}
export function setRemember(on, now = Date.now()) {
  try {
    if (on) window.localStorage.setItem(REMEMBER_KEY, String(now + REMEMBER_DAYS * 86400000));
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch { /* privat läge: då gäller fliken */ }
}
/** Sätter samma sista dag som en annan adress hade (www → app.bokix.se). */
export function setRememberUntil(ts) {
  try { if (Number(ts) > Date.now()) window.localStorage.setItem(REMEMBER_KEY, String(Number(ts))); } catch { /* inget */ }
}
const rememberActive = () => rememberUntil() > Date.now();

// Väljer lagring vid varje anrop, så att kryssrutan gäller redan för den
// inloggning som görs direkt efter att den satts.
const dynamicStorage = {
  getItem(key) {
    if (rememberActive()) return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    // Sju dagar har gått: den sparade inloggningen tas bort, lösenordet krävs.
    if (rememberUntil()) { try { window.localStorage.removeItem(key); window.localStorage.removeItem(REMEMBER_KEY); } catch { /* inget */ } }
    return window.sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (rememberActive()) { window.localStorage.setItem(key, value); window.sessionStorage.removeItem(key); }
    else window.sessionStorage.setItem(key, value);
  },
  removeItem(key) {
    window.sessionStorage.removeItem(key);
    try { window.localStorage.removeItem(key); } catch { /* inget */ }
  },
};

export function getAuthStorage() {
  if (typeof window === 'undefined') return undefined;
  return isStandaloneApp() ? window.localStorage : dynamicStorage;
}

// ── Återställningslänken ("Glömt lösenord?") ─────────────────────────────
// Supabase tömmer adressen och skickar PASSWORD_RECOVERY en enda gång direkt
// efter start, ofta innan App hunnit börja lyssna. Därför läses länken här,
// innan klienten skapas (supabaseClient.js), och minns tills lösenordet är
// bytt. sessionStorage: gäller fliken, och en omladdning ger samma ruta.
const RECOVERY_KEY = 'bokix_password_recovery';

export function rememberRecoveryLink() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  if (!/type=recovery/.test(hash) || !/access_token=/.test(hash)) return;
  try { window.sessionStorage.setItem(RECOVERY_KEY, '1'); } catch { /* blockerad lagring */ }
}

export function isPasswordRecovery() {
  if (typeof window === 'undefined') return false;
  try { return window.sessionStorage.getItem(RECOVERY_KEY) === '1'; } catch { return false; }
}

export function clearPasswordRecovery() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(RECOVERY_KEY); } catch { /* blockerad lagring */ }
}
