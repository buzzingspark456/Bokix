import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import Stripe from 'stripe'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { createSignedState, verifySignedState } from './api/stripe/_oauthState.js'
import { parseCookies, STRIPE_OAUTH_COOKIE, stripeOauthStateCookie, clearStripeOauthStateCookie } from './api/stripe/_cookies.js'
import { recordStripePaymentEvent } from './api/stripe/_paymentEvents.js'
import { upsertSubscription, hasExistingSubscription } from './api/stripe/_subscriptions.js'
import { normalizeAbsoluteUrl, appendQueryParam } from './api/stripe/_urls.js'
import { resolveInvoiceLineItems } from './api/stripe/_invoiceLineItems.js'
import { requireAuthedUser, loadOwnedCompany, loadMemberCompany } from './api/_auth.js'
import { COMPANY_WRITABLE_FIELDS } from './api/_companyFields.js'
import { isRequestFromBot } from './api/_botid.js'

dotenv.config()

// Sida 37: den tidigare VITE_-prefixade fallbacken (VITE_STRIPE_SECRET_KEY)
// är borttagen — allt som börjar med VITE_ bundlas statiskt in i klient-JS
// av Vite, så att namnge en hemlig nyckel så var ett latent läckage-hål
// (aldrig faktiskt utnyttjat, ingen frontend-kod läste den, men risken
// fanns om någon råkade göra det i framtiden). STRIPE_SECRET_KEY (utan
// VITE_-prefix) är den enda källan nu.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null

let stripe = null

if (!stripeSecretKey) {
  console.warn('Stripe secret key not configured yet. Stripe routes will return a 503 until STRIPE_SECRET_KEY is provided.')
} else if (stripeSecretKey.startsWith('pk_')) {
  console.error('Invalid Stripe key: STRIPE_SECRET_KEY must be a secret key beginning with sk_, not pk_.')
} else {
  stripe = new Stripe(stripeSecretKey, {
    // apiVersion removed to use Stripe account default
  })
  console.log('Loaded Stripe secret key for local server.')
}

// ── Resend (transaktionell e-post) — Sida 33: en nyckel, olika avsändare
// per kund ──────────────────────────────────────────────────────────────
// Två nycklar med olika behörighet, inte en enda full_access-nyckel överallt:
//   RESEND_API_KEY       (sending_access) — det absoluta flertalet anrop,
//                          alla riktiga fakturautskick. Läcker den kan en
//                          angripare bara skicka mejl, inte skapa/radera
//                          domäner eller röra kontot.
//   RESEND_ADMIN_API_KEY (full_access)    — bara de sällan anropade
//                          domänhanterings-rutterna nedan (skapa/kontrollera
//                          en kunds egen avsändardomän). sending_access-
//                          nycklar kan inte hantera domäner alls (verifierat
//                          mot Resends dokumentation), så den här är
//                          obligatorisk för Steg 2, men dess litet anropade
//                          yta är precis vad som gör den privilegienivån
//                          försvarbar.
const resendApiKey = process.env.RESEND_API_KEY || null
const resendAdminApiKey = process.env.RESEND_ADMIN_API_KEY || null
// Systemets reservavsändare — används när ett företag inte har en egen
// verifierad domän än, eller om ett utskick med deras domän oväntat
// misslyckas (se resolveSenderAddress/sendViaResend nedan).
const emailFrom = process.env.EMAIL_FROM || 'Bokix <onboarding@resend.dev>'

if (!resendApiKey) {
  console.warn('Resend API key not configured yet. Email routes will return a 503 until RESEND_API_KEY is provided.')
} else {
  console.log('Loaded Resend API key for local server.')
}
if (!resendAdminApiKey) {
  console.warn('Resend admin API key not configured yet. Domain management routes will return a 503 until RESEND_ADMIN_API_KEY is provided.')
} else {
  console.log('Loaded Resend admin API key for local server.')
}

function requireResend(res) {
  if (!resendApiKey) {
    res.status(503).json({ error: 'E-post är inte konfigurerat. Sätt RESEND_API_KEY (och valfritt EMAIL_FROM) i miljövariablerna för att kunna skicka fakturor via e-post.' })
    return false
  }
  return true
}

function requireResendAdmin(res) {
  if (!resendAdminApiKey) {
    res.status(503).json({ error: 'Domänhantering är inte konfigurerat. Sätt RESEND_ADMIN_API_KEY (en Resend-nyckel med Full access) i miljövariablerna.' })
    return false
  }
  return true
}

/** Namnet före @ i en avsändaradress — samma för alla, oavsett domän. */
const SENDER_LOCAL_PART = 'faktura'

