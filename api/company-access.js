import { applySecurityHeaders } from './_security.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { requireAuthedUser, loadMemberCompany } from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';
import { createClient } from '@supabase/supabase-js';
import { COMPANY_WRITABLE_FIELDS } from '../src/utils/companyFields.js';

// Enda server-endpointen en INBJUDEN användare (se supabase-setup.sql:
// company_members — ägare + upp till 2 inbjudna = max 3 per företag) någonsin
// pratar med för att läsa/skriva ett delat företags data. En inbjuden
// användare har ALDRIG en egen user_data-rad för det här företaget (blobben
// ligger kvar hos ägaren) och får därför aldrig gå via klientens vanliga
// direkta supabase.from('user_data')-anrop — RLS på user_data tillåter
// fortfarande bara auth.uid() = user_id. Den här filen är den enda platsen
// som får kringgå det, via service-role-nyckeln, och bara efter att ha
// bevisat ett AKTIVT medlemskap (loadMemberCompany i _auth.js).
//
// GET  ?company_id=X          → { company: <hela företagets state-gren>, role }
// POST { company_id, field, value } → sparar ETT fält via set_company_field
//   (samma vitlista av tillåtna fält som SQL-funktionen själv kräver — se
//   supabase-setup.sql). Avvisas med 403 om rollen är 'viewer'.
// POST { action: 'lookup', mode: 'orgnr'|'name', query } → se
//   handleCompanyLookup nedan. En tredje, i grunden orelaterad rutt (slår
//   upp ett företag i FöretagsAPI:s register, rör aldrig company_members
//   eller user_data) klämd in i SAMMA fil av samma skäl som allt annat
//   nedan — Vercels 12-funktionsgräns var redan på 12/12 (räknat i denna
//   fil-kommentar historik, se company-access.js:24 nedan) innan den här
//   lades till, en fjärde separat fil hade inte gått att deploya alls.
// Kräver INGEN inloggning (till skillnad från GET/POST-fälten ovan) —
// Auth.jsx:s registreringsflöde (steg "Ditt företag") behöver kunna slå
// upp företaget INNAN kontot ens finns (supabase.auth.signUp() körs inte
// förrän steg 4, se Auth.jsx:s handleNextStep), det finns alltså ingen
// access-token att skicka med då. Skyddas istället precis som det andra
// oautentiserade formuläret i den här kodbasen (api/contact.js): BotID +
// en egen, striktare rate-limit-bucket (se 'company-lookup' nedan) —
// ingen ägarskaps- eller identitetsfråga att bevisa för "slå upp den här
// texten i ett offentligt register" ändå, så en inloggad anropare
// (Contacts.jsx) skickar fortfarande med sin token av vana, men den
// läses eller krävs aldrig här.
//
// Vercels 12-funktionsgräns (Hobby-plan, se send-invoice.js:21 för samma
// resonemang): GET och POST delar avsiktligt en och samma fil istället för
// två separata endpoints.
const WRITABLE_FIELDS = new Set(COMPANY_WRITABLE_FIELDS);

const FORETAGSAPI_KEY = process.env.FORETAGSAPI_KEY || null;
const FORETAGSAPI_SEARCH_URL = 'https://data.foretagsapi.se/v1/search';

// Krymper FöretagsAPI:s fulla Company-objekt (se openapi.json) till bara de
// fält Kunder/Leverantörer-formulären faktiskt fyller i — aldrig financials,
// sniCodes, trademarks m.m. till klienten. Mindre svar, och ingen risk att
// råkar läcka fält vi aldrig bad om (`include` skickas aldrig med här).
function toCompanySummary(c) {
  return {
    name: c?.name || '',
    orgNumber: c?.orgNumber || '',
    legalForm: c?.legalForm || '',
    street: c?.postalAddress?.street || '',
    postalCode: c?.postalAddress?.postalCode || '',
    city: c?.postalAddress?.city || '',
    active: !c?.deregistrationDate,
  };
}

/** POST { action: 'lookup' }-grenen. `mode: 'orgnr'` slår upp exakt (1 träff
 * eller ingen), `mode: 'name'` fritextsöker (flera kandidater att välja
 * mellan i UI:t). Skriver själv res.status(...) och returnerar — samma
 * anropsmönster som requireAuthedUser m.fl. i _auth.js. */
