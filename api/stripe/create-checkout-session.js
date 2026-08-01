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
      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,
    });
    res.status(200).json({ session });
  } catch (error) {
    console.error('Stripe create-checkout-session error:', error);
    res.status(500).json({ error: error.message || 'Checkout session creation failed' });
  }
}
