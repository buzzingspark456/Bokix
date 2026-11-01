// Lägg till företag: företaget ska finnas på riktigt innan en prenumeration
// startar. Kontrollen i webbläsaren går att kringgå, så servern frågar
// Bolagsverket själv med numret ur företagets sparade uppgifter.
//
// Enskilda firmor finns inte hos Bolagsverket (numret är ett personnummer) och
// släpps igenom. Går registret inte att nå släpps kunden också igenom, som i
// _trialGuard.js: en riktig kund ska aldrig nekas på grund av ett nätfel.
import { isBolagsverketConfigured, lookupOrgNumber } from '../_bolagsverket.js';
import { isSoleTraderNumber } from '../../src/utils/fiscalYearSetup.js';
import { normalizeOrgNr } from './_trialGuard.js';

/** { ok: true } eller { ok: false, error } med text som kan visas för kunden. */
export async function checkCompanyInRegistry(orgNr, { configured = isBolagsverketConfigured, lookup = lookupOrgNumber } = {}) {
  const digits = normalizeOrgNr(orgNr);
  if (!digits || isSoleTraderNumber(digits) || !configured()) return { ok: true };
  try {
    const [company] = await lookup(digits);
    if (!company) return { ok: false, error: 'Företaget finns inte hos Bolagsverket. Kontakta support@bokix.se om något är fel.' };
    if (company.active === false) return { ok: false, error: 'Företaget är avregistrerat hos Bolagsverket och kan inte läggas till.' };
    return { ok: true };
  } catch (err) {
    console.warn('[företagskontroll] kunde inte fråga Bolagsverket, släpper igenom:', err.message);
    return { ok: true };
  }
}
