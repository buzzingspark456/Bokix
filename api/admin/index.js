import crypto from 'node:crypto';
import { applySecurityHeaders } from '../_security.js';
import { requireAuthedUser } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';
import { ADMIN_EMAILS } from '../_systemEvents.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { planFromId } from '../../src/utils/plans.js';
import * as featureFlags from '../../src/utils/featureFlags.js';
import { buildOverview, summarizeState } from './_customers.js';
import { detectOrgType } from '../../src/utils/orgType.js';
import { buildStatus, COMPONENT_IDS } from '../_status.js';
import { withSentry } from '../_sentry.js';
import { withTablesState } from '../_companyStore.js';

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
// tillåtna, ingen av dem beroende av den andra. Listan (ADMIN_EMAILS)
// ligger i _systemEvents.js, som också mejlar larm till samma adresser.

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

// Stark inloggning krävs för /internal (ägarens val 2026-10-18, ISO 27001,
// docs/isms Å3): Face ID (passkey) eller lösenord + kod från en
// autentiseringsapp. Bara lösenord räcker inte längre, eftersom panelen ser
// alla kunder. Läses ur sessionens token (aal och amr), som requireAuthedUser
// redan har verifierat mot Supabase.
const STRONG_AMR = /webauthn|passkey/i;
// Avstängt 2026-10-21 på ägarens begäran: lösenord räcker tills vidare.
// Sätt till true för att kräva Face ID eller tvåfaktor igen.
const REQUIRE_STRONG_AUTH = false;

export function sessionStrength(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    const methods = (Array.isArray(payload.amr) ? payload.amr : [])
      .map(m => (typeof m === 'string' ? m : m?.method))
      .filter(Boolean);
    return { strong: payload.aal === 'aal2' || methods.some(m => STRONG_AMR.test(m)), aal: payload.aal || null, methods };
  } catch {
    return { strong: false, aal: null, methods: [] };
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

  const ufUsers = allUsers.filter(u => u.app_metadata?.uf).length;

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
export async function handleUsers(admin, res) {
  let allUsers;
  try { allUsers = await fetchAllUsers(admin); } catch (err) { res.status(500).json({ error: err.message }); return; }

  const { data: userData, error: userDataError } = await admin
    .from('user_data')
    .select('user_id, company_name, company_orgnr, onboarding_completed, updated_at');
  if (userDataError) { res.status(500).json({ error: userDataError.message }); return; }
  const userDataById = Object.fromEntries((userData || []).map(u => [u.user_id, u]));
  // Konton som hoppat över guiden har inget company_name i raden: namnet
  // och org.nr hämtas då ur det sparade företaget (bara för dem, högst 60).
  const missing = (userData || []).filter(u => !u.company_name).map(u => u.user_id).slice(0, 60);
  if (missing.length) {
    const { data: blobRows } = await admin.from('user_data').select('user_id, state').in('user_id', missing);
    const rows = await withTablesState(admin, blobRows || []);
    rows.forEach(r => {
      const first = summarizeState(r.state)[0];
      if (first?.name) userDataById[r.user_id] = { ...userDataById[r.user_id], company_name: first.name, company_orgnr: first.orgNr };
    });
  }

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
      uf: !!u.app_metadata?.uf,
      companyName: ud?.company_name || null,
      companyOrgnr: ud?.company_orgnr || null,
      onboardingCompleted: !!ud?.onboarding_completed,
      orgType: u.app_metadata?.uf ? 'UF-företag' : (detectOrgType(ud?.company_orgnr) || null),
      lastSavedAt: ud?.updated_at || null,
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
// Rabatten på en prenumeration, läst live från Stripe (kuponger sparas inte
// i subscriptions-tabellen). null om ingen rabatt eller om Stripe inte svarar.
export function discountFromStripe(sub) {
  const list = [...(Array.isArray(sub?.discounts) ? sub.discounts : []), sub?.discount].filter(d => d && typeof d === 'object');
  const d = list[0];
  const coupon = d?.coupon || d?.source?.coupon;
  if (!coupon || typeof coupon !== 'object') return null;
  return {
    name: coupon.name || d.promotion_code?.code || null,
    percentOff: coupon.percent_off ?? null,
    amountOff: coupon.amount_off != null ? coupon.amount_off / 100 : null,
    duration: coupon.duration || null,
    endsAt: d.end ? new Date(d.end * 1000).toISOString() : null,
  };
}

// Vad kontot faktiskt betalar per månad efter rabatten. amount_off gäller
// per faktura, så på en årsplan delas den på tolv.
export function priceAfterDiscount(monthlyPrice, discount, yearly) {
  if (!discount) return monthlyPrice;
  let price = monthlyPrice;
  if (discount.percentOff != null) price = monthlyPrice * (1 - discount.percentOff / 100);
  else if (discount.amountOff != null) price = monthlyPrice - (yearly ? discount.amountOff / 12 : discount.amountOff);
  return Math.max(0, Math.round(price));
}

async function loadStripeDiscounts(subscriptionIds) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('pk_') || !subscriptionIds.length) return {};
  const stripe = new Stripe(key, {});
  const entries = await Promise.all(subscriptionIds.map(async (id) => {
    try {
      const sub = await stripe.subscriptions.retrieve(id, { expand: ['discounts'] });
      // Nyare API-versioner ger kupongen som id under source.coupon.
      for (const d of [...(sub.discounts || []), sub.discount]) {
        if (!d || typeof d !== 'object') continue;
        const couponId = typeof d.coupon === 'string' ? d.coupon : typeof d.source?.coupon === 'string' ? d.source.coupon : null;
        if (couponId) d.coupon = await stripe.coupons.retrieve(couponId);
      }
      return [id, discountFromStripe(sub)];
    } catch {
      return [id, null];
    }
  }));
  return Object.fromEntries(entries);
}

