import { applySecurityHeaders } from '../_security.js';
// Zettle (PayPal Zettle/iZettle) OAuth2, "authorization code"-grant —
// samma tvåstegsmönster som api/stripe/connect.js (start) + api/stripe/
// callback.js (token-utbyte), men ihopslaget till EN fil/väg av samma skäl
// som connect.js: Vercels 12-funktionsgräns (Hobby-plan). GET/POST på
// SAMMA sökväg är otvetydigt: Zettle skickar bara GET (dess egen redirect
// tillbaka hit efter inloggning), Bokix egen frontend skickar bara POST
// (startar flödet) — ingen kan förväxlas med den andra.
//
// URL:en att ange i Zettles Developer Portal under "OAuth Redirect URIs":
//   https://bokix.se/api/zettle/callback
// (lokalt: http://localhost:5000/api/zettle/callback, se server.js)
//
// Endpoints verifierade mot Zettles egen dokumentation (developer.zettle.
// com/docs/api/oauth, github.com/iZettle/api-documentation) i augusti 2026
// — INTE testade mot ett riktigt Zettle-konto än (kräver ZETTLE_CLIENT_ID/
// ZETTLE_CLIENT_SECRET från Zettles Developer Portal, som du registrerar
// appen och får EFTER att ha angett URL:en ovan). Om Zettle skulle svara
// med ett annat felformat än väntat vid det första riktiga testet, titta
// först här.
import { createClient } from '@supabase/supabase-js';
import { createSignedState, verifySignedState } from './_oauthState.js';
import { parseCookies, ZETTLE_OAUTH_COOKIE, zettleOauthStateCookie, clearZettleOauthStateCookie } from './_cookies.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { requireAuthedUser, loadOwnedCompany } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';

const ZETTLE_AUTHORIZE_URL = 'https://oauth.zettle.com/authorize';
const ZETTLE_TOKEN_URL = 'https://oauth.zettle.com/token';

const appUrl = process.env.STRIPE_ONBOARDING_RETURN_URL || 'http://localhost:5173';

function redirectWithStatus(res, status, detail) {
  // Samma "&debug=" temporära diagnosfält som api/stripe/callback.js —
  // aldrig känsligt (token/nycklar), bara ett kort felmeddelande.
  const debugParam = detail ? `&debug=${encodeURIComponent(String(detail).slice(0, 200))}` : '';
  res.writeHead(302, { Location: `${appUrl}/?zettle_connect=${status}${debugParam}` });
  res.end();
}

async function persistZettleTokens({ userId, companyId, accessToken, refreshToken, expiresAt }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY saknas — kan inte spara kopplingen server-side.');
  }
  // service-role kringgår RLS med avsikt: den här callbacken körs helt
  // utan inloggad användarsession (Zettle skickar bara en anonym
  // redirect) — user_id/company_id kommer därför uteslutande från den
  // SIGNERADE state:n, aldrig från query-parametrar direkt.
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabaseAdmin.rpc('set_company_zettle_tokens', {
    p_user_id: userId,
    p_company_id: companyId,
    p_access_token: accessToken,
    p_refresh_token: refreshToken,
    p_expires_at: expiresAt,
  });
  if (error) throw error;
}

