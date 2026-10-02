// Skriver Bokix egen prenumerationsstatus (service-role) — se den långa
// kommentaren ovanför public.subscriptions i supabase-setup.sql för VARFÖR
// webhooken aldrig skriver detta direkt in i user_data.state. Delad av både
// api/stripe/webhook.js (produktion) och server.js (lokal utveckling) så de
// två garanterat gör exakt samma sak.
import { createClient } from '@supabase/supabase-js';

// Säkerhetsfix (säkerhetsgranskningen) — se den fulla kommentaren i
// api/stripe/create-subscription-checkout.js för VARFÖR den här kollen
// finns. Flyttad hit (samma fil som upsertSubscription, redan delad mellan
// api/stripe/create-subscription-checkout.js och server.js) istället för
// att finnas som två separata, lätt-att-glömma-uppdatera kopior — server.js
// hade tidigare sin egen, oparallella create-subscription-checkout-rutt utan
// den här kollen alls, ett latent kryphål i lokal utveckling.
// Betala-per-företag (kundkrav): companyId ''/null/undefined = kontots
// ursprungliga/legacy-abonnemang (se supabase-setup.sql:s kommentar vid
// public.subscriptions för hela resonemanget — "redan betalt", oförändrat
// för alla konton/företag som fanns innan den här ändringen). Ett riktigt
// companyId = ett SPECIFIKT, nytt tillagt företags EGNA abonnemang.
// company_id är NOT NULL i databasen (tom sträng, inte NULL, för
// legacy-raden — se samma SQL-kommentar för varför: en riktig, fullständig
// UNIQUE(user_id, company_id) fungerar med .upsert()s onConflict-option,
// ett NULL+partiellt-index-upplägg hade inte gjort det).
const legacyCompanyId = (companyId) => companyId || '';

// Samma lista som App.jsx:s ALLOWED_SUBSCRIPTION_STATUSES: de statusar som
// släpper in kontot förbi betalspärren.
export const PAID_STATUSES = ['trialing', 'active', 'past_due'];

// Fälten upsertSubscription vill ha, ur ett Stripe Subscription-objekt.
export function subscriptionFieldsFromStripe(sub) {
  return {
    userId: sub.metadata?.user_id,
    plan: sub.metadata?.plan || undefined,
    companyId: sub.metadata?.company_id || null,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  };
}

export async function hasExistingSubscription(userId, companyId = null) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    // Kan inte slå upp — hellre neka öppet (kräv inloggning) än att av
    // misstag släppa igenom ett obehörigt anrop mot ett okänt konto.
    return true;
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data } = await admin.from('subscriptions').select('user_id').eq('user_id', userId).eq('company_id', legacyCompanyId(companyId)).maybeSingle();
  return !!data;
}

/** Hämtar HELA prenumerationsraden för ETT företag (companyId null =
 * kontots legacy-rad, se hasExistingSubscription ovan) — Inställningar →
 * Prenumeration (avsluta/återaktivera, se create-subscription-checkout.js)
 * behöver stripe_subscription_id:t för att veta VILKEN Stripe-prenumeration
 * som ska uppdateras. */
export async function getSubscriptionRow(userId, companyId = null) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  // Säkerhetsgranskningen (över-hämtning): hämtar bara de fält som
  // faktiskt läses, aldrig select('*') — stripe_subscription_id för
  // uppsägning/återaktivering, plus plan och created_at, som
  // återbetalningen vid uppsagt årsabonnemang räknar på. Kundens
  // stripe_customer_id och statusfälten hämtas fortfarande inte.
  const { data } = await admin.from('subscriptions').select('stripe_subscription_id, plan, created_at').eq('user_id', userId).eq('company_id', legacyCompanyId(companyId)).maybeSingle();
  return data || null;
}


/** Bara stripe_customer_id — för Stripes Billing Portal (Inställningar →
 * Prenumeration → Betalningsuppgifter/Fakturor & kvitton). Egen, smal
 * funktion i stället för att bredda getSubscriptionRows SELECT ovan —
 * samma över-hämtnings-försiktighet som den kommentaren redan förklarar. */
export async function getStripeCustomerId(userId, companyId = null) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).eq('company_id', legacyCompanyId(companyId)).maybeSingle();
  return data?.stripe_customer_id || null;
}

export async function upsertSubscription({
  userId,
  companyId = null,
  // Vilket abonnemang kunden faktiskt köpte ("employer_yearly"). Kommer ur
  // Stripe-metadatan som checkouten satte, och är det appen läser för att
  // veta om lönemodulen ingår. `undefined` lämnar kolumnen orörd — en
  // statusuppdatering från en gammal prenumeration utan plan i metadatan
  // ska inte nolla en plan som redan står i databasen.
  plan,
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
  // Raden har plats för EN prenumeration per företag, men Stripe kan ha
  // flera för samma konto (kunden gick igenom Checkout igen när spärren
  // felaktigt sa obetalt). En annan prenumeration som avslutas eller
  // misslyckas får inte skriva över en som fortfarande gäller.
  if (!PAID_STATUSES.includes(status) && stripeSubscriptionId) {
    const { data: existing } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .eq('company_id', legacyCompanyId(companyId))
      .maybeSingle();
    if (existing?.stripe_subscription_id
      && existing.stripe_subscription_id !== stripeSubscriptionId
      && PAID_STATUSES.includes(existing.status)) {
      console.warn('Hoppar över', status, 'för', stripeSubscriptionId, '— kontot har redan en giltig prenumeration:', existing.stripe_subscription_id);
      return;
    }
  }
  // upsert på (user_id, company_id) — EN riktig, fullständig unik
  // constraint (se supabase-setup.sql:s kommentar för varför company_id är
  // '' istället för NULL för legacy-raden, inte ett partiellt index).
  // Samma onConflict-sats täcker båda fallen.
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        company_id: legacyCompanyId(companyId),
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        ...(plan ? { plan } : {}),
        status,
        trial_ends_at: trialEndsAt,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
      },
      { onConflict: 'user_id,company_id' }
    );
  if (error) throw error;
}
