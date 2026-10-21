import { logSystemEvent } from '../_systemEvents.js';
import { applySecurityHeaders } from '../_security.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { requireAuthedUser, loadOwnedOrMemberCompany, requireActiveSubscription, findCompanyEntry } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';
import { hasResendApiKey, sendWithFallback } from '../_resend.js';
import { trySendFromOwnAddress } from '../_smtp.js';
import { createClient } from '@supabase/supabase-js';
import { brandedEmail, emailButton } from '../../src/utils/brandedEmail.js';

// Ägarens egen väntande inbjudan, plus företagets data om den finns (för
// avsändarnamn och egen domän). null om raden inte är ägarens.
async function loadOwnInvite(userId, inviteId) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key);
  const { data: invite } = await admin
    .from('company_members')
    .select('invited_email, company_id, invite_token, role, expires_at')
    .eq('id', inviteId)
    .eq('owner_user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (!invite) return null;
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;
  const { data: row } = await admin.from('user_data').select('state').eq('user_id', userId).maybeSingle();
  return { ...invite, companyData: findCompanyEntry(row?.state?.companies, invite.company_id)?.data || null };
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Inbjudningsmejlet byggs här, inte i webbläsaren: annars kunde vem som
// helst med en egen inbjudningsrad skicka valfri text och bilaga från
// Bokix adress (säkerhetsgranskningen 2026-10-20). Samma text som
// Settings.jsx buildInviteEmailHtml hade.
export function buildInviteEmail({ invite, companyName, inviterName, origin }) {
  const safeCompany = escHtml(companyName) || 'sitt företag';
  const safeInviter = escHtml(inviterName) || 'Någon';
  const roleLabel = invite.role === 'editor' ? 'redigera' : 'se';
  const url = `${origin}/invite?token=${encodeURIComponent(invite.invite_token)}&email=${encodeURIComponent(invite.invited_email)}`;
  return {
    subject: `Du är inbjuden till ${companyName || 'ett företag'} på Bokix`,
    html: brandedEmail({
      title: `Du är inbjuden till ${safeCompany}`,
      body: `
      <p>Hej,</p>
      <p>${safeInviter} har bjudit in dig till <strong>${safeCompany}</strong> på Bokix. Du kommer kunna ${roleLabel} företagets bokföring.</p>
      ${emailButton(url, 'Acceptera inbjudan')}
    `,
      footnote: 'Länken är giltig i 7 dagar. Har du redan ett Bokix-konto loggar du bara in, annars skapar du ett nytt.',
    }),
  };
}

// Speglar POST /api/email/send-invoice i server.js (lokal dev via
// `npm run dev`) — Vercel kör aldrig server.js i produktion, bara filer
// under api/**, så den routen måste finnas här också eller så 404:ar
// "Skicka via e-post" tyst på den riktiga domänen även om nycklarna är
// satta i Vercels miljövariabler.
//
// Sida 33 — två nycklar med olika behörighet: RESEND_API_KEY (sending_access)
// skickar mejlet, RESEND_ADMIN_API_KEY (full_access) används bara för att
// LÄSA en domäns live-status härifrån (sending_access-nycklar kan inte
// hantera/läsa domäner alls).
//
// Namnet är historiskt — bryr sig aldrig om vilket dokument som skickas,
// bara to/subject/html/bilaga, så både Invoices.jsx och Quotes.jsx
// (fakturor OCH offerter) använder samma rutt istället för en egen
// identisk "send-quote"-function (Vercels 12-funktionsgräns, Hobby-plan).
//
// Säkerhetsfix (se säkerhetsgranskningen): den här endpointen hade
// tidigare INGEN inloggningskontroll alls — to/subject/html/bilaga togs
// emot rakt av och skickades via Bokix eget Resend-konto, ett öppet
// mejl-relä som vem som helst kunde missbruka för spam/nätfiske i Bokix
// avsändardomän. Kräver nu en verifierad session, och avsändarnamnet
// (`company`) hämtas nu från företagets EGEN sparade data (antingen den
// inloggade ägarens egen state, eller — för en inbjuden medarbetare på
// ett delat företag — ägarens state via samma medlemskapskoll som
// company-access.js, se loadOwnedOrMemberCompany) istället för att lita
// på ett client-supplied company-objekt — annars kunde man fortfarande
// skicka "från" ett företagsnamn man inte äger eller är medlem i.
export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!(await checkRateLimit(req, res, { key: 'send-invoice', max: 30 }))) return;

  // Ingen BotID-koll längre (main.jsx: initBotId, se filkommentaren där) —
  // requireAuthedUser + ägarskap/medlemskap (loadOwnedOrMemberCompany, se
  // längre ner) är det faktiska skyddet, exakt samma mönster som
  // company-access.js.
  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    const body = await parseJsonBody(req);
    const { invite_id: inviteId } = body || {};
    let { subject, html, replyTo, attachmentBase64, attachmentFilename } = body || {};
    let { to, company_id: companyId } = body || {};

    let companyData;
    let ownerUserId;
    if (inviteId) {
      // Inbjudningsmejl (Settings.jsx). Behörigheten är själva inbjudan:
      // raden måste vara ägarens egen, väntande och inte utgången, och
      // mottagare, ämne och text byggs här från raden. Inget från klienten
      // följer med. Kräver inte att företaget hunnit sparas i user_data,
      // som ett nytt konto ibland inte har.
      if (!await requireActiveSubscription(user, res)) return;
      const invite = await loadOwnInvite(user.id, inviteId);
      if (!invite) {
        await logSystemEvent('email_failed', `Inbjudan ${inviteId}: hittades inte för avsändaren`);
        res.status(404).json({ error: 'Inbjudan hittades inte.' });
        return;
      }
      to = invite.invited_email;
      companyId = invite.company_id;
      ownerUserId = user.id;
      companyData = invite.companyData || {};
      const inviterName = [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ') || user.email;
      const origin = /^https:\/\/(www\.)?bokix\.se$|^http:\/\/localhost(:\d+)?$/.test(String(req.headers?.origin || '')) ? req.headers.origin : 'https://www.bokix.se';
      ({ subject, html } = buildInviteEmail({ invite, companyName: companyData?.company?.name, inviterName, origin }));
      replyTo = undefined;
      attachmentBase64 = undefined;
      attachmentFilename = undefined;
    } else {
      if (!await requireActiveSubscription(user, res)) return;
      if (!to || !companyId) {
        res.status(400).json({ error: 'to, subject, html och company_id krävs.' });
        return;
      }
      const owned = await loadOwnedOrMemberCompany(user.id, companyId, res);
      if (!owned) return;
      ({ companyData, ownerUserId } = owned);
    }

    if (!subject || !html) {
      res.status(400).json({ error: 'to, subject, html och company_id krävs.' });
      return;
    }

    const basePayload = {
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachmentBase64 ? { attachments: [{ filename: attachmentFilename || 'faktura.pdf', content: attachmentBase64 }] } : {}),
    };

    // ── 1. Kundens EGEN adress, om den är kopplad ──
    // Har företaget en verifierad SMTP-avsändare (Inställningar →
    // Fakturautskick) går mejlet genom deras eget mejlkonto: rätt
    // avsändare, deras egen Skickat-mapp, och ingen kostnad för oss.
    // Se api/_smtp.js för hela resonemanget. ownerUserId (inte user.id) —
    // email_senders är nycklad på ÄGARENS id, se loadOwnedOrMemberCompany.
    const own = await trySendFromOwnAddress(ownerUserId, companyId, {
      to,
      subject,
      html,
      replyTo,
      attachmentBase64,
      attachmentFilename,
    });
    if (own.used && own.ok) {
      res.status(200).json({ id: own.id, sentFrom: 'own' });
      return;
    }

    // ── 2. Annars Bokix egen väg ──
    // Hit kommer vi antingen för att ingen egen adress är kopplad, eller
    // för att den just misslyckades. Att låta fakturan gå iväg via
    // systemadressen är alltid bättre än att inte gå iväg alls — kunden
    // ser felet på sin SMTP-inställning i Inställningar.
    if (!hasResendApiKey()) {
      res.status(503).json({
        error: own.used
          ? `Utskicket från din egen adress misslyckades: ${own.error}`
          : 'E-post är inte konfigurerat. Sätt RESEND_API_KEY (och valfritt EMAIL_FROM) i Vercels miljövariabler för att kunna skicka fakturor via e-post.',
      });
      return;
    }

    // Bugkritiskt: ett misslyckat utskick med kundens egen domän försöker
    // automatiskt igen med systemadressen istället för att hela utskicket
    // bara faller — se sendWithFallback i _resend.js.
    const result = await sendWithFallback(basePayload, companyData?.company);

    if (!result.ok) {
      console.error('Resend API error:', result.data);
      await logSystemEvent('email_failed', `Faktura/påminnelse: ${result.data?.message || `Resend svarade ${result.status}`}`);
      res.status(result.status).json({ error: result.data?.message || 'Resend kunde inte skicka e-posten.' });
      return;
    }

    res.status(200).json({ id: result.data.id, sentFrom: 'bokix' });
  } catch (error) {
    console.error('Email send error:', error);
    await logSystemEvent('email_failed', `Faktura/påminnelse: ${error?.message || error}`);
    res.status(500).json({ error: error?.message || 'Kunde inte skicka e-post.' });
  }
}
