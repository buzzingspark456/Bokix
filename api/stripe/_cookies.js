// Minimal cookie-hantering utan extra beroende (t.ex. `cookie-parser`) —
// bara det de två OAuth-endpointsen faktiskt behöver: läsa in cookien
// state:n ska jämföras mot, och sätta/rensa den.
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

export const STRIPE_OAUTH_COOKIE = 'bokix_stripe_oauth_state';

// Secure: cookien saknade tidigare flaggan — utan den skickas den även över
// vanlig http://, inte bara https://. Ofarligt i praktiken på Vercel (allt
// är https i produktion), men ett gratis extra lager mot en nätverksnivå-
// nedgradering. `Secure` fungerar även på http://localhost (webbläsare
// behandlar localhost som en "secure context" oavsett schema), så lokal
// dev via server.js påverkas inte.
export function stripeOauthStateCookie(value) {
  return `${STRIPE_OAUTH_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; Path=/; Max-Age=600; SameSite=Lax`;
}

export function clearStripeOauthStateCookie() {
  return `${STRIPE_OAUTH_COOKIE}=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Lax`;
}
