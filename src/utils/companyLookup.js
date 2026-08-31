import { supabase } from '../supabaseClient';

// Hur länge ett uppslag väntar på svar innan det ger upp — se motivering
// i requestCompanyLookup nedan. 12s är gott om tid för ett normalt svar
// (FöretagsAPI svarar typiskt inom någon sekund) men kort nog att inte
// kännas som att formuläret hänger sig.
const LOOKUP_TIMEOUT_MS = 12000;

// Samma request-mönster som emailApi.js/stripeApi.js — en tunn wrapper
// runt fetch mot backendens egen /api/company-access, aldrig mot
// data.foretagsapi.se direkt (API-nyckeln ska aldrig hamna i webbläsaren).
// action: 'lookup' delar fil med det befintliga GET/POST-företagsdelnings-
// API:et av samma skäl som allt annat där — se api/company-access.js.
//
// Kundfeedback: ett uppslag hittade företaget första gången, men ett nytt
// försök strax efter blev hängande på "Hämtar företagsuppgifter…" för alltid
// — aldrig vare sig ett resultat eller ett felmeddelande. `fetch()` har
// ANGET default-timeout: om svaret aldrig kommer (t.ex. en anslutning som
// tystnar utan ett riktigt HTTP-svar, se company-access.js:141 om Vercels
// bot-skydd som tidigare gjort precis detta mot den här endpointen) väntar
// löftet för evigt och useCompanyLookup.js:s try/catch får aldrig något att
// fånga. AbortController nedan sätter ett hårt tak så anropet ALLTID
// landar i antingen ett svar eller ett kastat fel inom LOOKUP_TIMEOUT_MS —
// aldrig i limbo.
async function requestCompanyLookup(body) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  let response;
  try {
    response = await fetch('/api/company-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ action: 'lookup', ...body }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Företagsuppslaget tog för lång tid. Försök igen, eller fyll i uppgifterna manuellt.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.error || `Företagsuppslag misslyckades (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

/** Slår upp exakt ETT företag på ett 10-siffrigt organisationsnummer
 * (bindestreck/mellanslag tas bort automatiskt). Returnerar null om
 * numret inte är 10 siffror eller inget företag hittades — aldrig ett
 * kastat fel för "hittades inte", bara för faktiska nätverks-/serverfel. */
export async function lookupCompanyByOrgNumber(orgNumber) {
  const digits = String(orgNumber || '').replace(/\D/g, '');
  if (digits.length !== 10) return null;
  const { companies } = await requestCompanyLookup({ mode: 'orgnr', query: digits });
  return companies?.[0] || null;
}

/** Fritextsökning på företagsnamn (fuzzy, FöretagsAPI:s egen matchning) —
 * returnerar upp till `limit` kandidater att välja mellan i UI:t. */
export async function searchCompaniesByName(name, limit = 5) {
  const query = String(name || '').trim();
  if (query.length < 2) return [];
  const { companies } = await requestCompanyLookup({ mode: 'name', query, limit });
  return companies || [];
}
