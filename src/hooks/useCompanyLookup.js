import { useCallback, useEffect, useRef, useState } from 'react';
import { lookupCompanyByOrgNumber, searchCompaniesByName } from '../utils/companyLookup';

const NAME_DEBOUNCE_MS = 500;
const NAME_MIN_CHARS = 3;

// Delad autouppslagslogik för Kunder/Leverantörer (Contacts.jsx) och
// registreringens "Ditt företag"-steg (Auth.jsx) — antingen exakt via
// organisationsnummer (10 siffror, ett träff-eller-inte-uppslag) eller
// fritextsökning på namn med en resultatlista att välja mellan. `set` är
// formulärets egen set(key, value)-setter (samma signatur i alla tre
// användningsställena), så hooken bara behöver känna till FÄLTNAMNEN, inte
// hela formulärobjektet eller vilket formulär den används i.
//
// Kundfeedback: ska inte kräva ett extra klick/Enter/blur — hela poängen
// är att slippa kunna organisationsnumret utantill. Så fort 10 siffror är
// ifyllda (handleOrgNrChange, kallas från fältets egen onChange) slår den
// upp automatiskt; namnsökningen (queueNameSearch, samma ställe) körs
// debounced medan man skriver, ingen knapp krävs. searchByName/lookupByOrgNr
// finns kvar odebouncerade också — sökknappen i UI:t använder dem direkt
// för en omedelbar omsökning om något gick fel eller listan känns fel.
//
// Byggd för att aldrig blockera manuell inmatning: både "hittades inte"
// och "krediterna slut för månaden" (402, se api/company-access.js) visas
// bara som en kort, icke-blockerande textrad — formuläret fungerar exakt
// som innan uppslaget fanns om något går fel.
export function useCompanyLookup(set) {
  const [orgLookup, setOrgLookup] = useState({ status: 'idle', message: '' }); // idle|loading|done|error
  const [nameResults, setNameResults] = useState([]);
  const [nameSearch, setNameSearch] = useState({ status: 'idle', message: '' });

  // Förhindrar dubbletter/kapplöpningar utan extra state-omrenderingar:
  // lastOrgNrQueried stoppar ett nytt anrop för SAMMA 10 siffror varje
  // gång onChange fyrar (annars ett anrop per tangenttryck efter den
  // tionde siffran redan skrivits). nameRequestSeq ignorerar ett SVAR som
  // hinner komma tillbaka efter ett senare, mer aktuellt sökanrop (annars
  // kan en snabbt uppskriven kortare sökning "vinna" över resultatet av
  // det man faktiskt hann skriva färdigt).
  const lastOrgNrQueried = useRef('');
  const nameDebounceRef = useRef(null);
  const nameRequestSeq = useRef(0);

  useEffect(() => () => {
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
  }, []);

  const applyCompany = useCallback((company) => {
    if (!company) return;
    set('name', company.name || '');
    set('orgNr', company.orgNumber || '');
    if (company.street) set('address', company.street);
    if (company.postalCode) set('postalCode', company.postalCode);
    if (company.city) set('city', company.city);
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    setNameResults([]);
    setNameSearch({ status: 'idle', message: '' });
  }, [set]);

  const lookupByOrgNr = useCallback(async (rawOrgNr) => {
    const digits = String(rawOrgNr || '').replace(/\D/g, '');
    if (digits.length !== 10) return;
    lastOrgNrQueried.current = digits;
    setOrgLookup({ status: 'loading', message: '' });
    try {
      const company = await lookupCompanyByOrgNumber(digits);
      if (!company) {
        setOrgLookup({ status: 'error', message: 'Inget företag hittades för det organisationsnumret.' });
        return;
      }
      applyCompany(company);
      setOrgLookup({ status: 'done', message: `Uppgifter hämtade: ${company.name}` });
    } catch (error) {
      setOrgLookup({ status: 'error', message: error?.message || 'Kunde inte slå upp organisationsnumret just nu.' });
    }
  }, [applyCompany]);

  // Kallas direkt från org.nummer-fältets onChange (inte bara onBlur) —
  // triggar sig själv så fort 10 siffror är ifyllda, ingen fältväxling
  // krävs. No-op tills dess, och no-op igen om just DE här 10 siffrorna
  // redan slogs upp (fortsatt skrivande efter en lyckad/misslyckad
  // matchning ska inte spamma om samma anrop).
  const handleOrgNrChange = useCallback((rawValue) => {
    const digits = String(rawValue || '').replace(/\D/g, '');
    if (digits.length !== 10 || digits === lastOrgNrQueried.current) return;
    lookupByOrgNr(digits);
  }, [lookupByOrgNr]);

  const searchByName = useCallback(async (name) => {
    const query = String(name || '').trim();
    if (query.length < 2) return;
    const requestId = ++nameRequestSeq.current;
    setNameSearch({ status: 'loading', message: '' });
    try {
      const companies = await searchCompaniesByName(query, 5);
      if (requestId !== nameRequestSeq.current) return; // ett nyare anrop har redan tagit över
      setNameResults(companies);
      setNameSearch(companies.length
        ? { status: 'idle', message: '' }
        : { status: 'error', message: 'Inga företag hittades med det namnet.' });
    } catch (error) {
      if (requestId !== nameRequestSeq.current) return;
      setNameResults([]);
      setNameSearch({ status: 'error', message: error?.message || 'Kunde inte söka just nu.' });
    }
  }, []);

  // Kallas direkt från namn-fältets onChange — väntar NAME_DEBOUNCE_MS
  // efter senaste tangenttryck (avbryter en tidigare väntande sökning om
  // användaren hinner skriva mer under tiden) innan den faktiskt söker,
  // så det inte går ett API-anrop per bokstav.
  const queueNameSearch = useCallback((name) => {
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    const query = String(name || '').trim();
    if (query.length < NAME_MIN_CHARS) {
      nameRequestSeq.current += 1; // ogiltigförklara ett ev. redan pågående svar
      setNameResults([]);
      setNameSearch({ status: 'idle', message: '' });
      return;
    }
    nameDebounceRef.current = setTimeout(() => { searchByName(query); }, NAME_DEBOUNCE_MS);
  }, [searchByName]);

  const clearNameResults = useCallback(() => {
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    setNameResults([]);
    setNameSearch({ status: 'idle', message: '' });
  }, []);

  return {
    orgLookup, lookupByOrgNr, handleOrgNrChange,
    nameResults, nameSearch, searchByName, queueNameSearch,
    applyCompany, clearNameResults,
  };
}
