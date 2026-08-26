import { applySecurityHeaders } from '../_security.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { requireAuthedUser, loadOwnedCompany } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';
import { hasResendApiKey, sendWithFallback } from '../_resend.js';

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
// (`company`) hämtas nu från den inloggade användarens EGEN sparade
// företagsdata istället för att lita på ett client-supplied company-
// objekt — annars kunde man fortfarande skicka "från" ett företagsnamn
// man inte äger.
export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!hasResendApiKey()) {
    res.status(503).json({ error: 'E-post är inte konfigurerat. Sätt RESEND_API_KEY (och valfritt EMAIL_FROM) i Vercels miljövariabler för att kunna skicka fakturor via e-post.' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'send-invoice', max: 30 })) return;

  // Vercel BotID — se filkommentaren i main.jsx.
  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    const body = await parseJsonBody(req);
    const { to, subject, html, replyTo, attachmentBase64, attachmentFilename, company_id: companyId } = body || {};

    if (!to || !subject || !html || !companyId) {
      res.status(400).json({ error: 'to, subject, html och company_id krävs.' });
      return;
    }

    const companyData = await loadOwnedCompany(user.id, companyId, res);
    if (!companyData) return;

    const basePayload = {
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachmentBase64 ? { attachments: [{ filename: attachmentFilename || 'faktura.pdf', content: attachmentBase64 }] } : {}),
    };

    // Bugkritiskt: ett misslyckat utskick med kundens egen domän försöker
    // automatiskt igen med systemadressen istället för att hela utskicket
    // bara faller — se sendWithFallback i _resend.js.
    const result = await sendWithFallback(basePayload, companyData.company);

    if (!result.ok) {
      console.error('Resend API error:', result.data);
      res.status(result.status).json({ error: result.data?.message || 'Resend kunde inte skicka e-posten.' });
      return;
    }

    res.status(200).json({ id: result.data.id });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte skicka e-post.' });
  }
}
