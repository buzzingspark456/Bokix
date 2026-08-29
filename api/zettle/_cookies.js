// Egen, liten kopia av api/stripe/_cookies.js — INTE återanvänd rakt av,
// medvetet: samma cookienamn/hemlighet för två olika leverantörers OAuth-
// flöden skulle låta en Zettle-anslutning och en Stripe-anslutning som
// råkar vara igång samtidigt i samma webbläsare (t.ex. två flikar) skriva
// över varandras state-cookie. Innehållet är annars identiskt — se den
// filens kommentarer för det fulla resonemanget.
export function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    if (!key) return;
    out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

export const ZETTLE_OAUTH_COOKIE = 'bokix_zettle_oauth_state';

export function zettleOauthStateCookie(value) {
  return `${ZETTLE_OAUTH_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; Path=/; Max-Age=600; SameSite=Lax`;
}

export function clearZettleOauthStateCookie() {
  return `${ZETTLE_OAUTH_COOKIE}=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Lax`;
}
