import { createClient } from '@supabase/supabase-js';

// Säkerhetsfix (se säkerhetsgranskningen): flera endpoints litade tidigare
// blint på user_id/company_id i request-body:n — vem som helst som kände
// till (eller gissade) ett par ID:n kunde t.ex. koppla från en annan
// användares Stripe-konto eller skicka mejl som "från" ett företag de inte
// äger. De två funktionerna här ger endpoints ett sätt att verifiera VEM
// som faktiskt anropar (mot Supabase Auth) och VILKET företag den
// användaren faktiskt äger, istället för att lita på vad body:n påstår.

/** Verifierar Authorization: Bearer <access_token> mot Supabase Auth. Kör
 * `res.status(401)...` och returnerar null själv vid fel — anropande kod
 * ska bara göra `const user = await requireAuthedUser(req, res); if (!user) return;`. */
export async function requireAuthedUser(req, res) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    res.status(401).json({ error: 'Inloggning krävs.' });
    return null;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(503).json({ error: 'Supabase är inte konfigurerat.' });
    return null;
  }

  // Anon-nyckeln räcker här — getUser(token) verifierar bara att token:en
  // är giltig och vem den tillhör, den kringgår aldrig RLS eller kräver
  // förhöjd behörighet (till skillnad från service-role-nyckeln som
  // loadCompanyForUser nedan behöver för att själv slå upp state:n).
  const supabase = createClient(supabaseUrl, anonKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Ogiltig eller utgången inloggning.' });
    return null;
  }
  return data.user;
}

/** Slår upp det angivna företaget i DEN VERIFIERADE användarens egen
 * sparade state — bevisar ägarskap utan att lita på ett client-supplied
 * company_id ensamt (id:t måste faktiskt finnas i just den här
 * användarens data). Kör `res.status(...)...` och returnerar null själv
 * vid fel, samma anropsmönster som requireAuthedUser ovan. */
export async function loadOwnedCompany(userId, companyId, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas — kan inte verifiera ägarskap server-side.' });
    return null;
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: row, error } = await admin.from('user_data').select('state').eq('user_id', userId).maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  const companyData = row?.state?.companies?.[companyId];
  if (!companyData) {
    res.status(403).json({ error: 'Företaget hittades inte för den inloggade användaren.' });
    return null;
  }
  return companyData;
}

/** Slår upp företaget oavsett om den inloggade användaren är ÄGARE
 * (loadOwnedCompany ovan) eller en INBJUDEN MEDLEM (loadMemberCompany
 * nedan) — samma "prova ägaren först, fall tillbaka till medlemskap"-
 * mönster som redan etablerat i company-access.js (fältsparningens
 * ägar-snabbväg). Flera endpoints (send-invoice.js, stripe/connect.js,
 * zettle/callback.js, email/domains/index.js) kollade tidigare BARA
 * ägarskap, vilket gjorde att en inbjuden medarbetare (t.ex. den andra av
 * Bokix två grundare, inloggad på ett delat företag) fick "Företaget
 * hittades inte för den inloggade användaren" och aldrig kunde
 * skicka/koppla något — trots giltig åtkomst till företaget i appen i
 * övrigt.
 *
 * `requireEditor` (förval false): sätt till true för anrop som ÄNDRAR
 * företagets sparade data eller kopplingar (Stripe/Zettle-anslutning,
 * e-postdomän, egen avsändaradress) — samma editor-krav som
 * company-access.js redan ställer på fältsparning, en läsare ska inte
 * kunna koppla/koppla från integrationer åt hela företaget. Lämna false
 * för rena läsningar (statuskoll) eller åtgärder som inte ändrar sparad
 * data (t.ex. att skicka ett mejl) — en läsare ska kunna göra det de
 * redan kan se.
 *
 * Returnerar `{ companyData, ownerUserId, role }`, INTE bara companyData
 * rakt av (bugkritiskt, hittades när send-invoice.js/stripe/zettle-
 * kopplingarna fixades för medlemmar): all företagsdata ligger i ÄGARENS
 * `user_data`-rad, så varje efterföljande anrop som skriver/läser en rad
 * NYCKLAD PÅ user_id (email_senders, set_company_stripe_account,
 * set_company_zettle_tokens, den signerade OAuth-state:n Stripe/Zettles
 * callback senare litar blint på UTAN session) måste använda
 * `ownerUserId`, ALDRIG den inloggade anroparens egna `userId` — annars
 * skriver/läser en inbjuden medlem tyst fel persons rad (eller skapar en
 * spöklik, aldrig synlig gren i sin EGEN user_data) i stället för att
 * faktiskt träffa det delade företaget. `role` är `'owner'` för ägaren,
 * annars `'editor'|'viewer'` från medlemskapsraden.
 *
 * Skriver INTE till `res` vid ägarmissar (måste kunna falla tillbaka
 * tyst till medlemskontrollen) — bara om medlemskontrollen själv slår
 * fel, via loadMemberCompany:s egen res.status(...)-hantering, eller om
 * rollen inte räcker. */
