import { applySecurityHeaders } from '../_security.js';
import { resolvePlan, TRIAL_DAYS, resolveCancellation } from '../../src/utils/plans.js';
import Stripe from 'stripe';
import { parseJsonBody } from './_parseBody.js';
import { normalizeAbsoluteUrl, appendQueryParam } from './_urls.js';
import { checkRateLimit, getClientIp } from '../_rateLimit.js';
import { createClient } from '@supabase/supabase-js';
import { trialDecision, trialMetadata } from './_trialGuard.js';
import { requireAuthedUser } from '../_auth.js';
import { hasExistingSubscription, getSubscriptionRow, getStripeCustomerId, upsertSubscription, subscriptionFieldsFromStripe, PAID_STATUSES } from './_subscriptions.js';

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
      const { data: row } = await admin.from('user_data').select('state').eq('user_id', userId).maybeSingle();
      orgNr = row?.state?.companies?.[companyId]?.company?.orgNr || '';
    }
    return { email: data.user.email, orgNr };
  } catch (err) {
    console.warn('[provperiod] kunde inte läsa kontot:', err.message);
    return null;
  }
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
    // ── Stripes Billing Portal (Inställningar → Prenumeration →
    // Betalningsuppgifter / Fakturor & kvitton) — EN hostad Stripe-sida som
    // redan hanterar BÅDE kortbyte OCH kvitto-/fakturahistorik korrekt, i
    // stället för att bygga om det i appen (egna Stripe-API-anrop för
    // betalkort och en egen fakturalista, dubbelt jobb och en yta till att
    // hålla säker). Kräver alltid en inloggad session — precis som cancel/
    // reactivate nedan, av samma skäl.
    if (body.action === 'billing-portal') {
      const authedUser = await requireAuthedUser(req, res);
      if (!authedUser) return;

      const stripeCustomerId = await getStripeCustomerId(authedUser.id, body.company_id || null);
      if (!stripeCustomerId) {
        res.status(404).json({ error: 'Ingen Stripe-kund hittades för det här företaget.' });
        return;
      }

      const returnUrl = normalizeAbsoluteUrl(process.env.STRIPE_SUCCESS_URL, 'http://localhost:5173');
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });
      res.status(200).json({ url: portalSession.url });
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

      const updated = await stripe.subscriptions.update(subRow.stripe_subscription_id, {
        ...(body.action === 'cancel' && cancellation.cancelAt
          ? { cancel_at: Math.floor(cancellation.cancelAt.getTime() / 1000) }
          : { cancel_at_period_end: body.action === 'cancel' }),
        // Återaktivering måste nolla BÅDA vägarna ut: en prenumeration som
        // sagts upp med cancel_at (minimitiden) släpps inte av att bara
        // cancel_at_period_end sätts till false.
        ...(body.action === 'reactivate' ? { cancel_at: null, cancel_at_period_end: false } : {}),
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
        plan: subRow.plan || null,
        // Slutdatumet när uppsägningen skjuts fram till minimitidens slut,
        // så gränssnittet kan säga "avslutas 15 april" i stället för bara
        // "uppsagd".
        cancelAt: updated.cancel_at ? new Date(updated.cancel_at * 1000).toISOString() : null,
        minimumMonths: cancellation.minimumMonths || 0,
        cancelAtPeriodEnd: !!updated.cancel_at_period_end,
        trialEndsAt: updated.trial_end ? new Date(updated.trial_end * 1000).toISOString() : null,
        currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null,
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
    } else if (await hasExistingSubscription(body.user_id)) {
      const user = await requireAuthedUser(req, res);
      if (!user) return; // requireAuthedUser har redan svarat 401
      if (user.id !== body.user_id) {
        res.status(403).json({ error: 'user_id matchar inte den inloggade användaren.' });
        return;
      }
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
    const trialSignals = { email: account?.email || body.customer_email, orgNr: account?.orgNr, ip: getClientIp(req) };
    const decision = await trialDecision(stripe, { ...trialSignals, excludeUserId: body.user_id });
    if (!decision.allowTrial) console.warn('[provperiod] ingen provperiod:', decision.reasons.join(','), body.user_id);
    const guardMetadata = {
      ...trialMetadata(trialSignals),
      ...(decision.allowTrial ? {} : { bokix_trial_denied: decision.reasons.join(',') }),
    };

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
