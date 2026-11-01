// Företagets registrerade uppgifter: servern hämtar dem själv från Bolagsverket
// och avgör vad som får skrivas. Webbläsaren skickar aldrig in vad registret
// säger, så uppdateringen går inte att fejka.
import { isBolagsverketConfigured, lookupOrgNumber } from './_bolagsverket.js';
import { REGISTRY_FIELDS, isFieldLocked, isRegistryCompany, orgDigits } from '../src/utils/companyRegistry.js';
import { niceCase, formatPostalCode } from '../src/utils/registryText.js';

/** Uppgifterna att skriva, eller null när det inte finns något att hämta.
 * Ett tomt svar från registret skriver aldrig över det som redan står.
 * Momsnumret fylls bara i när det saknas: ett avvikande nummer
 * (gruppregistrering) ska stå kvar. */
export async function registryPatch(company, { configured = isBolagsverketConfigured, lookup = lookupOrgNumber, now = () => new Date() } = {}) {
  if (!isRegistryCompany(company) || !configured()) return null;
  const digits = orgDigits(company.orgNr);
  const [hit] = await lookup(digits);
  if (!hit) return null;
  const wanted = {
    name: hit.name || company.name,
    address: niceCase(hit.street) || company.address,
    postalCode: formatPostalCode(hit.postalCode) || company.postalCode,
    city: niceCase(hit.city) || company.city,
    ...(company.vatRegistered !== false && !company.vatNr ? { vatNr: `SE${digits}01` } : {}),
  };
  const changed = Object.keys(wanted).filter(key => (wanted[key] || '') !== (company[key] || ''));
  return { fields: { ...wanted, registrySyncedAt: now().toISOString() }, changed };
}

/** Namnet och org.numret är företagets identitet och går inte att ändra efter
 * registreringen, för någon företagsform. */
export function companyWriteError(current, next) {
  if (!current?.orgNr) return null;
  if (orgDigits(next?.orgNr) !== orgDigits(current.orgNr)) return 'Organisationsnumret är låst efter registreringen. Kontakta support@bokix.se för att ändra det.';
  if (next?.name !== current.name) return 'Företagsnamnet är låst efter registreringen. Kontakta support@bokix.se för att ändra det.';
  return null;
}

/** Låsta fält behåller sitt sparade värde. Sparas samtidigt något annat, som
 * visningsnamnet, ska det gå igenom även om formuläret bar på gamla värden. */
export function pinRegistryFields(current, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return incoming;
  const out = { ...incoming };
  if (current?.registrySyncedAt) out.registrySyncedAt = current.registrySyncedAt;
  else delete out.registrySyncedAt;
  for (const key of REGISTRY_FIELDS) {
    if (!isFieldLocked(current, key)) continue;
    if (key in current) out[key] = current[key];
    else delete out[key];
  }
  return out;
}
