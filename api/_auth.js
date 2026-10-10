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

/** Hittar ett företag i state.companies. Nyckeln och företagets eget
 * company.id är oftast samma, men inte alltid: äldre konton har företaget
 * under en annan nyckel än sitt id (createEmptyCompanyData-buggen), och
 * Inställningar bjuder in med company.id. Provar nyckeln först, sedan
 * company.id. Returnerar { key, data } (key = där det faktiskt ligger, och
 * dit skrivningar ska gå) eller null. */
export function findCompanyEntry(companies, companyId) {
  if (!companies || !companyId) return null;
  if (companies[companyId]) return { key: companyId, data: companies[companyId] };
  const match = Object.entries(companies).find(([, c]) => c?.company?.id === companyId);
  return match ? { key: match[0], data: match[1] } : null;
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
  const companyData = findCompanyEntry(row?.state?.companies, companyId)?.data;
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
  const ownEntry = findCompanyEntry(row?.state?.companies, companyId);
  if (ownEntry) return { companyData: ownEntry.data, companyKey: ownEntry.key, ownerUserId: userId, role: 'owner' };

  const member = await loadMemberCompany(userId, companyId, res);
  if (!member) return null;
  if (requireEditor && member.role !== 'editor') {
    res.status(403).json({ error: 'Din roll (läsare) tillåter inte den här åtgärden. Be ägaren ändra din roll till Kan redigera under Inställningar → Användare.' });
    return null;
  }
  return { companyData: member.companyData, companyKey: member.companyKey, ownerUserId: member.ownerUserId, role: member.role };
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
  const entry = findCompanyEntry(row?.state?.companies, companyId);
  const companyData = entry?.data;
  if (!companyData) {
    // Ägaren finns, men själva företaget är borta ur deras state (t.ex.
    // togs bort) — inbjudan pekar på ett företag som inte längre finns.
    res.status(403).json({ error: 'Företaget hittades inte längre.' });
    return null;
  }
  return { companyData, companyKey: entry.key, role: membership.role, pageAccess: membership.page_access || null, ownerUserId: membership.owner_user_id };
}

// ── Server-side betalningsspärr ────────────────────────────────────────
// Speglar klientspärren i App.jsx (ALLOWED_SUBSCRIPTION_STATUSES,
// FREE_ACCOUNT_EMAILS, UF-gratisperiod, delad åtkomst), men som en riktig
// säkerhetsgräns. Klientspärren är produktens UX, det här är låset.
// Samma regler finns i databasen: public.has_paid_access() i
// supabase-setup.sql. Ändras en regel här ska den ändras där också.
//
// Undantagna anrop (prenumerationskassan, arkivnedladdningen, webhook,
// cron, lösenordsåterställning, signed_url för läsning) ska INTE anropa
// det här — läsrätten finns kvar i sju år även utan prenumeration.

const ALLOWED_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due'];

// Samma två konton som App.jsx FREE_ACCOUNT_EMAIL_HASHES och
// admin/index.js ADMIN_EMAILS. Klartext går bra här: serverkod hamnar
// aldrig i den publika JS-bunten, och repot är privat.
const FREE_EMAILS = ['alwakiabdullah1@gmail.com', 'abbealwaki08@gmail.com'];

export function isFreeEmail(email) {
  return FREE_EMAILS.includes(String(email || '').trim().toLowerCase());
}

/** UF-gratisperioden, räknad från KONTOTS skapelsedatum (auth.users.created_at).
 *  Medvetet INTE från user_metadata.uf_started_at: user_metadata kan varje
 *  inloggad användare skriva om själv (supabase.auth.updateUser), så ett
 *  datum därifrån gick att flytta fram för evigt gratis. uf_started_at sätts
 *  ändå vid registreringen (Auth.jsx), så för ett riktigt UF-konto är de två
 *  samma tidpunkt. Flaggan `uf` ligger kvar i user_metadata — den går att
 *  sätta själv, men ger då högst tre månader från registreringen, samma
 *  sak som en provperiod. */
const UF_FREE_MONTHS = 3;
export function isWithinUfFreePeriod(user) {
  if (!user?.user_metadata?.uf) return false;
  // Avslutat UF-år (app_metadata, bara servern kan skriva) = perioden är slut.
  if (user.app_metadata?.uf_closed_at) return false;
  const created = new Date(user.created_at);
  if (Number.isNaN(created.getTime())) return false;
  const endsAt = new Date(created.getTime());
  endsAt.setMonth(endsAt.getMonth() + UF_FREE_MONTHS);
  return new Date() < endsAt;
}

function adminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

/** Har kontot `userId` själv rätt att använda Bokix (egen prenumeration,
 *  gratiskonto eller UF-period)? `knownUser` = redan verifierad användare,
 *  annars slås kontot upp. Vid databasfel släpps kontot igenom (loggas):
 *  en betalande kund ska aldrig låsas ute av ett tillfälligt fel. */
export async function hasPaidAccess(admin, userId, knownUser = null) {
  let user = knownUser;
  if (!user) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.warn('hasPaidAccess: kunde inte läsa kontot, släpper igenom.', error.message);
      return true;
    }
    user = data?.user || null;
  }
  if (user && isFreeEmail(user.email)) return true;
  if (user && isWithinUfFreePeriod(user)) return true;

  const { data: subs, error } = await admin
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId);
  if (error) {
    console.warn('hasPaidAccess: kunde inte läsa subscriptions, släpper igenom.', error.message);
    return true;
  }
  return (subs || []).some(s => ALLOWED_SUBSCRIPTION_STATUSES.includes(s.status));
}

function paymentRequired(res, message = 'Ingen aktiv prenumeration. Gå till betalningssidan.') {
  res.status(402).json({ error: message });
  return false;
}

/**
 * Får `user` använda betalda funktioner? Egen prenumeration, gratiskonto,
 * UF-period — eller aktivt medlemskap i ett företag vars ÄGARE har betald
 * åtkomst. Ett medlemskap hos en ägare som slutat betala räcker inte: annars
 * kunde ett obetalt konto bjuda in sin egen andra e-postadress och fortsätta
 * gratis via den.
 *
 * Returnerar true om anroparen får fortsätta, annars false (402 redan skickat).
 */
export async function requireActiveSubscription(user, res) {
  if (isFreeEmail(user.email)) return true;
  if (isWithinUfFreePeriod(user)) return true;

  const admin = adminClient();
  if (!admin) {
    console.warn('requireActiveSubscription: SUPABASE_SERVICE_ROLE_KEY saknas, hoppar över kontrollen.');
    return true;
  }

  if (await hasPaidAccess(admin, user.id, user)) return true;

  const { data: memberships, error } = await admin
    .from('company_members')
    .select('owner_user_id')
    .eq('member_user_id', user.id)
    .eq('status', 'active');
  if (error) {
    console.warn('requireActiveSubscription: kunde inte läsa medlemskap, släpper igenom.', error.message);
    return true;
  }
  const owners = [...new Set((memberships || []).map(m => m.owner_user_id))];
  for (const ownerId of owners) {
    if (await hasPaidAccess(admin, ownerId)) return true;
  }
  return paymentRequired(res);
}

/** För en inbjuden medlem som skriver i ägarens företag: det är ÄGAREN som
 *  ska ha betald åtkomst, inte medlemmen. */
export async function requireOwnerPaidAccess(ownerUserId, res) {
  const admin = adminClient();
  if (!admin) return true;
  if (await hasPaidAccess(admin, ownerUserId)) return true;
  return paymentRequired(res, 'Företagets ägare har ingen aktiv prenumeration. Ändringar kan inte sparas just nu.');
}