// ── Steg 1: starta flödet — autentiserad POST från Bokix egen frontend ──
// Samma säkerhetsresonemang som api/stripe/connect.js (handleStart): en
// tidigare enkel GET med user_id/company_id i query-strängen hade låtit
// vem som helst koppla sitt eget Zettle-konto till någon annans Bokix-
// företag. Kräver nu inloggad session + bevisat ägarskap.
async function handleStart(res, user, body) {
  const clientId = process.env.ZETTLE_CLIENT_ID;
  if (!clientId || !process.env.ZETTLE_OAUTH_STATE_SECRET) {
    console.error('Zettle OAuth start: ZETTLE_CLIENT_ID eller ZETTLE_OAUTH_STATE_SECRET saknas.');
    res.status(503).json({ error: 'Zettle-anslutning är inte konfigurerad.' });
    return;
  }

  const { company_id: companyId } = body || {};
  if (!companyId) {
    res.status(400).json({ error: 'company_id krävs.' });
    return;
  }
  const companyData = await loadOwnedCompany(user.id, companyId, res);
  if (!companyData) return;

  let state;
  try {
    state = createSignedState({ user_id: user.id, company_id: companyId });
  } catch (err) {
    console.error('Zettle OAuth start error:', err);
    res.status(500).json({ error: 'Kunde inte starta Zettle-anslutningen.' });
    return;
  }

  const redirectUri = process.env.ZETTLE_OAUTH_REDIRECT_URI || 'http://localhost:5000/api/zettle/callback';
  const authorizeUrl = new URL(ZETTLE_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  // Bugfix (verifierat mot en riktig Zettle-app): scope får INTE vara tom —
  // Zettle avvisar hela auktoriseringsanropet med "Invalid scope. Requested
  // scope(s) can't be empty." annars, den tidigare "utelämna scope om den
  // inte är satt"-varianten fungerade alltså aldrig i praktiken. Standard-
  // värdet nedan är precis det Bokix faktiskt behöver för att hämta
  // transaktioner/finansdata som bokföringsunderlag (samma syfte som
  // stripe_ledger_events, se supabase-setup.sql) — mellanslagsseparerad
  // lista, exakt formatet Zettles egen dokumentation visar (github.com/
  // iZettle/api-documentation: authorization.md). ZETTLE_OAUTH_SCOPE kan
  // fortfarande sätta ett annat värde vid behov, men behövs inte längre för
  // att flödet ska fungera.
  const scope = process.env.ZETTLE_OAUTH_SCOPE || 'READ:PURCHASE READ:FINANCE';
  authorizeUrl.searchParams.set('scope', scope);

  res.setHeader('Set-Cookie', zettleOauthStateCookie(state));
  res.status(200).json({ url: authorizeUrl.toString() });
}

// ── Steg 2: Zettle redirectar hit efter godkännande/avbrott ──
async function handleCallback(req, res) {
  // Säkerhetsgranskningen: samma saknade gräns som api/stripe/callback.js
  // hade — se den filens motsvarande kommentar.
  if (!checkRateLimit(req, res, { key: 'zettle-callback', max: 20 })) return;
  const { code, state, error: zettleError } = req.query || {};
  // Cookien ska bara kunna användas en gång, oavsett utfall.
  res.setHeader('Set-Cookie', clearZettleOauthStateCookie());

  if (zettleError) {
    // Användaren avbröt/nekade på Zettles sida — inte ett fel, ett val.
    redirectWithStatus(res, 'cancelled');
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieState = cookies[ZETTLE_OAUTH_COOKIE];
  if (!state || !cookieState || state !== cookieState) {
    console.error('Zettle OAuth callback: state matchar inte cookien (möjligt CSRF-försök).');
    redirectWithStatus(res, 'error');
    return;
  }

  const payload = verifySignedState(state);
  if (!payload?.user_id || !payload?.company_id) {
    console.error('Zettle OAuth callback: ogiltig eller för gammal state-signatur.');
    redirectWithStatus(res, 'error');
    return;
  }

  if (!code) {
    redirectWithStatus(res, 'cancelled');
    return;
  }

  const clientId = process.env.ZETTLE_CLIENT_ID;
  const clientSecret = process.env.ZETTLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Zettle OAuth callback: ZETTLE_CLIENT_ID/ZETTLE_CLIENT_SECRET saknas.');
    redirectWithStatus(res, 'error');
    return;
  }

  try {
    const redirectUri = process.env.ZETTLE_OAUTH_REDIRECT_URI || 'http://localhost:5000/api/zettle/callback';
    // Zettles token-endpoint (som de allra flesta OAuth2-token-endpoints)
    // tar form-encoded body, inte JSON.
    const tokenRes = await fetch(ZETTLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData?.access_token) {
      throw new Error(tokenData?.error_description || tokenData?.error || `Zettle svarade ${tokenRes.status} utan access_token.`);
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    await persistZettleTokens({
      userId: payload.user_id,
      companyId: payload.company_id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresAt,
    });

    redirectWithStatus(res, 'connected');
  } catch (err) {
    console.error('Zettle OAuth callback error:', err);
    redirectWithStatus(res, 'error', err.message);
  }
}

export default async function handler(req, res) {
  applySecurityHeaders(res);

  if (req.method === 'GET') {
    await handleCallback(req, res);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!checkRateLimit(req, res, { key: 'zettle-connect', max: 10 })) return;

  // Vercel BotID — se filkommentaren i main.jsx. Gäller bara POST (start):
  // GET är Zettles egen server-till-server-redirect, inget en användares
  // webbläsare "fyller i", BotID-skyddet är inte relevant där.
  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    const body = await parseJsonBody(req);
    await handleStart(res, user, body);
  } catch (error) {
    console.error('Zettle connect error:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Något gick fel.' });
  }
}
