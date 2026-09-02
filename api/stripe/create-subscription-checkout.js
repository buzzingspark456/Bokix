import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';
import { parseJsonBody } from './_parseBody.js';
import { normalizeAbsoluteUrl, appendQueryParam } from './_urls.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';
import { requireAuthedUser } from '../_auth.js';
import { hasExistingSubscription, getSubscriptionRow, upsertSubscription } from './_subscriptions.js';

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

// Bokix egen plan — "Ett pris. Allt ingår." (PricingPage.jsx/LandingPage.jsx),
// inte en variabel per kund som create-checkout-session.js (den gäller
// KUNDERS fakturabetalningar via ett anslutet Stripe-konto, helt separat
// flöde). inline price_data istället för ett förskapat Stripe Price-objekt
// — samma teknik som redan används för fakturarader (App.jsx
// getInvoicePaymentLinkUrl) — så ingen manuell produkt-/prisuppsättning i
// Stripe Dashboard krävs innan det här fungerar.
const SUBSCRIPTION_PRICE_SEK_ORE = 17900; // 179,00 kr/mån
const TRIAL_DAYS = 30;

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
  if (!checkRateLimit(req, res, { key: 'create-subscription-checkout', max: 10 })) return;

  // Vercel BotID — se filkommentaren i main.jsx.
  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

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
    if (body.action === 'cancel' || body.action === 'reactivate') {
      const authedUser = await requireAuthedUser(req, res);
      if (!authedUser) return; // requireAuthedUser har redan svarat 401

      const subRow = await getSubscriptionRow(authedUser.id, body.company_id || null);
      if (!subRow?.stripe_subscription_id) {
        res.status(404).json({ error: 'Ingen prenumeration hittades för det här företaget.' });
        return;
      }

      const updated = await stripe.subscriptions.update(subRow.stripe_subscription_id, {
        cancel_at_period_end: body.action === 'cancel',
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
        currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: !!updated.cancel_at_period_end,
      });

      res.status(200).json({
        status: updated.status,
        cancelAtPeriodEnd: !!updated.cancel_at_period_end,
        trialEndsAt: updated.trial_end ? new Date(updated.trial_end * 1000).toISOString() : null,
        currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null,
      });
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
    } else if (await hasExistingSubscription(body.user_id)) {
      const user = await requireAuthedUser(req, res);
      if (!user) return; // requireAuthedUser har redan svarat 401
      if (user.id !== body.user_id) {
        res.status(403).json({ error: 'user_id matchar inte den inloggade användaren.' });
        return;
      }
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
        // company_id (bara satt när det HÄR anropet gäller "Lägg till
        // företag", body.company_id) läses av webhook.js på samma sätt som
        // user_id, samma mönster som checkout.session.completed:s egen
        // company_id/invoice_id-metadata (kundfakturaflödet, orelaterat men
        // samma princip) redan använder.
        metadata: body.company_id ? { user_id: body.user_id, company_id: body.company_id } : { user_id: body.user_id },
      },
      metadata: body.company_id ? { user_id: body.user_id, company_id: body.company_id } : { user_id: body.user_id },
      // company_id på success_url (bara satt när body.company_id finns) —
      // App.jsx:s "vänta in webhooken"-logik (fetchUserData) behöver veta
      // VILKET företags rad den ska vänta på, annars väntar den (fel) in
      // kontots legacy-rad, som en ny företags-checkout aldrig skriver till.
      success_url: body.company_id
        ? appendQueryParam(appendQueryParam(baseUrl, 'subscription_checkout', 'success'), 'company_id', body.company_id)
        : appendQueryParam(baseUrl, 'subscription_checkout', 'success'),
      cancel_url: appendQueryParam(cancelBaseUrl, 'subscription_checkout', 'cancelled'),
    });
    res.status(200).json({ session });
  } catch (error) {
    console.error('Stripe create-subscription-checkout error:', error);
    res.status(500).json({ error: error.message || 'Subscription checkout session creation failed' });
  }
}
