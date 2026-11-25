import { createClient } from '@supabase/supabase-js';
import { logSystemEvent } from './_systemEvents.js';
import { applySecurityHeaders } from './_security.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { checkRateLimit, getClientIp } from './_rateLimit.js';
import { hasRecaptchaSecretKey, verifyRecaptcha } from './_recaptcha.js';
import { hasTurnstileSecretKey, verifyTurnstile } from './_turnstile.js';
import { brandedEmail } from '../src/utils/brandedEmail.js';
import { withSentry } from './_sentry.js';
import { isDisposableEmailDeep } from './_abuse.js';
import {
  BOOKING_TOPIC, BOOKING_MODES, BOOKING_REASONS, bookingReason, bookingMinutes, isSlotFree, isValidSlot, formatSlot, bookingMessage,
  busyFromMessage, bookingIcs, stockholmToday,
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

// En bifogad fil från appens Kontakta support (2026-11-07): bara för
// inloggade, bara bilder och PDF, högst 3 MB. Följer med mejlet till
// supporten som bilaga; Inkorgen får en rad om att det finns en fil.
const ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf'];
const ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;

// { filename, content } för Resend, null om ingen fil, eller { error }.
function readAttachment(raw) {
  if (!raw) return null;
  const type = typeof raw.type === 'string' ? raw.type.toLowerCase() : '';
  const data = typeof raw.data === 'string' ? raw.data.replace(/^data:[^,]*,/, '') : '';
  if (!ATTACHMENT_TYPES.includes(type) || !data || !/^[A-Za-z0-9+/=\s]+$/.test(data)) {
    return { error: 'Filen kan inte skickas. Välj en bild eller en PDF.' };
  }
  const bytes = Buffer.from(data, 'base64');
  if (!bytes.length) return { error: 'Filen är tom.' };
  if (bytes.length > ATTACHMENT_MAX_BYTES) return { error: 'Filen är för stor. Högst 3 MB.' };
  const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1].replace('jpeg', 'jpg');
  const base = String(raw.name || 'bilaga').replace(/\.[^.]*$/, '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'bilaga';
  return { filename: `${base}.${ext}`, content: bytes.toString('base64'), size: bytes.length };
}

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
// längden på raden "Längd:"; båda läses tillbaka därifrån för att visa
// upptagna tider. Svarar med [{ slot, minutes }].
async function busySlots() {
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
    .map(r => busyFromMessage(r.message))
    .filter(b => b && b.slot.slice(0, 10) > today);
}

function buildBookingHtml({ name, email, slot, mode, reason, company, phone, note }) {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #0f172a; line-height: 1.6;">
      <p><strong>Tid:</strong> ${esc(formatSlot(slot))}</p>
      <p><strong>Gäller:</strong> ${esc(BOOKING_REASONS[reason].label)}</p>
      <p><strong>Form:</strong> ${esc(BOOKING_MODES[mode])}</p>
      <p><strong>Namn:</strong> ${esc(name)}</p>
      <p><strong>E-post:</strong> ${esc(email)}</p>
      ${company ? `<p><strong>Företag:</strong> ${esc(company)}</p>` : ''}
      ${phone ? `<p><strong>Telefon:</strong> ${esc(phone)}</p>` : ''}
      ${note ? `<p><strong>Meddelande:</strong></p><p style="white-space: pre-wrap;">${esc(note)}</p>` : ''}
    </div>
  `;
}

function buildBookerHtml({ name, slot, mode, reason }) {
  const how = mode === 'phone'
    ? 'Vi ringer dig på numret du angav.'
    : 'Vi mejlar en länk till videomötet innan dess.';
  return brandedEmail({
    title: 'Din genomgång är bokad',
    body: `
      <p>Hej ${esc(name.split(' ')[0])},</p>
      <p>Tack för din bokning. Vi ses <strong>${esc(formatSlot(slot))}</strong> (${esc(BOOKING_REASONS[reason].label)}), cirka ${bookingMinutes(reason)} minuter. ${how}</p>
      <p>Passar tiden inte längre? Svara på det här mejlet så hittar vi en ny.</p>
      <p>Hälsningar<br/>Bokix</p>
    `,
  });
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
  const reason = bookingReason(body?.reason);

  if (!name || !email) { res.status(400).json({ error: 'Namn och e-post krävs.' }); return; }
  if (!EMAIL_RE.test(email)) { res.status(400).json({ error: 'Ogiltig e-postadress.' }); return; }
  // Engångsadresser (10minutemail m.fl.) kan inte bekräfta en tid: bokningen
  // från 2026-11-06 studsade. Be om en riktig adress i stället.
  if (await isDisposableEmailDeep(email)) {
    res.status(400).json({ error: 'Använd en vanlig e-postadress, så att vi kan skicka bekräftelsen och möteslänken.' });
    return;
  }
  if (mode === 'phone' && !/\d{6,}/.test(phone.replace(/\D/g, ''))) {
    res.status(400).json({ error: 'Skriv ett telefonnummer så att vi kan ringa dig.' });
    return;
  }
  if (!isValidSlot(slot)) { res.status(400).json({ error: 'Tiden går inte att boka. Välj en annan.' }); return; }

  if (hasTurnstileSecretKey()) {
    const { ok } = await verifyTurnstile(body?.captchaToken, getClientIp(req));
    if (!ok) {
      res.status(400).json({ error: 'Kunde inte verifiera att du inte är en robot. Ladda om sidan och försök igen. Har du en annonsblockerare, pausa den för bokix.se.' });
      return;
    }
  }

  if (!isSlotFree(slot, bookingMinutes(reason), await busySlots())) {
    res.status(409).json({ error: 'Någon hann boka den tiden precis. Välj en annan.', taken: true });
    return;
  }

  const saved = await saveContactMessage({
    name, email, topic: BOOKING_TOPIC,
    message: bookingMessage({ slot, mode, reason, company, phone, note }),
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
    subject: `Ny genomgång ${formatSlot(slot)} (${BOOKING_REASONS[reason].label}) — ${name}${company ? `, ${company}` : ''}`,
    html: buildBookingHtml({ name, email, slot, mode, reason, company, phone, note }),
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
    html: buildBookerHtml({ name, slot, mode, reason }),
    reply_to: getContactInbox(),
    attachments: [{
      filename: 'genomgang-bokix.ics',
      content: Buffer.from(bookingIcs({ slot, mode, reason, uid: `${saved || Date.now()}@bokix.se` })).toString('base64'),
    }],
  });
  if (!confirm.ok) console.error('Resend API error (booking confirmation):', confirm.data);

  res.status(200).json({ id: saved || inbox.data?.id || null });
}

async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method === 'GET') {
    // Upptagna tider till bokningssidan. Bara tider, inga namn.
    if (!(await checkRateLimit(req, res, { key: 'booking-slots', max: 60 }))) return;
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ busy: await busySlots() });
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
    // Bilaga bara från inloggade (appen), aldrig från det publika formuläret.
    const attachment = user ? readAttachment(body?.attachment) : null;
    if (attachment?.error) {
      res.status(400).json({ error: attachment.error });
      return;
    }

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
    // 2026-10-24: Cloudflare Turnstile i stället för reCAPTCHA (användarens
    // önskemål), samma som bokningen. reCAPTCHA gäller bara om Turnstile inte
    // är inställt.
    // En sida som var öppen före bytet skickar en reCAPTCHA-token i stället:
    // den godtas om reCAPTCHA fortfarande är inställt, så ingen fastnar.
    const legacyRecaptcha = !body?.captchaToken && body?.recaptchaToken && hasRecaptchaSecretKey();
    if (!user && hasTurnstileSecretKey() && !legacyRecaptcha) {
      const { ok, reason } = await verifyTurnstile(body?.captchaToken, getClientIp(req));
      if (!ok) {
        console.warn('[contact] Turnstile nekade meddelandet:', reason);
        res.status(400).json({ error: 'Kunde inte verifiera att du inte är en robot. Ladda om sidan och försök igen. Har du en annonsblockerare, pausa den för bokix.se.' });
        return;
      }
    } else if (!user && hasRecaptchaSecretKey()) {
      const { ok, reason } = await verifyRecaptcha(body?.recaptchaToken, getClientIp(req));
      if (!ok) {
        console.warn('[contact] reCAPTCHA nekade meddelandet:', reason);
        res.status(400).json({ error: 'Kunde inte verifiera att du inte är en robot. Ladda om sidan och försök igen.' });
        return;
      }
    }

    // Sparas först i admin-panelens Inkorg (contact_messages), så att inget
    // meddelande försvinner om mejlet inte går iväg. Saknas tabellen eller
    // nyckeln fortsätter det som förut, med bara mejlet.
    const attachmentNote = attachment ? `\n\nBifogad fil: ${attachment.filename} (${Math.max(1, Math.round(attachment.size / 1024))} kB), finns i mejlet till supporten.` : '';
    const saved = await saveContactMessage({ name, email, topic, message: message + attachmentNote });

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
        html: buildEmailHtml({ name, email, topic, message: message + attachmentNote }),
        reply_to: email,
        ...(attachment ? { attachments: [{ filename: attachment.filename, content: attachment.content }] } : {}),
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

    // Kopia till den inloggade avsändaren, så att det syns i den egna
    // inkorgen att meddelandet gick iväg. Bara inloggade: adressen kommer då
    // från sessionen, så ingen kan låta rutten mejla en främmande adress.
    if (user?.email) {
      const copy = await sendEmail(resendApiKey, {
        from: getEmailFrom(),
        to: [user.email],
        subject: `Vi har fått ditt meddelande (${topic})`,
        html: brandedEmail({
          title: 'Vi har fått ditt meddelande',
          body: `<p>Tack, vi svarar så snart vi kan. Här är en kopia av det du skickade:</p>${buildEmailHtml({ name, email, topic, message })}`,
        }),
        reply_to: getContactInbox(),
      });
      if (!copy.ok) console.error('Resend API error (contact copy):', copy.data);
    }

    res.status(200).json({ id: data.id });
  } catch (error) {
    console.error('Contact form send error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte skicka e-post.' });
  }
}

export default withSentry(handler, '/api/contact');