// ── Kontaktformulär (publik marknadssajt) — se motsvarande kommentar i
// api/contact.js för varför det här är en EGEN rutt och inte samma som
// send-invoice: ingen inloggning krävs, men mottagare/HTML byggs alltid
// på servern istället för att lita på klienten.
const CONTACT_INBOX = process.env.CONTACT_INBOX || 'support@bokix.se'
const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_CONTACT_TOPICS = ['Support', 'Fakturering & pris', 'Säkerhet & integritet', 'Övrigt']

function escContact(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildContactEmailHtml({ name, email, topic, message }) {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #0f172a; line-height: 1.6;">
      <p><strong>Namn:</strong> ${escContact(name)}</p>
      <p><strong>E-post:</strong> ${escContact(email)}</p>
      <p><strong>Ämne:</strong> ${escContact(topic)}</p>
      <p><strong>Meddelande:</strong></p>
      <p style="white-space: pre-wrap;">${escContact(message)}</p>
    </div>
  `
}

function fallbackSenderAddress(companyName) {
  // Om EMAIL_FROM redan är på formen "Namn <adress>" byts bara namndelen ut
  // mot företagets — annars återanvänds hela EMAIL_FROM oförändrad.
  const match = /^(.*)<(.+)>$/.exec(emailFrom)
  if (match && companyName) {
    return `${companyName} via Bokix <${match[2].trim()}>`
  }
  return emailFrom
}

/** Bugkritiskt (Sida 33): frågar ALLTID Resend live om en domäns status
 * innan ett utskick — aldrig en cachad flagga (t.ex. `emailDomainStatus`
 * som bara är en display-hint för Inställningar-sidan) som hunnit bli
 * inaktuell sedan senaste kontrollen. Faller tyst tillbaka till
 * systemadressen om domänen saknas, inte är verifierad, eller om själva
 * statuskontrollen mot Resend misslyckas — ett utskick ska aldrig stoppas
 * av att avsändaradressen inte gick att avgöra. */
async function resolveSenderAddress(company) {
  const fallback = fallbackSenderAddress(company?.name)
  if (!company?.resendDomainId || !company?.emailDomain || !resendAdminApiKey) {
    return { from: fallback, usingCustomDomain: false }
  }
  try {
    const domainRes = await fetch(`https://api.resend.com/domains/${company.resendDomainId}`, {
      headers: { Authorization: `Bearer ${resendAdminApiKey}` },
    })
    if (!domainRes.ok) return { from: fallback, usingCustomDomain: false }
    const domainData = await domainRes.json()
    if (domainData?.status === 'verified') {
      return { from: `${company.name} <${SENDER_LOCAL_PART}@${company.emailDomain}>`, usingCustomDomain: true }
    }
  } catch (error) {
    console.error('Resend domain status check failed, falling back:', error)
  }
  return { from: fallback, usingCustomDomain: false }
}

/** Ett enda ställe som faktiskt pratar med Resends /emails-endpoint, så
 * både förstaförsöket och fallback-återförsöket i send-invoice nedan
 * garanterat skickar identisk payload förutom `from`. */
async function sendViaResend(payload) {
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await resendRes.json().catch(() => ({}))
  return { ok: resendRes.ok, status: resendRes.status, data }
}

const app = express()

// Sida 37: grundläggande säkerhetshärdning — bara den lokala dev-servern
// (npm run dev, port 5000). I produktion är det api/*.js-filerna som
// hanterar /api/*-trafik på Vercel (se api/_security.js för motsvarande
// header-härdning där), server.js körs aldrig skarpt. CSP/andra headers
// stör inget här eftersom servern bara svarar med JSON, aldrig HTML.
app.use(helmet())

// Generellt tak för alla /api/*-anrop, striktare specifikt på Stripe/
// mejl-rutterna (de rör pengar respektive kan missbrukas för spam).
// In-memory — nollställs vid omstart, vilket räcker för lokal utveckling
// men INTE är en ersättning för riktig rate-limiting i produktion (kräver
// en delad datastore som Upstash Redis, eller Vercels egen
// Firewall-produkt — se plan-filen för varför det inte byggs här).
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false })
const sensitiveLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false })
app.use('/api/', generalLimiter)
app.use('/api/stripe/', sensitiveLimiter)
app.use('/api/email/', sensitiveLimiter)
app.use('/api/company-access', sensitiveLimiter)

