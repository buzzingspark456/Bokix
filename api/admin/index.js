import crypto from 'node:crypto';
import { applySecurityHeaders } from '../_security.js';
import { requireAuthedUser } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { createClient } from '@supabase/supabase-js';
import { planFromId } from '../../src/utils/plans.js';

// ── Internt admin-API (/internal på klienten) ───────────────────────────
// EN enda fil för HELA admin-panelen, inte en fil per delsystem —
// samma medvetna konsolidering som company-access.js redan förklarar
// (dess egen kommentar: "Vercels 12-funktionsgräns"). Den här filen
// lägger till den TOLFTE och sista funktionen inom Hobby-taket; nästa
// admin-delsystem MÅSTE läggas till som en ny `resource`-gren HÄR, aldrig
// som en egen fil, annars går deployen sönder.
//
// Blogg (admin-CMS, blog_posts/blogimages) togs bort 2026-09-13 — RLS på
// blogimages-bucketen gick inte att få stabil (se git-historiken för
// felsökningen), och kundbeslutet blev att dra ur funktionen i stället
// för att lägga mer tid på den. blog_posts-tabellen och blogimages-
// bucketen finns kvar orörda i Supabase (ingen DROP kördes — en
// databasändring som kan tappa innehåll görs aldrig automatiskt), bara
// koden som skrev/läste dem är borta.
//
// SÄKERHET — detta är den enda riktiga behörighetsgränsen, allt i
// klienten (InternalAuth.jsx, den dolda /internal-routen) är bara UI:
// varje anrop hit verifierar för det första att Authorization-headern
// hör till en INLOGGAD Supabase-användare (requireAuthedUser, samma
// hjälpfunktion som alla andra känsliga endpoints redan använder), och
// för det andra att den inloggade personens e-post finns i ADMIN_EMAILS
// nedan. Ingen rad i user_data eller en separat "roller"-tabell — en kort
// hårdkodad lista, samma avvägning som FREE_ACCOUNT_EMAILS i App.jsx
// redan gör för en handfull kända e-postadresser.
//
// Kundönskemål ("riktigt admin, inte softwaren själva"): en EGEN,
// dedikerad Supabase-användare (abbealwaki08@gmail.com) med admin-
// åtkomst, UTÖVER (inte i stället för) kontot som faktiskt bokför i
// Bokix (alwakiabdullah1@gmail.com, samma e-postadress som
// FREE_ACCOUNT_EMAILS i App.jsx) — kunden vill kunna logga in på
// /internal med endera. Samma Supabase-projekt/auth-system för båda
// (ingen anledning att bygga ett andra), bara två separata identiteter
// tillåtna, ingen av dem beroende av den andra.
const ADMIN_EMAILS = ['alwakiabdullah1@gmail.com', 'abbealwaki08@gmail.com'];

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

// Tvingad tvåfaktorsautentisering för /internal (kundönskemål: "gör det
// super, super svårt att komma in") — ett läckt eller gissat lösenord
// ENSAMT ska aldrig räcka hit, till skillnad från resten av appen där 2FA
// är valfritt. Den RIKTIGA spärren måste ligga HÄR, server-side: en klient
// som redan har en session (t.ex. en flik inloggad i den vanliga appen)
// skulle annars kunna hoppa förbi InternalAuth.jsx:s UI helt och anropa
// det här API:t direkt med en aal1-token.
//
// aal (Authenticator Assurance Level) står redan i JWT-payloaden som
// Supabase signerar — kräver alltså inget extra nätverksanrop, bara att
// avkoda base64url-delen. Vi verifierar INTE signaturen själva här: det
// gjorde redan requireAuthedUser ovan (supabase.auth.getUser(token) mot
// Supabase Auth), den här funktionen bara läser ut en claim ur en token
// vi redan vet är äkta.
function getTokenAal(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const part = token?.split('.')[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json)?.aal || null;
  } catch {
    return null;
  }
}

function getAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

