import { createClient } from '@supabase/supabase-js';
import { logSystemEvent } from './_systemEvents.js';
import { applySecurityHeaders } from './_security.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { checkRateLimit, getClientIp } from './_rateLimit.js';
import { hasRecaptchaSecretKey, verifyRecaptcha } from './_recaptcha.js';

// Kontaktformuläret på den publika marknadssajten (ContactPage.jsx) —
// egen rutt, INTE en återanvändning av /api/email/send-invoice. Den
// rutten kräver en inloggad Supabase-session + company_id (se
// requireAuthedUser i _auth.js), vilket en anonym besökare på /kontakt
// aldrig har — formuläret fick därför alltid 401 "Inloggning krävs."
// tillbaka och kunde aldrig skicka något, oavsett vad besökaren skrev.
//
// Precis för att den HÄR rutten uttryckligen INTE kräver inloggning
// (måste inte, en besökare som mejlar oss är inte kund än) tar den
// aldrig emot `to`/`html` från klienten som send-invoice gör — mottagare
// och e-postens HTML byggs alltid här på servern av validerade fält.
// Annars vore det exakt det öppna mejl-reläet som säkerhetsgranskningen
// (se kommentaren i send-invoice.js) redan en gång stängde igen.
// Läses INTE in som modul-nivå-konstanter — samma gotcha som _resend.js/
// _signedToken.js/company-access.js:s getForetagsApiKey/create-
// subscription-checkout.js:s getStripe redan har en identisk kommentar
// om: server.js:s dotenv.config() körs EFTER sina egna imports. Den här
// filen importerades tidigare aldrig direkt av server.js (som hade en
// egen handkopierad /api/contact-rutt) — när server.js:s /api/contact
// byttes till att importera PRODUKTIONSFILEN direkt blev de här konstanterna
// plötsligt permanent `null`/sina fallback-värden i lokal utveckling,
// trots en korrekt ifylld .env ("E-post är inte konfigurerat" även med
// nyckeln på plats). Fungerade ändå hela tiden i produktion.
function getResendApiKey() {
  return process.env.RESEND_API_KEY || null;
}
function getEmailFrom() {
  return process.env.EMAIL_FROM || 'Bokix <onboarding@resend.dev>';
}
function getContactInbox() {
  return process.env.CONTACT_INBOX || 'support@bokix.se';
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 'Felrapport' — den inloggade appens "Rapportera fel" (App.jsx), inte
// bara den publika kontaktsidans egna ämnen. Samma rutt, samma
// oautentiserade väg (kräver inte requireAuthedUser — se filkommentaren
// högst upp), en inloggad avsändare skickar bara med sina egna
// namn/e-post redan ifyllda istället för att behöva skriva dem.
const ALLOWED_TOPICS = ['Support', 'Fakturering & pris', 'Säkerhet & integritet', 'Felrapport', 'Övrigt'];

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

// Id för det sparade meddelandet, eller null om det inte gick att spara.
async function saveContactMessage(row) {
  try {
    const client = adminClient();
    if (!client) return null;
    const { data, error } = await client.from('contact_messages').insert(row).select('id').single();
    return error ? null : data.id;
  } catch {
    return null;
  }
}

async function markContactEmailSent(id) {
  try { await adminClient()?.from('contact_messages').update({ email_sent: true }).eq('id', id); } catch { /* bara en markering */ }
}

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildEmailHtml({ name, email, topic, message }) {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #0f172a; line-height: 1.6;">
      <p><strong>Namn:</strong> ${esc(name)}</p>
      <p><strong>E-post:</strong> ${esc(email)}</p>
      <p><strong>Ämne:</strong> ${esc(topic)}</p>
      <p><strong>Meddelande:</strong></p>
      <p style="white-space: pre-wrap;">${esc(message)}</p>
    </div>
  `;
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const resendApiKey = getResendApiKey();
  // Striktare gräns än övriga e-postrutter (default max 20) — ett
  // anonymt, oautentiserat formulär är det mest utsatta målet för spam.
  if (!checkRateLimit(req, res, { key: 'contact', max: 5 })) return;

  // Ingen BotID-koll längre (main.jsx: initBotId, se filkommentaren där) —
  // reCAPTCHA nedan (när RECAPTCHA_SECRET_KEY är satt) plus den striktare
  // rate-limiten ovan (5, mot övriga rutters 10-30) är det faktiska,
  // robusta skyddet för det här publika, oautentiserade formuläret.
  try {
    const body = await parseJsonBody(req);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const topic = ALLOWED_TOPICS.includes(body?.topic) ? body.topic : 'Övrigt';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!name || !email || !message) {
      res.status(400).json({ error: 'Namn, e-post och meddelande krävs.' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Ogiltig e-postadress.' });
      return;
    }

    // Bara om en hemlig nyckel faktiskt är satt (RECAPTCHA_SECRET_KEY) —
    // samma "fungerar utan konfiguration tills du skaffat nycklar"-princip
    // som Turnstile.jsx redan har på klientsidan, så en installation utan
    // reCAPTCHA-nycklar (eller ett Playwright-test, se e2e/contact.spec.js)
    // inte går sönder bara för att widgeten aldrig renderades.
    if (hasRecaptchaSecretKey()) {
      const { ok } = await verifyRecaptcha(body?.recaptchaToken, getClientIp(req));
      if (!ok) {
        res.status(400).json({ error: 'Kunde inte verifiera att du inte är en robot. Ladda om sidan och försök igen.' });
        return;
      }
    }

    // Sparas först i admin-panelens Inkorg (contact_messages), så att inget
    // meddelande försvinner om mejlet inte går iväg. Saknas tabellen eller
    // nyckeln fortsätter det som förut, med bara mejlet.
    const saved = await saveContactMessage({ name, email, topic, message });

    if (!resendApiKey) {
      if (saved) { res.status(200).json({ id: saved }); return; }
      res.status(503).json({ error: 'E-post är inte konfigurerat. Sätt RESEND_API_KEY i Vercels miljövariabler för att kunna ta emot kontaktformulär.' });
      return;
    }

    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: [getContactInbox()],
        subject: `Kontaktformulär (${topic}) — ${name}`,
        html: buildEmailHtml({ name, email, topic, message }),
        reply_to: email,
      }),
    });
    const data = await result.json().catch(() => ({}));

    if (!result.ok) {
      console.error('Resend API error (contact):', data);
      await logSystemEvent('contact_email_failed', data?.message || `Resend svarade ${result.status}`);
      // Meddelandet finns i Inkorgen, så för avsändaren har det gått fram.
      if (saved) { res.status(200).json({ id: saved }); return; }
      res.status(result.status).json({ error: data?.message || 'Resend kunde inte skicka e-posten.' });
      return;
    }

    if (saved) await markContactEmailSent(saved);
    res.status(200).json({ id: data.id });
  } catch (error) {
    console.error('Contact form send error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte skicka e-post.' });
  }
}