// Bugkritiskt: MÅSTE registreras INNAN den globala express.json() nedan.
// Stripes signaturverifiering (constructEvent) kräver kroppen exakt som
// bytes-strömmen kom in — en gång tolkad till ett JS-objekt av json()-
// middlewaren och strängen är för alltid förlorad (annan whitespace/
// nyckelordning vid en eventuell JSON.stringify tillbaka), så verifieringen
// skulle alltid misslyckas. Express kör middleware/rutter i registrerings-
// ordning, så en exakt path+metod-matchande rutt HÄR (med sin egen
// express.raw()) hinner svara innan den senare globala json()-middlewaren
// någonsin rör kroppen — övriga rutter påverkas inte, Express hoppar bara
// vidare till nästa matchande handler för dem. Speglar api/stripe/webhook.js
// (produktionsvarianten på Vercel), som har samma logik men läser den råa
// kroppen via req.text() istället.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature']
  const rawBody = req.body // Buffer, tack vare express.raw() ovan

  if (!signature || !rawBody || !rawBody.length) {
    res.status(400).json({ error: 'Missing stripe-signature header or body' })
    return
  }

  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_TUNNEL,
    process.env.STRIPE_WEBHOOK_SECRET_SNAPSHOT,
    // Se motsvarande kommentar i api/stripe/webhook.js: produktionens
    // faktiska Vercel-miljövariabler heter inte STRIPE_WEBHOOK_SECRET*, se
    // `vercel env ls` — de här två är vad som faktiskt finns.
    process.env.Bokix_Stripe_Connect_Snapshot,
    process.env.empowering_splendor_thin,
    // Se motsvarande kommentar i api/stripe/webhook.js: de två ovan lyssnar
    // bara på events_from:["@accounts"], aldrig Bokix eget konto — en NY
    // destination ("@self") med denna egna signeringshemlighet krävdes.
    process.env.STRIPE_WEBHOOK_SECRET_SELF,
  ].filter(Boolean)
  if (secrets.length === 0 || !stripe) {
    res.status(500).json({ error: 'Stripe webhook secret is not configured' })
    return
  }

  let event
  let lastError
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret)
      break
    } catch (error) {
      lastError = error
    }
  }
  if (!event) {
    console.error('Stripe webhook verification failed:', lastError?.message || lastError)
    res.status(400).json({ error: 'Webhook signature verification failed' })
    return
  }

  console.log('Stripe webhook event:', event.type)

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      // Se motsvarande kommentar i api/stripe/webhook.js: 'unpaid' är
      // möjligt här för asynkrona betalmetoder, bokför bara bekräftat
      // mottagna pengar.
      if (session.payment_status === 'paid') {
        const { user_id: userId, company_id: companyId, invoice_id: invoiceId } = session.metadata || {}
        if (userId && companyId && invoiceId) {
          await recordStripePaymentEvent({
            stripeEventId: event.id,
            userId,
            companyId,
            invoiceId,
            amountTotal: session.amount_total != null ? session.amount_total / 100 : null,
            currency: session.currency,
            paidAt: new Date(event.created * 1000).toISOString(),
          })
        } else {
          console.warn('checkout.session.completed utan user_id/company_id/invoice_id i metadata, hoppar över:', session.id)
        }
      }
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      // Se motsvarande kommentar i api/stripe/webhook.js: Bokix egen
      // prenumeration (registreringsflödet), helt separat från
      // checkout.session.completed ovan.
      const sub = event.data.object
      await upsertSubscription({
        userId: sub.metadata?.user_id,
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        stripeSubscriptionId: sub.id,
        status: sub.status,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      })
    }
  } catch (error) {
    console.error('Stripe webhook processing error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
    return
  }

  res.status(200).json({ received: true, type: event.type })
})

