// "Koppla från" — deauktoriserar det anslutna Stripe-kontot och rensar
// kopplingen server-side. Anropas av en redan inloggad användare (samma
// förtroendemodell som övriga api/stripe/*-endpoints i det här projektet,
// som redan litar på company_id/user_id från frontend utan extra
// tokenverifiering).
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { parseJsonBody } from './parseBody.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.VITE_STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_') ? new Stripe(stripeSecretKey, {}) : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!stripe) {
    res.status(503).json({ error: 'Stripe är inte konfigurerat.' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const { user_id: userId, company_id: companyId, stripe_account_id: stripeAccountId } = body || {};
    if (!userId || !companyId || !stripeAccountId) {
      res.status(400).json({ error: 'user_id, company_id och stripe_account_id krävs.' });
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
      p_user_id: userId,
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
