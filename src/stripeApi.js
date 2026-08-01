async function requestStripeApi(path, body) {
  const response = await fetch(`/api/stripe/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe API error (${response.status}): ${text}`);
  }

  return response.json();
}

export async function createConnectedStripeAccount(payload) {
  return requestStripeApi('create-account', payload);
}

export async function createStripeAccountLink(payload) {
  return requestStripeApi('create-account-link', payload);
}

export async function createStripeCheckoutSession(payload) {
  return requestStripeApi('create-checkout-session', payload);
}