// 15mb (inte standard-100kb) eftersom fakturamejl bifogar en PDF som
// base64-sträng i JSON-kroppen — annars avvisas anrop med en bifogad
// faktura-PDF över ~70kb (base64 är ~33% större än originalfilen).
app.use(express.json({ limit: '15mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Säkerhetsstädning: /api/companies/:companyId/data (GET/PUT) togs bort
// härifrån — obehövd, unauthenticated död kod. Skrev/läste bara en lokal
// JSON-fil (data/app-data.json) som ingen frontend-kod någonsin anropade;
// riktig företagsdata går via supabase.from('user_data') direkt från
// klienten (Row Level Security i Supabase, inte via server.js), och den
// motsvarande produktionsroutet finns inte alls i api/ (Vercels serverless-
// funktioner) — bara lokal dev-kod utan motsvarighet i drift.

function handleError(res, error, status = 500) {
  console.error('Stripe API error:', error)
  const message = error?.message || 'Stripe API request failed'
  res.status(status).json({ error: message })
}

function requireStripe(res) {
  if (!stripe) {
    res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY or VITE_STRIPE_SECRET_KEY before trying again.' })
    return false
  }
  return true
}

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  if (!requireStripe(res)) return

  // Vercel BotID — se filkommentaren i main.jsx. isRequestFromBot() är
  // fail-open (aldrig true om kollen själv strular) och returnerar alltid
  // false lokalt (NODE_ENV !== "production"), se api/_botid.js.
  if (await isRequestFromBot()) {
    res.status(403).json({ error: 'Åtkomst nekad.' })
    return
  }

  try {
    const body = req.body || {}
    const { user_id: userId, company_id: companyId, invoice_id: invoiceId, customer_email: customerEmail, customer_type: customerType } = body
    if (!userId || !companyId || !invoiceId) {
      res.status(400).json({ error: 'user_id, company_id och invoice_id krävs.' })
      return
    }

    // Säkerhetsfix (se motsvarande kommentar i api/stripe/create-checkout-
    // session.js, samma logik speglad här för lokal utveckling):
    // line_items/application_fee_amount/stripe_account_id togs tidigare emot
    // rakt från requesten och skickades vidare oförändrade — vem som helst
    // kunde posta ett eget (manipulerat) belopp direkt mot endpointen. Slås
    // nu upp och räknas om från den lagrade fakturan istället.
    const resolved = await resolveInvoiceLineItems({ userId, companyId, invoiceId, platformFeePercent: Number.parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT || '5') })
    if (resolved.error) {
      res.status(resolved.status || 400).json({ error: resolved.error })
      return
    }
    const { lineItems, currency, applicationFeeAmount, stripeAccountId } = resolved

    // Bank transfer kräver en riktig Stripe-kund på sessionen, inte bara
    // customer_email, och stödjer bara EUR/GBP/JPY/MXN/USD — aldrig SEK
    // eller NOK.
    const BANK_TRANSFER_CURRENCIES = new Set(['eur', 'gbp', 'usd'])
    let stripeCustomerId
    if (BANK_TRANSFER_CURRENCIES.has(currency) && customerEmail) {
      const stripeCustomer = await stripe.customers.create({ email: customerEmail })
      stripeCustomerId = stripeCustomer.id
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...(stripeCustomerId ? { customer: stripeCustomerId } : (customerEmail ? { customer_email: customerEmail } : {})),
      // payment_method_types utelämnas alltid så Checkout visar allt
      // Dashboard-påslaget som är relevant (kort, Pay by Bank, Klarna,
      // Swish, ...). Enda undantaget: Klarna exkluderas explicit för
      // företagskunder (stödjer inte B2B) — övriga metoder som Pay by Bank
      // har ingen sådan spärr.
      ...(customerType === 'se_individual' ? {} : { excluded_payment_method_types: ['klarna'] }),
      line_items: lineItems,
      // Kopplingen webhooken behöver för att veta vilken faktura som betalats.
      metadata: {
        user_id: userId,
        company_id: companyId,
        invoice_id: invoiceId,
      },
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: stripeAccountId,
        },
      },
      success_url: normalizeAbsoluteUrl(process.env.STRIPE_SUCCESS_URL, 'http://localhost:5173'),
      cancel_url: normalizeAbsoluteUrl(process.env.STRIPE_CANCEL_URL, 'http://localhost:5173'),
    })

    res.status(200).json({ session })
  } catch (error) {
    handleError(res, error)
  }
})

// Bokix egen plan — "Ett pris. Allt ingår." — helt separat från
// create-checkout-session ovan (kunders fakturabetalningar via ett anslutet
// konto). Se motsvarande kommentar i api/stripe/create-subscription-
// checkout.js (samma logik speglad här för lokal utveckling).
const SUBSCRIPTION_PRICE_SEK_ORE = 9900 // 99,00 kr/mån
const SUBSCRIPTION_TRIAL_DAYS = 30

