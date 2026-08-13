import Stripe from 'stripe';
import { parseJsonBody } from './parseBody.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.VITE_STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_')
  ? new Stripe(stripeSecretKey, {
      // apiVersion removed to use Stripe account default
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
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'SE',
      business_type: 'company',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: { interval: 'manual' },
        },
      },
      business_profile: {
        name: body.business_name || 'Bokix customer',
        product_description: 'Faktura- och betalningshantering via Bokix',
      },
      metadata: {
        company_id: body.company_id,
        user_id: body.user_id,
      },
    });
    res.status(200).json({ account });
  } catch (error) {
    console.error('Stripe create-account error:', error);
    res.status(500).json({ error: error.message || 'Stripe account creation failed' });
  }
}
