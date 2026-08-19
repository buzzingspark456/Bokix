// ── TILLFÄLLIG endpoint — verifierar att webhook-kedjan fungerar HELT
// AUTOMATISKT (ingen manuell backfill) genom att skapa en riktig test-
// prenumeration direkt via Stripe API (ingen betalkortsuppgift krävs för
// det, till skillnad från Checkout-UI:t) och sedan, efter en kort väntan,
// kolla om webhooken redan hunnit skriva raden själv. Skyddad av
// ADMIN_SETUP_SECRET. Tas bort igen efter testet. ──
import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_') ? new Stripe(stripeSecretKey, {}) : null;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  const providedSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SETUP_SECRET || providedSecret !== process.env.ADMIN_SETUP_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (!stripe) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }

  const action = req.query?.action || (req.url.includes('action=') ? new URL(req.url, 'http://x').searchParams.get('action') : 'create');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (action === 'create') {
      const testUserId = 'e2e00000-0000-0000-0000-' + Date.now().toString().padStart(12, '0').slice(-12);
      const customer = await stripe.customers.create({ email: `bokix.webhooktest.${Date.now()}@example.com` });

      // Hitta BOKIX100-kupongen (skapad tidigare) så testet inte skapar en
      // riktig framtida betalningsskyldighet på ett test-customer-objekt.
      const promo = await stripe.promotionCodes.list({ code: 'BOKIX100', limit: 1 });
      const couponId = promo.data[0]?.coupon?.id;

      // subscriptions.create() items[].price_data tar bara ett flat
      // "product" (befintligt Product-ID) - till skillnad från Checkout
      // Sessions line_items[].price_data som accepterar inline product_data
      // (det är vad create-subscription-checkout.js faktiskt använder i
      // produktion, redan bekräftat fungera). Skapar en riktig Price här
      // bara för det här engångstestet.
      const product = await stripe.products.create({ name: 'Bokix (webhook-test)' });
      const price = await stripe.prices.create({ product: product.id, currency: 'sek', unit_amount: 9900, recurring: { interval: 'month' } });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        trial_period_days: 30,
        // Stripes nyare API: "discounts" (array), inte en platt "coupon"-
        // parameter (samma sorts ändring som promotion_codes.create).
        discounts: couponId ? [{ coupon: couponId }] : undefined,
        metadata: { user_id: testUserId },
      });

      res.status(200).json({ test_user_id: testUserId, customer_id: customer.id, subscription_id: subscription.id, status: subscription.status });
      return;
    }

    if (action === 'check') {
      const testUserId = req.query?.user_id || new URL(req.url, 'http://x').searchParams.get('user_id');
      const { data, error } = await admin.from('subscriptions').select('*').eq('user_id', testUserId).maybeSingle();
      res.status(200).json({ found: !!data, row: data || null, error: error?.message });
      return;
    }

    if (action === 'inspect_endpoint') {
      const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
      res.status(200).json({
        count: endpoints.data.length,
        endpoints: endpoints.data.map(e => ({
          id: e.id, url: e.url, status: e.status, api_version: e.api_version,
          enabled_events: e.enabled_events, livemode: e.livemode, created: e.created,
        })),
      });
      return;
    }

    if (action === 'inspect_events') {
      const subId = req.query?.subscription_id || new URL(req.url, 'http://x').searchParams.get('subscription_id');
      const events = await stripe.events.list({ type: 'customer.subscription.created', limit: 10 });
      const matching = events.data.filter(e => e.data?.object?.id === subId);
      res.status(200).json({
        total_recent_events: events.data.length,
        matching: matching.map(e => ({ id: e.id, type: e.type, created: e.created, pending_webhooks: e.pending_webhooks, api_version: e.api_version })),
        most_recent_5: events.data.slice(0, 5).map(e => ({ id: e.id, created: e.created, subscription_id: e.data?.object?.id, pending_webhooks: e.pending_webhooks })),
      });
      return;
    }

    if (action === 'inspect_v2') {
      const out = {};
      try {
        const v2 = await stripe.v2.core.eventDestinations.list();
        out.v2_event_destinations = v2.data.map(d => ({
          id: d.id, name: d.name, status: d.status, type: d.type,
          event_payload: d.event_payload, events_from: d.events_from,
          include_events: d.include_events, include_categories: d.include_categories,
        }));
      } catch (e) {
        out.v2_error = e.message;
      }
      res.status(200).json(out);
      return;
    }

    if (action === 'fix_events_from') {
      // events_from går inte att ändra på en befintlig destination (bara
      // vid create) — skapar en NY, separat destination mot samma
      // webhook-URL istället, med "@self" som källa (Bokix eget konto,
      // där prenumerationerna faktiskt skapas — till skillnad från den
      // befintliga som bara får "@accounts", anslutna konton).
      const created = await stripe.v2.core.eventDestinations.create({
        name: 'Bokix egna kontohändelser (@self)',
        type: 'webhook_endpoint',
        webhook_endpoint: { url: 'https://bokix.vercel.app/api/stripe/webhook' },
        event_payload: 'snapshot',
        events_from: ['@self'],
        enabled_events: ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'checkout.session.completed'],
        include: ['webhook_endpoint.signing_secret', 'webhook_endpoint.url'],
      });
      res.status(200).json({
        id: created.id,
        events_from: created.events_from,
        status: created.status,
        signing_secret: created.webhook_endpoint?.signing_secret,
      });
      return;
    }

    if (action === 'cleanup') {
      const subId = req.query?.subscription_id || new URL(req.url, 'http://x').searchParams.get('subscription_id');
      const testUserId = req.query?.user_id || new URL(req.url, 'http://x').searchParams.get('user_id');
      if (subId) await stripe.subscriptions.cancel(subId);
      if (testUserId) await admin.from('subscriptions').delete().eq('user_id', testUserId);
      res.status(200).json({ cleaned: true });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('webhook-e2e-test error:', error);
    res.status(500).json({ error: error.message, raw: error.raw?.message });
  }
}