app.post('/api/stripe/create-subscription-checkout', async (req, res) => {
  if (!requireStripe(res)) return

  // Vercel BotID — se filkommentaren i main.jsx.
  if (await isRequestFromBot()) {
    res.status(403).json({ error: 'Åtkomst nekad.' })
    return
  }

  try {
    const body = req.body || {}
    if (!body.user_id) {
      return res.status(400).json({ error: 'user_id krävs.' })
    }

    // Säkerhetsfix (se motsvarande kommentar i api/stripe/create-
    // subscription-checkout.js, samma logik speglad här för lokal
    // utveckling): den här rutten litade tidigare blint på body.user_id,
    // helt utan den skyddskoll produktionsversionen redan hade fått.
    if (await hasExistingSubscription(body.user_id)) {
      const user = await requireAuthedUser(req, res)
      if (!user) return // requireAuthedUser har redan svarat 401
      if (user.id !== body.user_id) {
        return res.status(403).json({ error: 'user_id matchar inte den inloggade användaren.' })
      }
    }

    const baseUrl = normalizeAbsoluteUrl(process.env.STRIPE_SUCCESS_URL, 'http://localhost:5173')
    const cancelBaseUrl = normalizeAbsoluteUrl(process.env.STRIPE_CANCEL_URL, 'http://localhost:5173')

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: body.customer_email || undefined,
      // Se motsvarande kommentar i api/stripe/create-subscription-checkout.js
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
        trial_period_days: SUBSCRIPTION_TRIAL_DAYS,
        metadata: { user_id: body.user_id },
      },
      metadata: { user_id: body.user_id },
      success_url: appendQueryParam(baseUrl, 'subscription_checkout', 'success'),
      cancel_url: appendQueryParam(cancelBaseUrl, 'subscription_checkout', 'cancelled'),
    })

    res.status(200).json({ session })
  } catch (error) {
    handleError(res, error)
  }
})

// ── E-post (Resend) ──────────────────────────────────────────────────────
// Skickar riktiga mejl till kunder — till skillnad från mailto:-länkarna på
// klienten (som bara öppnar avsändarens eget mailprogram), går de här
// faktiskt ut från servern via Resend. `attachmentBase64` är valfri: en
// PDF-bilaga (t.ex. själva fakturan) kodad som base64 utan "data:"-prefix.
// `company` (valfri: { name, emailDomain, resendDomainId }) avgör
// avsändaradressen — se resolveSenderAddress ovan.
//
// Namnet är historiskt — rutten bryr sig aldrig om VILKET dokument som
// skickas, bara to/subject/html/bilaga, så både Invoices.jsx och
// Quotes.jsx (fakturor OCH offerter) använder den här samma rutten.
// En egen "send-quote"-rutt vore identisk kod och en onödig extra
// Vercel-function (se commit om 12-funktionsgränsen).
app.post('/api/email/send-invoice', async (req, res) => {
  if (!requireResend(res)) return

  // Vercel BotID — se filkommentaren i main.jsx.
  if (await isRequestFromBot()) {
    res.status(403).json({ error: 'Åtkomst nekad.' })
    return
  }

  // Säkerhetsfix (se motsvarande kommentar i api/email/send-invoice.js,
  // samma logik speglad här för lokal utveckling): kräver nu en verifierad
  // inloggad session och bevisar ägarskap av företaget innan något skickas
  // — annars ett öppet mejl-relä som vem som helst kunde missbruka.
  const user = await requireAuthedUser(req, res)
  if (!user) return

  try {
    const body = req.body || {}
    const { to, subject, html, replyTo, attachmentBase64, attachmentFilename, company_id: companyId } = body

    if (!to || !subject || !html || !companyId) {
      res.status(400).json({ error: 'to, subject, html och company_id krävs.' })
      return
    }

    const companyData = await loadOwnedCompany(user.id, companyId, res)
    if (!companyData) return

    const { from } = await resolveSenderAddress(companyData.company)

    const basePayload = {
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(attachmentBase64 ? { attachments: [{ filename: attachmentFilename || 'faktura.pdf', content: attachmentBase64 }] } : {}),
    }

    let result = await sendViaResend({ ...basePayload, from })

    // Bugkritiskt (Sida 33): om utskicket med kundens egen domän misslyckas
    // — inte bara om den var overifierad, utan om själva sändningen faller,
    // t.ex. en domän som blivit overifierad efter statuskontrollen ovan
    // hann köra — försöker vi automatiskt igen med systemadressen istället
    // för att låta hela utskicket falla.
    if (!result.ok && from !== fallbackSenderAddress(companyData.company?.name)) {
      console.warn('Send with custom domain failed, retrying with fallback sender:', result.data)
      result = await sendViaResend({ ...basePayload, from: fallbackSenderAddress(companyData.company?.name) })
    }

    if (!result.ok) {
      console.error('Resend API error:', result.data)
      res.status(result.status).json({ error: result.data?.message || 'Resend kunde inte skicka e-posten.' })
      return
    }

    res.status(200).json({ id: result.data.id })
  } catch (error) {
    console.error('Email send error:', error)
    res.status(500).json({ error: error?.message || 'Kunde inte skicka e-post.' })
  }
})

