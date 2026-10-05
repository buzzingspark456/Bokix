// Bolagsverkets API för värdefulla datamängder: företagsuppslag direkt från
// myndigheten, avgiftsfritt och utan avtal (EU:s HVD-förordning, sedan
// 2025-02-03). Ersätter FöretagsAPI (en privat mellanhand) för uppslag på
// organisationsnummer, se handleCompanyLookup i company-access.js.
//
// Specifikationen är Bolagsverkets egen OpenAPI 3.0.3, hämtad 2026-10-05 ur
// deras utvecklarportal (WSO2):
//   https://portal.api.bolagsverket.se/api/am/devportal/v3/apis/ff8f9a91-1fdd-4705-8836-c1906581162f/swagger
//   POST /organisationer { identitetsbeteckning } → { organisationer: [Organisation] }
//   POST /dokumentlista  { identitetsbeteckning } → { dokument: [{ dokumentId, rapporteringsperiodTom, ... }] }
// Inloggning: OAuth2 client credentials, scope vardefulla-datamangder:read.
// Max 60 anrop per minut för hela Bokix. Det finns INGEN namnsökning, bara
// uppslag på nummer; namnsökningen ligger kvar hos FöretagsAPI.
//
// Nycklar: BOLAGSVERKET_CLIENT_ID och BOLAGSVERKET_CLIENT_SECRET (registrering
// i portalen). Läses vid anrop, inte som modulkonstanter, av samma skäl som
// getForetagsApiKey i company-access.js (dotenv körs efter imports lokalt).

const DEFAULT_BASE = 'https://gw.api.bolagsverket.se';
const base = () => (process.env.BOLAGSVERKET_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');

// Inloggningen ligger på portalen, inte på gw-adressen där API:et finns
// (spec:en säger bara "/oauth2/token"; gw svarar 404, portalen 401 utan
// nycklar, kontrollerat 2026-10-05).
const tokenUrl = () => process.env.BOLAGSVERKET_TOKEN_URL || 'https://portal.api.bolagsverket.se/oauth2/token';

export function isBolagsverketConfigured() {
  return Boolean(process.env.BOLAGSVERKET_CLIENT_ID && process.env.BOLAGSVERKET_CLIENT_SECRET);
}

// Fel med HTTP-status, så att company-access.js kan svara klienten rätt
// (429 = Bolagsverkets egen gräns, 502 = går inte att nå).
export class BolagsverketError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// Token-cache per varm instans. Bolagsverket ger en token med expires_in;
// vi förnyar en minut innan den går ut.
// pendingToken: företaget och dokumentlistan hämtas samtidigt, och utan den
// loggade båda in var för sig vid första uppslaget.
let cachedToken = null;
let pendingToken = null;
export function _resetTokenCache() { cachedToken = null; pendingToken = null; }

async function fetchWithTimeout(url, options, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    throw new BolagsverketError(error?.name === 'AbortError' ? 'Bolagsverket svarade inte i tid.' : 'Kunde inte nå Bolagsverket.', 502);
  } finally {
    clearTimeout(timer);
  }
}

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  if (!pendingToken) pendingToken = requestToken().finally(() => { pendingToken = null; });
  return pendingToken;
}