// Prenumerationerna med pris efter rabatt, MRR och de som kräver uppföljning.
// Används av Betalningar och Översikt. Kastar vid fel.
async function loadPayments(admin, allUsersIn) {
  const { data: subs, error: subsError } = await admin
    .from('subscriptions')
    .select('user_id, status, plan, trial_ends_at, current_period_end, cancel_at_period_end, created_at, stripe_subscription_id');
  if (subsError) throw new Error(subsError.message);

  const allUsers = allUsersIn || await fetchAllUsers(admin);
  const emailById = Object.fromEntries(allUsers.map(u => [u.id, u.email]));
  const discounts = await loadStripeDiscounts((subs || []).filter(s => s.stripe_subscription_id && s.status !== 'canceled').map(s => s.stripe_subscription_id));

  const rows = (subs || []).map(s => {
    const plan = planFromId(s.plan);
    const listPrice = plan?.price ?? 179;
    const discount = discounts[s.stripe_subscription_id] || null;
    return {
      userId: s.user_id,
      email: emailById[s.user_id] || null,
      // Grundarnas egna konton är inga intäkter och räknas inte i MRR/ARR.
      isAdmin: isAdminEmail(emailById[s.user_id]),
      status: s.status,
      planName: plan?.name || 'Med personal (äldre konto)',
      listPrice,
      planPrice: priceAfterDiscount(listPrice, discount, plan?.intervalId === 'yearly'),
      discount,
      trialEndsAt: s.trial_ends_at,
      currentPeriodEnd: s.current_period_end,
      cancelAtPeriodEnd: s.cancel_at_period_end,
      createdAt: s.created_at,
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // MRR: bara `active` betalar faktiskt varje månad — `trialing` betalar
  // ingenting förrän provperioden (TRIAL_DAYS, 30 dagar) tar slut. Räknas
  // de med hade siffran sett bättre ut än pengarna som faktiskt kommer in.
  // Pengarna efter rabatt, utan grundarnas egna konton. 100 % rabatt betalar
  // ingenting och räknas inte som betalande (drar annars ner snittet).
  const paying = rows.filter(r => r.status === 'active' && !r.isAdmin && r.planPrice > 0);
  const mrr = paying.reduce((sum, r) => sum + r.planPrice, 0);
  const discountPerMonth = paying.reduce((sum, r) => sum + (r.listPrice - r.planPrice), 0);

  // "Kräver uppföljning": betalningen har redan fallerat eller kortet är
  // ogiltigt — den enda statusen där någon (kunden eller Bokix) faktiskt
  // behöver göra något, till skillnad från trialing/active/canceled som
  // alla sköter sig själva.
  const atRisk = rows.filter(r => ['past_due', 'unpaid', 'incomplete'].includes(r.status));

  return { subscriptions: rows, mrr, payingCount: paying.length, discountPerMonth, atRisk };
}

async function handlePayments(admin, res) {
  try { res.status(200).json(await loadPayments(admin)); } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Översikt (resource: 'overview') ─────────────────────────────────────
// Det som behöver uppmärksamhet i dag: nya konton, provperioder som tar
// slut, nya konton som inte kommit igång, betalningar, meddelanden och fel.
// Kundernas sparade data läses bara för nya konton och provperioder
// (högst 80), aldrig för alla.
export async function handleOverview(admin, res) {
  const users = await fetchAllUsers(admin);
  const { data: subs, error: subsError } = await admin.from('subscriptions').select('user_id, company_id, status, plan, trial_ends_at, cancel_at_period_end');
  if (subsError) { res.status(500).json({ error: subsError.message }); return; }
  const monthAgo = Date.now() - 31 * 86400000;
  const ids = [...new Set([
    ...users.filter(u => new Date(u.created_at).getTime() >= monthAgo).map(u => u.id),
    ...(subs || []).filter(s => s.status === 'trialing').map(s => s.user_id),
  ])].slice(0, 80);
  const states = {};
  if (ids.length) {
    const { data: blobRows } = await admin.from('user_data').select('user_id, state').in('user_id', ids);
    (await withTablesState(admin, blobRows || [])).forEach(r => { states[r.user_id] = r.state; });
  }
  const { data: messages } = await admin.from('contact_messages').select('handled_at').is('handled_at', null).limit(500);
  const { data: events } = await admin.from('system_events').select('kind, created_at').not('kind', 'in', '(backup_ok,shadow_read)').gte('created_at', new Date(Date.now() - 86400000).toISOString()).limit(500);
  const payments = await loadPayments(admin, users).catch(() => null);
  res.status(200).json({
    ...buildOverview({ users, subs, states, messages: messages || [], events: events || [], isAdmin: isAdminEmail }),
    mrr: payments?.mrr ?? null,
    payingCount: payments?.payingCount ?? null,
  });
}

// ── Statussidan (resource: 'status') ────────────────────────────────────
// Meddelanden på bokix.se/status: störningar och planerat underhåll. GET ger
// meddelandena och sidan som den ser ut nu; POST skapar, ändrar eller tar bort.
const INCIDENT_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved', 'maintenance'];
const INCIDENT_IMPACTS = ['degraded', 'down', 'maintenance'];

async function handleStatus(admin, res) {
  const now = new Date();
  const [incidents, checks, daily] = await Promise.all([
    admin.from('status_incidents').select('*').order('starts_at', { ascending: false }).limit(100),
    admin.from('status_checks').select('component, status, checked_at, ms, note').gte('checked_at', new Date(now.getTime() - 30 * 60000).toISOString()).order('checked_at', { ascending: false }).limit(60),
    admin.from('status_daily').select('day, component, ok, degraded, down').gte('day', new Date(now.getTime() - 91 * 86400000).toISOString().slice(0, 10)).limit(2000),
  ]);
  const err = incidents.error || checks.error || daily.error;
  if (err) {
    if (/does not exist|schema cache/i.test(err.message)) { res.status(200).json({ missingTable: true, incidents: [] }); return; }
    res.status(500).json({ error: err.message }); return;
  }
  const latest = {};
  (checks.data || []).forEach(r => { if (!latest[r.component]) latest[r.component] = r; });
  res.status(200).json({ incidents: incidents.data || [], latest, page: buildStatus({ latest, daily: daily.data || [], incidents: incidents.data || [], now }) });
}

export function cleanIncident(body) {
  const title = String(body.title || '').trim().slice(0, 120);
  if (!title) return { error: 'Rubrik krävs.' };
  const status = INCIDENT_STATUSES.includes(body.status) ? body.status : 'investigating';
  const impact = INCIDENT_IMPACTS.includes(body.impact) ? body.impact : (status === 'maintenance' ? 'maintenance' : 'degraded');
  const components = Array.isArray(body.components) ? body.components.filter(c => COMPONENT_IDS.includes(c)) : [];
  const startsAt = body.startsAt && !Number.isNaN(Date.parse(body.startsAt)) ? new Date(body.startsAt).toISOString() : null;
  return { value: { title, body: String(body.body || '').trim().slice(0, 2000), status, impact, components, ...(startsAt ? { starts_at: startsAt } : {}) } };
}

async function handleStatusUpdate(admin, res, body, adminEmail) {
  const now = new Date().toISOString();
  if (body.action === 'delete') {
    const { error } = await admin.from('status_incidents').delete().eq('id', body.id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true }); return;
  }
  const { value, error: invalid } = cleanIncident(body);
  if (invalid) { res.status(400).json({ error: invalid }); return; }
  const resolved = value.status === 'resolved' ? { resolved_at: now } : { resolved_at: null };
  if (body.action === 'create') {
    const { error } = await admin.from('status_incidents').insert({ ...value, ...resolved, created_by: adminEmail, updated_at: now });
    if (error) { res.status(500).json({ error: error.message }); return; }
  } else if (body.action === 'update' && body.id) {
    const { error } = await admin.from('status_incidents').update({ ...value, ...resolved, updated_at: now }).eq('id', body.id);
    if (error) { res.status(500).json({ error: error.message }); return; }
  } else { res.status(400).json({ error: 'Okänd action.' }); return; }
  console.log(`[admin/status] ${adminEmail} ${body.action}: ${value.title} (${value.status})`);
  res.status(200).json({ ok: true });
}

// ── Kundkort (resource: 'customer', id) ─────────────────────────────────
// Allt om ett konto på ett ställe: kontot, företagens inställningar och
// användning (utan belopp eller kunders namn), prenumerationerna med länk
// till Stripe, inloggningar och kundens senaste fel.
export async function handleCustomer(admin, res, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) { res.status(400).json({ error: 'Ogiltigt konto-id.' }); return; }
  const { data: got, error: userError } = await admin.auth.admin.getUserById(id);
  if (userError || !got?.user) { res.status(404).json({ error: 'Kontot hittades inte.' }); return; }
  const u = got.user;
  const { data: udBlob } = await admin.from('user_data').select('state, updated_at, onboarding_completed, onboarding_skipped').eq('user_id', id).maybeSingle();
  const ud = udBlob ? (await withTablesState(admin, [{ ...udBlob, user_id: id }]))[0] : udBlob;
  const { data: subs } = await admin.from('subscriptions').select('company_id, status, plan, trial_ends_at, current_period_end, cancel_at_period_end, created_at, stripe_customer_id').eq('user_id', id);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: logins } = await admin.from('login_events').select('device, created_at').eq('user_id', id).gte('created_at', monthAgo).order('created_at', { ascending: false }).limit(300);
  const { data: events } = await admin.from('system_events').select('kind, detail, created_at').ilike('detail', `%${id}%`).order('created_at', { ascending: false }).limit(10);
  const { data: members } = await admin.from('company_members').select('company_id, invited_email, role, status').eq('owner_user_id', id);
  const companies = summarizeState(ud?.state);
  res.status(200).json({
    account: {
      id: u.id, email: u.email, createdAt: u.created_at, lastSignInAt: u.last_sign_in_at || null,
      emailConfirmed: Boolean(u.email_confirmed_at), uf: Boolean(u.app_metadata?.uf), suspended: Boolean(u.banned_until),
      isAdmin: isAdminEmail(u.email), name: [u.user_metadata?.first_name, u.user_metadata?.last_name].filter(Boolean).join(' ') || null,
      onboardingCompleted: Boolean(ud?.onboarding_completed), onboardingSkipped: Boolean(ud?.onboarding_skipped), lastSavedAt: ud?.updated_at || null,
    },
    companies: companies.map(c => ({
      ...c,
      members: (members || []).filter(m => m.company_id === c.id && m.status !== 'revoked').map(m => ({ email: m.invited_email, role: m.role, status: m.status })),
    })),
    subscriptions: (subs || []).map(sub => {
      const plan = planFromId(sub.plan);
      return {
        companyId: sub.company_id || null, companyName: (sub.company_id ? companies.find(c => c.id === sub.company_id) : companies[0])?.name || null,
        status: sub.status, planName: plan?.name || null, price: plan?.price ?? null,
        trialEndsAt: sub.trial_ends_at, currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end), createdAt: sub.created_at,
        stripeUrl: sub.stripe_customer_id ? `https://dashboard.stripe.com/customers/${sub.stripe_customer_id}` : null,
      };
    }),
    logins: { last30Days: (logins || []).length, recent: (logins || []).slice(0, 5) },
    errors: events || [],
  });
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

// ── Inkorg (resource: 'inbox') ──────────────────────────────────────────
// Kontaktformulären (contact_messages, sparade av api/contact.js). Saknas
// tabellen har SQL:en supabase-2026-09-27-admin.sql inte körts än; det sägs
// rakt ut i stället för att visas som ett fel.
async function handleInbox(admin, res) {
  const { data, error } = await admin
    .from('contact_messages')
    .select('id, name, email, topic, message, email_sent, handled_at, handled_by, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    if (/does not exist|schema cache|contact_messages/i.test(error.message)) { res.status(200).json({ missingTable: true, messages: [] }); return; }
    res.status(500).json({ error: error.message }); return;
  }
  res.status(200).json({ messages: data || [] });
}

async function handleInboxUpdate(admin, res, body, adminEmail) {
  if (!body.id) { res.status(400).json({ error: 'id krävs.' }); return; }
  const handled = body.action === 'handle';
  const { error } = await admin.from('contact_messages')
    .update({ handled_at: handled ? new Date().toISOString() : null, handled_by: handled ? adminEmail : null })
    .eq('id', body.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(200).json({ ok: true });
}

// ── Systemstatus (resource: 'system') ───────────────────────────────────
// Det som behöver åtgärdas, samlat: vilka tjänster som är konfigurerade
// (bara om nyckeln finns, aldrig värdet), misslyckade mejl, fel i admin-
// API:t, betalningar som fallerat, obesvarade kontaktformulär, databasens
// och fillagringens storlek, och funktionsflaggorna i src/utils/featureFlags.js.
const CONFIG_CHECKS = [
  ['RESEND_API_KEY', 'E-post (Resend)', 'Fakturor, påminnelser och kontaktformuläret kan inte mejlas.'],
  ['STRIPE_SECRET_KEY', 'Stripe', 'Abonnemang och betallänkar fungerar inte.'],
  ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook', 'Betalningar registreras inte automatiskt.'],
  ['CRON_SECRET', 'Schemalagda jobb', 'Nattjobben (påminnelser, arkiv, gallring) kan inte köras säkert.'],
  ['EMAIL_SECRET_KEY', 'Egen avsändaradress', 'Kunderna kan inte skicka från sin egen adress.'],
  ['RECAPTCHA_SECRET_KEY', 'reCAPTCHA', 'Kontaktformuläret har bara hastighetsbegränsning som spamskydd.'],
  ['GA4_SERVICE_ACCOUNT_KEY', 'Google Analytics', 'Besöksstatistiken under Analys saknas.'],
];
// Supabase gratisplan: 500 MB databas och 1 GB fillagring.
const DB_LIMIT_BYTES = 500 * 1024 * 1024;
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

// Sentry (felspårning, api/_sentry.js och src/utils/sentry.js): olösta fel
// de senaste två veckorna. Kräver en läs-token i Vercel (SENTRY_API_TOKEN med
// event:read, SENTRY_ORG, SENTRY_PROJECT); utan den visas bara att Sentry är på.
async function loadSentryIssues() {
  const token = process.env.SENTRY_API_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const link = org ? `https://${org}.sentry.io/issues/` : 'https://sentry.io/';
  if (!token || !org || !project) return { apiConfigured: false, link, issues: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const url = `https://de.sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?query=is:unresolved&statsPeriod=14d&limit=10`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    if (!r.ok) return { apiConfigured: true, link, issues: [], error: `Sentry svarade ${r.status}` };
    const rows = await r.json();
    return {
      apiConfigured: true,
      link,
      issues: (Array.isArray(rows) ? rows : []).map(i => ({
        title: String(i.title || '').slice(0, 200),
        culprit: String(i.culprit || '').slice(0, 200),
        count: Number(i.count) || 0,
        users: Number(i.userCount) || 0,
        lastSeen: i.lastSeen || null,
        permalink: i.permalink || link,
      })),
    };
  } catch (err) {
    return { apiConfigured: true, link, issues: [], error: err?.name === 'AbortError' ? 'Sentry svarade inte' : 'Kunde inte nå Sentry' };
  } finally {
    clearTimeout(timer);
  }
}

async function handleSystem(admin, res) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };

  // Webhooken läser sin hemlighet under flera namn (se getWebhookSecrets i
  // api/stripe/webhook.js); produktionen har den i STRIPE_WEBHOOK_SECRET_SELF.
  const ALT_KEYS = { STRIPE_WEBHOOK_SECRET: ['STRIPE_WEBHOOK_SECRET_SELF'] };
  const config = CONFIG_CHECKS.map(([key, label, impact]) => ({
    key, label, impact,
    ok: [key, ...(ALT_KEYS[key] || [])].some((k) => Boolean(process.env[k])),
  }));

  const systemEvents = await safe(async () => {
    const { data, error } = await admin.from('system_events').select('kind, detail, created_at').not('kind', 'in', '(backup_ok,shadow_read)').gte('created_at', since).order('created_at', { ascending: false }).limit(50);
    return error ? null : data;
  }, null);
  const apiErrors = await safe(async () => {
    const { data } = await admin.from('security_events').select('type, email, detail, created_at').eq('type', 'admin_api_error').gte('created_at', since).order('created_at', { ascending: false }).limit(20);
    return data || [];
  }, []);
  const atRisk = await safe(async () => {
    const { data } = await admin.from('subscriptions').select('status').in('status', ['past_due', 'unpaid', 'incomplete']);
    return (data || []).length;
  }, 0);
  const unhandled = await safe(async () => {
    const { count, error } = await admin.from('contact_messages').select('id', { count: 'exact', head: true }).is('handled_at', null);
    return error ? null : count;
  }, null);
  const db = await safe(async () => {
    const { data, error } = await admin.rpc('admin_db_stats');
    return error ? null : data;
  }, null);
  const sentry = await safe(loadSentryIssues, { apiConfigured: false, link: 'https://sentry.io/', issues: [] });

  res.status(200).json({
    config,
    sentry,
    systemEvents,
    apiErrors,
    atRisk,
    unhandledMessages: unhandled,
    storage: db ? { ...db, dbLimit: DB_LIMIT_BYTES, storageLimit: STORAGE_LIMIT_BYTES } : null,
    featureFlags: Object.entries(featureFlags).map(([name, value]) => ({ name, value })),
    // Saknas något av detta har supabase-2026-09-27-admin.sql inte körts.
    setupMissing: systemEvents === null || unhandled === null || db === null,
  });
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

async function handler(req, res) {
  applySecurityHeaders(res);
  // Adminsiffrorna ska alltid vara färska, aldrig ett sparat svar.
  res.setHeader('Cache-Control', 'no-store');
  if (!(await checkRateLimit(req, res, { key: 'admin', max: 120 }))) return;

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

  const authHeader = String(req.headers['authorization'] || req.headers['Authorization'] || '');
  const strength = sessionStrength(authHeader.replace(/^Bearer\s+/i, ''));
  if (REQUIRE_STRONG_AUTH && !strength.strong) {
    // Metoderna skickas med, så en ny inloggningsmetod som borde räknas syns direkt.
    await logSecurityEvent(admin, 'admin_weak_login', user.email, `${strength.aal || '?'}: ${strength.methods.join(', ') || 'okänd'}`);
    res.status(403).json({
      error: 'Admin-panelen kräver Face ID eller tvåfaktor. Logga in med Face ID, eller med lösenord och kod från din autentiseringsapp.',
      code: 'strong_auth_required',
      methods: strength.methods,
    });
    return;
  }
  try {
    if (req.method === 'GET') {
      const resource = req.query?.resource;
      if (resource === 'overview') { await handleOverview(admin, res); return; }
      if (resource === 'status') { await handleStatus(admin, res); return; }
      if (resource === 'customer') { await handleCustomer(admin, res, req.query?.id); return; }
      if (resource === 'analytics') { await handleAnalytics(admin, res, req.query); return; }
      if (resource === 'users') { await handleUsers(admin, res); return; }
      if (resource === 'payments') { await handlePayments(admin, res); return; }
      if (resource === 'security') { await handleSecurity(admin, res); return; }
      if (resource === 'inbox') { await handleInbox(admin, res); return; }
      if (resource === 'system') { await handleSystem(admin, res); return; }
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
      if (body.resource === 'inbox' && ['handle', 'unhandle'].includes(body.action)) { await handleInboxUpdate(admin, res, body, user.email); return; }
      if (body.resource === 'status' && ['create', 'update', 'delete'].includes(body.action)) { await handleStatusUpdate(admin, res, body, user.email); return; }
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

export default withSentry(handler, '/api/admin');
