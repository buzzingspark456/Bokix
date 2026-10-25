// Kalenderlänken: GET /api/calendar?u=<ägarens user_id>&c=<företags-id>&k=<nyckel>
// svarar med företagets deklarationsdatum och fakturornas förfallodagar som
// en .ics-fil (src/utils/calendarFeed.js). Google Kalender, Apple och Outlook
// hämtar den själva med jämna mellanrum, utan inloggning — därför skyddas
// länken av en lång slumpad nyckel som sparas på företaget
// (company.calendar.key) och byts när användaren skapar en ny länk.
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from './_security.js';
import { checkRateLimit } from './_rateLimit.js';
import { buildCalendarEvents, calendarChoices, toIcs } from '../src/utils/calendarFeed.js';
import { withSentry } from './_sentry.js';
import { readOwnerCompany } from './_companyStore.js';

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
// user_id är en uuid-kolumn: annat format ger ett Postgres-fel (500) i stället för 404.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const { u, c, k } = req.query || {};
  // Samma svar för fel format, okänt företag och fel nyckel: länken ska inte
  // gå att använda för att ta reda på vilka företag som finns.
  const notFound = () => res.status(404).send('Kalendern finns inte.');
  if (!UUID_RE.test(String(u || '')) || !ID_RE.test(String(c || '')) || !KEY_RE.test(String(k || ''))) return notFound();

  // Varje hämtning läser hela kontot. Gränsen gäller per kalenderlänk:
  // Google Kalender hämtar alla kunders länkar från samma adresser, så en
  // gräns per IP hade stoppat alla. Den vida IP-gränsen stoppar bara robotar.
  if (!(await checkRateLimit(req, res, { key: 'calendar-feed', max: 30, identifier: `${u}:${c}` }))) return;
  if (!(await checkRateLimit(req, res, { key: 'calendar-ip', max: 600 }))) return;

  const admin = adminClient();
  if (!admin) return res.status(503).send('Kalendern är inte tillgänglig just nu.');

  let entry;
  try {
    entry = await readOwnerCompany(admin, u, c);
  } catch {
    return res.status(500).send('Kunde inte läsa kalendern.');
  }
  const companyData = entry?.data;
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

export default withSentry(handler, '/api/calendar');
