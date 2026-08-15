// Steg 1 av det klassiska Stripe Connect OAuth-flödet ("Standard"-konton):
// genererar en signerad state, sparar samma värde i en httpOnly-cookie,
// och skickar användaren vidare till Stripes egna, Stripe-hostade
// auktoriseringssida (connect.stripe.com/oauth/authorize) — exakt den typ
// av sida referensbilden visade, fast med Bokix som plattform istället för
// en konkurrent. Bokix bygger inte om den sidan; det är Stripes ansvar.
import { createSignedState } from './_oauthState.js';
import { stripeOauthStateCookie } from './_cookies.js';

// Startas via en helsides-navigering (window.location.href), inte fetch —
// ett JSON-felsvar skulle då bara visas som rå text på en tom sida. Alla
// felvägar redirectar därför tillbaka till appen med samma
// ?stripe_connect=error-flagga som callbacken använder, så felet alltid
// visas som samma odramatiska meddelande i UI:t istället för en trasig sida.
const appUrl = process.env.STRIPE_ONBOARDING_RETURN_URL || 'http://localhost:5173';
function redirectToApp(res, status) {
  res.writeHead(302, { Location: `${appUrl}/?stripe_connect=${status}` });
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId || !process.env.STRIPE_OAUTH_STATE_SECRET) {
    console.error('Stripe OAuth start: STRIPE_CONNECT_CLIENT_ID eller STRIPE_OAUTH_STATE_SECRET saknas.');
    redirectToApp(res, 'not_configured');
    return;
  }

  const { user_id: userId, company_id: companyId } = req.query || {};
  if (!userId || !companyId) {
    redirectToApp(res, 'error');
    return;
  }

  let state;
  try {
    state = createSignedState({ user_id: userId, company_id: companyId });
  } catch (err) {
    console.error('Stripe OAuth start error:', err);
    redirectToApp(res, 'error');
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
  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
}
