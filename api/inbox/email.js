import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { checkRateLimit } from '../_rateLimit.js';
import { logSystemEvent } from '../_systemEvents.js';
import {
  getInboxDomain, tokenFromAddress, verifySvixSignature, pickAttachments, attachmentType,
  safeFileName, gmailConfirmationCode, MAX_ATTACHMENT_BYTES,
} from './_inbox.js';

// Resend anropar den här när ett mejl kommit till en inkorgsadress
// (email.received). Webhooken innehåller bara metadata; bilagorna hämtas från
// Resends API och sparas i bokix-uploads under företagsägarens mapp, som rader
// i inbox_items. Appen plockar upp raderna (App.jsx). Se
// supabase-2026-10-04-inkorg.sql.
//
// Svarar alltid 200 när signaturen stämmer, även när ett mejl inte ger något
// (okänd adress, inga bilagor): annars försöker Resend igen i flera dagar.

const RESEND_API = 'https://api.resend.com';

async function readRawBody(req) {
  if (typeof req.text === 'function') return req.text();
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function header(req, name) {
  const h = req.headers || {};
  return typeof h.get === 'function' ? h.get(name) : h[name];
}

async function resendGet(path) {
  const res = await fetch(`${RESEND_API}${path}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
  if (!res.ok) throw new Error(`Resend svarade ${res.status} på ${path}`);
  return res.json();
}

// En "res" som inte skriver något: gränsen ska bara säga ja eller nej här.
const silentRes = { status() { return this; }, json() { return this; } };

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !serviceKey || !process.env.RESEND_API_KEY) {
    res.status(503).json({ error: 'Inkorgen är inte konfigurerad.' });
    return;
  }

  const body = await readRawBody(req);
  const ok = verifySvixSignature({
    id: header(req, 'svix-id'),
    timestamp: header(req, 'svix-timestamp'),
    signature: header(req, 'svix-signature'),
  }, body, secret);
  if (!ok) { res.status(401).json({ error: 'Ogiltig signatur.' }); return; }

  let event;
  try { event = JSON.parse(body); } catch { res.status(400).json({ error: 'Ogiltig JSON.' }); return; }
  if (event?.type !== 'email.received' || !event.data?.email_id) { res.status(200).json({ ignored: true }); return; }

  const mail = event.data;
  const domain = getInboxDomain();
  const tokens = [...new Set([...(mail.to || []), ...(mail.cc || []), ...(mail.received_for || [])]
    .map(a => tokenFromAddress(a, domain)).filter(Boolean))];
  if (tokens.length === 0) { res.status(200).json({ ignored: 'no_inbox' }); return; }

  const admin = createClient(url, serviceKey);
  const { data: inboxes } = await admin.from('inbox_addresses').select('id, owner_user_id, company_id, token').in('token', tokens);
  if (!inboxes?.length) { res.status(200).json({ ignored: 'unknown_address' }); return; }

  const now = new Date().toISOString();
  const fromEmail = String(mail.from || '').slice(0, 200);

  // Gmails bekräftelse innan vidarebefordran slås på: spara koden så att den
  // syns i appen. Den blir inget underlag.
  if (/forwarding-noreply@google\.com/i.test(fromEmail)) {
    let text = '';
    try { text = (await resendGet(`/emails/receiving/${encodeURIComponent(mail.email_id)}`))?.text || ''; } catch { text = ''; }
    const code = gmailConfirmationCode(fromEmail, mail.subject, text);
    await admin.from('inbox_addresses')
      .update({ last_received_at: now, ...(code ? { gmail_confirmation_code: code, gmail_confirmation_at: now } : {}) })
      .in('id', inboxes.map(i => i.id));
    res.status(200).json({ gmailConfirmation: Boolean(code) });
    return;
  }

  // Samma mejl två gånger (Resend försöker igen efter ett fel): ta bara emot en gång.
  const { data: already } = await admin.from('inbox_items').select('id')
    .or(`email_id.eq.${mail.email_id},email_id.like.${mail.email_id}:%`).limit(1);
  if (already?.length) { res.status(200).json({ duplicate: true }); return; }

  let attachments = [];
  try {
    attachments = pickAttachments((await resendGet(`/emails/receiving/${encodeURIComponent(mail.email_id)}/attachments`))?.data || []);
  } catch (err) {
    console.error('Inkorg: kunde inte hämta bilagor', err);
    await logSystemEvent('inbox_fetch_failed', err?.message || 'okänt fel');
    res.status(502).json({ error: 'Kunde inte hämta bilagorna.' });
    return;
  }

  // Hämta filerna en gång, spara dem för varje inkorg mejlet gick till.
  const files = [];
  for (const att of attachments) {
    try {
      const r = await fetch(att.download_url);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_ATTACHMENT_BYTES) continue;
      const type = attachmentType(att);
      files.push({ buf, type, name: safeFileName(att.filename, type) });
    } catch (err) {
      console.warn('Inkorg: kunde inte ladda ner en bilaga', err?.message);
    }
  }

  let saved = 0;
  for (const inbox of inboxes) {
    // Högst 100 mejl i timmen per adress: en adress som läckt ska inte kunna
    // fylla ett företags kvitton.
    if (!(await checkRateLimit(req, silentRes, { key: 'inbox-email', windowMs: 60 * 60 * 1000, max: 100, identifier: inbox.token }))) continue;
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `${inbox.owner_user_id}/receipts/inbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await admin.storage.from('bokix-uploads').upload(path, file.buf, { contentType: file.type, upsert: false });
      if (upErr) { console.error('Inkorg: uppladdning misslyckades', upErr.message); continue; }
      const fileUrl = `${url}/storage/v1/object/public/bokix-uploads/${path}`;
      const { error: insErr } = await admin.from('inbox_items').insert({
        owner_user_id: inbox.owner_user_id,
        company_id: inbox.company_id,
        source: 'email',
        email_id: inboxes.length > 1 ? `${mail.email_id}:${inbox.id}` : mail.email_id,
        from_email: fromEmail,
        subject: String(mail.subject || '').slice(0, 300),
        file_url: fileUrl,
        file_name: file.name,
        content_type: file.type,
        size_bytes: file.buf.length,
      });
      if (insErr) {
        console.error('Inkorg: kunde inte spara raden', insErr.message);
        await admin.storage.from('bokix-uploads').remove([path]);
        continue;
      }
      saved++;
    }
  }

  await admin.from('inbox_addresses').update({ last_received_at: now }).in('id', inboxes.map(i => i.id));
  res.status(200).json({ saved });
}
