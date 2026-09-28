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
