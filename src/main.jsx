import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initBotId } from 'botid/client/core'
import { schedulePosthogInit } from './utils/posthog.js'
import { getStoredConsent } from './utils/consent.js'
import './index.css'
// AppRouter (inte App.jsx direkt längre) — Prestandafix: App.jsx (hela den
// inloggade bokföringsappen) laddas numera lazy, bara när den faktiskt
// behövs. Se kommentaren vid App-komponentens topp i App.jsx för fulla
// resonemanget, och AppRouter.jsx för hur/när den avgör det.
import AppRouter, { shouldLoadAppImmediately } from './AppRouter.jsx'
import ErrorBoundary from './components/shared/ErrorBoundary.jsx'
import { installGlobalErrorHandlers } from './utils/errorReporting.js'
import { reloadOnceForNewBuild } from './utils/staleBuild.js'

// Krascher och ohanterade fel rapporteras till /api/client-error (larm).
installGlobalErrorHandlers()

// Gammal flik efter en ny deploy: sidfilen finns inte längre. Ladda om en
// gång i stället för att visa "Något gick fel" (se utils/staleBuild.js).
// Klick på en rubrik (label) som inte är kopplad till sitt fält: lägg markören
// i fältet under den, så man hamnar i rutan i stället för bredvid den. Gäller
// hela appen. Kopplade labels (for/inuti) sköter webbläsaren själv.
document.addEventListener('click', (e) => {
  const label = e.target?.closest?.('label');
  if (!label || label.htmlFor || label.querySelector('input,textarea,select')) return;
  if (window.getSelection?.().toString()) return; // markerar text för att kopiera
  const box = label.parentElement;
  const field = box?.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not(:disabled), textarea:not(:disabled), select:not(:disabled)');
  if (field && typeof field.focus === 'function') field.focus();
});

window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewBuild()) event.preventDefault()
})

// Chromes inbyggda översättning (och vissa tillägg) byter ut textnoder under
// React. Nästa gång React flyttar eller tar bort en sådan nod kastar
// webbläsaren "insertBefore/removeChild: not a child of this node" och hela
// sidan blir vit (sågs live 2026-10-03). Den kända lösningen (facebook/react
// #11538): gör anropet till en no-op när noden redan flyttats av någon annan,
// i stället för att krascha.
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChild(child) {
    if (child.parentNode !== this) return child;
    return originalRemoveChild.call(this, child);
  };
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function insertBefore(newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return originalInsertBefore.call(this, newNode, null);
    }
    return originalInsertBefore.call(this, newNode, referenceNode);
  };
}

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

// PostHog — se utils/posthog.js för hela resonemanget (samtycke, fördröjd
// uppstart). getStoredConsent() läses här EN gång, vid sidladdning, för en
// redan återkommande besökare som svarat tidigare — CookieBanner.jsx tar
// över därifrån (updatePosthogConsent i utils/consent.js) för ett NYTT val.
schedulePosthogInit(getStoredConsent() === 'granted')

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

const tree = (
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);

// Startsidan är förrenderad (scripts/prerender.mjs). Med hydrateRoot tar
// React över den HTML som redan syns i stället för att rita om allt: med
// createRoot ersattes varje element, och Google räknade rubriken som synlig
// först när JavaScriptet kört (LCP ca 2,7 s i stället för under 1 s på en
// mellanklass-telefon). Bara "/" och bara när startsidan faktiskt ska visas
// (inte den inloggade appen): de andra sidorna laddas med lazy() och
// Suspense i AppRouter, vilket servern inte renderar likadant.
const rootEl = document.getElementById('root');
const canHydrate = window.location.pathname === '/'
  && rootEl.firstElementChild?.id === 'lp-root'
  && !shouldLoadAppImmediately();
if (canHydrate) {
  hydrateRoot(rootEl, tree, {
    // Skiljer sig något (t.ex. tema) ritar React om just den delen; det ska
    // synas i konsolen men aldrig stoppa sidan.
    onRecoverableError: (error) => console.warn('Hydrering:', error?.message || error),
  });
} else {
  createRoot(rootEl).render(tree);
}
