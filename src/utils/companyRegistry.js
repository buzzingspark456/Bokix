// Vilka företag får sina uppgifter från Bolagsverket? Delas av appen och
// servern (api/_companyRegistrySync.js) så att låset är samma regel på båda.
//
// Enskilda firmor finns inte hos Bolagsverket: de skriver sina uppgifter en gång
// i onboardingen och sedan är de låsta, så att ingen kan byta identitet på
// fakturorna. UF-företag och företag utan org.nr har inget att hämta eller låsa.
import { isSoleTraderNumber } from './fiscalYearSetup.js';

// Låsta. Visningsnamnet och momsnumret är fria: Bolagsverket har inget momsnummer
// och ett avvikande nummer (gruppregistrering) ska gå att skriva in. Namnet och
// org.numret låses för sig. F-skatten finns inte hos Bolagsverket utan sätts när företaget läggs
// upp; ett fel rättas av supporten.
export const REGISTRY_FIELDS = ['address', 'postalCode', 'city', 'fSkatt'];

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const orgDigits = (orgNr) => String(orgNr || '').replace(/\D/g, '').slice(-10);

export function isRegistryCompany(company) {
  const digits = orgDigits(company?.orgNr);
  return digits.length === 10 && !isSoleTraderNumber(digits) && !company?.isUf;
}

/** Är fältet låst? Bolag alltid. En enskild firma får fylla i det som saknas
 * (äldre konton), men aldrig ändra det som redan står. */
export function isFieldLocked(company, key) {
  if (!REGISTRY_FIELDS.includes(key) || orgDigits(company?.orgNr).length !== 10 || company?.isUf) return false;
  return isRegistryCompany(company) || Boolean(company?.[key]);
}

/** Högst en kontroll per dygn, bara för ägarens egna företag. */
export function registrySyncDue(entry, now = Date.now()) {
  if (!entry?.company || entry.__shared || entry.__stub) return false;
  if (!isRegistryCompany(entry.company)) return false;
  const last = Date.parse(entry.company.registrySyncedAt || '');
  return !last || now - last >= SYNC_INTERVAL_MS;
}
