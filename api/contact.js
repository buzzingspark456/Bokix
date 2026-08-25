import { applySecurityHeaders } from './_security.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { checkRateLimit } from './_rateLimit.js';
import { isRequestFromBot } from './_botid.js';

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
const resendApiKey = process.env.RESEND_API_KEY || null;
const emailFrom = process.env.EMAIL_FROM || 'Bokix <onboarding@resend.dev>';
const CONTACT_INBOX = process.env.CONTACT_INBOX || 'support@bokix.se';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_TOPICS = ['Support', 'Fakturering & pris', 'Säkerhet & integritet', 'Övrigt'];

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

  if (!resendApiKey) {
    res.status(503).json({ error: 'E-post är inte konfigurerat. Sätt RESEND_API_KEY i Vercels miljövariabler för att kunna ta emot kontaktformulär.' });
    return;
  }
  // Striktare gräns än övriga e-postrutter (default max 20) — ett
  // anonymt, oautentiserat formulär är det mest utsatta målet för spam.
  if (!checkRateLimit(req, res, { key: 'contact', max: 5 })) return;

  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

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

    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [CONTACT_INBOX],
        subject: `Kontaktformulär (${topic}) — ${name}`,
        html: buildEmailHtml({ name, email, topic, message }),
        reply_to: email,
      }),
    });
    const data = await result.json().catch(() => ({}));

    if (!result.ok) {
      console.error('Resend API error (contact):', data);
      res.status(result.status).json({ error: data?.message || 'Resend kunde inte skicka e-posten.' });
      return;
    }

    res.status(200).json({ id: data.id });
  } catch (error) {
    console.error('Contact form send error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte skicka e-post.' });
  }
}
