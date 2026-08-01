import Stripe from 'stripe';
import { parseJsonBody } from './parseBody.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.VITE_STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_')
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-08-15',
    })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!stripe) {
    res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY or VITE_STRIPE_SECRET_KEY before trying again.' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const accountLink = await stripe.accountLinks.create({
      account: body.account_id,
      refresh_url: process.env.STRIPE_ONBOARDING_REFRESH_URL || 'http://localhost:5173',
      return_url: process.env.STRIPE_ONBOARDING_RETURN_URL || 'http://localhost:5173',
      type: 'account_onboarding',
    });
    res.status(200).json({ accountLink });
  } catch (error) {
    console.error('Stripe account-link error:', error);
    res.status(500).json({ error: error.message || 'Stripe onboarding link failed' });
  }
}
