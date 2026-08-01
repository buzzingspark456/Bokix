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
    const accountLink = await stripe.accountLinks.create({
      account: body.account_id,
      refresh_url: process.env.STRIPE_ONBOARDING_REFRESH_URL,
      return_url: process.env.STRIPE_ONBOARDING_RETURN_URL,
      type: 'account_onboarding',
    });
    res.status(200).json({ accountLink });
  } catch (error) {
    console.error('Stripe account-link error:', error);
    res.status(500).json({ error: error.message || 'Stripe onboarding link failed' });
  }
}
