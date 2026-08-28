// Google reCAPTCHA v2 Invisible — server-sidans verifiering, delad mellan
// api/contact.js (produktion) och server.js:s egen spegling (lokal
// utveckling), samma återanvändnings-princip som _botid.js/_rateLimit.js.
//
// Klassiska siteverify-endpointen, INTE den nyare CreateAssessment
// (Google Cloud reCAPTCHA Enterprise-API:et Google numera rekommenderar
// migrering till): siteverify kräver bara en HEMLIG nyckel och ett enkelt
// POST-anrop, exakt samma "en fetch, inget SDK"-mönster som resten av den
// här kodbasen redan använder (Resend, Stripe raw-API:er där det räcker).
// CreateAssessment kräver ett helt Google Cloud-projekt + service-
// autentisering för en enda kontaktformulärs-rutt — inte värt den extra
// infrastrukturen just nu. Byt om/när Google faktiskt pensionerar
// siteverify (inget datum satt i deras egen dokumentation ännu).
const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY || null;

export function hasRecaptchaSecretKey() {
  return Boolean(recaptchaSecretKey);
}

/** Returnerar { ok: true } eller { ok: false, reason }. Verifierar ALDRIG
 * "OK" bara för att en hemlig nyckel saknas — se anropsstället (api/
 * contact.js) för hur "inte konfigurerat än" hanteras separat och
 * medvetet, samma "fungerar utan konfiguration tills du sätter en nyckel"
 * -princip som Turnstile.jsx redan har på klientsidan. */
export async function verifyRecaptcha(token, remoteIp) {
  if (!recaptchaSecretKey) return { ok: false, reason: 'not_configured' };
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing_token' };

  try {
    const params = new URLSearchParams({ secret: recaptchaSecretKey, response: token });
    if (remoteIp && remoteIp !== 'unknown') params.set('remoteip', remoteIp);

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await verifyRes.json().catch(() => ({}));
    if (!data.success) {
      console.warn('reCAPTCHA verification failed:', data['error-codes']);
      return { ok: false, reason: 'verification_failed' };
    }
    return { ok: true };
  } catch (err) {
    // Nätverksfel mot Google — fail-closed här (till skillnad från
    // isRequestFromBot i _botid.js, som medvetet failar öppen). Motivering:
    // BotID:s egen infrastruktur kan strula ibland och skyddar redan
    // KÄNSLIGA betalnings-/mejlrutter där "släpp igenom" är rätt avvägning
    // — kontaktformuläret har inget annat skydd (ingen inloggning krävs
    // alls) om siteverify skulle vara nere, så fail-closed är rätt val
    // just här: hellre en tillfällig "kunde inte skicka" än ett öppet
    // spam-relä om Google har ett utfall.
    console.error('reCAPTCHA verification request failed:', err);
    return { ok: false, reason: 'network_error' };
  }
}
