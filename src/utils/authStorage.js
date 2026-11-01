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

export function getAuthStorage() {
  if (typeof window === 'undefined') return undefined;
  return isStandaloneApp() ? window.localStorage : window.sessionStorage;
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
