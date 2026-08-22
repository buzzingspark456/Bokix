import { supabase } from './supabaseClient';

/** Samma request-mönster som stripeApi.js — en tunn wrapper runt fetch mot
 * backendens egna /api/-rutter, inte mot tredjepartstjänsten direkt (API-
 * nyckeln till Resend ska aldrig hamna i webbläsaren).
 *
 * Säkerhetsfix: skickar nu alltid med den inloggade sessionens access-
 * token — send-invoice.js (se dess egen kommentar) kräver den numera för
 * att veta VEM som skickar, inte bara vad body:n påstår. */
async function requestEmailApi(path, body) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  const response = await fetch(`/api/email/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.error || `E-post-API-fel (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

// Vercels serverless functions har en HÅRD gräns på 4.5MB per request-kropp
// som inte går att höja med kod (till skillnad från Express-gränsen i
// server.js för lokal utveckling) — ett för stort utskick skulle annars
// bara misslyckas med ett kryptiskt "413" efter att redan ha laddat upp
// hela bilagan. Kollar här istället INNAN anropet och ger ett begripligt
// felmeddelande direkt. 4 300 000 tecken bas64 ≈ ~4.3MB, lämnar utrymme
// kvar för resten av JSON-kroppen (html, ämnesrad, m.m.) under 4.5MB-taket.
const MAX_ATTACHMENT_BASE64_LENGTH = 4_300_000;

export async function sendInvoiceEmail(payload) {
  if (payload?.attachmentBase64?.length > MAX_ATTACHMENT_BASE64_LENGTH) {
    throw new Error('Bilagan är för stor för att skickas via e-post (max ~3 MB). Prova att ladda ner PDF:en istället.');
  }
  return requestEmailApi('send-invoice', payload);
}

/** Sida 33, Steg 2 — skapar en avsändardomän hos Resend och returnerar de
 * DNS-poster (SPF/DKIM) företaget ska lägga till hos sin egen
 * domänleverantör. */
export async function createEmailDomain(domain) {
  return requestEmailApi('domains/create', { domain });
}

/** Live-koll av en domäns verifieringsstatus — samma anrop appen gör
 * server-side vid varje utskick, så statusen i Inställningar aldrig visar
 * något annat än vad ett faktiskt utskick just nu skulle använda.
 * `companyId` krävs numera (säkerhetsfix, se status.js) — servern kollar
 * att domänen faktiskt tillhör det företaget innan den svarar. */
export async function getEmailDomainStatus(domainId, companyId) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  const params = new URLSearchParams({ id: domainId, company_id: companyId || '' });
  const response = await fetch(`/api/email/domains/status?${params.toString()}`, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const message = payload?.error || `E-post-API-fel (${response.status})`;
    throw new Error(message);
  }
  return payload;
}
