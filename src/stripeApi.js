async function requestStripeApi(path, body) {
  const response = await fetch(`/api/stripe/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.error || `Stripe API error (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export async function createStripeCheckoutSession(payload) {
  return requestStripeApi('create-checkout-session', payload);
}

// Bokix egen plan (99 kr/mån, 30 dagars gratis provperiod) — helt separat
// från createStripeCheckoutSession ovan, som gäller kunders fakturabetalningar
// via ett anslutet Stripe-konto. Se api/stripe/create-subscription-checkout.js.
export async function createStripeSubscriptionCheckout(payload) {
  return requestStripeApi('create-subscription-checkout', payload);
}
