// Skriver en hållbar betalningshändelse-rad (service-role) — se den långa
// kommentaren ovanför stripe_payment_events i supabase-setup.sql för VARFÖR
// webhooken aldrig skriver "betald" direkt in i user_data.state. Delad av
// både api/stripe/webhook.js (produktion) och server.js (lokal utveckling)
// så de två garanterat gör exakt samma sak.
import { createClient } from '@supabase/supabase-js';

export async function recordStripePaymentEvent({ stripeEventId, userId, companyId, invoiceId, amountTotal, currency, paidAt }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY saknas — kan inte logga betalningshändelsen server-side.');
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  // ignoreDuplicates: true (ON CONFLICT DO NOTHING på stripe_event_id) —
  // Stripe garanterar bara "minst en gång"-leverans och skickar samma
  // event igen vid t.ex. timeout, så det här måste vara idempotent.
  const { error } = await supabaseAdmin
    .from('stripe_payment_events')
    .upsert(
      {
        stripe_event_id: stripeEventId,
        user_id: userId,
        company_id: companyId,
        invoice_id: invoiceId,
        amount_total: amountTotal,
        currency,
        paid_at: paidAt,
      },
      { onConflict: 'stripe_event_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}
