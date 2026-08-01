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

export async function createConnectedStripeAccount(payload) {
  return requestStripeApi('create-account', payload);
}

export async function createStripeAccountLink(payload) {
  return requestStripeApi('create-account-link', payload);
}

export async function createStripeCheckoutSession(payload) {
  return requestStripeApi('create-checkout-session', payload);
}