async function handleCompanyLookup(body, res) {
  if (!FORETAGSAPI_KEY) {
    res.status(503).json({ error: 'Företagsuppslag är inte konfigurerat (FORETAGSAPI_KEY saknas).' });
    return;
  }
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query) {
    res.status(400).json({ error: 'query krävs.' });
    return;
  }

  let requestBody;
  if (body?.mode === 'orgnr') {
    const digits = query.replace(/\D/g, '');
    if (digits.length !== 10) {
      res.status(400).json({ error: 'Organisationsnumret måste vara 10 siffror.' });
      return;
    }
    requestBody = { org_number: digits };
  } else if (body?.mode === 'name') {
    // 1-10 (FöretagsAPI:s eget tak, se openapi.json SearchByNameRequest.limit).
    const limit = Math.min(Math.max(Number(body?.limit) || 5, 1), 10);
    requestBody = { q: query, limit };
  } else {
    res.status(400).json({ error: 'mode måste vara "orgnr" eller "name".' });
    return;
  }

  let apiResponse;
  try {
    apiResponse = await fetch(FORETAGSAPI_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FORETAGSAPI_KEY}` },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    console.error('FöretagsAPI-anrop misslyckades:', error);
    res.status(502).json({ error: 'Kunde inte nå företagsregistret just nu.' });
    return;
  }
  const data = await apiResponse.json().catch(() => ({}));

  if (!apiResponse.ok) {
    // 402 (kontots månadskrediter slut) och 429 (FöretagsAPI:s egen
    // rate-limit, skild från VÅR checkRateLimit ovan) är de enda vi
    // realistiskt stöter på i drift — visas som ett kort, icke-blockerande
    // meddelande i formuläret (se useCompanyLookup.js), aldrig ett krasch.
    if (apiResponse.status === 402) {
      res.status(402).json({ error: 'Företagsuppslaget är slut för den här månaden. Fyll i uppgifterna manuellt.' });
      return;
    }
    if (apiResponse.status === 429) {
      res.status(429).json({ error: 'För många uppslag mot företagsregistret just nu. Försök igen om en stund.' });
      return;
    }
    console.error('FöretagsAPI-fel:', apiResponse.status, data);
    res.status(502).json({ error: 'Kunde inte slå upp företaget just nu.' });
    return;
  }

  const companies = Array.isArray(data?.companies) ? data.companies.map(toCompanySummary) : [];
  res.status(200).json({ companies });
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'company-access', max: 60 })) return;

  // OBS: ingen BotID-koll här längre (till skillnad från main.jsx:s
  // filkommentar, som är föråldrad på den punkten — se rättningen i den
  // filen). api/company-access.js POST är MEDVETET borttagen ur
  // initBotId-listan i main.jsx (den fixen för "hängde permanent") — utan
  // en matchande client-registrering skickar botid/client ALDRIG
  // x-is-human-headern för det här anropet (se dess källa:
  // node_modules/botid/dist/client/core/index.js, `d==null||!l` faller
  // igenom till ett helt orört fetch-anrop). Ett checkBotId()-anrop här
  // trodde vi tidigare bara "larmade i loggen och fail-öppnade" (se
  // _botid.js) — men det gäller bara när checkBotId() KASTAR ett fel.
  // Utan headern klassificerar Vercels riktiga bot-tjänst själva anropet
  // och kan (verifierat i produktion — det här var buggen bakom "Åtkomst
  // nekad" / sökningen funkar inte) landa i isBot:true för helt vanliga
  // användare, ingen kastad exception att fånga. Skyddet den här filens
  // egen kommentar redan pekade på (rate limit ovan för lookup-grenen,
  // requireAuthedUser + loadMemberCompany + role==='editor' för
  // fältsparningen) är det faktiska försvaret — BotID var bara ett extra
  // lager som numera inte kan fungera för den här filen.
  let postBody = null;
  if (req.method === 'POST') {
    // Body läses av här (en gång — req är en ström, kan inte parsas
    // två gånger) EFTERSOM lookup-grenen nedan måste kunna svara INNAN
    // requireAuthedUser körs. Sparas i postBody och återanvänds istället
    // för att parsas igen längre ner för den vanliga company_id/field/
    // value-grenen.
    postBody = await parseJsonBody(req);

    if (postBody?.action === 'lookup') {
      // Egen, striktare bucket än de 60/15 min ovan (som redan kört och
      // godkänt anropet) — FöretagsAPI-nyckeln har en ändlig månadskvot,
      // detta är bara ett golv mot en enskild klient som spammar en varm
      // instans, inte ett riktigt globalt kredit-tak (kräver delad
      // datastore, se _rateLimit.js:s egen kommentar om samma begränsning).
      if (!checkRateLimit(req, res, { key: 'company-lookup', max: 20 })) return;
      try {
        await handleCompanyLookup(postBody, res);
      } catch (error) {
        console.error('company-access lookup error:', error);
        res.status(500).json({ error: error?.message || 'Kunde inte slå upp företaget.' });
      }
      return;
    }
  }

  // Allt annat (GET-hämtning + POST-fältsparning) kräver fortfarande en
  // inloggad, bevisad ägare/medlem — oförändrat, se filkommentaren ovan.
  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const companyId = req.query?.company_id;
      if (!companyId) {
        res.status(400).json({ error: 'company_id krävs.' });
        return;
      }
      const member = await loadMemberCompany(user.id, companyId, res);
      if (!member) return;
      res.status(200).json({ company: member.companyData, role: member.role });
      return;
    }

    // POST (fältsparning) — postBody parsades redan ovan.
    const { company_id: companyId, field, value } = postBody || {};
    if (!companyId || !field || value === undefined) {
      res.status(400).json({ error: 'company_id, field och value krävs.' });
      return;
    }
    if (!WRITABLE_FIELDS.has(field)) {
      res.status(400).json({ error: `Ogiltigt fält: ${field}` });
      return;
    }

    const member = await loadMemberCompany(user.id, companyId, res);
    if (!member) return;
    if (member.role !== 'editor') {
      res.status(403).json({ error: 'Din roll (läsare) tillåter inte att spara ändringar.' });
      return;
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { error: rpcError } = await admin.rpc('set_company_field', {
      p_user_id: member.ownerUserId,
      p_company_id: companyId,
      p_field: field,
      p_value: value,
    });
    if (rpcError) {
      res.status(500).json({ error: rpcError.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('company-access error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte hämta/spara företagsdata.' });
  }
}