export async function loadOwnedOrMemberCompany(userId, companyId, res, { requireEditor = false } = {}) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas — kan inte verifiera ägarskap server-side.' });
    return null;
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: row, error } = await admin.from('user_data').select('state').eq('user_id', userId).maybeSingle();
  if (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  const ownCompanyData = row?.state?.companies?.[companyId];
  if (ownCompanyData) return { companyData: ownCompanyData, ownerUserId: userId, role: 'owner' };

  const member = await loadMemberCompany(userId, companyId, res);
  if (!member) return null;
  if (requireEditor && member.role !== 'editor') {
    res.status(403).json({ error: 'Din roll (läsare) tillåter inte den här åtgärden.' });
    return null;
  }
  return { companyData: member.companyData, ownerUserId: member.ownerUserId, role: member.role };
}

/** Samma sorts ägarskapsbevis som loadOwnedCompany ovan, men för en
 * INBJUDEN användare (se supabase-setup.sql: company_members) istället för
 * den bokstavliga raden i user_data. Två uppslag: (1) finns en AKTIV
 * medlemskapsrad för den här userId:n på det här company_id:t — bevisar
 * att någon ägare faktiskt bjudit in just den här personen, inte att
 * personen bara påstår det via ett client-supplied company_id; (2) hämtar
 * sedan ägarens egen state precis som loadOwnedCompany, fast med
 * owner_user_id FRÅN medlemskapsraden, aldrig från request-body:n. Kör
 * `res.status(...)...` och returnerar null själv vid fel, samma
 * anropsmönster som ovan. Returnerar även `role` ('editor'|'viewer') och
 * `ownerUserId` — anropande endpoint MÅSTE avvisa skrivningar när
 * role !== 'editor' (server-sidan är den enda riktiga behörighetsgränsen,
 * en klient-döljd knapp räknas inte). */
export async function loadMemberCompany(userId, companyId, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas — kan inte verifiera medlemskap server-side.' });
    return null;
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: membership, error: membershipError } = await admin
    .from('company_members')
    .select('owner_user_id, role, page_access')
    .eq('company_id', companyId)
    .eq('member_user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) {
    res.status(500).json({ error: membershipError.message });
    return null;
  }
  if (!membership) {
    res.status(403).json({ error: 'Du har inte längre åtkomst till det här företaget.' });
    return null;
  }

  const { data: row, error: rowError } = await admin
    .from('user_data')
    .select('state')
    .eq('user_id', membership.owner_user_id)
    .maybeSingle();
  if (rowError) {
    res.status(500).json({ error: rowError.message });
    return null;
  }
  const companyData = row?.state?.companies?.[companyId];
  if (!companyData) {
    // Ägaren finns, men själva företaget är borta ur deras state (t.ex.
    // togs bort) — inbjudan pekar på ett företag som inte längre finns.
    res.status(403).json({ error: 'Företaget hittades inte längre.' });
    return null;
  }
  return { companyData, role: membership.role, pageAccess: membership.page_access || null, ownerUserId: membership.owner_user_id };
}
