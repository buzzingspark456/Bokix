import { applySecurityHeaders } from '../_security.js';
import { resolvePlan, TRIAL_DAYS, resolveCancellation, planFromId, ALL_PLAN_IDS } from '../../src/utils/plans.js';
import Stripe from 'stripe';
import { parseJsonBody } from './_parseBody.js';
import { stripeReturnBase, appendQueryParam } from './_urls.js';
import { checkRateLimit, getClientIp } from '../_rateLimit.js';
import { createClient } from '@supabase/supabase-js';
import { trialDecision, trialMetadata } from './_trialGuard.js';
import { checkCompanyInRegistry } from './_registryGuard.js';
import { requireAuthedUser } from '../_auth.js';
import { readOwnerCompany } from '../_companyStore.js';
import { hasExistingSubscription, getSubscriptionRow, getStripeCustomerId, getStripeCustomerIds, upsertSubscription, subscriptionFieldsFromStripe, stripePeriodEnd, PAID_STATUSES } from './_subscriptions.js';
import { listSubscriptionCustomerIds, listSubscriptionInvoices, invoicesForCompany } from './_billingInvoices.js';
import { sendableEmail } from '../../src/utils/validators.js';
import { isValidSwedishOrgNr } from '../../src/utils/personnummer.js';

// Läses INTE in som modul-nivå-konstant — samma gotcha som _resend.js/
// _signedToken.js/company-access.js:s getForetagsApiKey redan har en
// identisk kommentar om: server.js:s dotenv.config() körs EFTER sina egna
// imports (ES-moduler kör hela den importerade modul-kroppen innan
// importörens egen kod, dotenv.config() inkluderad). Den här filen
// importerades tidigare aldrig direkt av server.js (som hade en egen
// handkopierad create-subscription-checkout-rutt, se den ruttens
// kommentar i server.js) — när server.js:s /api/stripe/create-
// subscription-checkout byttes till att importera PRODUKTIONSFILEN direkt
// blev en modul-nivå-konstant här plötsligt permanent `null` i lokal
// utveckling, trots en korrekt ifylld .env ("Stripe is not configured"
// även med nyckeln på plats). Fungerade ändå hela tiden i produktion
// (Vercel injicerar env-variabler innan modulen ens laddas).
function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
  return stripeSecretKey && !stripeSecretKey.startsWith('pk_')
    ? new Stripe(stripeSecretKey, {
        // apiVersion removed to use Stripe account default
      })
    : null;
}

// Stripes tillåtna orsaker för cancellation_details.feedback.
const CANCEL_FEEDBACK = new Set(['too_expensive', 'missing_features', 'switched_service', 'unused', 'too_complex', 'low_quality', 'customer_service', 'other']);

// Beloppet kommer ur den DELADE plankatalogen (src/utils/plans.js), samma
// fil prissidan renderar ifrån — inte ur en konstant här. Tidigare stod
// 17900 öre hårdkodat, vilket betydde att en kund som valde "Utan
// personal" (129 kr) ändå debiterades 179 kr och att appen omöjligt kunde
// veta vilken nivå som köpts. Ett pris som bara finns på ETT ställe kan
// inte glida isär mot det kunden såg.
//
// inline price_data i stället för förskapade Stripe Price-objekt — samma
// teknik som redan används för fakturarader (App.jsx
// getInvoicePaymentLinkUrl) — så ingen manuell produktuppsättning i Stripe
// Dashboard krävs, och en prisändring i katalogen slår igenom direkt.

// Säkerhetsfix (säkerhetsgranskningen): den här endpointen litade tidigare
// blint på body.user_id. Vem som helst kunde posta en godtycklig (gissad
// eller läckt) användares user_id, slutföra Checkout med sitt EGET kort och
// sedan avbryta prenumerationen — webhook.js → upsertSubscription skriver
// prenumerationsstatus rakt in i `subscriptions`, keyed på user_id, UTAN
// att jämföra mot en redan sparad stripe_customer_id. En avbruten, spoofad
// prenumeration hade alltså skrivit över en RIKTIG betalande kunds status
// till "canceled" och låst ute dem via PaymentRequiredGate.
//
// Kan INTE bara kräva requireAuthedUser rakt av här som i de andra Stripe-
// endpointsen: anropet sker direkt efter supabase.auth.signUp() (Auth.jsx,
// regStep===3), och `data.session` kan vara null där om Supabase-projektet
// kräver bekräftad e-post innan en session utfärdas — det är den enda
// legitima anropspunkten utan inloggad session. Lösningen (hasExistingSub-
// scription, _subscriptions.js): en HELT NY user_id (inget att skydda ännu)
// tillåts precis som idag. Men finns redan en subscriptions-rad för det
// user_id:t — dvs. kontot har redan varit igenom det här flödet — krävs en
// verifierad session SOM MATCHAR user_id, så bara den inloggade ägaren kan
// skapa en ny checkout mot sitt eget, redan existerande konto.

