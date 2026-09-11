import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';
import { parseJsonBody } from './_parseBody.js';
import { normalizeAbsoluteUrl } from './_urls.js';
import { resolveInvoiceLineItems } from './_invoiceLineItems.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';
import subscriptionCheckoutHandler from './_subscriptionCheckout.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_')
  ? new Stripe(stripeSecretKey, {
      // apiVersion removed to use Stripe account default
    })
  : null;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = await parseJsonBody(req);

  // Om anropet gäller en prenumeration (Bokix egen plan / cancel / reactivate)
  // delegeras det till subscriptionCheckoutHandler så vi ryms under Vercels 12-funktionsgräns.
  if (!body?.invoice_id || body?.action === 'cancel' || body?.action === 'reactivate' || body?.planId || body?.priceId || req.url?.includes('create-subscription-checkout')) {
    return subscriptionCheckoutHandler(req, res);
  }

  if (!stripe) {
    res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY before trying again.' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'create-checkout-session', max: 20 })) return;

  // Vercel BotID — routen finns i initBotId()-listan i main.jsx, annars
  // misslyckas den här kollen alltid (se filkommentaren där).
  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  try {
    const { user_id: userId, company_id: companyId, invoice_id: invoiceId, customer_email: customerEmail, customer_type: customerType } = body || {};
    if (!userId || !companyId || !invoiceId) {
      res.status(400).json({ error: 'user_id, company_id och invoice_id krävs.' });
      return;
    }

    const resolved = await resolveInvoiceLineItems({ userId, companyId, invoiceId });
    if (resolved.error) {
      res.status(resolved.status || 400).json({ error: resolved.error });
      return;
    }
    const { lineItems, currency, applicationFeeAmount, stripeAccountId } = resolved;

    const BANK_TRANSFER_CURRENCIES = new Set(['eur', 'gbp', 'usd']);
    let stripeCustomerId;
    if (BANK_TRANSFER_CURRENCIES.has(currency) && customerEmail) {
      const stripeCustomer = await stripe.customers.create({ email: customerEmail }, { stripeAccount: stripeAccountId });
      stripeCustomerId = stripeCustomer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...(stripeCustomerId ? { customer: stripeCustomerId } : (customerEmail ? { customer_email: customerEmail } : {})),
      ...(customerType === 'se_individual' ? {} : { excluded_payment_method_types: ['klarna'] }),
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
      },
      metadata: {
        user_id: userId,
        company_id: companyId,
        invoice_id: invoiceId,
      },
      success_url: normalizeAbsoluteUrl(process.env.STRIPE_SUCCESS_URL, 'http://localhost:5173'),
      cancel_url: normalizeAbsoluteUrl(process.env.STRIPE_CANCEL_URL, 'http://localhost:5173'),
    }, { stripeAccount: stripeAccountId });
    res.status(200).json({ session });
  } catch (error) {
    console.error('Stripe create-checkout-session error:', error);
    res.status(500).json({ error: error.message || 'Checkout session creation failed' });
  }
}
