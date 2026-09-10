import { applySecurityHeaders } from '../../_security.js';
import { parseJsonBody } from '../../stripe/_parseBody.js';
import { requireAuthedUser, loadOwnedCompany } from '../../_auth.js';
import { checkRateLimit } from '../../_rateLimit.js';
import {
  PROVIDERS, GOOGLE_PROVIDER, guessProvider, publicView, hasEmailSecretKey,
  loadSenderRow, saveSenderRow, deleteSenderRow, encryptSecret, verifySmtp,
} from '../../_smtp.js';
import { hasGoogleOAuth, buildAuthUrl, exchangeCode, signState, verifyState } from '../../_gmail.js';

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
async function handleCreate(req, res, parsedBody) {
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
    const body = parsedBody || {};
    const { domain } = body;
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

// ── Egen avsändaradress (SMTP) ─────────────────────────────────────────
// Ligger i DEN HÄR filen och inte i en egen route av en enda anledning:
// Vercels Hobby-plan tillåter 12 serverlösa funktioner och projektet
// ligger redan på exakt 12. En trettonde fil under api/** får hela
// deployen att misslyckas — samma skäl som create/status en gång slogs
// ihop här (se filkommentaren överst). Grenen väljs på `resource`.
//
// Skiljer sig från domängrenarna på en viktig punkt: den kräver INGEN
// Resend-nyckel. Hela poängen är att fungera för den som inte har någon
// egen domän att verifiera.

/** Vad klienten behöver för att rita formuläret: färdiga serverval per
 *  leverantör, utan hemligheter. */
function providerOptions() {
  return Object.values(PROVIDERS).map(({ id, label, host, port, secure, appPasswordUrl, help }) => ({
    id, label, host, port, secure, appPasswordUrl: appPasswordUrl || null, help,
  }));
}

async function handleSenderStatus(req, res) {
  if (!checkRateLimit(req, res, { key: 'email-sender-status', max: 60 })) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  const companyId = req.query?.company_id;
  if (!companyId) {
    res.status(400).json({ error: 'company_id krävs.' });
    return;
  }
  const companyData = await loadOwnedCompany(user.id, companyId, res);
  if (!companyData) return;

  const { row, error, missingTable } = await loadSenderRow(user.id, companyId);
  if (error) {
    res.status(500).json({ error });
    return;
  }
  res.status(200).json({
    sender: publicView(row),
    providers: providerOptions(),
    // Utan nyckeln kan servern varken kryptera eller dekryptera, och då
    // ska gränssnittet säga det rakt ut i stället för att låta kunden
    // fylla i ett formulär som ändå inte kan sparas.
    configured: hasEmailSecretKey(),
    googleAvailable: hasEmailSecretKey() && hasGoogleOAuth(),
    missingTable: Boolean(missingTable),
  });
}

// ── Google-inloggning ───────────────────────────────────────────────────
// Två steg. Först en signerad startadress (vi skickar aldrig användaren
// vidare från servern — klienten öppnar länken, så sessionen finns kvar).
// Sedan växlas engångskoden in mot en refresh-token som krypteras och
// sparas i samma rad som app-lösenordsvägen använder.
//
// Callback-adressen är /koppla-mejl, en vanlig vy i appen — Google
// tillåter ingen frågesträng i den registrerade adressen, och en egen
// serverlös funktion hade dessutom spräckt 12-funktionsgränsen.
async function handleOauthUrl(req, res, body) {
  if (!checkRateLimit(req, res, { key: 'email-sender-oauth', max: 20 })) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  if (!hasEmailSecretKey() || !hasGoogleOAuth()) {
    res.status(503).json({ error: 'Google-inloggning är inte konfigurerad på servern.' });
    return;
  }
  const companyId = body?.company_id;
  if (!companyId) {
    res.status(400).json({ error: 'company_id krävs.' });
    return;
  }
  const companyData = await loadOwnedCompany(user.id, companyId, res);
  if (!companyData) return;

  // Origin från requesten, inte hårdkodad: samma kod måste fungera på
  // localhost, på förhandsvisningar och skarpt.
  const origin = originOf(req);
  const state = signState({ uid: user.id, cid: companyId });
  res.status(200).json({ url: buildAuthUrl({ state, origin, loginHint: body.loginHint || undefined }) });
}

async function handleOauthExchange(req, res, body) {
  if (!checkRateLimit(req, res, { key: 'email-sender-oauth-exchange', max: 20 })) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  const { code, state } = body || {};
  if (!code || !state) {
    res.status(400).json({ error: 'code och state krävs.' });
    return;
  }
  const claims = verifyState(state);
  if (!claims) {
    res.status(400).json({ error: 'Kopplingen tog för lång tid eller kunde inte verifieras. Försök igen.' });
    return;
  }
  // Den som kopplar MÅSTE vara den som startade. Utan den här kontrollen
  // kan en state:n från någon annans flöde återanvändas för att länka ett
  // Google-konto till fel företag.
  if (claims.uid !== user.id) {
    res.status(403).json({ error: 'Kopplingen hör till en annan inloggning.' });
    return;
  }
  const companyId = claims.cid;
  const companyData = await loadOwnedCompany(user.id, companyId, res);
  if (!companyData) return;

  try {
    const { refreshToken, email } = await exchangeCode(code, originOf(req));
    if (!email) {
      res.status(400).json({ error: 'Kunde inte läsa vilken adress som kopplades. Försök igen.' });
      return;
    }
    const saved = await saveSenderRow(user.id, companyId, {
      provider: GOOGLE_PROVIDER,
      from_email: email,
      from_name: companyData.company?.name || null,
      // host/port/username är NOT NULL i tabellen och används inte i
      // Google-vägen. Vi skriver vad som faktiskt gäller i stället för
      // tomma strängar, så en rad går att förstå vid felsökning.
      host: 'gmail.googleapis.com',
      port: 443,
      secure: true,
      username: email,
      secret: encryptSecret(refreshToken),
      verified_at: new Date().toISOString(),
      last_error: null,
    });
    if (saved.error) {
      const missing = /relation .* does not exist/i.test(saved.error);
      res.status(missing ? 503 : 500).json({
        error: missing
          ? 'Tabellen email_senders saknas i databasen. Kör supabase-setup.sql i Supabase SQL-editorn en gång till.'
          : saved.error,
      });
      return;
    }
    const { row } = await loadSenderRow(user.id, companyId);
    res.status(200).json({ sender: publicView(row) });
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Kunde inte slutföra kopplingen till Google.' });
  }
}

/** Adressen appen faktiskt kördes från — måste vara identisk med den som
 *  användes när koden skapades, annars nekar Google inväxlingen. */
function originOf(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${proto}://${host}` : (process.env.SITE_URL || null);
}

async function handleSenderSave(req, res, body) {
  if (!checkRateLimit(req, res, { key: 'email-sender-save', max: 10 })) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  if (!hasEmailSecretKey()) {
    res.status(503).json({ error: 'Servern saknar EMAIL_SECRET_KEY och kan därför inte spara e-postlösenord säkert.' });
    return;
  }

  const { company_id: companyId, fromEmail, fromName, password } = body || {};
  if (!companyId || !fromEmail || !password) {
    res.status(400).json({ error: 'company_id, fromEmail och password krävs.' });
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(fromEmail).trim())) {
    res.status(400).json({ error: 'Ange en giltig e-postadress.' });
    return;
  }

  const companyData = await loadOwnedCompany(user.id, companyId, res);
  if (!companyData) return;

  // Leverantör: kundens val om det finns, annars gissat ur adressen.
  const providerId = PROVIDERS[body.provider] ? body.provider : guessProvider(fromEmail);
  const preset = PROVIDERS[providerId];
  const host = String(body.host || preset.host || '').trim();
  const port = Number(body.port || preset.port);
  const secure = body.secure === undefined ? preset.secure : Boolean(body.secure);
  // Användarnamnet är nästan alltid adressen, men inte hos alla
  // leverantörer — därför överskrivbart.
  const username = String(body.username || fromEmail).trim();

  if (!host || !port) {
    res.status(400).json({ error: 'Serveradress och port krävs för den här leverantören.' });
    return;
  }

  // Testa inloggningen INNAN något sparas. Ett felaktigt app-lösenord ska
  // upptäckas här, inte första gången en riktig faktura ska iväg.
  const check = await verifySmtp({ host, port, secure, username, password });
  if (!check.ok) {
    res.status(400).json({ error: check.error });
    return;
  }

  const saved = await saveSenderRow(user.id, companyId, {
    provider: providerId,
    from_email: String(fromEmail).trim(),
    from_name: fromName ? String(fromName).trim() : (companyData.company?.name || null),
    host,
    port,
    secure,
    username,
    secret: encryptSecret(password),
    verified_at: new Date().toISOString(),
    last_error: null,
  });
  if (saved.error) {
    // Vanligaste orsaken: tabellen finns inte i den här databasen ännu.
    const missing = /relation .* does not exist/i.test(saved.error);
    res.status(missing ? 503 : 500).json({
      error: missing
        ? 'Tabellen email_senders saknas i databasen. Kör supabase-setup.sql i Supabase SQL-editorn en gång till.'
        : saved.error,
    });
    return;
  }

  const { row } = await loadSenderRow(user.id, companyId);
  res.status(200).json({ sender: publicView(row) });
}

