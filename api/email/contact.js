import { applySecurityHeaders } from '../_security.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';

// Bugfix: det publika kontaktformuläret (src/components/marketing/
// ContactPage.jsx) postade tidigare till send-invoice.js — men den rutten
// kräver sedan säkerhetsfixen mot öppna mejl-reläer en inloggad session
// OCH ett company_id ägt av den användaren. En besökare som bara vill
// ställa en fråga INNAN de ens skapat konto (kontaktformulärets faktiska
// målgrupp) fick alltså alltid ett 401 "Inloggning krävs." — formuläret
// gick inte att skicka in över huvud taget.
//
// Den här rutten är MEDVETET separat och kräver ingen inloggning: den
// skickar bara till EN fast mottagare (aldrig en client-styrd `to`), så
// den kan inte missbrukas som ett öppet relä oavsett vem som anropar den.
// Bot-check + en snävare rate limit än send-invoice.js (inget kundkonto
// håller tillbaka missbruk här) håller nere spam.
const resendApiKey = process.env.RESEND_API_KEY || null;
const emailFrom = process.env.EMAIL_FROM || 'Bokix <onboarding@resend.dev>';
// Dit kontaktformulärets mejl faktiskt landar. Konfigurerbart via env så
// adressen kan bytas i Vercel utan en kodändring — sätt CONTACT_INBOX_EMAIL
// till support@bokix.se den dagen den inkorgen faktiskt finns och läses;
// fram tills dess samma adress som redan användes hårdkodad här.
const CONTACT_INBOX = process.env.CONTACT_INBOX_EMAIL || 'alwakiabdullah1@gmail.com';

const MAX_FIELD_LENGTH = 5000;

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanField(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

// Bygger mejlets HTML-kropp — samma enkla mall som tidigare låg client-side
// i ContactPage.jsx, flyttad hit så formuläret aldrig behöver skicka en
// färdigbyggd HTML-sträng (mindre yta att validera/missbruka server-side).
function buildEmailHtml({ name, email, topic, message }) {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin: 0 0 16px;">Nytt meddelande från kontaktformuläret</h2>
      <p style="margin: 0 0 4px;"><strong>Namn:</strong> ${esc(name)}</p>
      <p style="margin: 0 0 4px;"><strong>E-post:</strong> ${esc(email)}</p>
      <p style="margin: 0 0 16px;"><strong>Ämne:</strong> ${esc(topic)}</p>
      <p style="margin: 0 0 8px;"><strong>Meddelande:</strong></p>
      <p style="white-space: pre-wrap; margin: 0; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">${esc(message)}</p>
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
    res.status(503).json({ error: 'E-post är inte konfigurerat. Sätt RESEND_API_KEY i Vercels miljövariabler.' });
    return;
  }

  // Striktare tak än send-invoice.js (30/15 min) — den här rutten kräver
  // inget kundkonto, så den är ett bekvämare spammål.
  if (!checkRateLimit(req, res, { key: 'contact', max: 8 })) return;

  // Vercel BotID — se filkommentaren i main.jsx.
  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const name = cleanField(body?.name, 200);
    const email = cleanField(body?.email, 200);
    const topic = cleanField(body?.topic, 100) || 'Övrigt';
    const message = cleanField(body?.message, MAX_FIELD_LENGTH);

    if (!name || !isValidEmail(email) || !message) {
      res.status(400).json({ error: 'Namn, en giltig e-postadress och ett meddelande krävs.' });
      return;
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [CONTACT_INBOX],
        from: emailFrom,
        subject: `Kontaktformulär (${topic}) — ${name}`,
        html: buildEmailHtml({ name, email, topic, message }),
        reply_to: email,
      }),
    });
    const data = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error('Resend API error (contact):', data);
      res.status(resendRes.status).json({ error: data?.message || 'Kunde inte skicka meddelandet.' });
      return;
    }

    res.status(200).json({ id: data.id });
  } catch (error) {
    console.error('Contact email error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte skicka meddelandet.' });
  }
}
