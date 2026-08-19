// Skriver Bokix egen prenumerationsstatus (service-role) — se den långa
// kommentaren ovanför public.subscriptions i supabase-setup.sql för VARFÖR
// webhooken aldrig skriver detta direkt in i user_data.state. Delad av både
// api/stripe/webhook.js (produktion) och server.js (lokal utveckling) så de
// två garanterat gör exakt samma sak.
import { createClient } from '@supabase/supabase-js';

export async function upsertSubscription({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  trialEndsAt,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY saknas — kan inte spara prenumerationsstatus server-side.');
  }
  if (!userId) {
    // metadata.user_id saknas — troligen en prenumeration skapad manuellt i
    // Stripe Dashboard, inte via create-subscription-checkout.js. Inget vi
    // kan koppla till ett Bokix-konto, men inte heller ett fel att larma om.
    console.warn('Stripe-prenumerationshändelse utan user_id i metadata, hoppar över:', stripeSubscriptionId);
    return;
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  // upsert på user_id (UNIQUE, en rad per konto) — samma rad uppdateras av
  // varje efterföljande subscription-händelse för samma användare, i
  // motsats till stripe_payment_events som är en append-only logg.
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        status,
        trial_ends_at: trialEndsAt,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
      },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}
