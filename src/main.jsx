import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initBotId } from 'botid/client/core'
import './index.css'
// AppRouter (inte App.jsx direkt längre) — Prestandafix: App.jsx (hela den
// inloggade bokföringsappen) laddas numera lazy, bara när den faktiskt
// behövs. Se kommentaren vid App-komponentens topp i App.jsx för fulla
// resonemanget, och AppRouter.jsx för hur/när den avgör det.
import AppRouter from './AppRouter.jsx'

// Scrollbar-inställningen (Inställningar → Data och Inställningar, App.jsx
// äger den när den ÄR monterad) satt på <html> HÄR också, en gång vid
// uppstart — precis samma resonemang som temat redan har sin egen kopia i
// MarketingLayout.jsx (useMarketingTheme): sedan Prestanda-fixet (App.jsx
// numera lazy, se AppRouter.jsx) mountas App.jsx INTE längre för de rena
// marknadssidorna (/priser, /funktioner m.fl.) — utan den här raden skulle
// en inloggad användares "Dölj scrollbar"-val bara synas EFTER inloggning,
// inte på de publika sidorna hen råkar bläddra till. Körs synkront, före
// första målning, så ingen flimrar-till-synlig-sen-döljs-flimmer uppstår.
try {
  const hideScrollbar = localStorage.getItem('bokix_hide_scrollbar') === 'true';
  document.documentElement.setAttribute('data-hide-scrollbar', String(hideScrollbar));
} catch { /* privat läge/blockerad storage — App.jsx:s egen kopia (om/när den mountas) försöker igen och faller tillbaka på samma sätt där */ }

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
    { path: '/api/contact', method: 'POST' },
  ],
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
)
