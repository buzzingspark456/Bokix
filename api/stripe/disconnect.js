import { applySecurityHeaders } from '../_security.js';
// "Koppla från" — deauktoriserar det anslutna Stripe-kontot och rensar
// kopplingen server-side.
//
// Säkerhetsfix (se säkerhetsgranskningen): litade tidigare på company_id/
// user_id/stripe_account_id rakt från requesten utan att verifiera vem som
// faktiskt anropade — vem som helst som kände till (eller gissade) ett
// stripe_account_id kunde koppla från en helt annan användares Stripe-
// konto. Kräver nu en verifierad inloggad session (requireAuthedUser) och
// bevisar att DEN användaren faktiskt äger företaget (loadOwnedCompany)
// innan något kopplas från.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { parseJsonBody } from './_parseBody.js';
import { requireAuthedUser, loadOwnedCompany } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_') ? new Stripe(stripeSecretKey, {}) : null;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!stripe) {
    res.status(503).json({ error: 'Stripe är inte konfigurerat.' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'stripe-disconnect', max: 10 })) return;

  // Vercel BotID — se filkommentaren i main.jsx.
  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  const user = await requireAuthedUser(req, res);
  if (!user) return;

  try {
    const body = await parseJsonBody(req);
    const { company_id: companyId } = body || {};
    if (!companyId) {
      res.status(400).json({ error: 'company_id krävs.' });
      return;
    }

    const companyData = await loadOwnedCompany(user.id, companyId, res);
    if (!companyData) return;

    // Vilket konto som kopplas från kommer nu från den verifierade,
    // sparade datan — inte längre från requesten — så ett manipulerat
    // stripe_account_id i body:n kan inte längre peka på ett annat konto.
    const stripeAccountId = companyData.company?.stripeAccountId;
    if (!stripeAccountId) {
      res.status(400).json({ error: 'Inget Stripe-konto är anslutet för det här företaget.' });
      return;
    }

    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    if (clientId) {
      try {
        await stripe.oauth.deauthorize({ client_id: clientId, stripe_user_id: stripeAccountId });
      } catch (err) {
        // Kontot kan redan vara frånkopplat på Stripes sida (t.ex. om
        // användaren gjorde det där direkt) — det ska inte blockera att
        // Bokix egen koppling ändå rensas.
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
    const { error: rpcError } = await supabaseAdmin.rpc('set_company_stripe_account', {
      p_user_id: user.id,
      p_company_id: companyId,
      p_stripe_account_id: null,
    });
    if (rpcError) {
      res.status(500).json({ error: rpcError.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Stripe disconnect error:', error);
    res.status(500).json({ error: error.message || 'Frånkoppling misslyckades' });
  }
}