async function handleSenderRemove(req, res, body) {
  if (!checkRateLimit(req, res, { key: 'email-sender-remove', max: 20 })) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  const companyId = body?.company_id;
  if (!companyId) {
    res.status(400).json({ error: 'company_id krävs.' });
    return;
  }
  const companyData = await loadOwnedCompany(user.id, companyId, res);
  if (!companyData) return;

  const result = await deleteSenderRow(user.id, companyId);
  if (result.error) {
    res.status(500).json({ error: result.error });
    return;
  }
  res.status(200).json({ sender: null });
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Egen avsändaradress först: den grenen har inget med Resend att göra
  // och får inte falla på att RESEND_ADMIN_API_KEY saknas.
  if (req.method === 'GET' && req.query?.resource === 'sender') {
    await handleSenderStatus(req, res);
    return;
  }
  if (req.method === 'POST') {
    // Body:n läses EN gång och skickas vidare — parseJsonBody kan inte
    // läsa samma ström två gånger.
    const body = await parseJsonBody(req).catch(() => ({}));
    if (body?.resource === 'sender') {
      if (body.action === 'remove') await handleSenderRemove(req, res, body);
      else if (body.action === 'oauth-url') await handleOauthUrl(req, res, body);
      else if (body.action === 'oauth-exchange') await handleOauthExchange(req, res, body);
      else await handleSenderSave(req, res, body);
      return;
    }
    if (!resendAdminApiKey) {
      res.status(503).json({ error: 'Domänhantering är inte konfigurerat. Sätt RESEND_ADMIN_API_KEY (en Resend-nyckel med Full access) i Vercels miljövariabler.' });
      return;
    }
    await handleCreate(req, res, body);
    return;
  }

  if (!resendAdminApiKey) {
    res.status(503).json({ error: 'Domänhantering är inte konfigurerat. Sätt RESEND_ADMIN_API_KEY (en Resend-nyckel med Full access) i Vercels miljövariabler.' });
    return;
  }
  await handleStatus(req, res);
}
