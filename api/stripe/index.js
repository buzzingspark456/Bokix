import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // apiVersion removed to use Stripe account default
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function POST(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/api\/stripe\/?/, '');

  if (pathname === 'create-account') {
    const body = await request.json();
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
          schedule: {
            interval: 'manual',
          },
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
    return jsonResponse({ account });
  }

  if (pathname === 'create-account-link') {
    const body = await request.json();
    const accountLink = await stripe.accountLinks.create({
      account: body.account_id,
      refresh_url: process.env.STRIPE_ONBOARDING_REFRESH_URL,
      return_url: process.env.STRIPE_ONBOARDING_RETURN_URL,
      type: 'account_onboarding',
    });
    return jsonResponse({ accountLink });
  }

  if (pathname === 'create-checkout-session') {
    const body = await request.json();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: body.line_items,
      customer_email: body.customer_email,
      payment_intent_data: {
        application_fee_amount: body.application_fee_amount || 0,
        transfer_data: {
          destination: body.stripe_account_id,
        },
      },
      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,
    });
    return jsonResponse({ session });
  }

  return jsonResponse({ error: 'Unknown Stripe API route' }, 404);
}
