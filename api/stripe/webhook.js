import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';
import { recordStripePaymentEvent } from './_paymentEvents.js';
import { upsertSubscription } from './_subscriptions.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  // apiVersion removed to use Stripe account default
});

function getWebhookSecrets() {
  return [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_TUNNEL,
    process.env.STRIPE_WEBHOOK_SECRET_SNAPSHOT,
    // Produktionens Vercel-projekt har INGEN variabel som heter
    // STRIPE_WEBHOOK_SECRET* — bara två med Vercel-Stripe-integrationens
    // egna auto-genererade namn (`vercel env ls` bekräftar detta). Utan de
    // här två raderna verifieras webhooken aldrig i produktion — alla
    // Stripe-händelser (inklusive de nya customer.subscription.*) skulle
    // tyst avvisas med 400 "signature verification failed". constructEvent
    // provar varje hemlighet i tur och ordning och kastar bara om INGEN
    // matchar, så att ha extra kandidater här är riskfritt.
    process.env.Bokix_Stripe_Connect_Snapshot,
    process.env.empowering_splendor_thin,
    // De två ovan lyssnar bara på events_from:["@accounts"] (Stripe v2
    // Event Destinations) — ALDRIG händelser från Bokix eget konto, där
    // våra egna prenumerationer skapas. events_from går inte att ändra i
    // efterhand (bara vid create), så en NY destination ("@self") skapades
    // istället, med denna egna signeringshemlighet.
    process.env.STRIPE_WEBHOOK_SECRET_SELF,
  ].filter(Boolean);
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  const rawBody = await req.text();

  if (!signature) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  if (!rawBody) {
    res.status(400).json({ error: 'Missing request body' });
    return;
  }

  const secrets = getWebhookSecrets();
  if (secrets.length === 0) {
    res.status(500).json({ error: 'Stripe webhook secret is not configured' });
    return;
  }

  let event;
  let lastError;

  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!event) {
    console.error('Stripe webhook verification failed:', lastError?.message || lastError);
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  console.log('Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'account.updated':
        // Onboarding-status läses redan alltid live vid behov (samma "aldrig
        // en cachad flagga"-princip som resolveSenderAddress för Resend) —
        // inget att spara här.
        break;
      case 'checkout.session.completed': {
        // payment_status kan vara 'unpaid' här för asynkrona betalmetoder
        // (t.ex. banköverföring) — sessionen är "completed" (kunden är klar
        // i UI:t) men pengarna inte bekräftat mottagna än. Bokför bara
        // faktiskt bekräftade betalningar.
        const session = event.data.object;
        if (session.payment_status !== 'paid') break;

        const { user_id: userId, company_id: companyId, invoice_id: invoiceId } = session.metadata || {};
        if (!userId || !companyId || !invoiceId) {
          // Gamla/manuellt skapade sessioner utan metadata — inget vi kan
          // koppla till en faktura. Loggas, men är inget att larma om eller
          // låta Stripe försöka igen för (det löser sig aldrig av sig själv).
          console.warn('checkout.session.completed utan user_id/company_id/invoice_id i metadata, hoppar över:', session.id);
          break;
        }

        await recordStripePaymentEvent({
          stripeEventId: event.id,
          userId,
          companyId,
          invoiceId,
          amountTotal: session.amount_total != null ? session.amount_total / 100 : null,
          currency: session.currency,
          paidAt: new Date(event.created * 1000).toISOString(),
        });
        break;
      }
      case 'payout.paid':
        // Utbetalningshistorik för det anslutna kontot hämtas idag inte in
        // någonstans i appen (ingen sida visar den) — inget att spara förrän
        // en sådan sida faktiskt finns, se PRODUCTION_READINESS.md.
        break;

      // ── Bokix egen prenumeration (create-subscription-checkout.js,
      // registreringsflödet i Auth.jsx) — HELT separat från checkout.session.
      // completed ovan, som gäller kunders fakturabetalningar via ett
      // anslutet Stripe-konto. created/updated täcker både "provperiod
      // startad", "provperiod slut → första betalning", "betalning
      // misslyckades" (status blir past_due/unpaid) osv. — alla skickar
      // samma händelsetyp med olika status, ingen anledning att sära på dem. ──
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await upsertSubscription({
          userId: sub.metadata?.user_id,
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          stripeSubscriptionId: sub.id,
          status: sub.status,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        });
        break;
      }
      case 'customer.subscription.deleted': {
        // Stripe sätter redan status till 'canceled' på själva objektet här
        // — samma upsertSubscription-anrop, ingen särskild "ta bort rad"-väg.
        const sub = event.data.object;
        await upsertSubscription({
          userId: sub.metadata?.user_id,
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          stripeSubscriptionId: sub.id,
          status: sub.status,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // Databasfel etc. — svara 5xx så Stripe försöker igen (idempotent via
    // stripe_event_id-unikheten i recordStripePaymentEvent), istället för
    // att tyst tappa en riktig betalningshändelse.
    console.error('Stripe webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
    return;
  }

  res.status(200).json({ received: true, type: event.type });
}
