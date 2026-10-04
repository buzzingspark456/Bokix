// Cloudflare Turnstile — serverns verifiering av token från Turnstile.jsx.
// Samma hemliga nyckel som ligger i Supabase (Attack Protection), här som
// TURNSTILE_SECRET_KEY i Vercel. Läses vid anrop, inte som modulkonstant
// (se kommentaren om dotenv i contact.js).
export function hasTurnstileSecretKey() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/** { ok: true } eller { ok: false, reason }. Fail-closed vid nätverksfel,
 * samma val som _recaptcha.js av samma skäl. */
export async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: 'not_configured' };
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing_token' };
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== 'unknown') params.set('remoteip', remoteIp);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await res.json().catch(() => ({}));
    if (!data.success) {
      console.warn('Turnstile verification failed:', data['error-codes']);
      return { ok: false, reason: 'verification_failed' };
    }
    return { ok: true };
  } catch (err) {
    console.error('Turnstile siteverify unreachable:', err);
    return { ok: false, reason: 'network_error' };
  }
}
