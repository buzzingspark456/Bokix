import { applySecurityHeaders } from '../_security.js';
// Stripe Connect: starta/koppla från anslutningen till kundens EGNA Stripe-
// konto (för att ta emot kortbetalningar på sina fakturor) — HELT separat
// från Bokix egen prenumeration (create-subscription-checkout.js) eller
// kundfakturors betalningar (create-checkout-session.js).
//
// Slog ihop de tidigare separata filerna oauth-start.js och disconnect.js
// till en enda (dispatch på body.action) för att göra plats åt en ny
// integration (Zettle) under Vercels 12-funktionsgräns (Hobby-plan) —
// samma konsoliderings-mönster som redan används av api/email/domains/
// index.js (tidigare create.js + status.js) och av create-subscription-
// checkout.js (action: 'cancel'/'reactivate' i den här sessionen). Valde
// just DETTA par att slå ihop, inte t.ex. webhook.js eller checkout-
// session-filerna: start/frånkoppling är kopplingens livscykel (på/av),
// inte pengaflödet självt — lägst risk att röra av de befintliga Stripe-
// filerna. api/stripe/callback.js (själva token-utbytet efter Stripes
// redirect) rörs INTE, det är den känsligaste biten av flödet.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createSignedState } from './_oauthState.js';
import { stripeOauthStateCookie } from './_cookies.js';
import { parseJsonBody } from './_parseBody.js';
import { requireAuthedUser, loadOwnedOrMemberCompany, requireActiveSubscription } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';
import { verifyReauthGrant } from '../_signedToken.js';
import { syncStripeLedger } from './_ledgerSync.js';
import { withSentry } from '../_sentry.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_') ? new Stripe(stripeSecretKey, {}) : null;

// body redan inläst EN gång i handler() nedan och skickas ner hit — req:ns
// egen data-ström går bara att läsa en gång, ett andra parseJsonBody(req)-
// anrop här hade hängt sig (väntar på ett 'end'-event som redan skett).
async function handleStart(res, user, body) {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId || !process.env.STRIPE_OAUTH_STATE_SECRET) {
    console.error('Stripe OAuth start: STRIPE_CONNECT_CLIENT_ID eller STRIPE_OAUTH_STATE_SECRET saknas.');
    res.status(503).json({ error: 'Stripe Connect är inte konfigurerat.' });
    return;
  }

  const { company_id: companyId } = body || {};
  if (!companyId) {
    res.status(400).json({ error: 'company_id krävs.' });
    return;
  }
  // requireEditor: true — en inbjuden läsare ska inte kunna koppla ett
  // betalningskonto till hela företaget, se loadOwnedOrMemberCompany.
  const owned = await loadOwnedOrMemberCompany(user.id, companyId, res, { requireEditor: true });
  if (!owned) return;

  let state;
  try {
    // ownerUserId, INTE user.id: callback.js (efter Stripes redirect) körs
    // helt utan session och litar blint på state:n för att veta VILKEN
    // user_data-rad kontot ska sparas i — en inbjuden medlem som startar
    // kopplingen måste ändå signera in ÄGARENS id, annars sparas kontot i
    // medlemmens egen, tomma rad i stället för det delade företaget.
    state = createSignedState({ user_id: owned.ownerUserId, company_id: companyId });
  } catch (err) {
    console.error('Stripe OAuth start error:', err);
    res.status(500).json({ error: 'Kunde inte starta Stripe-anslutningen. Försök igen om en stund, eller kontakta bokixab@gmail.com.' });
    return;
  }

  const redirectUri = process.env.STRIPE_OAUTH_REDIRECT_URI || 'http://localhost:5000/api/stripe/callback';
  const authorizeUrl = new URL('https://connect.stripe.com/oauth/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('scope', 'read_write');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);

  res.setHeader('Set-Cookie', stripeOauthStateCookie(state));
  res.status(200).json({ url: authorizeUrl.toString() });
}

