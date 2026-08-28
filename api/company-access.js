import { applySecurityHeaders } from './_security.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { requireAuthedUser, loadMemberCompany } from './_auth.js';
import { checkRateLimit } from './_rateLimit.js';
import { isRequestFromBot } from './_botid.js';
import { createClient } from '@supabase/supabase-js';
import { COMPANY_WRITABLE_FIELDS } from '../src/utils/companyFields.js';

// Enda server-endpointen en INBJUDEN användare (se supabase-setup.sql:
// company_members — ägare + upp till 2 inbjudna = max 3 per företag) någonsin
// pratar med för att läsa/skriva ett delat företags data. En inbjuden
// användare har ALDRIG en egen user_data-rad för det här företaget (blobben
// ligger kvar hos ägaren) och får därför aldrig gå via klientens vanliga
// direkta supabase.from('user_data')-anrop — RLS på user_data tillåter
// fortfarande bara auth.uid() = user_id. Den här filen är den enda platsen
// som får kringgå det, via service-role-nyckeln, och bara efter att ha
// bevisat ett AKTIVT medlemskap (loadMemberCompany i _auth.js).
//
// GET  ?company_id=X          → { company: <hela företagets state-gren>, role }
// POST { company_id, field, value } → sparar ETT fält via set_company_field
//   (samma vitlista av tillåtna fält som SQL-funktionen själv kräver — se
//   supabase-setup.sql). Avvisas med 403 om rollen är 'viewer'.
//
// Vercels 12-funktionsgräns (Hobby-plan, se send-invoice.js:21 för samma
// resonemang): GET och POST delar avsiktligt en och samma fil istället för
// två separata endpoints.
const WRITABLE_FIELDS = new Set(COMPANY_WRITABLE_FIELDS);

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'company-access', max: 60 })) return;

  // Vercel BotID — se filkommentaren i main.jsx. Bara på POST (skrivningen),
  // precis som varje annan endpoint i den här kodbasen (t.ex.
  // api/email/domains/status.js, en GET, har aldrig haft en BotID-koll
  // alls) — main.jsx:s initBotId-lista registrerar bara POST-metoder,
  // aldrig GET. Kör man checkBotId() på ett anrop som inte finns i den
  // listan larmar Vercel om "Possible misconfiguration" i loggen (verifierat
  // lokalt via `npm run dev`) eftersom klienten aldrig skickade en
  // BotID-token för just den kombinationen — fail-open (se _botid.js) så
  // det blockerar ingenting, men larmet är brus värt att undvika.
  if (req.method === 'POST') {
    const isBot = await isRequestFromBot();
    if (isBot) {
      res.status(403).json({ error: 'Åtkomst nekad.' });
      return;
    }
  }

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const companyId = req.query?.company_id;
      if (!companyId) {
        res.status(400).json({ error: 'company_id krävs.' });
        return;
      }
      const member = await loadMemberCompany(user.id, companyId, res);
      if (!member) return;
      res.status(200).json({ company: member.companyData, role: member.role });
      return;
    }

    // POST
    const body = await parseJsonBody(req);
    const { company_id: companyId, field, value } = body || {};
    if (!companyId || !field || value === undefined) {
      res.status(400).json({ error: 'company_id, field och value krävs.' });
      return;
    }
    if (!WRITABLE_FIELDS.has(field)) {
      res.status(400).json({ error: `Ogiltigt fält: ${field}` });
      return;
    }

    const member = await loadMemberCompany(user.id, companyId, res);
    if (!member) return;
    if (member.role !== 'editor') {
      res.status(403).json({ error: 'Din roll (läsare) tillåter inte att spara ändringar.' });
      return;
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { error: rpcError } = await admin.rpc('set_company_field', {
      p_user_id: member.ownerUserId,
      p_company_id: companyId,
      p_field: field,
      p_value: value,
    });
    if (rpcError) {
      res.status(500).json({ error: rpcError.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('company-access error:', error);
    res.status(500).json({ error: error?.message || 'Kunde inte hämta/spara företagsdata.' });
  }
}