// Speglar GET/POST /api/company-access i api/company-access.js — lokal
// utveckling, samma resonemang som send-invoice ovan (Vercel kör aldrig
// server.js i produktion). Enda rutten en INBJUDEN användare (company_members)
// någonsin pratar med — se filkommentaren i api/company-access.js för hela
// säkerhetsresonemanget, exakt speglat här.
const COMPANY_ACCESS_WRITABLE_FIELDS = new Set(COMPANY_WRITABLE_FIELDS)

app.get('/api/company-access', async (req, res) => {
  // Ingen BotID-koll här (till skillnad från POST nedan) — samma konvention
  // som api/email/domains/status.js: bara skrivande POST-endpoints
  // registreras i main.jsx:s initBotId-lista, en GET-koll här hade bara
  // trigga Vercels "Possible misconfiguration"-larm i onödan (verifierat
  // lokalt).
  const user = await requireAuthedUser(req, res)
  if (!user) return

  try {
    const companyId = req.query?.company_id
    if (!companyId) {
      res.status(400).json({ error: 'company_id krävs.' })
      return
    }
    const member = await loadMemberCompany(user.id, companyId, res)
    if (!member) return
    res.status(200).json({ company: member.companyData, role: member.role })
  } catch (error) {
    console.error('company-access error:', error)
    res.status(500).json({ error: error?.message || 'Kunde inte hämta företagsdata.' })
  }
})

app.post('/api/company-access', async (req, res) => {
  if (await isRequestFromBot()) {
    res.status(403).json({ error: 'Åtkomst nekad.' })
    return
  }
  const user = await requireAuthedUser(req, res)
  if (!user) return

  try {
    const body = req.body || {}
    const { company_id: companyId, field, value } = body
    if (!companyId || !field || value === undefined) {
      res.status(400).json({ error: 'company_id, field och value krävs.' })
      return
    }
    if (!COMPANY_ACCESS_WRITABLE_FIELDS.has(field)) {
      res.status(400).json({ error: `Ogiltigt fält: ${field}` })
      return
    }

    const member = await loadMemberCompany(user.id, companyId, res)
    if (!member) return
    if (member.role !== 'editor') {
      res.status(403).json({ error: 'Din roll (läsare) tillåter inte att spara ändringar.' })
      return
    }

    // Ingen ny env-var-koll här: loadMemberCompany ovan har redan skapat en
    // admin-klient med samma VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY och
    // skulle ha svarat 503 och returnerat null (koden hade aldrig nått hit)
    // om någon av dem saknades — en andra koll här var därför dödkod.
    const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { error: rpcError } = await admin.rpc('set_company_field', {
      p_user_id: member.ownerUserId,
      p_company_id: companyId,
      p_field: field,
      p_value: value,
    })
    if (rpcError) {
      res.status(500).json({ error: rpcError.message })
      return
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('company-access error:', error)
    res.status(500).json({ error: error?.message || 'Kunde inte spara företagsdata.' })
  }
})

// Striktare gräns än övriga e-postrutter (sensitiveLimiter ovan tillåter
// 30) — ett anonymt, oautentiserat formulär är det mest utsatta målet
// för spam av alla rutterna här.
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false })
app.post('/api/contact', contactLimiter, async (req, res) => {
  if (!requireResend(res)) return

  if (await isRequestFromBot()) {
    res.status(403).json({ error: 'Åtkomst nekad.' })
    return
  }

  try {
    const body = req.body || {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const topic = ALLOWED_CONTACT_TOPICS.includes(body.topic) ? body.topic : 'Övrigt'
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!name || !email || !message) {
      res.status(400).json({ error: 'Namn, e-post och meddelande krävs.' })
      return
    }
    if (!CONTACT_EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Ogiltig e-postadress.' })
      return
    }

    const result = await sendViaResend({
      from: emailFrom,
      to: [CONTACT_INBOX],
      subject: `Kontaktformulär (${topic}) — ${name}`,
      html: buildContactEmailHtml({ name, email, topic, message }),
      reply_to: email,
    })

    if (!result.ok) {
      console.error('Resend API error (contact):', result.data)
      res.status(result.status).json({ error: result.data?.message || 'Resend kunde inte skicka e-posten.' })
      return
    }

    res.status(200).json({ id: result.data.id })
  } catch (error) {
    console.error('Contact form send error:', error)
    res.status(500).json({ error: error?.message || 'Kunde inte skicka e-post.' })
  }
})

