// Nattlig säkerhetskopia utanför Supabase, se api/_offsiteBackup.js.
// Vercel anropar den här enligt vercel.json (crons) med
// `Authorization: Bearer $CRON_SECRET`, samma skydd som reminders.js.
// Misslyckas körningen, eller är lagringen inte inställd, loggas det i
// Systemstatus och ett larmmejl går ut (_systemEvents.js).
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { logSystemEvent } from '../_systemEvents.js';
import { readBackupConfig, createOffsiteStore, runOffsiteBackup } from '../_offsiteBackup.js';
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

  const config = readBackupConfig();
  if (config.missing.length) {
    await logSystemEvent('backup_not_configured', `Saknas i Vercel: ${config.missing.join(', ')}`);
    res.status(503).json({ error: 'Säkerhetskopian är inte inställd.', missing: config.missing });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas.' });
    return;
  }

  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const summary = await runOffsiteBackup(admin, createOffsiteStore(config), config.key);
    if (summary.errors.length) {
      await logSystemEvent('backup_failed', `Delvis klar (${summary.filesCopied} filer kopierade): ${summary.errors.slice(0, 5).join('; ')}`);
    } else {
      // Kvitto på att natten gick bra. status-check.js larmar om det saknas,
      // så att en körning som slutat helt (inget fel loggas då) också märks.
      await logSystemEvent('backup_ok', `Databas ${Math.round(summary.dbBytes / 1024)} kB, ${summary.filesCopied} nya filer, ${summary.filesPending} kvar till nästa natt`);
    }
    res.status(200).json(summary);
  } catch (error) {
    console.error('Offsite backup error:', error);
    await logSystemEvent('backup_failed', error?.message || String(error));
    res.status(500).json({ error: error?.message || 'Säkerhetskopian misslyckades.' });
  }
}

export default withSentry(handler, '/api/cron/offsite-backup');
