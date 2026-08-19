// Stripes success_url/cancel_url MÅSTE vara fullständiga absoluta URL:er
// (schema + host), annars svarar Checkout-API:et med "Not a valid URL" —
// exakt det som hände i produktion när STRIPE_SUCCESS_URL/STRIPE_CANCEL_URL
// var satta till bara ett domännamn utan "https://" framför. Normaliserar
// istället för att lita på att miljövariabeln alltid är korrekt formad.
// Delad av create-checkout-session.js och create-subscription-checkout.js
// (och deras speglade rutter i server.js).
export function normalizeAbsoluteUrl(raw, fallback) {
  const candidate = (raw || '').trim() || fallback;
  try {
    return new URL(candidate).toString();
  } catch {
    // Saknar schema (t.ex. "bokix.se") — försök igen med https:// framför
    // innan vi ger upp och faller tillbaka på fallback-URL:en.
    try {
      return new URL(`https://${candidate}`).toString();
    } catch {
      return fallback;
    }
  }
}

// URLSearchParams/URL hanterar redan-existerande query-strängar korrekt
// (till skillnad från att bara klistra på "?nyckel=varde" med en
// template-sträng, som gav en trasig URL med två "?" om basen redan hade
// en egen query-del).
export function appendQueryParam(url, key, value) {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}
