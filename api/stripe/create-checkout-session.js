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
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: body.line_items,
      payment_intent_data: {
        application_fee_amount: body.application_fee_amount || 0,
        transfer_data: {
          destination: body.stripe_account_id,
        },
      },
      customer_email: body.customer_email,
      success_url: process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173',
      cancel_url: process.env.STRIPE_CANCEL_URL || 'http://localhost:5173',
    });
    res.status(200).json({ session });
  } catch (error) {
    console.error('Stripe create-checkout-session error:', error);
    res.status(500).json({ error: error.message || 'Checkout session creation failed' });
  }
}
