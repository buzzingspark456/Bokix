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
    // Tidigare bara /api/stripe/disconnect — oauth-start.js/disconnect.js
    // slogs ihop till connect.js (action: 'start'/'disconnect') för att
    // göra plats under Vercels 12-funktionsgräns, se filkommentaren där.
    // Skyddar nu BÅDA actionerna, inte bara disconnect (oauth-start hade
    // aldrig BotID-skydd — ett förbiseende, inte avsiktligt).
    { path: '/api/stripe/connect', method: 'POST' },
    // api/zettle/callback.js — bara POST (starta anslutningen) skyddas;
    // GET är Zettles egen redirect tillbaka, ingen användare "fyller i"
    // något där, samma konvention som email/domains och company-access.
    { path: '/api/zettle/callback', method: 'POST' },
    { path: '/api/email/send-invoice', method: 'POST' },
    // api/email/domains/index.js (tidigare två separata filer, create.js
    // + status.js — ihopslagna, se den filens egen kommentar för varför).
    // Bara POST (create): GET (status, läsning) skyddas medvetet INTE av
    // BotID, samma konvention som company-access.js nedan.
    { path: '/api/email/domains', method: 'POST' },
    { path: '/api/contact', method: 'POST' },
    // api/company-access.js POST MEDVETET INTE listad (var det tidigare,
    // se git-historik) — samma "glömt lösenord"-resonemang som
    // request-password-reset nedan, av samma faktiska anledning: filen
    // fick 2026-08-30 en andra, helt oautentiserad gren (action: 'lookup',
    // FöretagsAPI-uppslag i Kunder/Leverantörer OCH i registreringens
    // "Ditt företag"-steg — den senare körs INNAN kontot ens finns).
    // Verifierat lokalt (Playwright, samma metod som redan dokumenterat
    // nedan): klientens BotID-inpackning HÄNGER på obestämd tid när
    // utmaningsskriptet inte laddas (404 lokalt, av samma skäl som alltid
    // — Vercels riktiga BotID-infrastruktur finns bara i produktion), inte
    // bara i det redan kända "avvisas med ett tomt Event"-fallet — company-
    // lookup-fetchen löste sig aldrig, varken lyckat eller som fel, precis
    // det symtomet en kund rapporterade IRL på bokix.se (org.nummer-fältet
    // fastnade på "Hämtar företagsuppgifter…" för evigt). Ett fel skript-
    // laddningsförsök (nätverksglapp, annonsblockerare, integritets-
    // tillägg — exakt vad kommentaren nedan redan varnar för) räcker för
    // att permanent låsa fältet, även i produktion. Skyddet den här grenen
    // faktiskt behöver (den sparar ett riktigt fält åt en inbjuden
    // användare) kommer ändå från requireAuthedUser + loadMemberCompany +
    // role==='editor' i api/company-access.js — ett Supabase-uträknat
    // konto med bevisat, aktivt medlemskap i just det företaget, en mycket
    // starkare spärr än BotID för en redan autentiserad skrivning.
    // RÄTTELSE (2026-08-30): api/company-access.js:s egen isRequestFromBot()
    // ansågs tidigare "fail-open, harmless" oavsett — fel. Utan en
    // client-registrering här skickas x-is-human-headern aldrig alls, och
    // Vercels riktiga bot-tjänst kan då (utan att kasta något fel — inget
    // för _botid.js:s fail-open att fånga) landa i isBot:true för vanliga
    // användare. Det var den faktiska orsaken till "Åtkomst nekad" på
    // både lookup-grenen och fältsparningen i produktion — servern har
    // därför INGEN BotID-koll alls längre för den här filen, bara
    // rate-limit (lookup) respektive requireAuthedUser+loadMemberCompany+
    // role (fältsparning).
  ],
})
// "Glömt lösenord?" (api/auth/request-password-reset.js) MEDVETET INTE
// listad ovan, trots att den (till skillnad från signUp/signInWithPassword)
// faktiskt går via en av våra Vercel-functions: testat och verifierat att
// klientens BotID-inpackning FAILAR STÄNGD, inte öppen, om dess egna
// utmaningsskript av någon anledning inte hinner/kan laddas (verifierat
// lokalt — hela fetch()-anropet avvisas då med ett tomt Event istället för
// att bara hoppa över kollen). Servern (isRequestFromBot i handlern) är
// fail-open av precis den anledningen, men klientens egen inpackning här
// är det inte — och kontoåterställning är fel flöde att introducera en ny
// enskild felkälla i. Turnstile (Auth.jsx) + serverns egna 5/dygn-gräns
// (_rateLimit.js) täcker missbruksrisken utan den risken.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
)
