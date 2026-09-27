// Kalenderlänken: GET /api/calendar?u=<ägarens user_id>&c=<företags-id>&k=<nyckel>
// svarar med företagets deklarationsdatum och fakturornas förfallodagar som
// en .ics-fil (src/utils/calendarFeed.js). Google Kalender, Apple och Outlook
// hämtar den själva med jämna mellanrum, utan inloggning — därför skyddas
// länken av en lång slumpad nyckel som sparas på företaget
// (company.calendar.key) och byts när användaren skapar en ny länk.
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from './_security.js';
import { buildCalendarEvents, calendarChoices, toIcs } from '../src/utils/calendarFeed.js';

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const KEY_RE = /^[0-9a-f]{32,128}$/;

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

function keysMatch(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const { u, c, k } = req.query || {};
  // Samma svar för fel format, okänt företag och fel nyckel: länken ska inte
  // gå att använda för att ta reda på vilka företag som finns.
  const notFound = () => res.status(404).send('Kalendern finns inte.');
  if (!ID_RE.test(String(u || '')) || !ID_RE.test(String(c || '')) || !KEY_RE.test(String(k || ''))) return notFound();

  const admin = adminClient();
  if (!admin) return res.status(503).send('Kalendern är inte tillgänglig just nu.');

  const { data: row, error } = await admin.from('user_data').select('state').eq('user_id', u).maybeSingle();
  if (error) return res.status(500).send('Kunde inte läsa kalendern.');
  const companyData = row?.state?.companies?.[c];
  const settings = companyData?.company?.calendar;
  if (!companyData || !settings?.key || !keysMatch(settings.key, k)) return notFound();

  const events = buildCalendarEvents(companyData, calendarChoices(settings));
  const name = companyData.company?.name ? `Bokix – ${companyData.company.name}` : 'Bokix';
  const ics = toIcs(events, { calendarName: name });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="bokix.ics"');
  res.setHeader('Cache-Control', 'private, max-age=900');
  return res.status(200).send(req.method === 'HEAD' ? '' : ics);
}
