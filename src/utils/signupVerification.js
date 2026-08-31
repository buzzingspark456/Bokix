// Klientsidan för registreringens "Bekräfta e-post"-steg (Auth.jsx) — se
// api/auth/request-password-reset.js:s send-signup-code/verify-signup-code
// -grenar för själva logiken (varför den filen, trots namnet, och varför
// ingen riktig Supabase-session skapas här). Samma tunna
// fetch-wrapper-mönster som companyLookup.js.
async function requestVerification(body) {
  const response = await fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Kunde inte kontakta servern (${response.status})`);
  }
  return payload;
}

/** Skickar en sexsiffrig kod till `email` och returnerar den signerade
 * token:en som måste skickas med (oförändrad) till verifySignupCode. */
export async function sendSignupCode(email) {
  const { token } = await requestVerification({ action: 'send-signup-code', email });
  return token;
}

/** Kollar `code` mot `token` (från sendSignupCode). Kastar med ett
 * läsbart meddelande om koden är fel/utgången — kastar aldrig "tyst". */
export async function verifySignupCode({ email, code, token }) {
  await requestVerification({ action: 'verify-signup-code', email, code, token });
}
