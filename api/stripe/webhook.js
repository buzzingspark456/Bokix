import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-08-15',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  const rawBody = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);

    console.log('Stripe webhook event:', event.type);
    switch (event.type) {
      case 'account.updated':
        // TODO: Persist onboarding status to your own database here.
        break;
      case 'checkout.session.completed':
        // TODO: Mark invoice as paid using session metadata.
        break;
      case 'payout.paid':
        // TODO: Update payout history for the connected account.
        break;
      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
}
