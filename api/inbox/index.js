import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { checkRateLimit } from '../_rateLimit.js';
import { requireAuthedUser, loadOwnedOrMemberCompany } from '../_auth.js';
import { getInboxDomain, makeInboxToken, normalizeSender } from './_inbox.js';

// Företagets e-postinkorg (Inställningar → Kopplingar → E-postinkorg).
// POST { companyId, action: 'get' | 'rotate' | 'senders', senders? }
//   get    — adressen (skapas första gången), senast mottaget mejl och Gmails
//            bekräftelsekod om en kommit.
//   rotate — ny adress; den gamla slutar ta emot. Bara ägare och redigerare.
//   senders — sparar godkända avsändare (adresser eller @domäner; tom = alla).
// Svar: { address, lastReceivedAt, gmailCode, gmailCodeAt }

function shape(row) {
  return {
    address: `${row.token}@${getInboxDomain()}`,
    lastReceivedAt: row.last_received_at || null,
    // Koden är bara intressant den första timmen; Gmail kräver den direkt.
    gmailCode: row.gmail_confirmation_code && row.gmail_confirmation_at
      && Date.now() - new Date(row.gmail_confirmation_at).getTime() < 24 * 60 * 60 * 1000
      ? row.gmail_confirmation_code : null,
    gmailCodeAt: row.gmail_confirmation_at || null,
    allowedSenders: row.allowed_senders || [],
    lastBlockedFrom: row.last_blocked_from || null,
    lastBlockedAt: row.last_blocked_at || null,
  };
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!(await checkRateLimit(req, res, { key: 'inbox-address', max: 30 }))) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;
  const body = await parseJsonBody(req);
  const companyId = typeof body?.companyId === 'string' ? body.companyId : '';
  const action = ['rotate', 'senders'].includes(body?.action) ? body.action : 'get';
  if (!companyId) { res.status(400).json({ error: 'companyId saknas.' }); return; }

  const access = await loadOwnedOrMemberCompany(user.id, companyId, res, { requireEditor: action !== 'get' });
  if (!access) return;
  const { ownerUserId, companyData } = access;

  const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: existing, error } = await admin.from('inbox_addresses').select('*')
    .eq('owner_user_id', ownerUserId).eq('company_id', companyId).maybeSingle();
  if (error) {
    res.status(500).json({ error: /inbox_addresses/.test(error.message)
      ? 'Tabellen inbox_addresses saknas. Kör supabase-2026-10-04-inkorg.sql i Supabase.'
      : error.message });
    return;
  }

  if (existing && action === 'get') { res.status(200).json(shape(existing)); return; }

  if (action === 'senders') {
    if (!existing) { res.status(400).json({ error: 'Adressen finns inte än.' }); return; }
    const list = Array.isArray(body?.senders) ? body.senders : [];
    const senders = [...new Set(list.map(normalizeSender).filter(Boolean))].slice(0, 50);
    const { data, error: upErr } = await admin.from('inbox_addresses').update({ allowed_senders: senders }).eq('id', existing.id).select('*').single();
    if (upErr) {
      res.status(500).json({ error: /allowed_senders/.test(upErr.message)
        ? 'Kolumnen allowed_senders saknas. Kör supabase-2026-10-04-inkorg-avsandare.sql i Supabase.'
        : upErr.message });
      return;
    }
    res.status(200).json(shape(data));
    return;
  }

  // Ny adress. Kollisioner är i praktiken omöjliga (sju slumptecken), men
  // försök ändå några gånger.
  const companyName = companyData?.company?.name || companyData?.name || '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = makeInboxToken(companyName);
    const row = { owner_user_id: ownerUserId, company_id: companyId, token, gmail_confirmation_code: null, gmail_confirmation_at: null };
    const result = existing
      ? await admin.from('inbox_addresses').update(row).eq('id', existing.id).select('*').single()
      : await admin.from('inbox_addresses').insert(row).select('*').single();
    if (!result.error) { res.status(200).json(shape(result.data)); return; }
    if (!/duplicate|unique/i.test(result.error.message)) { res.status(500).json({ error: result.error.message }); return; }
  }
  res.status(500).json({ error: 'Kunde inte skapa en adress. Försök igen.' });
}
