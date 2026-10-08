import { createClient } from '@supabase/supabase-js';
import { logSystemEvent } from './_systemEvents.js';
import { applySecurityHeaders } from './_security.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { checkRateLimit, getClientIp } from './_rateLimit.js';
import { hasRecaptchaSecretKey, verifyRecaptcha } from './_recaptcha.js';
import { hasTurnstileSecretKey, verifyTurnstile } from './_turnstile.js';
import {
  BOOKING_TOPIC, BOOKING_MODES, isValidSlot, formatSlot, bookingMessage,
  slotFromMessage, bookingIcs, stockholmToday,
} from '../src/utils/demoBooking.js';

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

// Inloggad avsändare (appens Rapportera fel) eller null. Appen visar ingen
// reCAPTCHA, så en giltig Supabase-session får räcka som robotkontroll.
async function sessionUser(req) {
  const header = req.headers['authorization'] || '';
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return null;
  try {
    const { data, error } = await createClient(url, anonKey).auth.getUser(token);
    return error ? null : data?.user || null;
  } catch {
    return null;
  }
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

// ── Bokning av genomgång (/boka-genomgang, BookingPage.jsx) ──
// Samma rutt och samma Inkorg som kontaktformuläret, ämne "Genomgång".
// Tiden står på första raden i meddelandet ("Tid: 2026-10-06 10:00") och
// läses tillbaka därifrån för att visa upptagna tider.
async function takenSlots() {
  const client = adminClient();
  if (!client) return [];
  const since = new Date(Date.now() - 45 * 86400000).toISOString();
  const { data, error } = await client
    .from('contact_messages')
    .select('message')
    .eq('topic', BOOKING_TOPIC)
    .gte('created_at', since);
  if (error || !data) return [];
  const today = stockholmToday();
  return data
    .map(r => slotFromMessage(r.message))
    .filter(s => s && s.slice(0, 10) > today);
}

function buildBookingHtml({ name, email, slot, mode, company, phone, note }) {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #0f172a; line-height: 1.6;">
      <p><strong>Tid:</strong> ${esc(formatSlot(slot))}</p>
      <p><strong>Form:</strong> ${esc(BOOKING_MODES[mode])}</p>
      <p><strong>Namn:</strong> ${esc(name)}</p>
      <p><strong>E-post:</strong> ${esc(email)}</p>
      ${company ? `<p><strong>Företag:</strong> ${esc(company)}</p>` : ''}
      ${phone ? `<p><strong>Telefon:</strong> ${esc(phone)}</p>` : ''}
      ${note ? `<p><strong>Meddelande:</strong></p><p style="white-space: pre-wrap;">${esc(note)}</p>` : ''}
    </div>
  `;
}

function buildBookerHtml({ name, slot, mode }) {
  const how = mode === 'phone'
    ? 'Vi ringer dig på numret du angav.'
    : 'Vi mejlar en länk till videomötet innan dess.';
  return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #0f172a; line-height: 1.6;">
      <p>Hej ${esc(name.split(' ')[0])},</p>
      <p>Tack för din bokning. Vi ses <strong>${esc(formatSlot(slot))}</strong> för en genomgång av Bokix, cirka 30 minuter. ${how}</p>
      <p>Passar tiden inte längre? Svara på det här mejlet så hittar vi en ny.</p>
      <p>Hälsningar<br/>Bokix</p>
    </div>
  `;
}

async function sendEmail(apiKey, payload) {
  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await result.json().catch(() => ({}));
  return { ok: result.ok, status: result.status, data };
}

async function handleBooking(req, res, body) {
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const company = typeof body?.company === 'string' ? body.company.trim().slice(0, 160) : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim().slice(0, 40) : '';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 2000) : '';
  const mode = body?.mode === 'phone' ? 'phone' : 'video';
  const slot = typeof body?.slot === 'string' ? body.slot : '';

  if (!name || !email) { res.status(400).json({ error: 'Namn och e-post krävs.' }); return; }
  if (!EMAIL_RE.test(email)) { res.status(400).json({ error: 'Ogiltig e-postadress.' }); return; }
  if (mode === 'phone' && !/\d{6,}/.test(phone.replace(/\D/g, ''))) {
    res.status(400).json({ error: 'Skriv ett telefonnummer så att vi kan ringa dig.' });
    return;
  }
  if (!isValidSlot(slot)) { res.status(400).json({ error: 'Tiden går inte att boka. Välj en annan.' }); return; }

  if (hasTurnstileSecretKey()) {
    const { ok } = await verifyTurnstile(body?.captchaToken, getClientIp(req));
    if (!ok) {
      res.status(400).json({ error: 'Kunde inte verifiera att du inte är en robot. Försök igen.' });
      return;
    }
  }

  if ((await takenSlots()).includes(slot)) {
    res.status(409).json({ error: 'Någon hann boka den tiden precis. Välj en annan.', taken: true });
    return;
  }

  const saved = await saveContactMessage({
    name, email, topic: BOOKING_TOPIC,
    message: bookingMessage({ slot, mode, company, phone, note }),
  });

  const resendApiKey = getResendApiKey();
  if (!resendApiKey) {
    if (saved) { res.status(200).json({ id: saved }); return; }
    res.status(503).json({ error: 'Bokningen kunde inte tas emot just nu. Mejla support@bokix.se.' });
    return;
  }

  const inbox = await sendEmail(resendApiKey, {
    from: getEmailFrom(),
    to: [getContactInbox()],
    subject: `Ny genomgång ${formatSlot(slot)} — ${name}${company ? `, ${company}` : ''}`,
    html: buildBookingHtml({ name, email, slot, mode, company, phone, note }),
    reply_to: email,
  });
  if (!inbox.ok) {
    console.error('Resend API error (booking):', inbox.data);
    await logSystemEvent('contact_email_failed', inbox.data?.message || `Resend svarade ${inbox.status}`);
    if (!saved) {
      res.status(502).json({ error: 'Bokningen kunde inte tas emot just nu. Mejla support@bokix.se.' });
      return;
    }
  } else if (saved) {
    await markContactEmailSent(saved);
  }

  // Bekräftelse till den som bokade. Går den inte iväg står bokningen ändå.
  const confirm = await sendEmail(resendApiKey, {
    from: getEmailFrom(),
    to: [email],
    subject: `Din genomgång av Bokix, ${formatSlot(slot)}`,
    html: buildBookerHtml({ name, slot, mode }),
    reply_to: getContactInbox(),
    attachments: [{
      filename: 'genomgang-bokix.ics',
      content: Buffer.from(bookingIcs({ slot, mode, uid: `${saved || Date.now()}@bokix.se` })).toString('base64'),
    }],
  });
  if (!confirm.ok) console.error('Resend API error (booking confirmation):', confirm.data);

  res.status(200).json({ id: saved || inbox.data?.id || null });
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'GET') {
    // Upptagna tider till bokningssidan. Bara tider, inga namn.
    if (!(await checkRateLimit(req, res, { key: 'booking-slots', max: 60 }))) return;
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ taken: await takenSlots() });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const resendApiKey = getResendApiKey();
  // Striktare gräns än övriga e-postrutter (default max 20) — ett
  // anonymt, oautentiserat formulär är det mest utsatta målet för spam.
  if (!(await checkRateLimit(req, res, { key: 'contact', max: 5 }))) return;

  // Ingen BotID-koll längre (main.jsx: initBotId, se filkommentaren där) —
  // reCAPTCHA nedan (när RECAPTCHA_SECRET_KEY är satt) plus den striktare
  // rate-limiten ovan (5, mot övriga rutters 10-30) är det faktiska,
  // robusta skyddet för det här publika, oautentiserade formuläret.
  try {
    const body = await parseJsonBody(req);
    if (body?.kind === 'booking') { await handleBooking(req, res, body); return; }
    const user = await sessionUser(req);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = user?.email || (typeof body?.email === 'string' ? body.email.trim() : '');
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
    if (!user && hasRecaptchaSecretKey()) {
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
