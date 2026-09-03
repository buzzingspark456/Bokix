import { applySecurityHeaders } from '../../_security.js';
import { parseJsonBody } from '../../stripe/_parseBody.js';
import { requireAuthedUser, loadOwnedCompany } from '../../_auth.js';
import { checkRateLimit } from '../../_rateLimit.js';

// Slog ihop det som tidigare var TVÅ separata filer (create.js POST,
// status.js GET) till en enda — Vercels 12-funktionsgräns (Hobby-plan):
// api/auth/request-password-reset.js knuffade den skarpa deployen till 13
// functions och FICK deployen att misslyckas. Samma "GET+POST i en enda
// handler"-mönster som api/company-access.js redan använder, inte en
// nyuppfunnen lösning.
//
// Varje gren (create/status) behåller sin EGEN ursprungliga
// kontrollordning (rate limit → ev. bot-koll → requireAuthedUser) rakt av
// istället för att lyfta t.ex. requireAuthedUser till en delad plats innan
// grenarna — annars hade VARJE anrop (även ett som ändå skulle
// rate-limitas bort) fått betala för en Supabase-sessionsvalidering
// FÖRST, vilket omintetgör poängen med att rate-limitern (billig,
// in-memory) ligger före de dyrare kollarna.
const resendAdminApiKey = process.env.RESEND_ADMIN_API_KEY || null;

// Säkerhetsfix (se säkerhetsgranskningen): hade tidigare ingen
// inloggningskontroll — vem som helst på internet kunde registrera
// godtyckliga domäner mot Bokix Resend-konto med den priviligierade
// nyckeln. Kräver nu en verifierad session. Ingen ägarskaps-koll mot ett
// specifikt company_id behövs här (till skillnad från status nedan)
// eftersom det här skapar en NY domän, inte läser ut en befintlig.
async function handleCreate(req, res) {
  if (!checkRateLimit(req, res, { key: 'email-domain-create', max: 10 })) return;

  // OBS: ingen BotID-koll här längre (till skillnad från tidigare — se
  // git-historik och main.jsx:s filkommentar, "Anslut domän"-noten).
  // Den här POST-vägen togs bort ur main.jsx:s initBotId-protect-lista av
  // exakt samma skäl som api/company-access.js redan är det: utan en
  // matchande client-registrering skickar botid/client ALDRIG
  // x-is-human-headern, och Vercels riktiga bot-tjänst kan då (utan att
  // checkBotId() kastar något fel — inget för _botid.js:s fail-open att
  // fånga) landa i isBot:true för helt vanliga användare vars
  // utmaningsskript blockerats (annonsblockerare, integritetstillägg,
  // nätverksglapp). Det var den bekräftade orsaken till en kunds "Kunde
  // inte koppla domänen" — inte ett fel hos Resend eller den här servern.
  // requireAuthedUser nedan + rate-limiten ovan är det faktiska skyddet.
  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    const body = await parseJsonBody(req);
    const { domain } = body || {};
    if (!domain || typeof domain !== 'string') {
      res.status(400).json({ error: 'domain krävs.' });
      return;
    }

    const resendRes = await fetch('https://api.resend.com/domains', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendAdminApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });
    const data = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error('Resend domain create error:', data);
      res.status(resendRes.status).json({ error: data?.message || 'Kunde inte skapa domänen hos Resend.' });
      return;
    }

    res.status(200).json({ id: data.id, status: data.status, records: data.records || [] });
  } catch (error) {
    console.error('Domain create error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte skapa domänen.' });
  }
}

// Pollas från Inställningar-sidan, och är samma live-kontroll
// send-invoice.js gör vid varje utskick — aldrig en cachad flagga (se
// Sida 33, bugkritisk-noten).
//
// Säkerhetsfix (se säkerhetsgranskningen): hade tidigare ingen
// inloggningskontroll och läste ut STATUS/DNS-poster för ett godtyckligt
// domän-id utan att kolla vem som frågade eller om domänen ens tillhörde
// den frågande. Kräver nu inloggning OCH att id:t matchar den inloggade
// användarens EGET sparade resendDomainId för angivet company_id. GET
// (läsning) skyddas medvetet INTE av BotID, samma konvention som övriga
// rena läsrutter i den här kodbasen.
async function handleStatus(req, res) {
  if (!checkRateLimit(req, res, { key: 'email-domain-status', max: 60 })) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    const id = req.query?.id;
    const companyId = req.query?.company_id;
    if (!id || !companyId) {
      res.status(400).json({ error: 'id och company_id krävs.' });
      return;
    }

    const companyData = await loadOwnedCompany(user.id, companyId, res);
    if (!companyData) return;
    if (companyData.company?.resendDomainId !== id) {
      res.status(403).json({ error: 'Domänen tillhör inte det här företaget.' });
      return;
    }

    const resendRes = await fetch(`https://api.resend.com/domains/${id}`, {
      headers: { Authorization: `Bearer ${resendAdminApiKey}` },
    });
    const data = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error('Resend domain status error:', data);
      res.status(resendRes.status).json({ error: data?.message || 'Kunde inte hämta domänstatus.' });
      return;
    }

    res.status(200).json({ status: data.status, records: data.records || [] });
  } catch (error) {
    console.error('Domain status error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte hämta domänstatus.' });
  }
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!resendAdminApiKey) {
    res.status(503).json({ error: 'Domänhantering är inte konfigurerat. Sätt RESEND_ADMIN_API_KEY (en Resend-nyckel med Full access) i Vercels miljövariabler.' });
    return;
  }

  if (req.method === 'POST') {
    await handleCreate(req, res);
  } else {
    await handleStatus(req, res);
  }
}
