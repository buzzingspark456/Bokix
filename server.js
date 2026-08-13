import express from 'express'
import Stripe from 'stripe'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

const port = Number(process.env.PORT || 5000)
app.listen(port, () => {
  console.log(`Local Stripe API server listening on http://localhost:${port}`)
})
