import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initBotId } from 'botid/client/core'
import './index.css'
import App from './App.jsx'

// Vercel BotID (säkerhetsgranskningen, punkt "Add bot protection") — skyddar
// våra EGNA känsliga api/*-routes (betalning, mejlutskick, Stripe-frånkoppling,
// domänregistrering). Kan INTE skydda Supabase-inloggning/registrering
// (supabase.auth.signUp/signInWithPassword går direkt mot Supabases servrar,
// aldrig via en av våra Vercel-functions) — det täcks istället av Turnstile
// i Auth.jsx, som Supabase har inbyggt stöd för. Måste initieras här (innan
// första renderingen) och listan nedan måste hålla sig i synk med varje
// checkBotId()-anrop server-side, annars misslyckas den tyst (se BotID-docs).
initBotId({
  protect: [
    { path: '/api/stripe/create-checkout-session', method: 'POST' },
    { path: '/api/stripe/create-subscription-checkout', method: 'POST' },
    { path: '/api/stripe/disconnect', method: 'POST' },
    { path: '/api/email/send-invoice', method: 'POST' },
    { path: '/api/email/domains/create', method: 'POST' },
  ],
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
