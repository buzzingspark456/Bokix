import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';
import { parseJsonBody } from './_parseBody.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_')
  ? new Stripe(stripeSecretKey, {
      // apiVersion removed to use Stripe account default
    })
  : null;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!stripe) {
    res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY before trying again.' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const account = await stripe.accounts.retrieve(body.account_id);
    res.status(200).json({ account });
  } catch (error) {
    console.error('Stripe retrieve-account error:', error);
    res.status(500).json({ error: error.message || 'Retrieve Stripe account failed' });
  }
}
