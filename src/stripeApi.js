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

// Bokix egen prenumeration (nivå och pris enligt src/utils/plans.js, 30
// dagars gratis provperiod) — helt separat
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
//
// companyId (betala-per-företag, kundkrav) — utelämnad/null = kontots
// ursprungliga/legacy-abonnemang, precis som innan denna ändring; ett
// riktigt värde riktar avsluta/återaktivera mot just DET företagets EGNA
// abonnemang istället (Settings.jsx: Prenumeration-fliken skickar numera
// alltid det aktiva företagets id).
export async function cancelStripeSubscription(companyId = null, { feedback, comment } = {}) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad för att avsluta prenumerationen.');
  return requestStripeApi('create-subscription-checkout', { action: 'cancel', company_id: companyId || undefined, feedback: feedback || undefined, comment: comment || undefined }, session.access_token);
}

// Byt plan på den befintliga prenumerationen (Inställningar → Ändra plan).
export async function changeStripePlan(planId, companyId = null) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad för att byta plan.');
  return requestStripeApi('create-subscription-checkout', { action: 'change-plan', plan: planId, company_id: companyId || undefined }, session.access_token);
}

export async function reactivateStripeSubscription(companyId = null) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad för att återaktivera prenumerationen.');
  return requestStripeApi('create-subscription-checkout', { action: 'reactivate', company_id: companyId || undefined }, session.access_token);
}

// Stripes Billing Portal (Inställningar → Prenumeration → Betalningsuppgifter
// / Fakturor & kvitton) — samma endpoint/fil igen (Vercel-funktionsgränsen,
// se filkommentaren i _subscriptionCheckout.js). Returnerar en URL att
// omdirigera till, inte en session att montera i appen.
export async function openBillingPortal(companyId = null) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad för att öppna betalningsportalen.');
  const { url } = await requestStripeApi('create-subscription-checkout', { action: 'billing-portal', company_id: companyId || undefined }, session.access_token);
  return url;
}

// Fakturamejl (action 'billing-cc'): utan email läses adressen, annars sparas den ('' tar bort).
export async function billingCcEmail(companyId = null, email) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad.');
  const res = await requestStripeApi('create-subscription-checkout', { action: 'billing-cc', company_id: companyId || undefined, ...(email !== undefined ? { email } : {}) }, session.access_token);
  return res.email || '';
}

export async function getSubscriptionInvoices(companyId = null) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad för att se fakturor och kvitton.');
  const { invoices } = await requestStripeApi('create-subscription-checkout', { action: 'billing-invoices', company_id: companyId || undefined }, session.access_token);
  return invoices;
}

// Hämtar prenumerationen direkt ur Stripe och sparar den i
// public.subscriptions (action 'sync' i _subscriptionCheckout.js). Anropas
// av betalspärren innan den säger "inte betalt", som reserv om webhooken
// inte kommit fram. Returnerar Stripes status, eller null om inget hittades.
export async function syncStripeSubscription({ sessionId = null, companyId = null } = {}) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  const { status } = await requestStripeApi('create-subscription-checkout', { action: 'sync', session_id: sessionId || undefined, company_id: companyId || undefined }, session.access_token);
  return status || null;
}

// Misslyckad betalning (2026-11-27): läget för bannern i appen.
export async function fetchPaymentIssue(companyId = null) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return requestStripeApi('create-subscription-checkout', { action: 'payment-issue', company_id: companyId || undefined }, session.access_token);
}

// Försök igen: drar kortet direkt. Bara ett anrop, inga automatiska omförsök,
// så att ett klick aldrig blir flera dragningar. Servern betalar bara den
// öppna fakturan, så ett dubbelklick drar inte två gånger.
export async function retrySubscriptionPayment(companyId = null) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad.');
  const { response, payload } = await fetchOnce('create-subscription-checkout', { action: 'retry-payment', company_id: companyId || undefined }, session.access_token);
  if (response.status === 429) return { ok: false, reason: 'Du har försökt flera gånger. Vänta några minuter, eller byt kort.' };
  if (!response.ok) throw new Error(payload?.error || 'Kunde inte försöka igen just nu.');
  return payload;
}

/** Betalkortet i appen (2026-11-27): card-info, card-setup och card-save. */
export async function subscriptionCardAction(action, companyId = null, extra = {}) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Du måste vara inloggad.');
  const { response, payload } = await fetchOnce('create-subscription-checkout', { action, company_id: companyId || undefined, ...extra }, session.access_token);
  if (response.status === 429) throw new Error('Du har försökt flera gånger. Vänta några minuter och försök igen.');
  if (!response.ok) throw new Error(payload?.error || 'Det gick inte just nu. Försök igen om en stund.');
  return payload;
}
