import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from './_security.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { requireAuthedUser, loadOwnedCompany } from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';
import { archiveCompany } from './_archive.js';
import { closeUfAccount } from './_ufAccount.js';

// POST /api/archive { company_id, reason: 'reset' | 'delete' }
// POST /api/archive { action: 'uf_close' }  avslutar UF-året, se _ufAccount.js
//
// Anropas av appen INNAN ett företag töms (Radera data) eller tas bort
// (Radera företag). Företaget läses från databasen här på servern, inte från
// vad klienten skickar, så arkivet är det som faktiskt var sparat. Svarar
// 200 först när bokföringen och filerna ligger i arkivet; annars ska appen
// avbryta raderingen. Se _archive.js.
const REASONS = new Set(['reset', 'delete']);

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await checkRateLimit(req, res, { key: 'archive', max: 20 }))) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  const body = await parseJsonBody(req);

  if (body?.action === 'uf_close') {
    const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const result = await closeUfAccount(admin, user);
    res.status(result.status).json(result.body);
    return;
  }

  const companyId = body?.company_id;
  const reason = body?.reason;
  if (!companyId || !REASONS.has(reason)) {
    res.status(400).json({ error: 'company_id och reason (reset eller delete) krävs.' });
    return;
  }

  const companyData = await loadOwnedCompany(user.id, companyId, res);
  if (!companyData) return;

  try {
    const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const result = await archiveCompany(admin, { userId: user.id, companyId, companyData, reason });
    res.status(200).json({ ok: true, keepUntil: result.keepUntil, files: result.files });
  } catch (error) {
    console.error('archive error:', error);
    res.status(500).json({ error: 'Kunde inte spara arkivkopian. Inget har raderats.' });
  }
}
