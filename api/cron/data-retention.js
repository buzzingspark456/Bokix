// Nattkopior, arkivgallring och datastädning (se _dataRetention.js). Egen
// cron sedan 2026-10-08: i reminders.js delade den påminnelsernas
// tidsgräns, och med några hundra konton hade den inte hunnit. Här har den
// egen tid och fortsätter nästa natt där den slutade (cron_progress).
// Vercel anropar enligt vercel.json med `Authorization: Bearer $CRON_SECRET`.
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { logSystemEvent } from '../_systemEvents.js';
import { runDataRetention } from './_dataRetention.js';
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
    // Funktionen får 300 s (vercel.json). Marginal för att spara var den slutade.
    const result = await runDataRetention(admin, { dryRun, deadline: Date.now() + 240_000 });
    if (result.errors.length) {
      await logSystemEvent('retention_failed', result.errors.slice(0, 5).join('; '));
    }
    res.status(200).json(result);
  } catch (error) {
    console.error('Data retention error:', error);
    await logSystemEvent('retention_failed', error?.message || String(error));
    res.status(500).json({ error: error?.message || 'Datastädningen misslyckades.' });
  }
}

export default withSentry(handler, '/api/cron/data-retention');
