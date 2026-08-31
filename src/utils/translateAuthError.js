// Supabase Auth svarar alltid på ENGELSKA (går inte att sätta om i
// Supabase Dashboard) — men resten av Bokix är på svenska, så ett rått
// Supabase-felmeddelande (t.ex. "For security purposes, you can only
// request this after 6 seconds.") som visas rakt av sticker ut som en
// bugg. Delad mellan klienten (Auth.jsx: handleLogin/signUp-katcherna,
// som pratar direkt med supabase-js) och servern (api/auth/
// request-password-reset.js, som vidarebefordrar Supabase-fel från
// resetPasswordForEmail) — SAMMA fil importerad från båda, ingen risk att
// de två glider isär (se server.js:s kommentar om exakt den sortens bugg).
//
// Mönster-matchning (inte en exakt lookup-tabell): Supabase-meddelanden
// innehåller ofta dynamiska delar (sekunder kvar, m.m.) som måste läsas ut,
// inte bara jämföras. Okänt meddelande → returneras OFÖRÄNDRAT, aldrig
// dolt eller ersatt med något generiskt — ett äkta, oöversatt Supabase-fel
// är fortfarande mer användbart för en användare (och för felsökning) än
// en gissad svensk text som kanske inte stämmer.
const PATTERNS = [
  // "For security purposes, you can only request this after 6 seconds."
  [/for security purposes,?\s*you can only request this after (\d+)\s*seconds?/i,
    (m) => `Av säkerhetsskäl kan du bara begära det här igen om ${m[1]} sekunder.`],
  [/invalid login credentials/i, () => 'Fel e-postadress eller lösenord.'],
  [/user already registered/i, () => 'Det finns redan ett konto med den e-postadressen.'],
  [/email not confirmed/i, () => 'E-postadressen är inte bekräftad än — kolla inkorgen efter bekräftelsemailet.'],
  [/email rate limit exceeded/i, () => 'För många e-postutskick till den adressen just nu. Försök igen om en stund.'],
  [/password should be at least/i, () => 'Lösenordet är för kort.'],
];

export function translateSupabaseAuthError(message) {
  if (typeof message !== 'string' || !message.trim()) return message;
  for (const [pattern, translate] of PATTERNS) {
    const match = pattern.exec(message);
    if (match) return translate(match);
  }
  return message;
}
