import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || process.env.VITE_STRIPE_SECRET_KEY || '', {
  // apiVersion removed to use Stripe account default
});

function getWebhookSecrets() {
  return [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_TUNNEL,
    process.env.STRIPE_WEBHOOK_SECRET_SNAPSHOT,
  ].filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  const rawBody = await req.text();

  if (!signature) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  if (!rawBody) {
    res.status(400).json({ error: 'Missing request body' });
    return;
  }

  const secrets = getWebhookSecrets();
  if (secrets.length === 0) {
    res.status(500).json({ error: 'Stripe webhook secret is not configured' });
    return;
  }

  let event;
  let lastError;

  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!event) {
    console.error('Stripe webhook verification failed:', lastError?.message || lastError);
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

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

  res.status(200).json({ received: true, type: event.type });
}
