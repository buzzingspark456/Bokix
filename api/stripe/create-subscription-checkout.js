import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';
import { parseJsonBody } from './_parseBody.js';
import { normalizeAbsoluteUrl, appendQueryParam } from './_urls.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_')
  ? new Stripe(stripeSecretKey, {
      // apiVersion removed to use Stripe account default
    })
  : null;

// Bokix egen plan — "Ett pris. Allt ingår." (PricingPage.jsx/LandingPage.jsx),
// inte en variabel per kund som create-checkout-session.js (den gäller
// KUNDERS fakturabetalningar via ett anslutet Stripe-konto, helt separat
// flöde). inline price_data istället för ett förskapat Stripe Price-objekt
// — samma teknik som redan används för fakturarader (App.jsx
// getInvoicePaymentLinkUrl) — så ingen manuell produkt-/prisuppsättning i
// Stripe Dashboard krävs innan det här fungerar.
const SUBSCRIPTION_PRICE_SEK_ORE = 9900; // 99,00 kr/mån
const TRIAL_DAYS = 30;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!stripe) {
    res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY before trying again.' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'create-subscription-checkout', max: 10 })) return;

  // Vercel BotID — se filkommentaren i main.jsx.
  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    if (!body.user_id) {
      res.status(400).json({ error: 'user_id krävs.' });
      return;
    }

    const baseUrl = normalizeAbsoluteUrl(process.env.STRIPE_SUCCESS_URL, 'http://localhost:5173');
    const cancelBaseUrl = normalizeAbsoluteUrl(process.env.STRIPE_CANCEL_URL, 'http://localhost:5173');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: body.customer_email || undefined,
      // Visar Stripe Checkouts inbyggda "Lägg till kampanjkod"-länk under
      // e-postfältet — koderna själva skapas/hanteras i Stripe Dashboard
      // (Produktkatalog > Kuponger/Kampanjkoder), inget att bygga här.
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: 'sek',
            product_data: { name: 'Bokix' },
            unit_amount: SUBSCRIPTION_PRICE_SEK_ORE,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        // Sätts på själva Subscription-objektet (inte bara Sessionen) — så
        // metadata följer med automatiskt på VARJE efterföljande
        // customer.subscription.*-händelse (webhook.js), utan att behöva
        // slå upp/expandera sessionen igen för att koppla ihop dem.
        metadata: { user_id: body.user_id },
      },
      metadata: { user_id: body.user_id },
      success_url: appendQueryParam(baseUrl, 'subscription_checkout', 'success'),
      cancel_url: appendQueryParam(cancelBaseUrl, 'subscription_checkout', 'cancelled'),
    });
    res.status(200).json({ session });
  } catch (error) {
    console.error('Stripe create-subscription-checkout error:', error);
    res.status(500).json({ error: error.message || 'Subscription checkout session creation failed' });
  }
}
