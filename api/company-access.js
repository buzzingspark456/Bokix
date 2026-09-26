import { applySecurityHeaders } from './_security.js';
import { canWriteField } from '../src/utils/pageAccess.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { requireAuthedUser, loadMemberCompany, requireActiveSubscription, requireOwnerPaidAccess, hasPaidAccess, isFreeEmail } from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';
import { createClient } from '@supabase/supabase-js';
import { COMPANY_WRITABLE_FIELDS } from '../src/utils/companyFields.js';

// Huvudsakligen till för en INBJUDEN användare (se supabase-setup.sql:
// company_members — ägare + upp till 2 inbjudna = max 3 per företag) att
// läsa/skriva ett delat företags data. En inbjuden användare har ALDRIG en
// egen user_data-rad för det här företaget (blobben ligger kvar hos
// ägaren) och får därför aldrig gå via klientens vanliga direkta
// supabase.from('user_data')-anrop — RLS på user_data tillåter fortfarande
// bara auth.uid() = user_id. Den här filen är den enda platsen som får
// kringgå det, via service-role-nyckeln, och bara efter att ha bevisat ett
// AKTIVT medlemskap (loadMemberCompany i _auth.js).
//
// ÄGAREN sparar normalt sett ALDRIG via den här filen (skriver direkt mot
// sin egen user_data-rad, RLS räcker där) — MED ETT UNDANTAG: field==='company'
// (Settings.jsx:s "Spara ändringar"-knapp för Företagsuppgifter) går hit
// ÄVEN för ägaren, eftersom just den skrivningen måste kunna spärra namn/
// org.nummer server-side (se låset längre ner) — något en ren klient-
// skrivning mot user_data aldrig kan göra. POST-grenen provar därför en
// ägar-snabbväg (egen user_data-rad) FÖRE loadMemberCompany.
//
// GET  ?company_id=X          → { company: <hela företagets state-gren>, role }
// POST { company_id, field, value } → sparar ETT fält via
//   set_company_field (samma vitlista av tillåtna fält som SQL-funktionen
//   själv kräver — se supabase-setup.sql). Avvisas med 403 om rollen är
//   'viewer', eller (bara för field==='company', ägaren själv) om
//   värdet försöker ändra ett redan låst namn/org.nummer.
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

// Läses INTE in som modul-nivå-konstant — samma gotcha som _signedToken.js/
// _oauthState.js redan har en identisk kommentar om: server.js:s
// dotenv.config() körs EFTER sina egna imports (ES-moduler kör hela det
// importerade modul-kroppen innan importörens egen kod, dotenv.config()
// inkluderad). Den här filen importerades tidigare aldrig direkt av
// server.js (som hade en egen handkopierad FORETAGSAPI_KEY-konstant,
// deklarerad EFTER sin egen dotenv.config()-rad och därför opåverkad) —
// när server.js:s /api/company-access byttes till att importera
// PRODUKTIONSFILEN direkt (se den kommentaren) blev en modul-nivå-konstant
// här plötsligt `null` för alltid i lokal utveckling, trots en korrekt
// ifylld .env ("FORETAGSAPI_KEY saknas" även med nyckeln på plats).
// Fungerade ändå hela tiden i produktion (Vercel injicerar env-variabler
// innan modulen ens laddas, inget dotenv/körordning inblandat där).
function getForetagsApiKey() {
  return process.env.FORETAGSAPI_KEY || null;
}
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
    // För förslaget på räkenskapsår när ett företag läggs upp
    // (FiscalYearVatFields.jsx): senaste årsredovisningens period, och
    // registreringsdatumet för ett nytt företag utan årsredovisning än.
    registrationDate: c?.registrationDate || '',
    fiscalYearStart: c?.financials?.fiscalYearStart || '',
    fiscalYearEnd: c?.financials?.fiscalYearEnd || '',
  };
}

// Momsregistrering: FöretagsAPI har inte uppgiften, men Skatteverket
// rapporterar svenska momsregistreringsnummer (SE + org.nr + 01) till EU:s
// VIES, som har ett öppet REST-API utan nyckel. Bara VALID/INVALID räknas
// som svar; allt annat (medlemslandets tjänst nere, timeout) blir ett fel
// så att klienten frågar användaren i stället för att gissa "inte registrerat".
const VIES_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms/SE/vat/';

