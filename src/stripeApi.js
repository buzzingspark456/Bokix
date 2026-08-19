// Statuskoder som troligen är TILLFÄLLIGA — infrastruktur (Vercels edge/
// bot-skydd, ett momentant nätverksglapp) snarare än ett riktigt fel i vår
// egen kod. Vår server-kod returnerar själv aldrig 404 eller 429 — ser vi
// det ändå är det nästan alltid något FRAMFÖR funktionen som svarat, inte
// funktionen själv. Retry:as tyst istället för att direkt visa användaren
// ett kryptiskt "Stripe API error (404)" för något som löser sig av sig
// självt på nästa försök.
const RETRYABLE_STATUSES = new Set([404, 429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [800, 1600];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOnce(path, body) {
  const response = await fetch(`/api/stripe/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  return { response, payload };
}

async function requestStripeApi(path, body) {
  let lastError;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await delay(RETRY_DELAY_MS[attempt - 1]);
    const isLastAttempt = attempt === MAX_ATTEMPTS - 1;

    let response, payload;
    try {
      ({ response, payload } = await fetchOnce(path, body));
    } catch (networkErr) {
      // fetch() själv kastade (nätverksfel, avbrutet anrop) — alltid värt
      // att försöka igen, oavsett vilken status det skulle blivit.
      lastError = networkErr;
      if (isLastAttempt) throw networkErr;
      continue;
    }

    if (response.ok) return payload;

    const message = payload?.error || `Stripe API error (${response.status})`;
    const shouldRetry = RETRYABLE_STATUSES.has(response.status) && !isLastAttempt;
    if (!shouldRetry) throw new Error(message);
    lastError = new Error(message);
  }

  throw lastError || new Error('Stripe API-anropet misslyckades.');
}

export async function createStripeCheckoutSession(payload) {
  return requestStripeApi('create-checkout-session', payload);
}

// Bokix egen plan (99 kr/mån, 30 dagars gratis provperiod) — helt separat
// från createStripeCheckoutSession ovan, som gäller kunders fakturabetalningar
// via ett anslutet Stripe-konto. Se api/stripe/create-subscription-checkout.js.
export async function createStripeSubscriptionCheckout(payload) {
  return requestStripeApi('create-subscription-checkout', payload);
}
