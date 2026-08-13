import express from 'express'
import Stripe from 'stripe'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { createSignedState, verifySignedState } from './api/stripe/oauthState.js'
import { parseCookies, STRIPE_OAUTH_COOKIE, stripeOauthStateCookie, clearStripeOauthStateCookie } from './api/stripe/cookies.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, 'data')
const dataFilePath = path.join(dataDir, 'app-data.json')

function ensureStoreFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify({ companies: {} }, null, 2))
  }
}

function loadStore() {
  ensureStoreFile()
  try {
    return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'))
  } catch {
    return { companies: {} }
  }
}

function saveStore(store) {
  ensureStoreFile()
  fs.writeFileSync(dataFilePath, JSON.stringify(store, null, 2))
}

const store = loadStore()

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.VITE_STRIPE_SECRET_KEY || null

let stripe = null

if (!stripeSecretKey) {
  console.warn('Stripe secret key not configured yet. Stripe routes will return a 503 until STRIPE_SECRET_KEY or VITE_STRIPE_SECRET_KEY is provided.')
} else if (stripeSecretKey.startsWith('pk_')) {
  console.error('Invalid Stripe key: STRIPE_SECRET_KEY must be a secret key beginning with sk_, not pk_.')
} else {
  stripe = new Stripe(stripeSecretKey, {
    // apiVersion removed to use Stripe account default
  })
  console.log('Loaded Stripe secret key for local server.')
}

const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/companies/:companyId/data', (req, res) => {
  const companyData = store.companies?.[req.params.companyId]
  if (!companyData) {
    return res.status(404).json({ error: 'Company data not found' })
  }

  res.json(companyData)
})

app.put('/api/companies/:companyId/data', (req, res) => {
  const companyId = req.params.companyId
  const payload = req.body

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Expected a company data object' })
  }

  if (!store.companies) {
    store.companies = {}
  }

  store.companies[companyId] = payload
  saveStore(store)
  res.json({ ok: true, companyId })
})

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

app.post('/api/stripe/create-account', async (req, res) => {
  if (!requireStripe(res)) return

  try {
    const body = req.body || {}
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'SE',
      business_type: 'company',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'manual',
          },
        },
      },
      business_profile: {
        name: body.business_name || 'Bokix customer',
        product_description: 'Faktura- och betalningshantering via Bokix',
      },
      metadata: {
        company_id: body.company_id,
        user_id: body.user_id,
      },
    })

    res.status(200).json({ account })
  } catch (error) {
    handleError(res, error)
  }
})

app.post('/api/stripe/create-account-link', async (req, res) => {
  if (!requireStripe(res)) return

  try {
    const body = req.body || {}
    const accountLink = await stripe.accountLinks.create({
      account: body.account_id,
      refresh_url: process.env.STRIPE_ONBOARDING_REFRESH_URL || 'http://localhost:5173',
      return_url: process.env.STRIPE_ONBOARDING_RETURN_URL || 'http://localhost:5173',
      type: 'account_onboarding',
    })

    res.status(200).json({ accountLink })
  } catch (error) {
    handleError(res, error)
  }
})

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  if (!requireStripe(res)) return

  try {
    const body = req.body || {}
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: body.line_items || [],
      customer_email: body.customer_email,
      payment_intent_data: {
        application_fee_amount: body.application_fee_amount || 0,
        transfer_data: {
          destination: body.stripe_account_id,
        },
      },
      success_url: process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173',
      cancel_url: process.env.STRIPE_CANCEL_URL || 'http://localhost:5173',
    })

    res.status(200).json({ session })
  } catch (error) {
    handleError(res, error)
  }
})

app.post('/api/stripe/retrieve-account', async (req, res) => {
  if (!requireStripe(res)) return

  try {
    const body = req.body || {}
    const account = await stripe.accounts.retrieve(body.account_id)
    res.status(200).json({ account })
  } catch (error) {
    handleError(res, error)
  }
})

app.post('/api/stripe/webhook', express.json(), async (req, res) => {
  console.log('Received Stripe webhook event')
  res.status(200).json({ received: true })
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

// Startas via helsides-navigering (window.location.href), inte fetch — ett
// JSON-felsvar skulle bara visas som rå text. Felvägar redirectar därför
// tillbaka till appen med samma ?stripe_connect=-flagga som callbacken
// använder, så felet alltid visas som samma odramatiska meddelande.
app.get('/api/stripe/oauth-start', (req, res) => {
  const redirectToApp = (status) => res.redirect(302, `${appUrl}/?stripe_connect=${status}`)

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId || !process.env.STRIPE_OAUTH_STATE_SECRET) {
    console.error('Stripe OAuth start: STRIPE_CONNECT_CLIENT_ID eller STRIPE_OAUTH_STATE_SECRET saknas.')
    return redirectToApp('not_configured')
  }

  const { user_id: userId, company_id: companyId } = req.query || {}
  if (!userId || !companyId) {
    return redirectToApp('error')
  }

  let state
  try {
    state = createSignedState({ user_id: userId, company_id: companyId })
  } catch (err) {
    console.error('Stripe OAuth start error:', err)
    return redirectToApp('error')
  }

  const redirectUri = process.env.STRIPE_OAUTH_REDIRECT_URI || `http://localhost:${process.env.PORT || 5000}/api/stripe/callback`
  const authorizeUrl = new URL('https://connect.stripe.com/oauth/authorize')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('scope', 'read_write')
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)

  res.setHeader('Set-Cookie', stripeOauthStateCookie(state))
  res.redirect(302, authorizeUrl.toString())
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

  try {
    const { user_id: userId, company_id: companyId, stripe_account_id: stripeAccountId } = req.body || {}
    if (!userId || !companyId || !stripeAccountId) {
      return res.status(400).json({ error: 'user_id, company_id och stripe_account_id krävs.' })
    }

    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
    if (clientId) {
      try {
        await stripe.oauth.deauthorize({ client_id: clientId, stripe_user_id: stripeAccountId })
      } catch (err) {
        console.warn('Stripe deauthorize warning:', err.message)
      }
    }

    await persistStripeAccountId({ userId, companyId, stripeAccountId: null })
    res.status(200).json({ ok: true })
  } catch (error) {
    handleError(res, error)
  }
})

const port = Number(process.env.PORT || 5000)
app.listen(port, () => {
  console.log(`Local Stripe API server listening on http://localhost:${port}`)
})