async function handleVatLookup(body, res) {
  const digits = String(body?.query || '').replace(/\D/g, '');
  if (digits.length !== 10) {
    res.status(400).json({ error: 'Organisationsnumret måste vara 10 siffror.' });
    return;
  }
  const vatNr = `SE${digits}01`;
  // VIES svarar ibland tillfälligt MS_UNAVAILABLE eller
  // MS_MAX_CONCURRENT_REQ; ett andra försök räcker oftast.
  let data;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${VIES_URL}${digits}01`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      data = await response.json().catch(() => ({}));
    } catch (error) {
      console.error('VIES-anrop misslyckades:', error?.name || error);
      data = null;
    } finally {
      clearTimeout(timeout);
    }
    if (data?.userError === 'VALID' || data?.userError === 'INVALID') break;
    if (attempt === 0) await new Promise(r => setTimeout(r, 600));
  }
  if (data?.userError !== 'VALID' && data?.userError !== 'INVALID') {
    console.error('VIES gav inget svar:', data?.userError);
    res.status(502).json({ error: 'Momsregistret går inte att nå just nu.' });
    return;
  }
  res.status(200).json({ registered: data.isValid === true, vatNr, name: data.isValid ? (data.name || '') : '' });
}

/** POST { action: 'lookup' }-grenen. `mode: 'orgnr'` slår upp exakt (1 träff
 * eller ingen), `mode: 'name'` fritextsöker (flera kandidater att välja
 * mellan i UI:t). Skriver själv res.status(...) och returnerar — samma
 * anropsmönster som requireAuthedUser m.fl. i _auth.js. */
async function handleCompanyLookup(body, res) {
  if (body?.mode === 'vat') {
    await handleVatLookup(body, res);
    return;
  }
  const foretagsApiKey = getForetagsApiKey();
  if (!foretagsApiKey) {
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${foretagsApiKey}` },
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
      // Betalar ägaren? Annars låser appen företaget för medlemmen direkt, i
      // stället för att låta hen redigera och sedan få sparfel (databasen
      // stoppar skrivningar när ägaren inte betalar, se has_paid_access).
      // Kan det inte avgöras räknas ägaren som betalande (hasPaidAccess).
      const url = process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const ownerPaid = url && key ? await hasPaidAccess(createClient(url, key), member.ownerUserId) : true;
      res.status(200).json({ company: member.companyData, role: member.role, pageAccess: member.pageAccess || null, ownerPaid });
      return;
    }

    // POST — Signerade URL:er för privata filer (bokix-uploads).
    // Även utgångna prenumerationer har laglig rätt att läsa sina sparade filer (7 år).
    if (postBody?.action === 'signed_url') {
      const { path } = postBody;
      // Bara den privata underlagsbucketen. Arkivet (bokix-arkiv) och andra
      // buckets har egna regler och ska aldrig kunna signeras härifrån.
      const bucket = 'bokix-uploads';
      if (postBody.bucket && postBody.bucket !== bucket) {
        res.status(400).json({ error: 'Ogiltig bucket.' });
        return;
      }
      if (!path || typeof path !== 'string' || path.includes('..') || path.startsWith('/')) {
        res.status(400).json({ error: 'Ogiltig sökväg.' });
        return;
      }
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        res.status(503).json({ error: 'Lagring är inte konfigurerad på servern.' });
        return;
      }
      const admin = createClient(supabaseUrl, serviceRoleKey);

      // Verifiera att anroparen äger sökvägen, är aktiv medlem i ägarens företag, eller är admin
      const pathOwnerId = path.split('/')[0];
      const isOwner = pathOwnerId === user.id;
      let isAllowed = isOwner || isFreeEmail(user.email);
      if (!isAllowed) {
        const { data: member } = await admin
          .from('company_members')
          .select('id')
          .eq('member_user_id', user.id)
          .eq('owner_user_id', pathOwnerId)
          .eq('status', 'active')
          .maybeSingle();
        if (member) isAllowed = true;
      }
      if (!isAllowed) {
        res.status(403).json({ error: 'Åtkomst nekad till denna fil.' });
        return;
      }
      const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 3600);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ signedUrl: data.signedUrl });
      return;
    }

    // POST (fältsparning) — postBody parsades redan ovan. Betalkontrollen
    // görs längre ner, när vi vet om anroparen är ägaren (egen prenumeration)
    // eller en inbjuden medlem (ägarens prenumeration).
    const { company_id: companyId, field, value } = postBody || {};
    if (!companyId || !field || value === undefined) {
      res.status(400).json({ error: 'company_id, field och value krävs.' });
      return;
    }
    if (!WRITABLE_FIELDS.has(field)) {
      res.status(400).json({ error: `Ogiltigt fält: ${field}` });
      return;
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Ägar-snabbväg, provas FÖRE loadMemberCompany: den funktionen letar
    // bara i company_members, dit ägaren själv aldrig läggs (se filens
    // kommentar högst upp — ägaren har sin egen rad i user_data direkt,
    // ingen medlemskapsrad att slå upp). Ägaren sparar annars ALLTID
    // direkt via klientens egen supabase.from('user_data')-anrop
    // (App.jsx:s updateCompanyField) — förutom just 'company'-fältet, som
    // Settings.jsx skickar hit istället EFTERSOM namn/org.nummer-låset
    // (se nedan) måste kunna verifieras server-side, vilket ett rent
    // klient-anrop aldrig kan.
    let ownerUserId = null;
    let ownerCompanyData = null;
    {
      const { data: ownRow, error: ownRowError } = await admin.from('user_data').select('state').eq('user_id', user.id).maybeSingle();
      if (ownRowError) {
        res.status(500).json({ error: ownRowError.message });
        return;
      }
      const existing = ownRow?.state?.companies?.[companyId];
      if (existing) { ownerUserId = user.id; ownerCompanyData = existing; }
    }

    if (ownerUserId) {
      if (!await requireActiveSubscription(user, res)) return;
      // Låst registrerat företagsnamn: en gång satt (dvs. orgNr är ifyllt —
      // se Settings.jsx:s kommentar om varför just orgNr är signalen "riktig
      // registrering genomförd", inte en egen flagga) går namnet inte att
      // ändra härifrån längre — kontakta support är den enda vägen. Servern
      // är den RIKTIGA spärren (ett rått
      // API-anrop kan aldrig kringgå den), Settings.jsx:s låsta UI är bara
      // återspeglingen av samma regel. Fritt fram att sätta namnet FÖRSTA
      // gången (tomt orgNr = oavslutad registrering, se "Jag har inget
      // företag än" i Auth.jsx) — det är precis vad Settings.jsx:s
      // "Slutför din företagsregistrering"-flöde gör.
      if (field === 'company' && ownerCompanyData?.orgNr && value?.name !== ownerCompanyData?.name) {
        res.status(403).json({ error: 'Företagsnamnet är låst efter registreringen. Kontakta support@bokix.se för att ändra det.' });
        return;
      }
      // …och organisationsnumret av exakt samma skäl. Det är företagets
      // identitet i allt appen skickar vidare: fakturor, momsdeklarationen
      // och AGI:n till Skatteverket, SIE-exporten till revisorn,
      // bolagsuppslagen. Ett ändrat org.nummer på en befintlig bokföring är
      // aldrig en rättelse — det är ett annat företag — så det går inte att
      // skriva om härifrån. Fritt fram FÖRSTA gången
      // (tomt orgNr = oavslutad registrering), precis som namnet ovan.
      if (field === 'company' && ownerCompanyData?.orgNr && value?.orgNr !== ownerCompanyData?.orgNr) {
        res.status(403).json({ error: 'Organisationsnumret är låst efter registreringen. Kontakta support@bokix.se för att ändra det.' });
        return;
      }
    } else {
      const member = await loadMemberCompany(user.id, companyId, res);
      if (!member) return;
      if (member.role !== 'editor') {
        res.status(403).json({ error: 'Din roll (läsare) tillåter inte att spara ändringar.' });
        return;
      }
      if (!await requireOwnerPaidAccess(member.ownerUserId, res)) return;
      // Sidbehörigheter (company_members.page_access): kontrollen som gör
      // dem verkliga. Klienten döljer sidor, men det är HÄR skrivningen
      // faktiskt stoppas — en dold meny är ingen behörighet. Saknas listan
      // (alla inbjudningar gjorda innan behörigheterna fanns) släpps allt
      // igenom precis som förut.
      if (!canWriteField(member.pageAccess, field, member.role)) {
        res.status(403).json({ error: 'Du har inte behörighet till den delen av företaget.' });
        return;
      }
      ownerUserId = member.ownerUserId;
    }

    const { error: rpcError } = await admin.rpc('set_company_field', {
      p_user_id: ownerUserId,
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
