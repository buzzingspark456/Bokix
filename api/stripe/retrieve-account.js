import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-08-15',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = await req.json();
    const account = await stripe.accounts.retrieve(body.account_id);
    res.status(200).json({ account });
  } catch (error) {
    console.error('Stripe retrieve-account error:', error);
    res.status(500).json({ error: error.message || 'Retrieve Stripe account failed' });
  }
}
