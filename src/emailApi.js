/** Samma request-mönster som stripeApi.js — en tunn wrapper runt fetch mot
 * backendens egna /api/-rutter, inte mot tredjepartstjänsten direkt (API-
 * nyckeln till Resend ska aldrig hamna i webbläsaren). */
async function requestEmailApi(path, body) {
  const response = await fetch(`/api/email/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

export async function sendInvoiceEmail(payload) {
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
 * något annat än vad ett faktiskt utskick just nu skulle använda. */
export async function getEmailDomainStatus(domainId) {
  const response = await fetch(`/api/email/domains/status?id=${encodeURIComponent(domainId)}`);
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