// ── E-postdomän per kund (Sida 33, Steg 2) ───────────────────────────────
// Skapar en domän hos Resend och returnerar DNS-posterna (SPF/DKIM) som
// kunden ska lägga till hos sin egen domänleverantör. Kräver den privilegierade
// RESEND_ADMIN_API_KEY (full_access) — sending_access-nycklar kan inte
// hantera domäner alls.
app.post('/api/email/domains/create', async (req, res) => {
  if (!requireResendAdmin(res)) return

  // Vercel BotID — se filkommentaren i main.jsx.
  if (await isRequestFromBot()) {
    res.status(403).json({ error: 'Åtkomst nekad.' })
    return
  }

  // Säkerhetsfix (se motsvarande kommentar i api/email/domains/create.js).
  const user = await requireAuthedUser(req, res)
  if (!user) return

  try {
    const { domain } = req.body || {}
    if (!domain || typeof domain !== 'string') {
      res.status(400).json({ error: 'domain krävs.' })
      return
    }

    const resendRes = await fetch('https://api.resend.com/domains', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendAdminApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    })
    const data = await resendRes.json().catch(() => ({}))

    if (!resendRes.ok) {
      console.error('Resend domain create error:', data)
      res.status(resendRes.status).json({ error: data?.message || 'Kunde inte skapa domänen hos Resend.' })
      return
    }

    res.status(200).json({ id: data.id, status: data.status, records: data.records || [] })
  } catch (error) {
    console.error('Domain create error:', error)
    res.status(500).json({ error: error?.message || 'Kunde inte skapa domänen.' })
  }
})

// Pollas från Inställningar-sidan (Ej verifierad → Verifierad) OCH är samma
// live-kontroll resolveSenderAddress gör vid varje utskick — aldrig en
// cachad flagga, se kommentaren vid resolveSenderAddress ovan.
app.get('/api/email/domains/status', async (req, res) => {
  if (!requireResendAdmin(res)) return

  // Säkerhetsfix (se motsvarande kommentar i api/email/domains/status.js).
  const user = await requireAuthedUser(req, res)
  if (!user) return

  try {
    const { id, company_id: companyId } = req.query || {}
    if (!id || !companyId) {
      res.status(400).json({ error: 'id och company_id krävs.' })
      return
    }
    const companyData = await loadOwnedCompany(user.id, companyId, res)
    if (!companyData) return
    if (companyData.company?.resendDomainId !== id) {
      res.status(403).json({ error: 'Domänen tillhör inte det här företaget.' })
      return
    }

    const resendRes = await fetch(`https://api.resend.com/domains/${id}`, {
      headers: { Authorization: `Bearer ${resendAdminApiKey}` },
    })
    const data = await resendRes.json().catch(() => ({}))

    if (!resendRes.ok) {
      console.error('Resend domain status error:', data)
      res.status(resendRes.status).json({ error: data?.message || 'Kunde inte hämta domänstatus.' })
      return
    }

    res.status(200).json({ status: data.status, records: data.records || [] })
  } catch (error) {
    console.error('Domain status error:', error)
    res.status(500).json({ error: error?.message || 'Kunde inte hämta domänstatus.' })
  }
})

// ── Klassiskt Stripe Connect OAuth ("Standard"-konton) ──────────────────
// Speglar api/stripe/oauth-start.js / callback.js / disconnect.js för
// lokal utveckling via denna Express-server istället för Vercels
// filbaserade serverless-routing. Samma delade helpers (oauthState.js,
// cookies.js) används på båda ställena så CSRF-logiken aldrig kan divergera.
const appUrl = process.env.STRIPE_ONBOARDING_RETURN_URL || 'http://localhost:5173'

async function persistStripeAccountId({ userId, companyId, stripeAccountId }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY saknas — kan inte spara kontokopplingen server-side.')
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const { error } = await supabaseAdmin.rpc('set_company_stripe_account', {
    p_user_id: userId,
    p_company_id: companyId,
    p_stripe_account_id: stripeAccountId,
  })
  if (error) throw error
}

