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

// agiReports hör till lönen men står inte under någon sida i ACCESS_PAGES.
const EXTRA_FIELD_PAGE = { agiReports: 'payroll' };

/** Hela företaget som medlemmen ska få det: fält som bara hör till sidor
 * med Ingen åtkomst tas bort, och företagsuppgifterna rensas. */
export function memberCompanyView(companyData, pageAccess, role) {
  if (!companyData || typeof companyData !== 'object') return companyData;
  const out = { ...companyData };
  if (pageAccess && typeof pageAccess === 'object') {
    const fieldPages = new Map(Object.entries(EXTRA_FIELD_PAGE).map(([f, p]) => [f, [p]]));
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
  return out;
}
