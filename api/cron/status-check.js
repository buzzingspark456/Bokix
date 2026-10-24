// Statussidans kontroller, var 5:e minut (vercel.json crons). Kollar varje
// del (api/_status.js), sparar resultatet (public.status_record) och mejlar
// grundarna när en del går från fungerande till nere (status_down, högst ett
// mejl i timmen per sort, se _systemEvents.js).
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { logSystemEvent } from '../_systemEvents.js';
import { runChecks, COMPONENTS } from '../_status.js';
import { withSentry } from '../_sentry.js';

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(String(req.headers['authorization'] || ''));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function handler(req, res) {
  applySecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(503).json({ error: 'Supabase är inte inställt.' });
    return;
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Riktiga fel den senaste tiden ur systemloggen (ingen kunddata, bara antal).
  const countEvents = async (kind, minutes, patterns = null) => {
    const { data } = await admin.from('system_events').select('detail')
      .eq('kind', kind).gte('created_at', new Date(Date.now() - minutes * 60000).toISOString()).limit(200);
    const rows = data || [];
    return patterns ? rows.filter(r => patterns.some(p => String(r.detail || '').includes(p))).length : rows.length;
  };

  // Förra kollen per del, för att bara larma när något just gick ner.
  const { data: previousRows } = await admin.from('status_checks').select('component, status')
    .gte('checked_at', new Date(Date.now() - 30 * 60000).toISOString())
    .order('checked_at', { ascending: false }).limit(60);
  const previous = {};
  (previousRows || []).forEach(r => { if (!(r.component in previous)) previous[r.component] = r.status; });

  const results = await runChecks({ countEvents });
  const failed = [];
  for (const r of results) {
    const { error } = await admin.rpc('status_record', { p_component: r.component, p_status: r.status, p_ms: r.ms, p_note: r.note });
    if (error) failed.push(`${r.component}: ${error.message}`);
    if (r.status === 'down' && previous[r.component] && previous[r.component] !== 'down') {
      const name = COMPONENTS.find(c => c.id === r.component)?.name || r.component;
      await logSystemEvent('status_down', `${name}: ${r.note || 'nere'}`);
    }
  }
  // En gång om dagen (kl. 08 UTC): fanns en lyckad nattkopia (backup_ok) det
  // senaste dygnet? Körs kopian inte alls loggas annars inget fel.
  const nowUtc = new Date();
  if (nowUtc.getUTCHours() === 8 && nowUtc.getUTCMinutes() < 5) {
    const { data: okRows } = await admin.from('system_events').select('created_at')
      .eq('kind', 'backup_ok').gte('created_at', new Date(Date.now() - 26 * 3600000).toISOString()).limit(1);
    if (!okRows?.length) await logSystemEvent('backup_stale', 'Ingen backup_ok från /api/cron/offsite-backup de senaste 26 timmarna.');
  }

  if (failed.length) {
    res.status(500).json({ error: 'Kunde inte spara', failed });
    return;
  }
  res.status(200).json({ ok: true, results });
}

export default withSentry(handler, '/api/cron/status-check');
