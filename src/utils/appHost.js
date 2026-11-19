// Appen på app.bokix.se, marknadssidorna på www.bokix.se (2026-11-19).
//
// www.bokix.se skickar den som ska in i appen vidare till app.bokix.se:
// inloggning, registrering, länkar i mejl (#access_token), Stripe-återlänkar
// (?subscription_checkout=) och hemskärmsappen (?app=1). Allt i adressen
// följer med. En redan inloggad session på www följer också med (samma
// mekanism som Supabases egna inloggningslänkar: token i adressens hash, som
// aldrig skickas till servern och som supabase-js tar bort direkt), och tas
// sedan bort på www så att samma förnyelsetoken aldrig används två gånger.
//
// APP_HOST_LIVE styr bara vidareskickningen från www. app.bokix.se fungerar
// redan när den är false, så att den går att prova innan alla skickas dit.

export const APP_HOST = 'app.bokix.se';
export const APP_ORIGIN = `https://${APP_HOST}`;
export const SITE_ORIGIN = 'https://www.bokix.se';
export const APP_HOST_LIVE = true;

const host = () => (typeof window === 'undefined' ? '' : window.location.hostname);
export const isAppHost = () => host() === APP_HOST;
export const isMarketingHost = () => ['www.bokix.se', 'bokix.se'].includes(host());

/** Ska www.bokix.se skicka vidare till app.bokix.se? (?apphost=1 provar i en webbläsare.) */
export function shouldForwardToApp() {
  if (!isMarketingHost()) return false;
  if (APP_HOST_LIVE) return true;
  try {
    const q = new URLSearchParams(window.location.search).get('apphost');
    if (q === '1') localStorage.setItem('bokix.appHost', '1');
    if (q === '0') localStorage.removeItem('bokix.appHost');
    return localStorage.getItem('bokix.appHost') === '1';
  } catch { return false; }
}

/**
 * Adressen på app.bokix.se. `intent` = { authMode, plan, uf, invite } från
 * marknadssidornas knappar. `session` = sparad Supabase-session på www.
 */
export function appUrl({ search = '', hash = '', intent = null, session = null } = {}) {
  const params = new URLSearchParams(search);
  params.delete('apphost');
  if (intent?.authMode) params.set('auth', intent.authMode === 'signup' ? 'signup' : 'login');
  if (intent?.plan) params.set('plan', String(intent.plan));
  if (intent?.uf) params.set('uf', '1');
  if (intent?.invite) params.set('invite', '1');
  const qs = params.toString();
  let h = hash || '';
  // Inloggningen följer med, men aldrig ovanpå en inloggningslänk som redan har egna token.
  if (session?.access_token && session?.refresh_token && !/access_token=|error=|type=(recovery|signup|invite)/.test(h)) {
    const p = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: String(Math.max(60, Math.round((Number(session.expires_at || 0) * 1000 - Date.now()) / 1000)) || 3600),
      expires_at: String(session.expires_at || ''),
      token_type: session.token_type || 'bearer',
      type: 'bokix_transfer',
    });
    h = `#${p.toString()}`;
  }
  return `${APP_ORIGIN}/${qs ? `?${qs}` : ''}${h}`;
}

/** Läser bort marknadssidornas avsikt (?auth, ?plan, ?uf, ?invite) på app.bokix.se. */
export function readAppIntent(search) {
  const params = new URLSearchParams(search || '');
  const auth = params.get('auth');
  if (!auth && !params.get('plan') && !params.get('uf') && !params.get('invite')) return null;
  const intent = {
    enterApp: true,
    authMode: auth === 'signup' ? 'signup' : 'login',
    ...(params.get('plan') ? { plan: params.get('plan') } : {}),
    ...(params.get('uf') === '1' ? { uf: true } : {}),
    ...(params.get('invite') === '1' ? { invite: true } : {}),
  };
  ['auth', 'plan', 'uf', 'invite'].forEach(k => params.delete(k));
  return { intent, search: params.toString() ? `?${params.toString()}` : '' };
}

/**
 * app.bokix.se: tar emot inloggningen från www (#…&type=bokix_transfer) och
 * sparar den där supabase-js läser den, innan appen startar. Tar bort den
 * ur adressen. Svarar true om en inloggning togs emot.
 */
export function adoptTransferredSession(storage, key) {
  if (typeof window === 'undefined' || !storage || !key) return false;
  const hash = window.location.hash || '';
  if (!/type=bokix_transfer/.test(hash)) return false;
  const p = new URLSearchParams(hash.slice(1));
  const access = p.get('access_token');
  const refresh = p.get('refresh_token');
  const clean = window.location.pathname + window.location.search;
  window.history.replaceState(window.history.state, '', clean);
  if (!access || !refresh) return false;
  const expiresAt = Number(p.get('expires_at')) || Math.round(Date.now() / 1000) + (Number(p.get('expires_in')) || 3600);
  let user = null;
  try { user = JSON.parse(atob(access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { /* läses av supabase-js */ }
  storage.setItem(key, JSON.stringify({
    access_token: access, refresh_token: refresh, token_type: p.get('token_type') || 'bearer',
    expires_in: Math.max(0, expiresAt - Math.round(Date.now() / 1000)), expires_at: expiresAt,
    user: user ? { id: user.sub, email: user.email, aud: user.aud, role: user.role, app_metadata: user.app_metadata || {}, user_metadata: user.user_metadata || {} } : null,
  }));
  return true;
}
