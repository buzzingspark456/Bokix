import { supabase } from '../supabaseClient';

// Samma request-mönster som emailApi.js/stripeApi.js — en tunn wrapper
// runt fetch mot backendens egen /api/company-access, aldrig mot
// data.foretagsapi.se direkt (API-nyckeln ska aldrig hamna i webbläsaren).
// action: 'lookup' delar fil med det befintliga GET/POST-företagsdelnings-
// API:et av samma skäl som allt annat där — se api/company-access.js.
async function requestCompanyLookup(body) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  const response = await fetch('/api/company-access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action: 'lookup', ...body }),
  });

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
