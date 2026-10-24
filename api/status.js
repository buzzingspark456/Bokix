// Statussidans data (bokix.se/status): öppen för alla, ingen inloggning.
// Bara om varje del fungerar, dagssummorna för 90 dagar och meddelandena
// som skrivits i /internal. Svaret får sparas i Vercels cache en minut, så
// många besökare samtidigt bara ger en fråga mot databasen.
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from './_security.js';
import { buildStatus } from './_status.js';
import { checkRateLimit } from './_rateLimit.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  // Cachen tar de flesta anropen, men en adress med ?något går förbi den.
  if (!(await checkRateLimit(req, res, { key: 'status-page', windowMs: 60 * 1000, max: 60 }))) return;
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'Statussidan är inte inställd.' });
    return;
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    const now = new Date();
    const since90 = new Date(now.getTime() - 91 * 86400000).toISOString().slice(0, 10);
    const [checks, daily, incidents] = await Promise.all([
      admin.from('status_checks').select('component, status, checked_at').gte('checked_at', new Date(now.getTime() - 30 * 60000).toISOString()).order('checked_at', { ascending: false }).limit(60),
      admin.from('status_daily').select('day, component, ok, degraded, down').gte('day', since90).limit(2000),
      admin.from('status_incidents').select('id, title, body, components, status, impact, starts_at, resolved_at, updated_at').order('starts_at', { ascending: false }).limit(50),
    ]);
    const err = checks.error || daily.error || incidents.error;
    if (err) throw new Error(err.message);
    const latest = {};
    (checks.data || []).forEach(r => { if (!latest[r.component]) latest[r.component] = r; });
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.status(200).json(buildStatus({ latest, daily: daily.data || [], incidents: incidents.data || [], now }));
  } catch (err) {
    console.warn('[status] kunde inte läsa statusen:', err?.message || err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'Statusen kunde inte hämtas just nu.' });
  }
}