// ── GA4 Data API (riktig besöksstatistik) ───────────────────────────────
// Server-till-server via ett service-konto — inte OAuth-klienten som
// redan finns för Gmail-inloggning (GOOGLE_OAUTH_CLIENT_ID i api/_gmail.js
// är en HELT annan koppling, kräver en inloggad ANVÄNDARE). Ett
// service-konto behöver ingen mänsklig inloggning, bara att kontot fått
// "Läsbehörig" i GA4-egendomens Åtkomsthantering — gjort 2026-09-13 för
// service-kontot bakom GA4_SERVICE_ACCOUNT_KEY, egendom "Bokix"
// (Property ID 550127081, GA4_PROPERTY_ID).
//
// Ingen extra npm-paket (@google-analytics/data drar in en hel gRPC-stack)
// — Node har allt som behövs inbyggt: crypto för att signera en RS256-JWT
// själv, global fetch för de två HTTP-anropen (token-utbyte +
// runReport). Samma "inga nya beroenden för något litet"-avvägning som
// resten av api/-katalogen redan gör.
function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGaAccessToken() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const key = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));
  const signInput = `${header}.${payload}`;
  const signature = crypto.createSign('RSA-SHA256').update(signInput).sign(key.private_key, 'base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signInput}.${signature}`,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokenData.error_description || tokenData.error || 'GA-inloggning misslyckades.');
  return tokenData.access_token;
}

async function runGaReport(accessToken, propertyId, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'GA-rapport misslyckades.');
  return data;
}

