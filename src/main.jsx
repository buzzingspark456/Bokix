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

// Vercel BotID (säkerhetsgranskningen, punkt "Add bot protection") —
// AVVECKLAD HELT (2026-09-15), inte bara nedtonad. Bakgrund: BotID:s
// klient-inpackning av fetch() FAILAR STÄNGT (avvisar hela anropet med ett
// tomt Event, aldrig ett riktigt Error-objekt) så fort dess eget
// utmaningsskript av någon anledning inte hinner eller kan laddas —
// nätverksglapp, annonsblockerare, integritetstillägg, eller bara att
// Vercels riktiga BotID-infrastruktur inte finns lokalt. Verifierat i
// produktion, en gång per route, i den ordning kundrapporter kom in:
//   1. api/company-access.js (lookup-grenen + fältsparning åt inbjudna
//      användare) — "Hämtar företagsuppgifter…" fastnade för alltid.
//   2. api/email/domains/index.js ("Anslut domän") — "Kunde inte koppla
//      domänen", tomt felmeddelande.
//   3. api/zettle/callback.js (POST, starta anslutningen) — "Kunde inte
//      ansluta Zettle: [object Event]" (den tomma Event:en syns rakt av
//      i felmeddelandet här, det tydligaste avtrycket av buggen).
// Samma mönster, tre gånger — inte tre orelaterade fel. Efter den tredje
// gjordes en full genomgång av VARJE route som fortfarande stod kvar i
// listan, i stället för att vänta på fler enskilda kundrapporter:
// betalningar och mejlutskick är precis den sortens flöde där "tyst
// blockerad, ingen begriplig felkod" är som dyrast (en förlorad kund/
// betalning, inte bara en förvirrande skärm). Varje route hade redan en
// EGEN, robust spärr oberoende av BotID:
//   · /api/stripe/connect (start OCH disconnect) — requireAuthedUser +
//     loadOwnedCompany (bevisat ägarskap), plus en reauth-kod för
//     disconnect specifikt (se den filens kommentar).
//   · /api/stripe/create-checkout-session (kundens betalningslänk) —
//     kräver ett REDAN existerande, matchande invoice_id/company_id/
//     user_id (resolveInvoiceLineItems slår upp och validerar äkta
//     data, ingen godtycklig charge går att skapa) + rate limit.
//   · /api/stripe/create-subscription-checkout (ny prenumeration/
//     avsluta/återaktivera/billing-portal) — avsluta/återaktivera/portal
//     kräver requireAuthedUser; en helt ny signup skyddas redan av
//     Turnstile på själva registreringssteget precis innan (Auth.jsx)
//     samt Stripes egen bedrägerikontroll (Radar) vid själva
//     kortdragningen — BotID var ett tredje, sköraste lagret ovanpå två
//     redan riktiga.
//   · /api/email/send-invoice — requireAuthedUser + ägarskap
//     (loadOwnedCompany), exakt samma mönster som company-access.js.
//   · /api/contact (publikt formulär, ingen inloggning finns) — har
//     REDAN ett eget, robust motsvarande skydd: reCAPTCHA (verifyRecaptcha,
//     när RECAPTCHA_SECRET_KEY är satt) + en striktare rate-limit (5,
//     mot övriga rutters 10-30) just för att den är mest utsatt. BotID var
//     här rent redundant, inte den enda spärren.
// Kan fortfarande INTE skydda Supabase-inloggning/registrering
// (supabase.auth.signUp/signInWithPassword går direkt mot Supabases
// servrar) — det täcks av Turnstile i Auth.jsx, som Supabase har inbyggt
// stöd för, och rörs inte av det här.
initBotId({
  protect: [],
})
// "Glömt lösenord?" (api/auth/request-password-reset.js) hade av samma
// skäl som ovan ALDRIG BotID i listan, trots att den (till skillnad från
// signUp/signInWithPassword) faktiskt går via en av våra Vercel-functions:
// testat och verifierat tidigast av alla att klientens BotID-inpackning
// FAILAR STÄNGT, inte öppet, om dess egna
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
