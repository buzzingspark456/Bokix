// Klientsidan för Reauthentication (emailad engångskod) inför en känslig
// ändring — se api/auth/request-password-reset.js:s send-reauth-code/
// verify-reauth-code/change-password-grenar för själva logiken. Samma
// tunna fetch-wrapper-mönster som signupVerification.js, men autentiserad
// (Authorization: Bearer <session access_token>) — anroparen är redan
// inloggad, till skillnad från registreringens signup-kod.
async function requestReauth(accessToken, body) {
  const response = await fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
    throw new Error(payload?.error || `Kunde inte kontakta servern (${response.status})`);
  }
  return payload;
}

/** Skickar en sexsiffrig kod till den inloggade användarens egen e-post
 * och returnerar den signerade token:en som måste skickas med (oförändrad)
 * till verifyReauthCode. */
export async function sendReauthCode(accessToken) {
  const { token } = await requestReauth(accessToken, { action: 'send-reauth-code' });
  return token;
}

/** Kollar `code` mot `token` (från sendReauthCode). Returnerar ett
 * kortlivat `reauthToken` — BEVISET att kollen faktiskt godkändes nyss,
 * som de skyddade skrivningarna (changePassword nedan, Företagsuppgifters
 * "Spara ändringar", Stripe-anslutning) kräver. Kastar med ett läsbart
 * meddelande om koden är fel/utgången. */
export async function verifyReauthCode({ accessToken, code, token }) {
  const { reauthToken } = await requestReauth(accessToken, { action: 'verify-reauth-code', code, token });
  return reauthToken;
}

/** Byter lösenord server-side (se filkommentaren i request-password-
 * reset.js:s handleChangePassword för varför server-side, inte klientens
 * egen supabase.auth.updateUser). Kräver ett färskt `reauthToken` från
 * verifyReauthCode. */
export async function changePassword({ accessToken, newPassword, reauthToken }) {
  await requestReauth(accessToken, { action: 'change-password', newPassword, reauthToken });
}