/** E-post och organisationsnummer för provperiodskontrollen, lästa på
 *  servern: kontots e-post, org.nr från registreringen eller (Lägg till
 *  företag) från företagets sparade uppgifter. null vid fel — kontrollen
 *  faller då tillbaka på e-posten klienten skickade. */
async function loadAccountForTrial(userId, companyId) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !userId) return null;
  try {
    const admin = createClient(url, key);
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    let orgNr = data.user.user_metadata?.org_nr || '';
    if (companyId) {
      const entry = await readOwnerCompany(admin, userId, companyId, { kinds: [] });
      orgNr = entry?.data?.company?.orgNr || '';
      return { email: data.user.email, orgNr, companyFound: Boolean(entry), isUf: Boolean(entry?.data?.company?.isUf) };
    }
    return { email: data.user.email, orgNr };
  } catch (err) {
    console.warn('[provperiod] kunde inte läsa kontot:', err.message);
    return null;
  }
}

function hasAuthHeader(req) {
  const header = req.headers?.['authorization'] || req.headers?.['Authorization'];
  return typeof header === 'string' && header.startsWith('Bearer ');
}

// Kontot skapades nyss (registreringen, innan en session hunnit utfärdas).
async function isFreshSignup(userId) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !userId) return false;
  const { data, error } = await createClient(url, key).auth.admin.getUserById(userId);
  if (error || !data?.user?.created_at) return false;
  return Date.now() - new Date(data.user.created_at).getTime() < 60 * 60 * 1000;
}

// ── Hjälp för misslyckad betalning (2026-11-27) ──
// Nyare Stripe-versioner har flyttat fakturans PaymentIntent till invoice.payments.
async function invoicePaymentIntent(stripe, invoice) {
  try {
    if (typeof invoice.payment_intent === 'string') return await stripe.paymentIntents.retrieve(invoice.payment_intent);
    if (invoice.payment_intent?.id) return invoice.payment_intent;
    const list = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 1, expand: ['data.payment.payment_intent'] });
    const pi = list.data?.[0]?.payment?.payment_intent;
    if (!pi) return null;
    return typeof pi === 'string' ? await stripe.paymentIntents.retrieve(pi) : pi;
  } catch {
    return null;
  }
}

