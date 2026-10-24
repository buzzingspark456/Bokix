// Tar bort konton som aldrig startade en prenumeration, sju dagar efter
// registreringen (användarens beslut 2026-10-24). Egen cron i stället för
// data-retention.js, som också stänger UF-konton och skickar mejl och är
// avstängd tills vidare. Reglerna (bokföring, UF, gratiskonton, delade
// företag) ligger i cleanAbandonedSignups i _dataRetention.js.
// Vercel anropar enligt vercel.json med `Authorization: Bearer $CRON_SECRET`.
// ?dryRun=1 räknar utan att radera.
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { logSystemEvent } from '../_systemEvents.js';
import { cleanAbandonedSignups } from './_dataRetention.js';
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
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas.' });
    return;
  }
  const dryRun = req.query?.dryRun === 'true' || req.query?.dryRun === '1';
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const result = await cleanAbandonedSignups(admin, { dryRun });
    res.status(200).json(result);
  } catch (error) {
    console.error('Unpaid signups error:', error);
    await logSystemEvent('retention_failed', `unpaid-signups: ${error?.message || String(error)}`);
    res.status(500).json({ error: error?.message || 'Städningen av obetalda konton misslyckades.' });
  }
}

export default withSentry(handler, '/api/cron/unpaid-signups');
