import { applySecurityHeaders } from '../_security.js';
// Steg 1 av det klassiska Stripe Connect OAuth-flödet ("Standard"-konton):
// genererar en signerad state, sparar samma värde i en httpOnly-cookie,
// och returnerar Stripes egna, Stripe-hostade auktoriseringsadress
// (connect.stripe.com/oauth/authorize) — exakt den typ av sida
// referensbilden visade, fast med Bokix som plattform istället för en
// konkurrent. Bokix bygger inte om den sidan; det är Stripes ansvar.
//
// Säkerhetsfix (se säkerhetsgranskningen): var tidigare en enkel GET som
// tog user_id/company_id rakt från query-strängen — vem som helst som
// kände till (eller gissade) ett user_id/company_id kunde starta flödet
// och koppla SITT EGET Stripe-konto till NÅGON ANNANS Bokix-företag.
// _oauthState.js signerar bara INNEHÅLLET (skyddar mot att user_id/
// company_id manipuleras UNDER vägen till Stripe och tillbaka) — det
// skyddade aldrig mot att fel person startade flödet i första hand. Är nu
// en autentiserad POST (kräver inloggad session + ägarskap av företaget,
// samma mönster som disconnect.js) som returnerar auktoriseringsadressen
// som JSON istället för att själv göra 302-omdirigeringen — frontend
// navigerar dit själv efter det autentiserade anropet (App.jsx:
// handleOpenStripeOnboarding).
import { createSignedState } from './_oauthState.js';
import { stripeOauthStateCookie } from './_cookies.js';
import { parseJsonBody } from './_parseBody.js';
import { requireAuthedUser, loadOwnedCompany } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'stripe-oauth-start', max: 10 })) return;

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId || !process.env.STRIPE_OAUTH_STATE_SECRET) {
    console.error('Stripe OAuth start: STRIPE_CONNECT_CLIENT_ID eller STRIPE_OAUTH_STATE_SECRET saknas.');
    res.status(503).json({ error: 'Stripe Connect är inte konfigurerat.' });
    return;
  }

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  const body = await parseJsonBody(req);
  const { company_id: companyId } = body || {};
  if (!companyId) {
    res.status(400).json({ error: 'company_id krävs.' });
    return;
  }
  const companyData = await loadOwnedCompany(user.id, companyId, res);
  if (!companyData) return;

  let state;
  try {
    // user.id kommer från den verifierade token:en, inte requesten — går
    // inte längre att förfalska vems ID som signeras in i state:n.
    state = createSignedState({ user_id: user.id, company_id: companyId });
  } catch (err) {
    console.error('Stripe OAuth start error:', err);
    res.status(500).json({ error: 'Kunde inte starta Stripe-anslutningen.' });
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