// Kortet abonnemanget dras från: märke, fyra sista siffror och utgång.
async function subscriptionCard(stripe, sub, customerId) {
  try {
    let pmId = typeof sub.default_payment_method === 'string' ? sub.default_payment_method : sub.default_payment_method?.id;
    if (!pmId && customerId) {
      const customer = await stripe.customers.retrieve(customerId);
      const dpm = customer?.invoice_settings?.default_payment_method;
      pmId = typeof dpm === 'string' ? dpm : dpm?.id;
    }
    if (!pmId) return null;
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (!pm?.card) return null;
    return { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
  } catch {
    return null;
  }
}

// Bankens svar på svenska, utan tekniska koder.
function declineText(error) {
  const code = error?.decline_code || error?.code;
  if (!code) return null;
  return ({
    insufficient_funds: 'Kortet saknar täckning.',
    expired_card: 'Kortet har gått ut.',
    card_declined: 'Banken nekade köpet.',
    do_not_honor: 'Banken nekade köpet.',
    generic_decline: 'Banken nekade köpet.',
    lost_card: 'Kortet är spärrat.',
    stolen_card: 'Kortet är spärrat.',
    incorrect_cvc: 'Säkerhetskoden stämmer inte.',
    processing_error: 'Ett tillfälligt fel hos banken. Försök igen om en stund.',
    authentication_required: 'Banken vill att du bekräftar betalningen.',
  })[code] || 'Banken nekade köpet.';
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY before trying again.' });
    return;
  }
  if (!(await checkRateLimit(req, res, { key: 'create-subscription-checkout', max: 10 }))) return;

  // Ingen BotID-koll längre (main.jsx: initBotId, se filkommentaren där) —
  // avsluta/återaktivera/billing-portal kräver alla requireAuthedUser
  // (nedan); en helt ny signup skyddas redan av Turnstile på registrerings-
  // steget precis innan (Auth.jsx) och av Stripes egen Radar-kontroll vid
  // själva kortdragningen.
  try {
    const body = await parseJsonBody(req);

    // ── Avsluta/återaktivera en BEFINTLIG prenumeration (Inställningar →
    // Prenumeration) — samma endpoint som skapar en ny Checkout-session
    // nedan istället för en egen fil, av samma "Vercel Hobby 12-funktions-
    // gräns"-skäl som redan dokumenterat i api/cron/reminders.js (se commit
    // "Fix: deployen misslyckades — 13 serverless functions, över Vercels
    // 12-gräns"). Kräver ALLTID en verifierad inloggad session — ingen
    // body.user_id-genväg som checkout-grenen nedan har (den har sitt eget,
    // dokumenterade skäl: anropet kan komma direkt efter signUp() innan en
    // session hunnit utfärdas). Att avsluta någons prenumeration kan bara
    // den inloggade ägaren själv göra.
    // company_id (betala-per-företag, kundkrav) — genomgående null/undefined
    // för kontots ORIGINALFLÖDE (oförändrat: Auth.jsx regStep 3, aldrig
    // skickat med company_id), ett riktigt värde bara för "Lägg till
    // företag" (App.jsx). Se _subscriptions.js:s kommentar för hur ''
    // (legacy) vs ett riktigt id hålls isär i databasen.
    // ── Hämta samtliga Bokix-prenumerationsfakturor för kontot. Varje
    // företag kan ha en egen Stripe-kund, så kund-id:n från databasen
    // kombineras med Stripe-prenumerationer vars metadata pekar på den
    // inloggade användaren. Bara säkra fakturalänkar och visningsfält
    // skickas tillbaka till klienten.
    if (body.action === 'billing-invoices') {
      const authedUser = await requireAuthedUser(req, res);
      if (!authedUser) return;

      const storedCustomerIds = await getStripeCustomerIds(authedUser.id);
      const customerIds = await listSubscriptionCustomerIds(stripe, authedUser.id, storedCustomerIds);
      const companyId = body.company_id || null;
      const subRow = await getSubscriptionRow(authedUser.id, companyId);
      const invoices = invoicesForCompany(await listSubscriptionInvoices(stripe, customerIds), companyId, subRow?.stripe_subscription_id);
      res.status(200).json({ invoices });
      return;
    }

    // ── Fakturamejl (2026-11-16, kundönskemål från en inbjuden revisor):
    // en extra adress som får en kopia av varje kvitto från Bokix. Sparas
    // som metadata (billing_cc) på företagets Stripe-kund, så ingen ny
    // tabell behövs; webhooken (invoice.paid) läser den. Utan body.email
    // läses adressen, med tom sträng tas den bort. Bara den inloggade
    // ägaren, aldrig inbjudna (de ser inte betalning, se Settings.jsx).
    if (body.action === 'billing-cc') {
      const authedUser = await requireAuthedUser(req, res);
      if (!authedUser) return;
      const companyId = body.company_id || null;
      let customerId = await getStripeCustomerId(authedUser.id, companyId);
      if (!customerId) {
        const subRow = await getSubscriptionRow(authedUser.id, companyId);
        if (subRow?.stripe_subscription_id) {
          try {
            const sub = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id);
            customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;
          } catch { /* ingen kund ännu */ }
        }
      }
      if (!customerId) {
        res.status(404).json({ error: 'Vi hittar ingen prenumeration för det här företaget än.' });
        return;
      }
      if (body.email === undefined) {
        const customer = await stripe.customers.retrieve(customerId);
        res.status(200).json({ email: customer?.metadata?.billing_cc || '' });
        return;
      }
      const raw = String(body.email || '').trim();
      const email = raw ? sendableEmail(raw) : '';
      if (raw && !email) {
        res.status(400).json({ error: 'Adressen ser inte ut som en giltig e-postadress.' });
        return;
      }
      await stripe.customers.update(customerId, { metadata: { billing_cc: email || '' } });
      res.status(200).json({ email: email || '' });
      return;
    }

    // ── Misslyckad betalning (2026-11-27): läget för bannern i appen, och
    // Försök igen som drar kortet direkt. Bara den inloggade ägaren, bara
    // det egna abonnemanget. Försök igen är begränsat till tre gånger per
    // tio minuter, så att det inte går att använda för att testa kort.
    if (body.action === 'payment-issue' || body.action === 'retry-payment') {
      const authedUser = await requireAuthedUser(req, res);
      if (!authedUser) return;
      if (body.action === 'retry-payment'
        && !(await checkRateLimit(req, res, { key: 'retry-payment', max: 3, windowMs: 10 * 60 * 1000, identifier: authedUser.id }))) return;
      const companyId = body.company_id || null;
      const subRow = await getSubscriptionRow(authedUser.id, companyId);
      if (!subRow?.stripe_subscription_id) {
        res.status(200).json({ issue: null });
        return;
      }
      const sub = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id);
      if (sub.metadata?.user_id && sub.metadata.user_id !== authedUser.id) {
        res.status(403).json({ error: 'Abonnemanget tillhör inte ditt konto.' });
        return;
      }
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      const open = (await stripe.invoices.list({ subscription: sub.id, status: 'open', limit: 1 })).data[0] || null;
      const card = await subscriptionCard(stripe, sub, customerId);

      if (body.action === 'payment-issue') {
        const pi = open ? await invoicePaymentIntent(stripe, open) : null;
        res.status(200).json({
          issue: open ? {
            amount: Math.round((open.amount_remaining ?? open.amount_due ?? 0) / 100),
            currency: open.currency,
            attempts: open.attempt_count || 0,
            nextAttempt: open.next_payment_attempt ? new Date(open.next_payment_attempt * 1000).toISOString() : null,
            requiresAction: pi?.status === 'requires_action',
            declineReason: declineText(pi?.last_payment_error),
            hostedUrl: open.hosted_invoice_url || null,
          } : null,
          status: sub.status,
          card,
        });
        return;
      }

      // Försök igen
      if (!open) {
        // Ingen öppen faktura: redan betald (t.ex. Stripe hann försöka). Spara läget.
        await upsertSubscription(subscriptionFieldsFromStripe(sub));
        res.status(200).json({ ok: true, status: sub.status });
        return;
      }
      try {
        await stripe.invoices.pay(open.id);
      } catch (err) {
        const pi = await invoicePaymentIntent(stripe, open);
        const requiresAction = err?.code === 'authentication_required' || err?.raw?.code === 'authentication_required' || pi?.status === 'requires_action';
        res.status(200).json({
          ok: false,
          requiresAction,
          hostedUrl: open.hosted_invoice_url || null,
          reason: requiresAction ? 'Banken vill att du bekräftar betalningen.' : (declineText(err?.raw || err) || 'Kortet nekades.'),
        });
        return;
      }
      // Gick igenom: spara direkt så att appen låses upp utan att vänta på webhooken.
      const fresh = await stripe.subscriptions.retrieve(sub.id);
      await upsertSubscription(subscriptionFieldsFromStripe(fresh));
      res.status(200).json({ ok: true, status: fresh.status });
      return;
    }

    // ── Stripes Billing Portal (Inställningar → Prenumeration →
    // Betalningsuppgifter → byt kort). Fakturahistoriken visas i appen så
    // att den kan omfatta flera Stripe-kunder för samma Bokix-konto.
    // Kräver alltid en inloggad session.
    if (body.action === 'billing-portal') {
      const authedUser = await requireAuthedUser(req, res);
      if (!authedUser) return;

      let stripeCustomerId = await getStripeCustomerId(authedUser.id, body.company_id || null);
      // Reserv när raden saknar kund-id: ta kunden från prenumerationen, eller
      // leta bland kontots Stripe-kunder efter en prenumeration som tillhör
      // just den här användaren och det här företaget (samma regel som 'sync').
      if (!stripeCustomerId) {
        const wantedCompanyId = body.company_id || null;
        const subRow = await getSubscriptionRow(authedUser.id, wantedCompanyId);
        if (subRow?.stripe_subscription_id) {
          try {
            const sub = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id);
            stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;
          } catch (err) {
            console.warn('billing-portal: kunde inte hämta prenumerationen', err.message);
          }
        }
        if (!stripeCustomerId && authedUser.email) {
          const customers = await stripe.customers.list({ email: authedUser.email, limit: 10 });
          for (const customer of customers.data) {
            const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 20 });
            if (subs.data.some(s => s.metadata?.user_id === authedUser.id && (s.metadata?.company_id || null) === wantedCompanyId)) {
              stripeCustomerId = customer.id;
              break;
            }
          }
        }
      }
      if (!stripeCustomerId) {
        res.status(404).json({ error: 'Vi hittar inga betalningsuppgifter för det här företaget än. Skriv till oss så hjälper vi dig.' });
        return;
      }

      const returnUrl = stripeReturnBase(process.env.STRIPE_SUCCESS_URL);
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });
      res.status(200).json({ url: portalSession.url });
      return;
    }

    // ── Byt plan (Inställningar → Prenumeration → Ändra plan, 2026-11-20).
    // Samma prenumeration, nytt månadsbelopp ur plankatalogen. Stripe räknar
    // om skillnaden för resten av perioden (proration) på nästa faktura.
    // Från årsplan till månadsvis går först när minimitiden passerats, annars
    // hade minimitiden gått att kringgå.
    if (body.action === 'change-plan') {
      const authedUser = await requireAuthedUser(req, res);
      if (!authedUser) return;
      const next = ALL_PLAN_IDS.includes(body.plan) ? planFromId(body.plan) : null;
      if (!next) { res.status(400).json({ error: 'Okänd plan.' }); return; }
      const subRow = await getSubscriptionRow(authedUser.id, body.company_id || null);
      if (!subRow?.stripe_subscription_id) { res.status(404).json({ error: 'Ingen prenumeration hittades för det här företaget.' }); return; }
      if (subRow.plan === next.id) { res.status(200).json({ plan: next.id, unchanged: true }); return; }
      const current = planFromId(subRow.plan);
      if (current?.intervalId === 'yearly' && next.intervalId === 'monthly') {
        const lock = resolveCancellation({ planId: subRow.plan, startedAt: subRow.created_at });
        if (lock.cancelAt) {
          res.status(409).json({ error: `Årsplanen har en minsta avtalstid på ${lock.minimumMonths} månader. Du kan byta till månadsvis från ${lock.cancelAt.toISOString().slice(0, 10)}.`, availableFrom: lock.cancelAt.toISOString() });
          return;
        }
      }
      const live = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id);
      const item = live.items?.data?.[0];
      const product = typeof item?.price?.product === 'string' ? item.price.product : item?.price?.product?.id;
      if (!item || !product) { res.status(409).json({ error: 'Prenumerationen gick inte att läsa. Skriv till oss så hjälper vi dig.' }); return; }
      const updated = await stripe.subscriptions.update(live.id, {
        items: [{ id: item.id, price_data: { currency: 'sek', product, unit_amount: next.amountOre, recurring: { interval: next.stripeInterval } } }],
        proration_behavior: 'create_prorations',
        metadata: { ...(live.metadata || {}), plan: next.id },
      });
      await upsertSubscription({
        userId: authedUser.id,
        companyId: body.company_id || null,
        stripeCustomerId: typeof updated.customer === 'string' ? updated.customer : updated.customer?.id,
        stripeSubscriptionId: updated.id,
        status: updated.status,
        trialEndsAt: updated.trial_end ? new Date(updated.trial_end * 1000).toISOString() : null,
        currentPeriodEnd: stripePeriodEnd(updated),
        cancelAtPeriodEnd: !!updated.cancel_at_period_end,
        plan: next.id,
      });
      res.status(200).json({ plan: next.id, status: updated.status });
      return;
    }

    if (body.action === 'cancel' || body.action === 'reactivate') {
      const authedUser = await requireAuthedUser(req, res);
      if (!authedUser) return; // requireAuthedUser har redan svarat 401

      const subRow = await getSubscriptionRow(authedUser.id, body.company_id || null);
      if (!subRow?.stripe_subscription_id) {
        res.status(404).json({ error: 'Ingen prenumeration hittades för det här företaget.' });
        return;
      }

      // Årsplanen har en minsta avtalstid på tre månader (plans.js). Säger
      // kunden upp innan dess löper abonnemanget till minimitidens slut i
      // stället för till innevarande periods slut — månadsplanen och en
      // årsplan som passerat minimitiden avslutas som vanligt.
      //
      // Ingen återbetalning finns någonstans i flödet, och det är hela
      // poängen med att debitera månadsvis även på årsplanen: det finns
      // aldrig ett förskott att betala tillbaka, alltså inget belopp att
      // räkna fel på och ingen manuell hantering när något krånglar.
      const cancellation = body.action === 'cancel'
        ? resolveCancellation({
            planId: subRow.plan,
            startedAt: subRow.created_at,
          })
        : { atPeriodEnd: true, cancelAt: null };

      // Stripe tar bara EN av cancel_at och cancel_at_period_end per anrop
      // ("Received both ... Please pass in only one", 2026-11-20). Vid
      // återaktivering nollas den som faktiskt är satt på prenumerationen.
      let reactivateFields = {};
      if (body.action === 'reactivate') {
        const live = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id);
        reactivateFields = live.cancel_at_period_end ? { cancel_at_period_end: false } : { cancel_at: null };
      }
      const updated = await stripe.subscriptions.update(subRow.stripe_subscription_id, {
        ...(body.action === 'cancel'
          ? (cancellation.cancelAt
            ? { cancel_at: Math.floor(cancellation.cancelAt.getTime() / 1000) }
            : { cancel_at_period_end: true })
          : reactivateFields),
        // Varför kunden avslutar (valfritt): Stripes egna fält för uppsägningsorsak.
        ...(body.action === 'cancel' && (CANCEL_FEEDBACK.has(body.feedback) || body.comment)
          ? { cancellation_details: { ...(CANCEL_FEEDBACK.has(body.feedback) ? { feedback: body.feedback } : {}), ...(body.comment ? { comment: String(body.comment).slice(0, 500) } : {}) } }
          : {}),
      });
      // Webhooken (customer.subscription.updated) skriver samma nya status
      // till public.subscriptions som vanligt, men kan dröja någon sekund —
      // speglar samma fält direkt här också (samma upsert-funktion
      // webhooken själv använder) så Inställningar kan visa rätt läge utan
      // att behöva vänta in eller polla den.
      await upsertSubscription({
        userId: authedUser.id,
        companyId: body.company_id || null,
        stripeCustomerId: typeof updated.customer === 'string' ? updated.customer : updated.customer?.id,
        stripeSubscriptionId: updated.id,
        status: updated.status,
        trialEndsAt: updated.trial_end ? new Date(updated.trial_end * 1000).toISOString() : null,
        currentPeriodEnd: stripePeriodEnd(updated),
        cancelAtPeriodEnd: !!updated.cancel_at_period_end,
      });

      res.status(200).json({
        status: updated.status,
        plan: subRow.plan || null,
        // Slutdatumet när uppsägningen skjuts fram till minimitidens slut,
        // så gränssnittet kan säga "avslutas 15 april" i stället för bara
        // "uppsagd".
        cancelAt: updated.cancel_at ? new Date(updated.cancel_at * 1000).toISOString() : null,
        minimumMonths: cancellation.minimumMonths || 0,
        cancelAtPeriodEnd: !!updated.cancel_at_period_end,
        trialEndsAt: updated.trial_end ? new Date(updated.trial_end * 1000).toISOString() : null,
        currentPeriodEnd: stripePeriodEnd(updated),
      });
      return;
    }

    // ── Hämta prenumerationen direkt ur Stripe (betalspärren) — reserv för
    // när webhooken inte hunnit eller inte kommit fram alls. Kunden kom
    // tillbaka från en lyckad Checkout men public.subscriptions var tom, så
    // spärren sa "inte betalt" och de betalade igen. Stripe är facit:
    // checkout-sessionen från success_url om den finns, annars kontots
    // Stripe-kunder via e-postadressen. Bara prenumerationer vars metadata
    // pekar på just den inloggade användaren räknas.
    if (body.action === 'sync') {
      const authedUser = await requireAuthedUser(req, res);
      if (!authedUser) return;

      const wantedCompanyId = body.company_id || null;
      const belongsToUser = (sub) => sub?.metadata?.user_id === authedUser.id
        && (sub.metadata?.company_id || null) === wantedCompanyId;

      const candidates = [];
      if (typeof body.session_id === 'string' && body.session_id.startsWith('cs_')) {
        try {
          const checkout = await stripe.checkout.sessions.retrieve(body.session_id, { expand: ['subscription'] });
          if (checkout.subscription && typeof checkout.subscription === 'object') candidates.push(checkout.subscription);
        } catch (err) {
          console.warn('sync: kunde inte hämta checkout-sessionen', body.session_id, err.message);
        }
      }
      if (!candidates.some(belongsToUser) && authedUser.email) {
        const customers = await stripe.customers.list({ email: authedUser.email, limit: 10 });
        for (const customer of customers.data) {
          const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 20 });
          candidates.push(...subs.data);
        }
      }

      const mine = candidates.filter(belongsToUser);
      // En giltig prenumeration före en avslutad, den nyaste först.
      mine.sort((a, b) => (PAID_STATUSES.includes(b.status) - PAID_STATUSES.includes(a.status)) || (b.created - a.created));
      const best = mine[0];
      if (!best) {
        res.status(200).json({ status: null });
        return;
      }
      await upsertSubscription(subscriptionFieldsFromStripe(best));
      res.status(200).json({ status: best.status });
      return;
    }

    if (!body.user_id) {
      res.status(400).json({ error: 'user_id krävs.' });
      return;
    }

    // Ett riktigt company_id (Lägg till företag) kräver ALLTID en inloggad,
    // verifierad session som matchar user_id — till skillnad från
    // kontots ORIGINALflöde nedan (kan komma direkt efter signUp(), innan
    // en session hunnit utfärdas, se filkommentaren högst upp) finns det
    // ingen legitim anledning att skapa checkout för ETT SPECIFIKT,
    // redan existerande företag utan att redan vara inloggad — man måste
    // ju redan ha loggat in för att kunna klicka "Lägg till företag" alls.
    if (body.company_id) {
      const user = await requireAuthedUser(req, res);
      if (!user) return;
      if (user.id !== body.user_id) {
        res.status(403).json({ error: 'user_id matchar inte den inloggade användaren.' });
        return;
      }
    } else if (hasAuthHeader(req) || await hasExistingSubscription(body.user_id)) {
      const user = await requireAuthedUser(req, res);
      if (!user) return; // requireAuthedUser har redan svarat 401
      if (user.id !== body.user_id) {
        res.status(403).json({ error: 'user_id matchar inte den inloggade användaren.' });
        return;
      }
    } else if (!await isFreshSignup(body.user_id)) {
      // Utan inloggning går det bara direkt efter registreringen. Annars
      // kunde vem som helst koppla en egen prenumeration till ett annat
      // konto bara genom att känna till dess id (säkerhetsgranskningen
      // 2026-10-20).
      res.status(401).json({ error: 'Logga in för att starta prenumerationen.' });
      return;
    }

    // Planen valideras mot katalogen innan något debiteras. En okänd
    // sträng får aldrig leda till ett belopp — då faller den tillbaka på
    // den nivå som gällde innan valet fanns (med personal, månadsvis), så
    // en gammal klient som inte skickar med `plan` fungerar oförändrat.
    const plan = resolvePlan(...String(body.plan || 'employer_monthly').split('_')) || resolvePlan('employer', 'monthly');

    // Upprepade provperioder (se _trialGuard.js): e-post och organisations-
    // nummer läses från kontot på servern, aldrig från det klienten skickar.
    // Ett företag (Lägg till företag) slås upp i kontots sparade data.
    const account = await loadAccountForTrial(body.user_id, body.company_id || null);
    // Bara svenska företag (2026-10-28): ett påhittat eller utländskt nummer
    // får ingen prenumeration. UF-konton har inget org.nr och berörs inte.
    if (account?.orgNr && !isValidSwedishOrgNr(account.orgNr)) {
      res.status(400).json({ error: 'Organisationsnumret är inte ett giltigt svenskt nummer. Bokix är för svenska företag. Kontakta support@bokix.se om något är fel.' });
      return;
    }
    // Lägg till företag: företaget måste ha ett nummer och finnas på riktigt.
    if (body.company_id && account?.companyFound && !account.isUf) {
      if (!account.orgNr) {
        res.status(400).json({ error: 'Företaget saknar organisationsnummer. Kontakta support@bokix.se.' });
        return;
      }
      const registry = await checkCompanyInRegistry(account.orgNr);
      if (!registry.ok) {
        res.status(400).json({ error: registry.error });
        return;
      }
    }
    const trialSignals = { email: account?.email || body.customer_email, orgNr: account?.orgNr, ip: getClientIp(req) };
    const decision = await trialDecision(stripe, { ...trialSignals, excludeUserId: body.user_id, companyId: body.company_id || null });
    if (!decision.allowTrial) console.warn('[provperiod] ingen provperiod:', decision.reasons.join(','), body.user_id);
    const guardMetadata = {
      ...trialMetadata(trialSignals),
      ...(decision.allowTrial ? {} : { bokix_trial_denied: decision.reasons.join(',') }),
    };

    const baseUrl = stripeReturnBase(process.env.STRIPE_SUCCESS_URL);
    const cancelBaseUrl = stripeReturnBase(process.env.STRIPE_CANCEL_URL);

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
            product_data: { name: `Bokix — ${plan.name}` },
            unit_amount: plan.amountOre,
            recurring: { interval: plan.stripeInterval },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        // Ingen provperiod när samma företag, person eller nätverk redan haft
        // en (_trialGuard.js). Kortet dras då direkt, som efter en provperiod.
        ...(decision.allowTrial ? { trial_period_days: TRIAL_DAYS } : {}),
        // Sätts på själva Subscription-objektet (inte bara Sessionen) — så
        // metadata följer med automatiskt på VARJE efterföljande
        // customer.subscription.*-händelse (webhook.js), utan att behöva
        // slå upp/expandera sessionen igen för att koppla ihop dem.
        // company_id (bara satt när det HÄR anropet gäller "Lägg till
        // företag", body.company_id) läses av webhook.js på samma sätt som
        // user_id, samma mönster som checkout.session.completed:s egen
        // company_id/invoice_id-metadata (kundfakturaflödet, orelaterat men
        // samma princip) redan använder.
        metadata: {
          ...guardMetadata,
          ...(body.company_id
            ? { user_id: body.user_id, company_id: body.company_id, plan: plan.id }
            : { user_id: body.user_id, plan: plan.id }),
        },
      },
      metadata: body.company_id
        ? { user_id: body.user_id, company_id: body.company_id, plan: plan.id }
        : { user_id: body.user_id, plan: plan.id },
      // company_id på success_url (bara satt när body.company_id finns) —
      // App.jsx:s "vänta in webhooken"-logik (fetchUserData) behöver veta
      // VILKET företags rad den ska vänta på, annars väntar den (fel) in
      // kontots legacy-rad, som en ny företags-checkout aldrig skriver till.
      // `plan` med på success_url: kvittotexten i App.jsx sa tidigare
      // "sedan 179 kr/mån" oavsett vad kunden faktiskt valt i checkouten,
      // eftersom den inte hade något sätt att veta nivån. Nu läser den
      // planen härifrån (planFromId) och nämner rätt belopp. Bara ett
      // visningsvärde — vad som debiteras avgörs av `plan` ovan, aldrig av
      // en parameter i webbläsarens adressfält.
      // session_id: Stripe byter själv ut {CHECKOUT_SESSION_ID} mot
      // sessionens id, så betalspärren kan hämta prenumerationen direkt
      // (action 'sync' ovan) om webhooken inte hunnit. Klistras på som text:
      // appendQueryParam hade URL-kodat klamrarna och Stripe hade då inte
      // känt igen platshållaren.
      success_url: `${body.company_id
        ? appendQueryParam(appendQueryParam(appendQueryParam(baseUrl, 'subscription_checkout', 'success'), 'plan', plan.id), 'company_id', body.company_id)
        : appendQueryParam(appendQueryParam(baseUrl, 'subscription_checkout', 'success'), 'plan', plan.id)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: appendQueryParam(cancelBaseUrl, 'subscription_checkout', 'cancelled'),
    });
    // trial: false säger åt klienten att ingen provperiod ingår (texten före
    // betalningen ska inte lova 30 gratis dagar).
    res.status(200).json({ session, trial: decision.allowTrial });
  } catch (error) {
    console.error('Stripe create-subscription-checkout error:', error);
    res.status(500).json({ error: error.message || 'Subscription checkout session creation failed' });
  }
}