// yyyymmdd (GA4:s dimensionsformat för "date") → yyyy-mm-dd, samma format
// signupsByDay redan använder så AnalyticsAdmin.jsx kan rita båda i samma
// mönster.
function gaDateToIso(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

// null = inte konfigurerat än (visa "sätt upp GA" i UI:t), { error } = en
// riktig GA-koppling som just nu felar (fel nyckel, indragen åtkomst,
// fel Property ID) — de två fallen ska INTE se likadana ut för admin.
// `range` (resolveRange ovan) styr samma period som kontografen — GA4:s
// API tar explicita YYYY-MM-DD-datum rakt av, inga relativa "30daysAgo"
// behövs när vi redan räknat ut exakta gränser.
async function fetchGaTraffic(range) {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId || !process.env.GA4_SERVICE_ACCOUNT_KEY) return null;

  try {
    const accessToken = await getGaAccessToken();
    const dateRanges = [{ startDate: range.startIso, endDate: range.endIso }];
    const [byDayReport, channelsReport] = await Promise.all([
      runGaReport(accessToken, propertyId, {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      runGaReport(accessToken, propertyId, {
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
    ]);

    const byDay = (byDayReport.rows || []).map(r => ({
      date: gaDateToIso(r.dimensionValues[0].value),
      pageViews: Number(r.metricValues[0].value),
      users: Number(r.metricValues[1].value),
      sessions: Number(r.metricValues[2].value),
    }));
    const totals = byDay.reduce((acc, d) => ({
      pageViews: acc.pageViews + d.pageViews,
      sessions: acc.sessions + d.sessions,
    }), { pageViews: 0, sessions: 0 });
    const channels = (channelsReport.rows || []).map(r => ({
      channel: r.dimensionValues[0].value,
      sessions: Number(r.metricValues[0].value),
    }));

    return { byDay, totals, channels };
  } catch (err) {
    return { error: err.message };
  }
}

// Delad av Analys, Användare och Säkerhet nedan — samma sidindelnings-
// logik (Supabase-gräns, inte en egen optimering), ingen anledning att
// skriva den tre gånger. Ofarligt idag (litet konto-antal); om kontobasen
// växer mycket är nästa steg att cacha resultatet i stället för att räkna
// om från scratch varje sidladdning, i alla tre vyerna samtidigt.
async function fetchAllUsers(admin) {
  let allUsers = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    allUsers = allUsers.concat(data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  return allUsers;
}

// Datumintervallet Analys-fliken visar — samma upplösta intervall
// används av BÅDE kontografen (Supabase) och GA4-grafen, så de två alltid
// visar samma period. `range` är ett av de fördefinierade snabbvalen;
// `from`/`to` (YYYY-MM-DD) vinner om båda skickas med, det är UI:ts
// "Anpassat"-läge. Klämt till max 2 år så ingen kan be om ett orimligt
// stort GA4-/listUsers-anrop av misstag.
function resolveRange(query) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (query?.from && query?.to) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
      const days = Math.min(730, Math.round((to - from) / 86400000) + 1);
      const start = new Date(to); start.setDate(start.getDate() - (days - 1));
      return { startIso: start.toISOString().slice(0, 10), endIso: to.toISOString().slice(0, 10), days };
    }
  }
  const daysByPreset = { '7d': 7, '30d': 30, '90d': 90, year: 365 };
  const days = daysByPreset[query?.range] || 30;
  const start = new Date(today); start.setDate(start.getDate() - (days - 1));
  return { startIso: start.toISOString().slice(0, 10), endIso: today.toISOString().slice(0, 10), days };
}

// ── Analys (resource: 'analytics') ──────────────────────────────────────
// Kontostatistik Bokix redan äger (Supabase auth.users + public.
// subscriptions) — VEM registrerar sig, UF eller inte, vem betalar —
// PLUS riktig besöksstatistik från GA4 (fetchGaTraffic ovan) när den
// kopplingen är på plats. De två datakällorna hämtas parallellt och
// skickas som separata fält i svaret; ett GA-fel ska aldrig få
// kontostatistiken att också försvinna.
async function handleAnalytics(admin, res, query) {
  let allUsers;
  try { allUsers = await fetchAllUsers(admin); } catch (err) { res.status(500).json({ error: err.message }); return; }

  const ufUsers = allUsers.filter(u => u.user_metadata?.uf).length;

  const range = resolveRange(query);

  // En post per dag i HELA intervallet (även dagar med 0 signups) — så
  // grafen aldrig hoppar över tomma dagar och feltolkar avståndet mellan
  // två punkter.
  const startDate = new Date(range.startIso);
  const days = Array.from({ length: range.days }, (_, i) => {
    const d = new Date(startDate); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const countsByDay = Object.fromEntries(days.map(d => [d, 0]));
  allUsers.forEach(u => {
    const day = u.created_at?.slice(0, 10);
    if (day in countsByDay) countsByDay[day] += 1;
  });

  const { data: subs, error: subsError } = await admin.from('subscriptions').select('status, plan');
  if (subsError) { res.status(500).json({ error: subsError.message }); return; }
  const statusCounts = {};
  (subs || []).forEach(s => { statusCounts[s.status] = (statusCounts[s.status] || 0) + 1; });

  // Nivåfördelning (129 kr "Utan personal" vs 179 kr "Med personal") —
  // tierId håller ihop månads- och årsplan under samma pris-nivå, exakta
  // kronor (129/109 respektive 179/149) skiljer sig bara på intervallet.
  // Konton utan sparat `plan` (skapade innan nivåerna fanns) räknas som
  // "employer" av samma skäl som planIncludesPayroll gör det i plans.js:
  // de har historiskt betalat 179 kr, alltså full funktionalitet.
  const tierCounts = { solo: 0, employer: 0 };
  (subs || []).forEach(s => {
    const plan = planFromId(s.plan);
    const tierId = plan?.tierId || 'employer';
    tierCounts[tierId] = (tierCounts[tierId] || 0) + 1;
  });

  const ga = await fetchGaTraffic(range);

  res.status(200).json({
    totalUsers: allUsers.length,
    ufUsers,
    regularUsers: allUsers.length - ufUsers,
    signupsInRange: allUsers.filter(u => u.created_at >= days[0]).length,
    signupsByDay: days.map(d => ({ date: d, count: countsByDay[d] })),
    range: { startIso: range.startIso, endIso: range.endIso, days: range.days },
    subscriptions: { total: (subs || []).length, byStatus: statusCounts, byTier: tierCounts },
    ga,
  });
}

// ── Användare (resource: 'users') ───────────────────────────────────────
// En rad per konto: kontostatus (auth.users) + företagsnamn (user_data,
// fältet för kontots ursprungliga/legacy-företag — company_members
// hanterar flerföretagsfallet, inte med här) + prenumeration
// (subscriptions) slås ihop HÄR, på servern, i stället för att klienten
// gör tre anrop och pusslar ihop dem själv.
async function handleUsers(admin, res) {
  let allUsers;
  try { allUsers = await fetchAllUsers(admin); } catch (err) { res.status(500).json({ error: err.message }); return; }

  const { data: userData, error: userDataError } = await admin
    .from('user_data')
    .select('user_id, company_name, company_orgnr, onboarding_completed');
  if (userDataError) { res.status(500).json({ error: userDataError.message }); return; }
  const userDataById = Object.fromEntries((userData || []).map(u => [u.user_id, u]));

  const { data: subs, error: subsError } = await admin
    .from('subscriptions')
    .select('user_id, status, plan, trial_ends_at, current_period_end, cancel_at_period_end');
  if (subsError) { res.status(500).json({ error: subsError.message }); return; }
  const subByUserId = Object.fromEntries((subs || []).map(s => [s.user_id, s]));

  const users = allUsers.map(u => {
    const ud = userDataById[u.id];
    const sub = subByUserId[u.id];
    const plan = planFromId(sub?.plan);
    return {
      id: u.id,
      email: u.email,
      uf: !!u.user_metadata?.uf,
      companyName: ud?.company_name || null,
      companyOrgnr: ud?.company_orgnr || null,
      onboardingCompleted: !!ud?.onboarding_completed,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at || null,
      emailConfirmed: !!u.email_confirmed_at,
      subscriptionStatus: sub?.status || null,
      planName: plan?.name || (sub ? 'Med personal (äldre konto)' : null),
      cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
      // GoTrue sätter banned_until till ett datum långt fram i tiden vid
      // avstängning (se handleSuspendUser) — vilket datum spelar ingen
      // roll här, bara att fältet är satt alls.
      suspended: !!u.banned_until,
      isAdmin: isAdminEmail(u.email),
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.status(200).json({ users });
}

// ── Stäng av / återaktivera konto (resource: 'users', POST) ─────────────
// GoTrues egen ban_duration — inget eget "suspended"-fält att hålla i
// synk. En VÄLDIGT lång duration ('876000h' ≈ 100 år) i stället för en
// riktig permanent-flagga, eftersom GoTrue-APIet bara tar en duration,
// aldrig "för alltid"; 'none' häver avstängningen. Adminkontona själva
// (ADMIN_EMAILS) går ALDRIG att stänga av härifrån — annars kunde en admin
// råka låsa ut sig själv (eller den andra admin-adressen) med en
// missklickad knapp.
async function handleSuspendUser(admin, res, body, adminEmail, suspend) {
  const { userId } = body;
  if (!userId) { res.status(400).json({ error: 'userId krävs.' }); return; }

  const { data: target, error: getError } = await admin.auth.admin.getUserById(userId);
  if (getError || !target?.user) { res.status(404).json({ error: 'Kontot hittades inte.' }); return; }
  if (isAdminEmail(target.user.email)) { res.status(400).json({ error: 'Adminkonton kan inte stängas av härifrån.' }); return; }

  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: suspend ? '876000h' : 'none' });
  if (error) { res.status(500).json({ error: error.message }); return; }
  console.log(`[admin/users] ${adminEmail} ${suspend ? 'stängde av' : 'återaktiverade'} ${target.user.email} (${userId})`);
  res.status(200).json({ ok: true });
}

// ── Betalningar (resource: 'payments') ──────────────────────────────────
// Bokix EGEN abonnemangsintäkt (subscriptions-tabellen) — INTE att blanda
// ihop med stripe_ledger_events/zettle_ledger_events (supabase-setup.sql),
// som är KUNDERNAS EGNA bokföringsunderlag för DERAS försäljning. Två
// helt olika Stripe-kopplingar som råkar dela tabellprefix.
async function handlePayments(admin, res) {
  const { data: subs, error: subsError } = await admin
    .from('subscriptions')
    .select('user_id, status, plan, trial_ends_at, current_period_end, cancel_at_period_end, created_at');
  if (subsError) { res.status(500).json({ error: subsError.message }); return; }

  let allUsers;
  try { allUsers = await fetchAllUsers(admin); } catch (err) { res.status(500).json({ error: err.message }); return; }
  const emailById = Object.fromEntries(allUsers.map(u => [u.id, u.email]));

  const rows = (subs || []).map(s => {
    const plan = planFromId(s.plan);
    return {
      userId: s.user_id,
      email: emailById[s.user_id] || null,
      status: s.status,
      planName: plan?.name || 'Med personal (äldre konto)',
      planPrice: plan?.price ?? 179,
      trialEndsAt: s.trial_ends_at,
      currentPeriodEnd: s.current_period_end,
      cancelAtPeriodEnd: s.cancel_at_period_end,
      createdAt: s.created_at,
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // MRR: bara `active` betalar faktiskt varje månad — `trialing` betalar
  // ingenting förrän provperioden (TRIAL_DAYS, 30 dagar) tar slut. Räknas
  // de med hade siffran sett bättre ut än pengarna som faktiskt kommer in.
  const mrr = rows.filter(r => r.status === 'active').reduce((sum, r) => sum + r.planPrice, 0);

  // "Kräver uppföljning": betalningen har redan fallerat eller kortet är
  // ogiltigt — den enda statusen där någon (kunden eller Bokix) faktiskt
  // behöver göra något, till skillnad från trialing/active/canceled som
  // alla sköter sig själva.
  const atRisk = rows.filter(r => ['past_due', 'unpaid', 'incomplete'].includes(r.status));

  res.status(200).json({ subscriptions: rows, mrr, atRisk });
}

// ── Säkerhet (resource: 'security') ─────────────────────────────────────
// Tre datakällor: auth.users (senaste inloggningar, obekräftade
// mejladresser), den hårdkodade admin-listan (så det syns i UI:t vilka
// konton som HAR adminåtkomst utan att läsa källkoden), och nu även
// security_events (logSecurityEvent nedan) — nekade admin-försök,
// misslyckad tvåfaktor och riktiga API-fel. Se supabase-setup.sql:s
// security_events-kommentar för HONEST scope: ett rent gissat lösenord
// (fel innan Supabase Auth ens svarar) syns aldrig här, bara det som
// passerar genom ett redan inloggat anrop till den här filen.
async function handleSecurity(admin, res) {
  let allUsers;
  try { allUsers = await fetchAllUsers(admin); } catch (err) { res.status(500).json({ error: err.message }); return; }

  const recentSignIns = allUsers
    .filter(u => u.last_sign_in_at)
    .sort((a, b) => new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at))
    .slice(0, 20)
    .map(u => ({ email: u.email, lastSignInAt: u.last_sign_in_at }));

  const unconfirmed = allUsers
    .filter(u => !u.email_confirmed_at)
    .map(u => ({ email: u.email, createdAt: u.created_at }));

  // Senaste 50 händelserna, nyast först — se logSecurityEvent nedan för
  // vilka två saker som faktiskt kan hamna här och varför inte fler.
  const { data: events, error: eventsError } = await admin
    .from('security_events')
    .select('type, email, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (eventsError) { res.status(500).json({ error: eventsError.message }); return; }

  res.status(200).json({ adminEmails: ADMIN_EMAILS, recentSignIns, unconfirmed, events: events || [] });
}

// Tyst — ett loggningsfel ska aldrig få den FAKTISKA admin-förfrågan att
// krascha (den har redan fått sitt riktiga svar, eller är på väg att få
// ett). Bäst-försök, samma avvägning som stripe_ledger_events cronen gör
// för sin egen loggning.
async function logSecurityEvent(admin, type, email, detail) {
  try {
    await admin.from('security_events').insert({ type, email: email || null, detail: detail || null });
  } catch {
    // se kommentaren ovan
  }
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!checkRateLimit(req, res, { key: 'admin', max: 120 })) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  const admin = getAdminClient();
  if (!admin) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas.' });
    return;
  }

  if (!isAdminEmail(user.email)) {
    // Samma svar oavsett ANLEDNING (fel e-post vs. inget konto alls) —
    // "403 saknar behörighet" avslöjar inte att just den här e-posten är
    // inloggad men inte admin, ingen anledning att vara mer specifik mot
    // en icke-admin än nödvändigt. Loggas ändå (den här personen HAR ett
    // giltigt Supabase-konto, annars hade requireAuthedUser redan stoppat
    // det ovan) — vem som helst som känner till /internal och försöker.
    await logSecurityEvent(admin, 'admin_denied', user.email);
    res.status(403).json({ error: 'Du har inte behörighet till admin-panelen.' });
    return;
  }
  if (getTokenAal(req) !== 'aal2') {
    // Rätt e-post, rätt lösenord, men ingen klarad tvåfaktorskod — värt
    // att se i loggen om det upprepas (ett läckt lösenord utan enheten
    // som har koden), till skillnad från den vanliga "glömde logga in med
    // 2FA än"-vägen som InternalApp.jsx redan löser i UI:t utan att
    // användaren märker det som ett fel.
    await logSecurityEvent(admin, 'mfa_required', user.email);
    // Samma svarsform som klienten redan vet hantera (se InternalApp.jsx:s
    // "mfa_required"-gren) — en tydlig, egen felkod i stället för att
    // klämma in det i det generella 403-svaret ovan.
    res.status(401).json({ error: 'mfa_required' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const resource = req.query?.resource;
      if (resource === 'analytics') { await handleAnalytics(admin, res, req.query); return; }
      if (resource === 'users') { await handleUsers(admin, res); return; }
      if (resource === 'payments') { await handlePayments(admin, res); return; }
      if (resource === 'security') { await handleSecurity(admin, res); return; }
      res.status(400).json({ error: 'Okänd resurs.' });
      return;
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.resource === 'users') {
        if (body.action === 'suspend') { await handleSuspendUser(admin, res, body, user.email, true); return; }
        if (body.action === 'unsuspend') { await handleSuspendUser(admin, res, body, user.email, false); return; }
        res.status(400).json({ error: 'Okänd action.' }); return;
      }
      res.status(400).json({ error: 'Okänd resurs.' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin/index error:', err);
    // En oväntad krasch NÅGONSTANS i admin-panelen — inte en förväntad
    // 400/403/404 (de har redan sin egen res.status(...) och når aldrig
    // hit), utan en riktig bugg. Loggas i samma säkerhetshändelse-tabell
    // Security-fliken redan visar, så ett trasigt admin-API syns där utan
    // att någon behöver leta i Vercels loggar.
    await logSecurityEvent(admin, 'admin_api_error', user.email, err.message || String(err));
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Något gick fel.' });
  }
}
