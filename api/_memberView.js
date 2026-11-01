// Vad en inbjuden medlem får se av ägarens företag, och vad den får skriva
// i företagsuppgifterna ('company'-fältet). Säkerhetsgranskningen
// 2026-10-20: medlemmar fick hela företaget, även Zettle-nycklar och
// lönerna när lön stod på Ingen åtkomst, och en redigerare kunde skriva
// över hela företagsobjektet med låst namn/org.nr och kopplingarnas nycklar.
import { ACCESS_PAGES, accessForPage } from '../src/utils/pageAccess.js';

// Hemligheter: samma mönster som arkivet rensar bort (api/_archive.js).
const SECRET_KEY = /token|secret|password|passwd|smtp|oauth|apikey|api_key|credential/i;
// Kopplingarnas identitet. Får synas (appen visar om Stripe och mejldomänen
// är anslutna) men sätts bara av servern och ägaren, aldrig av en medlem.
const CONNECTION_KEYS = new Set(['stripeAccountId', 'emailDomain', 'resendDomainId']);

/** Företagsuppgifterna utan hemligheter. Appen använder bara om Zettle är
 * anslutet, så den nyckeln blir en markering i stället för själva token. */
export function redactCompany(company) {
  if (!company || typeof company !== 'object') return company;
  const out = {};
  for (const [key, val] of Object.entries(company)) {
    if (!SECRET_KEY.test(key)) out[key] = val;
  }
  if (company.zettleAccessToken) out.zettleAccessToken = 'connected';
  // Kalenderlänkens nyckel är det enda som skyddar kalenderflödet.
  if (company.calendar && typeof company.calendar === 'object') {
    const { key: _key, ...rest } = company.calendar;
    out.calendar = rest;
  }
  return out;
}

/** Hela företaget som medlemmen ska få det: fält som bara hör till sidor
 * med Ingen åtkomst tas bort, och företagsuppgifterna rensas. */
export function memberCompanyView(companyData, pageAccess, role) {
  if (!companyData || typeof companyData !== 'object') return companyData;
  const out = { ...companyData };
  if (pageAccess && typeof pageAccess === 'object') {
    const fieldPages = new Map();
    for (const page of ACCESS_PAGES) {
      for (const field of page.fields) {
        fieldPages.set(field, [...(fieldPages.get(field) || []), page.id]);
      }
    }
    for (const [field, pages] of fieldPages) {
      // 'company' behövs överallt (namn, räkenskapsår, moms) och rensas nedan.
      if (field === 'company') continue;
      // Tomma listor i stället för borttagna fält, så appen inte behöver
      // skilja på "inga poster" och "får inte se".
      if (field in out && !pages.some(id => accessForPage(pageAccess, id, role) !== 'none')) {
        if (Array.isArray(out[field])) out[field] = [];
        else delete out[field];
      }
    }
  }
  if (out.company) out.company = redactCompany(out.company);
  return out;
}

// Sätts bara av servern (OAuth-kopplingarna, set_company_stripe_account och
// set_company_zettle_tokens). Samma lista som skyddet i databasen
// (private.guard_user_data_connections).
const SERVER_ONLY_KEYS = ['stripeAccountId', 'zettleAccessToken', 'zettleRefreshToken', 'zettleTokenExpiresAt'];

/** Ägarens sparning av 'company': ägaren får ta bort en koppling (koppla
 * från) men aldrig sätta eller byta den. Ett ändrat värde ersätts med det
 * sparade, precis som databasens skydd gör för inloggade. Granskningen
 * 2026-10-28: ägarvägen i company-access skriver med service-rollen, som
 * databasens skydd släpper förbi. */
export function pinServerConnections(current, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return incoming;
  const base = current && typeof current === 'object' ? current : {};
  const out = { ...incoming };
  for (const key of SERVER_ONLY_KEYS) {
    const val = out[key];
    if (val === undefined || val === null || val === '') continue;
    if (JSON.stringify(val) === JSON.stringify(base[key])) continue;
    if (key in base) out[key] = base[key];
    else delete out[key];
  }
  return out;
}

// En lagringssökväg i data: <konto-id>/<resten>, i klartext eller URL-kodad.
const STORAGE_PATH = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^"\s?#\\]+/gi;

/** Sökvägar i `value` till andras filer (inte i `userId`s egen mapp) som
 * inte redan finns i `visible` (det medlemmen får se av företaget). En
 * inbjuden får länka sina egna uppladdningar och behålla befintliga länkar,
 * men inte skriva in nya länkar till andras filer: fillänkarna
 * (canReadCompanyFile i company-access.js) går efter vad datan nämner.
 * Granskningen 2026-10-28. */
export function foreignStoragePaths(value, visible, userId) {
  let text;
  try { text = JSON.stringify(value ?? null); } catch { return []; }
  const seen = JSON.stringify(visible ?? null);
  const own = String(userId || '').toLowerCase();
  return [...new Set(text.match(STORAGE_PATH) || [])]
    .filter(p => p.slice(0, 36).toLowerCase() !== own && !seen.includes(p));
}

/** En medlems sparning av 'company': medlemmens ändringar läggs på det
 * som finns, men hemligheter, kopplingar, kalendernyckeln och låst
 * namn/org.nr behålls alltid från ägarens version. */
export function mergeMemberCompanyWrite(current, incoming) {
  const base = current && typeof current === 'object' ? current : {};
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return base;
  const out = { ...base };
  for (const [key, val] of Object.entries(incoming)) {
    if (SECRET_KEY.test(key) || CONNECTION_KEYS.has(key)) continue;
    if (key === 'calendar') {
      const { key: _key, ...settings } = val && typeof val === 'object' ? val : {};
      out.calendar = base.calendar?.key ? { ...settings, key: base.calendar.key } : settings;
      continue;
    }
    out[key] = val;
  }
  if (base.orgNr) {
    out.name = base.name;
    out.orgNr = base.orgNr;
  }
  // Inbjudningar pekar på id:t: en medlem får aldrig ändra eller ta bort det.
  if (base.id) out.id = base.id;
  return out;
}
