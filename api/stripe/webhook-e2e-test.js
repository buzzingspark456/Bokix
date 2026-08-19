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

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price_data: { currency: 'sek', product_data: { name: 'Bokix (webhook-test)' }, unit_amount: 9900, recurring: { interval: 'month' } } }],
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
