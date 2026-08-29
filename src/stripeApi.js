import { supabase } from './supabaseClient';

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

async function fetchOnce(path, body, accessToken) {
  const response = await fetch(`/api/stripe/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
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

async function requestStripeApi(path, body, accessToken) {
  let lastError;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await delay(RETRY_DELAY_MS[attempt - 1]);
    const isLastAttempt = attempt === MAX_ATTEMPTS - 1;

    let response, payload;
    try {
      ({ response, payload } = await fetchOnce(path, body, accessToken));
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
  // Ingen Authorization-header här med avsikt — den som betalar en faktura
  // är kundens KUND, inte ett inloggat Bokix-konto. Servern (create-checkout-
  // session.js) räknar själv om belopp/rader från den lagrade fakturan i
  // stället för att lita på klienten, se kommentaren där.
  return requestStripeApi('create-checkout-session', payload);
}

// Bokix egen plan (99 kr/mån, 30 dagars gratis provperiod) — helt separat
// från createStripeCheckoutSession ovan, som gäller kunders fakturabetalningar
// via ett anslutet Stripe-konto. Se api/stripe/create-subscription-checkout.js.
//
// Skickar med access_token om det finns en aktiv session (t.ex. anropet
// från PaymentRequiredGate.jsx, en redan inloggad användare) — servern
// kräver den om kontot redan har en subscriptions-rad, se säkerhets-
// kommentaren i create-subscription-checkout.js. Direkt efter signUp()
// (Auth.jsx) finns ofta ingen session än (kräver bekräftad e-post beroende
// på Supabase-projektets inställning) — då skickas anropet utan token,
// precis som förut, och servern tillåter det eftersom kontot är helt nytt.
export async function createStripeSubscriptionCheckout(payload) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  return requestStripeApi('create-subscription-checkout', payload, session?.access_token);
}

// Avsluta/återaktivera Bokix egen prenumeration (Inställningar →
// Prenumeration) — samma endpoint/fil som createStripeSubscriptionCheckout
// ovan (server-kommentaren i create-subscription-checkout.js förklarar
// varför: Vercels 12-funktionsgräns), skiljs bara på body.action. Kräver
// alltid en inloggad session — till skillnad från checkout-anropet ovan
// finns ingen legitim anropspunkt utan en.
export async function cancelStripeSubscription() {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad för att avsluta prenumerationen.');
  return requestStripeApi('create-subscription-checkout', { action: 'cancel' }, session.access_token);
}

export async function reactivateStripeSubscription() {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad för att återaktivera prenumerationen.');
  return requestStripeApi('create-subscription-checkout', { action: 'reactivate' }, session.access_token);
}