async function handleDisconnect(res, user, body) {
  if (!stripe) {
    res.status(503).json({ error: 'Stripe är inte konfigurerat.' });
    return;
  }

  const { company_id: companyId } = body || {};
  if (!companyId) {
    res.status(400).json({ error: 'company_id krävs.' });
    return;
  }

  const owned = await loadOwnedOrMemberCompany(user.id, companyId, res, { requireEditor: true });
  if (!owned) return;
  const { companyData, ownerUserId } = owned;

  // Vilket konto som kopplas från kommer från den verifierade, sparade
  // datan — inte requesten — så ett manipulerat stripe_account_id i
  // body:n kan inte peka på ett annat konto.
  const stripeAccountId = companyData.company?.stripeAccountId;
  if (!stripeAccountId) {
    res.status(400).json({ error: 'Inget Stripe-konto är anslutet för det här företaget. Anslut Stripe under Inställningar → Kopplingar.' });
    return;
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (clientId) {
    try {
      await stripe.oauth.deauthorize({ client_id: clientId, stripe_user_id: stripeAccountId });
    } catch (err) {
      // Kontot kan redan vara frånkopplat på Stripes sida — det ska inte
      // blockera att Bokix egen koppling ändå rensas.
      console.warn('Stripe deauthorize warning:', err.message);
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas — kan inte uppdatera kopplingen server-side.' });
    return;
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  // ownerUserId (inte user.id): RPC:n skriver till public.user_data WHERE
  // user_id = p_user_id, se loadOwnedOrMemberCompany.
  const { error: rpcError } = await supabaseAdmin.rpc('set_company_stripe_account', {
    p_user_id: ownerUserId,
    p_company_id: companyId,
    p_stripe_account_id: null,
  });
  if (rpcError) {
    res.status(500).json({ error: rpcError.message });
    return;
  }

  res.status(200).json({ ok: true });
}

// "Hämta nu" i Granskning, och direkt efter att kontot kopplats: samma
// hämtning som den dagliga cronen men med valfritt längre fönster (högst ett
// år), så att man inte behöver vänta till nästa morgon.
async function handleSync(res, user, body) {
  if (!stripe) {
    res.status(503).json({ error: 'Stripe är inte konfigurerat.' });
    return;
  }
  const { company_id: companyId } = body || {};
  if (!companyId) {
    res.status(400).json({ error: 'company_id krävs.' });
    return;
  }
  const owned = await loadOwnedOrMemberCompany(user.id, companyId, res, { requireEditor: true });
  if (!owned) return;
  const stripeAccountId = owned.companyData.company?.stripeAccountId;
  if (!stripeAccountId) {
    res.status(400).json({ error: 'Inget Stripe-konto är anslutet för det här företaget.' });
    return;
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas.' });
    return;
  }
  const days = Math.min(365, Math.max(1, Number(body?.days) || 90));
  const { count } = await syncStripeLedger({
    admin: createClient(supabaseUrl, serviceRoleKey),
    stripe,
    userId: owned.ownerUserId,
    companyId,
    stripeAccountId,
    sinceSeconds: days * 86400,
  });
  res.status(200).json({ ok: true, count });
}

async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await checkRateLimit(req, res, { key: 'stripe-connect', max: 10 }))) return;

  // Ingen BotID-koll längre (main.jsx: initBotId, se filkommentaren där för
  // hela historiken) — requireAuthedUser + loadOwnedOrMemberCompany (start)
  // och dessutom en reauth-kod (disconnect, nedan) är det faktiska, robusta
  // skyddet, oberoende av klientens skröpliga BotID-inpackning.
  const user = await requireAuthedUser(req, res);
  if (!user) return;
  if (!await requireActiveSubscription(user, res)) return;

  try {
    // Läses EN gång här — req:ns ström kan bara konsumeras en gång, se
    // kommentaren vid handleStart ovan.
    const body = await parseJsonBody(req);

    if (body?.action === 'disconnect') {
      // Reauthentication (App.jsx:s Stripe-anslutningsknappar, se
      // api/auth/request-password-reset.js:s send-reauth-code/verify-
      // reauth-code) — bara FRÅNKOPPLING kräver den numera. Kundönskemål
      // (Inställningar → Integrationer): "Anslut ska gå direkt till
      // Stripe, inte via en kod" — att ANSLUTA bara skickar iväg
      // användaren till Stripes EGEN, hostade OAuth-sida (ingen faktisk
      // ändring sker förrän Stripe själv autentiserat klart och callat
      // tillbaka, se callback.js), medan FRÅNKOPPLING river en redan
      // aktiv betalningsväg direkt — mer känsligt, får behålla spärren.
      if (!verifyReauthGrant(body?.reauthToken, user.id)) {
        res.status(403).json({ error: 'Åtkomst nekad. Logga in med kontot som har tillgång till företaget, eller be ägaren bjuda in dig.' });
        return;
      }
      await handleDisconnect(res, user, body);
    } else if (body?.action === 'sync') {
      await handleSync(res, user, body);
    } else {
      // Förval 'start' — client skickar alltid action explicit (se
      // App.jsx), men en okänd/saknad action tolkas som start snarare än
      // att 400:a, eftersom start är det vanligare/förväntade fallet.
      await handleStart(res, user, body);
    }
  } catch (error) {
    console.error('Stripe connect error:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Något gick fel.' });
  }
}

export default withSentry(handler, '/api/stripe/connect');
