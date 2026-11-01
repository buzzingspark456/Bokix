// Nattlig kontroll av företagstabellerna mot blobben, ett konto i taget
// (api/_companyCopy.js). Eget nattjobb (vercel.json, 02:30) med egen
// tidsgräns, så att det håller även med tusentals kunder; hinner det inte
// klart fortsätter nästa natt där det slutade.
// Vercel anropar den här med `Authorization: Bearer $CRON_SECRET`.
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { logSystemEvent } from '../_systemEvents.js';
import { checkCompanyCopy, checkCompanyLinks } from '../_companyCopy.js';
import { withSentry } from '../_sentry.js';

// Under Vercels gräns (maxDuration 300 s i vercel.json), med marginal.
const TIME_BUDGET_MS = 240 * 1000;

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
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const summary = await checkCompanyCopy(admin, { deadline: Date.now() + TIME_BUDGET_MS });
    if (summary.alert) await logSystemEvent('company_mismatch', summary.detail);
    // Egen kontroll: den ska larma även om jämförelsen ovan inte hittar något.
    const links = await checkCompanyLinks(admin);
    if (links.detail) await logSystemEvent('company_link_broken', links.detail);
    // Databasens skydd (private.keep_company_id) stoppade en sparning som hade
    // tagit bort många fält. Inget gick förlorat, men något skrev fel.
    const { data: kept } = await admin.from('system_events').select('detail').eq('kind', 'company_settings_kept')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).limit(5);
    if (kept?.length) await logSystemEvent('company_link_broken', kept.map(e => e.detail).join('\n'));
    res.status(200).json({ ...summary, missingIds: links.missingIds.length, brokenInvites: links.brokenInvites.length });
  } catch (error) {
    console.error('Company copy check error:', error);
    await logSystemEvent('company_mismatch', `Kontrollen kunde inte köras: ${error?.message || error}`);
    res.status(500).json({ error: error?.message || 'Kontrollen misslyckades.' });
  }
}

export default withSentry(handler, '/api/cron/company-copy');