async function requestToken() {
  const auth = Buffer.from(`${process.env.BOLAGSVERKET_CLIENT_ID}:${process.env.BOLAGSVERKET_CLIENT_SECRET}`).toString('base64');
  const response = await fetchWithTimeout(tokenUrl(), {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: 'grant_type=client_credentials&scope=vardefulla-datamangder%3Aread',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    console.error('Bolagsverket token-fel:', response.status, data?.error || '');
    throw new BolagsverketError('Inloggningen mot Bolagsverket misslyckades.', 502);
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return cachedToken.value;
}

async function post(path, body) {
  const token = await getToken();
  const response = await fetchWithTimeout(`${base()}/vardefulla-datamangder/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 401) cachedToken = null; // nästa anrop hämtar en ny token
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

// Datum kommer som millisekunder sedan 1970 i Bolagsverkets egna exempel,
// trots att schemat säger string. Klarar båda, och ger alltid YYYY-MM-DD.
export function toIsoDate(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' || /^\d{9,}$/.test(String(value))) {
    const d = new Date(Number(value));
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

// Bolagsverkets organisationsform-koder → de förkortningar resten av appen
// använder (utils/orgType.js formatLegalForm). Okänd kod: klartexten visas.
const FORM_CODES = { AB: 'AB', HB: 'HB', KB: 'KB', E: 'EF', EF: 'EF', EK: 'EK', BRF: 'BRF', BF: 'BRF', IF: 'IF', SF: 'SF', FI: 'FI' };

/** Räkenskapsåret ur senaste årsredovisningen: slutdatumet kommer från
 * dokumentlistan, starten är dagen efter samma datum ett år tidigare (ett
 * normalt tolvmånadersår; ett förlängt första år syns inte i listan). */
export function fiscalYearFromDocuments(dokument) {
  const ends = (Array.isArray(dokument) ? dokument : []).map(d => toIsoDate(d?.rapporteringsperiodTom)).filter(Boolean).sort();
  const end = ends.at(-1);
  if (!end) return { fiscalYearStart: '', fiscalYearEnd: '' };
  const [y, m, d] = end.split('-').map(Number);
  const start = new Date(Date.UTC(y - 1, m - 1, d + 1));
  return { fiscalYearStart: start.toISOString().slice(0, 10), fiscalYearEnd: end };
}

/** En Organisation ur Bolagsverkets svar → samma form som FöretagsAPI-träffen
 * hade (toCompanySummary i company-access.js), så formulären inte märker
 * någon skillnad. Varje deluppgift kan ha ett eget `fel` (källan nere) och
 * blir då bara tom, aldrig ett kastat fel. */
export function toSummary(org, fiscal = {}) {
  const names = org?.organisationsnamn?.organisationsnamnLista || [];
  const main = names.find(n => n?.organisationsnamntyp?.kod === 'FORETAGSNAMN') || names[0];
  const form = org?.organisationsform;
  const formCode = String(form?.kod || '').toUpperCase();
  const address = org?.postadressOrganisation?.postadress || {};
  const id = String(org?.organisationsidentitet?.identitetsbeteckning || '').replace(/\D/g, '');
  return {
    name: (main?.namn || '').trim(),
    // Bara siffror, som FöretagsAPI gav; formulären formaterar själva.
    orgNumber: id,
    legalForm: FORM_CODES[formCode] || form?.klartext || '',
    street: (address.utdelningsadress || '').trim(),
    postalCode: String(address.postnummer || '').replace(/\s/g, ''),
    city: (address.postort || '').trim(),
    active: !org?.avregistreradOrganisation?.avregistreringsdatum,
    registrationDate: toIsoDate(org?.organisationsdatum?.registreringsdatum),
    fiscalYearStart: fiscal.fiscalYearStart || '',
    fiscalYearEnd: fiscal.fiscalYearEnd || '',
    // Riktiga svar fyller ut till fem rader med tomma koder ("     ").
    sni: (org?.naringsgrenOrganisation?.sni || []).map(s => ({ code: String(s?.kod || '').trim(), text: String(s?.klartext || '').trim() })).filter(s => s.code),
    source: 'Bolagsverket',
  };
}

/** Slår upp ett organisationsnummer (10 siffror). Returnerar en lista med
 * 0 eller 1 träff (samma form som FöretagsAPI-uppslaget), eller kastar
 * BolagsverketError när registret inte går att nå. */
export async function lookupOrgNumber(digits) {
  // Företaget och årsredovisningslistan hämtas samtidigt; listan är bara
  // ett tillägg (räkenskapsåret) och får fallera utan att uppslaget gör det.
  const [orgRes, docRes] = await Promise.all([
    post('/organisationer', { identitetsbeteckning: digits }),
    post('/dokumentlista', { identitetsbeteckning: digits }).catch(() => null),
  ]);
  if (orgRes.status === 400 || orgRes.status === 404) return [];
  if (orgRes.status === 429) throw new BolagsverketError('För många uppslag mot Bolagsverket just nu. Försök igen om en stund.', 429);
  if (orgRes.status < 200 || orgRes.status >= 300) {
    console.error('Bolagsverket-fel:', orgRes.status, orgRes.data?.title || '', orgRes.data?.requestId || '');
    throw new BolagsverketError('Kunde inte slå upp företaget hos Bolagsverket just nu.', 502);
  }
  const orgs = (orgRes.data?.organisationer || []).filter(o => o && o.organisationsnamn?.fel?.typ !== 'ORGANISATION_FINNS_EJ' && (o.organisationsnamn?.organisationsnamnLista || []).length);
  if (!orgs.length) return [];
  // Flera träffar händer bara för enskilda näringsidkare (flera firmor på
  // samma personnummer); för ett organisationsnummer är det en. Välj den
  // som inte är avregistrerad om det finns en.
  const org = orgs.find(o => !o.avregistreradOrganisation?.avregistreringsdatum) || orgs[0];
  const fiscal = docRes && docRes.status >= 200 && docRes.status < 300 ? fiscalYearFromDocuments(docRes.data?.dokument) : {};
  return [toSummary(org, fiscal)];
}
