import { applySecurityHeaders } from '../_security.js';
// Steg 2: Stripe redirectar hit efter att användaren godkänt (eller
// avbrutit) på Stripes sida. Allt känsligt — kodväxlingen mot en
// åtkomsttoken och själva kontokopplingen — sker här, server-side.
// Frontend ser aldrig token eller rå Stripe-data, bara ett kort
// statusflagg i redirect-URL:en (?stripe_connect=connected|cancelled|error)
// som Startsidan läser av och visar ett meddelande för.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { verifySignedState } from './_oauthState.js';
import { parseCookies, STRIPE_OAUTH_COOKIE, clearStripeOauthStateCookie } from './_cookies.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_') ? new Stripe(stripeSecretKey, {}) : null;

const appUrl = process.env.STRIPE_ONBOARDING_RETURN_URL || 'http://localhost:5173';

// TEMPORÄRT: &debug=<kort felmeddelande> på felvägen, för att diagnostisera
// ett verkligt fel utan tillgång till Vercels loggar. Tas bort igen så fort
// felet är hittat — inget känsligt (token/nycklar) hamnar här, bara
// err.message, och bara på error-statusen.
function redirectWithStatus(res, status, detail) {
  const debugParam = detail ? `&debug=${encodeURIComponent(String(detail).slice(0, 200))}` : '';
  res.writeHead(302, { Location: `${appUrl}/?stripe_connect=${status}${debugParam}` });
  res.end();
}

async function persistStripeAccountId({ userId, companyId, stripeAccountId }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY saknas — kan inte spara kontokopplingen server-side.');
  }
  // service-role-nyckeln kringgår RLS med avsikt: den här callbacken körs
  // helt utan inloggad användarsession (Stripe skickar bara en anonym
  // redirect), så det finns ingen användar-JWT att autentisera mot. Det är
  // just därför user_id/company_id måste komma från den SIGNERADE state:n
  // och inte tas emot direkt som query-parametrar.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabaseAdmin.rpc('set_company_stripe_account', {
    p_user_id: userId,
    p_company_id: companyId,
    p_stripe_account_id: stripeAccountId,
  });
  if (error) throw error;
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  const { code, state, error: stripeError } = req.query || {};
  // Cookien ska bara kunna användas en gång, oavsett utfall.
  res.setHeader('Set-Cookie', clearStripeOauthStateCookie());

  if (stripeError) {
    // Användaren avbröt/nekade på Stripes sida — inte ett fel, bara ett
    // val. Odramatiskt meddelande på Bokix-sidan, ingen krasch.
    redirectWithStatus(res, 'cancelled');
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieState = cookies[STRIPE_OAUTH_COOKIE];
  if (!state || !cookieState || state !== cookieState) {
    console.error('Stripe OAuth callback: state matchar inte cookien (möjligt CSRF-försök).');
    redirectWithStatus(res, 'error');
    return;
  }

  const payload = verifySignedState(state);
  if (!payload?.user_id || !payload?.company_id) {
    console.error('Stripe OAuth callback: ogiltig eller för gammal state-signatur.');
    redirectWithStatus(res, 'error');
    return;
  }

  if (!code) {
    redirectWithStatus(res, 'cancelled');
    return;
  }

  if (!stripe) {
    console.error('Stripe OAuth callback: Stripe är inte konfigurerat (STRIPE_SECRET_KEY saknas).');
    redirectWithStatus(res, 'error');
    return;
  }

  try {
    const tokenResponse = await stripe.oauth.token({ grant_type: 'authorization_code', code });
    const connectedAccountId = tokenResponse.stripe_user_id;
    if (!connectedAccountId) throw new Error('Stripe svarade utan stripe_user_id.');

    await persistStripeAccountId({
      userId: payload.user_id,
      companyId: payload.company_id,
      stripeAccountId: connectedAccountId,
    });

    redirectWithStatus(res, 'connected');
  } catch (err) {
    console.error('Stripe OAuth callback error:', err);
    redirectWithStatus(res, 'error', err.message);
  }
}