// Säkerhetsfix (se motsvarande kommentar i api/stripe/oauth-start.js, samma
// logik speglad här för lokal utveckling): var en ren GET med user_id/
// company_id i query-strängen — vem som helst kunde avfyra den för
// VILKEN användare/företag som helst och koppla sitt eget Stripe-konto
// till någon annans Bokix-företag. Autentiserad POST nu istället,
// returnerar adressen som JSON — frontend navigerar dit själv.
app.post('/api/stripe/oauth-start', async (req, res) => {
  if (await isRequestFromBot()) {
    res.status(403).json({ error: 'Åtkomst nekad.' })
    return
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId || !process.env.STRIPE_OAUTH_STATE_SECRET) {
    console.error('Stripe OAuth start: STRIPE_CONNECT_CLIENT_ID eller STRIPE_OAUTH_STATE_SECRET saknas.')
    res.status(503).json({ error: 'Stripe Connect är inte konfigurerat.' })
    return
  }

  const user = await requireAuthedUser(req, res)
  if (!user) return

  const { company_id: companyId } = req.body || {}
  if (!companyId) {
    res.status(400).json({ error: 'company_id krävs.' })
    return
  }
  const companyData = await loadOwnedCompany(user.id, companyId, res)
  if (!companyData) return

  let state
  try {
    state = createSignedState({ user_id: user.id, company_id: companyId })
  } catch (err) {
    console.error('Stripe OAuth start error:', err)
    res.status(500).json({ error: 'Kunde inte starta Stripe-anslutningen.' })
    return
  }

  const redirectUri = process.env.STRIPE_OAUTH_REDIRECT_URI || `http://localhost:${process.env.PORT || 5000}/api/stripe/callback`
  const authorizeUrl = new URL('https://connect.stripe.com/oauth/authorize')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('scope', 'read_write')
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)

  res.setHeader('Set-Cookie', stripeOauthStateCookie(state))
  res.status(200).json({ url: authorizeUrl.toString() })
})

app.get('/api/stripe/callback', async (req, res) => {
  const { code, state, error: stripeError } = req.query || {}
  res.setHeader('Set-Cookie', clearStripeOauthStateCookie())

  const redirectWithStatus = (status) => res.redirect(302, `${appUrl}/?stripe_connect=${status}`)

  if (stripeError) return redirectWithStatus('cancelled')

  const cookies = parseCookies(req.headers.cookie)
  const cookieState = cookies[STRIPE_OAUTH_COOKIE]
  if (!state || !cookieState || state !== cookieState) {
    console.error('Stripe OAuth callback: state matchar inte cookien (möjligt CSRF-försök).')
    return redirectWithStatus('error')
  }

  const payload = verifySignedState(state)
  if (!payload?.user_id || !payload?.company_id) {
    console.error('Stripe OAuth callback: ogiltig eller för gammal state-signatur.')
    return redirectWithStatus('error')
  }

  if (!code) return redirectWithStatus('cancelled')
  if (!requireStripe(res)) return

  try {
    const tokenResponse = await stripe.oauth.token({ grant_type: 'authorization_code', code })
    const connectedAccountId = tokenResponse.stripe_user_id
    if (!connectedAccountId) throw new Error('Stripe svarade utan stripe_user_id.')

    await persistStripeAccountId({ userId: payload.user_id, companyId: payload.company_id, stripeAccountId: connectedAccountId })
    redirectWithStatus('connected')
  } catch (err) {
    console.error('Stripe OAuth callback error:', err)
    redirectWithStatus('error')
  }
})

app.post('/api/stripe/disconnect', async (req, res) => {
  if (!requireStripe(res)) return

  // Vercel BotID — se filkommentaren i main.jsx.
  if (await isRequestFromBot()) {
    res.status(403).json({ error: 'Åtkomst nekad.' })
    return
  }

  // Säkerhetsfix (se motsvarande kommentar i api/stripe/disconnect.js,
  // samma logik speglad här för lokal utveckling): kräver nu en verifierad
  // session och bevisar ägarskap av företaget, istället för att lita på
  // user_id/company_id/stripe_account_id rakt från requesten.
  const user = await requireAuthedUser(req, res)
  if (!user) return

  try {
    const { company_id: companyId } = req.body || {}
    if (!companyId) {
      return res.status(400).json({ error: 'company_id krävs.' })
    }

    const companyData = await loadOwnedCompany(user.id, companyId, res)
    if (!companyData) return
    const stripeAccountId = companyData.company?.stripeAccountId
    if (!stripeAccountId) {
      return res.status(400).json({ error: 'Inget Stripe-konto är anslutet för det här företaget.' })
    }

    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
    if (clientId) {
      try {
        await stripe.oauth.deauthorize({ client_id: clientId, stripe_user_id: stripeAccountId })
      } catch (err) {
        console.warn('Stripe deauthorize warning:', err.message)
      }
    }

    await persistStripeAccountId({ userId: user.id, companyId, stripeAccountId: null })
    res.status(200).json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

const port = Number(process.env.PORT || 5000)
app.listen(port, () => {
  console.log(`Local Stripe API server listening on http://localhost:${port}`)
})
