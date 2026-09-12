import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import CookieBanner from './components/CookieBanner';

// ── Marknads-/juridiksidorna — flyttade hit rakt av från App.jsx (se
// kommentaren vid App-komponentens topp där för VARFÖR). Samma lazy()-
// anrop som innan, bara i en annan fil. ──
const FeaturesPage = lazy(() => import('./components/marketing/FeaturesPage'));
const PricingPage = lazy(() => import('./components/marketing/PricingPage'));
const AboutPage = lazy(() => import('./components/marketing/AboutPage'));
const ContactPage = lazy(() => import('./components/marketing/ContactPage'));
const BookingPage = lazy(() => import('./components/marketing/BookingPage'));
const GmailConnectCallback = lazy(() => import('./components/GmailConnectCallback'));
// LÄRDOM, från en bugg på en numera borttagen sida: en statisk sida måste
// stå på ALLA fyra ställen — route här, förrendering i entry-server.jsx,
// rewrite i vercel.json och rad i public/sitemap.xml. Saknas routen faller
// besökaren på catch-all nedan och kastas till startsidan, trots att den
// förrenderade HTML-filen finns.
// "Byt bokföringsprogram" — den praktiska HUR-sidan (SIE4-export ur det
// gamla programmet → import i Bokix). Måste stå på samma fyra ställen som
// varje annan statisk
// marknadssida: här, i PRERENDER_ROUTES/PAGES (entry-server.jsx), i
// vercel.json:s rewrites och i public/sitemap.xml.
const SwitchPage = lazy(() => import('./components/marketing/SwitchPage'));
// "Koppla banken" — systersidan till SwitchPage: samma sorts HUR-sida, fast
// för kontoutdraget i stället för bokföringshistoriken. Står på samma fyra
// ställen som varje annan statisk marknadssida: här, i PRERENDER_ROUTES/
// PAGES (entry-server.jsx), i vercel.json:s rewrites och i sitemap.xml.
const BankPage = lazy(() => import('./components/marketing/BankPage'));
// "Bokix för UF-företag" — eget erbjudande OCH en egen, mindre produkt
// (utils/ufMode.js). Samma fyra ställen som varje annan statisk
// marknadssida: här, i PRERENDER_ROUTES/PAGES (entry-server.jsx), i
// vercel.json:s rewrites och i public/sitemap.xml.
const UfPage = lazy(() => import('./components/marketing/UfPage'));
// Fria verktyg (/verktyg + räknarna), ordlistan, integrationssidan och
// säkerhetssidan — alla publika, alla lazy av samma skäl som ovan: en
// besökare som bara ska till startsidan ska inte hämta dem.
const ToolsHubPage = lazy(() => import('./components/marketing/tools/ToolsHubPage'));
const MomsKalkylatorPage = lazy(() => import('./components/marketing/tools/MomsKalkylatorPage'));
const LonekalkylatorPage = lazy(() => import('./components/marketing/tools/LonekalkylatorPage'));
const EgenavgifterPage = lazy(() => import('./components/marketing/tools/EgenavgifterPage'));
const RotRutKalkylatorPage = lazy(() => import('./components/marketing/tools/RotRutKalkylatorPage'));
const DrojsmalsrantaPage = lazy(() => import('./components/marketing/tools/DrojsmalsrantaPage'));
// Utdelning/3:12 — de nya reglerna som gäller från 1 januari 2026 (se
// UtdelningPage.jsx för varför sidan är så uttalad om vilket år den avser).
const UtdelningPage = lazy(() => import('./components/marketing/tools/UtdelningPage'));
// "Momsdatum" och "Deadline för årsredovisningen" — samma sorts fria
// verktyg som ovan, fast med logiken (nextVatDeadlinePublic/
// calcAnnualReportDeadline) återanvänd rakt av från den inloggade appens
// egen, redan verifierade deadline-matte (declarationDeadlines.js), se
// freeToolCalculations.js:s filkommentar för resonemanget.
const MomsDatumPage = lazy(() => import('./components/marketing/tools/MomsDatumPage'));
const ArsredovisningPage = lazy(() => import('./components/marketing/tools/ArsredovisningPage'));
const OrdlistaPage = lazy(() => import('./components/marketing/OrdlistaPage'));
// Bloggen — DYNAMISKT innehåll (skrivs/publiceras via /internal, se
// InternalApp.jsx), till skillnad från varenda annan marknadssida i den
// här filen. Förrenderas därför INTE (ingen post i entry-server.jsx:s
// PRERENDER_ROUTES/PAGES eller egen vercel.json-rewrite) — ett nytt
// inlägg måste synas direkt utan en ny deploy, vilket bara går med rena
// klient-routes. Faller igenom till app-shell.html:s catch-all-rewrite
// precis som den inloggade appens egna routes redan gör.
const BlogListPage = lazy(() => import('./components/marketing/blog/BlogListPage'));
const BlogPostPage = lazy(() => import('./components/marketing/blog/BlogPostPage'));
// Det dolda admin-läget — ingen länk till den någonstans i den publika
// navigeringen, se InternalApp.jsx för behörighetskollen (klient-sidan är
// bara UI, den riktiga spärren är api/admin/index.js:s ADMIN_EMAILS).
const InternalApp = lazy(() => import('./components/internal/InternalApp'));
const IntegrationsPage = lazy(() => import('./components/marketing/IntegrationsPage'));
const SecurityPage = lazy(() => import('./components/marketing/SecurityPage'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const TermsPolicy = lazy(() => import('./components/TermsPolicy'));
const CookiesPolicy = lazy(() => import('./components/CookiesPolicy'));
const PersonuppgiftsBitradesAvtal = lazy(() => import('./components/PersonuppgiftsBitradesAvtal'));
const InviteRedeem = lazy(() => import('./components/InviteRedeem'));

// Den INLOGGADE bokföringsappen — Stripe, Supabase, sidomeny, lönehantering,
// allt. Lazy-laddad: bara RootRoute nedan avgör OM/NÄR den ens hämtas.
const App = lazy(() => import('./App'));

// Identisk minimalkopia av App.jsx:s egen RouteLoadingFallback — kan inte
// importera den därifrån, den filen är precis det som fortfarande laddas
// i det ögonblicket den här ska visas.
function AppLoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-page, #f4f7f5)' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(11,99,41,0.25)', borderTopColor: '#0b6329', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

// Supabase (@supabase/supabase-js, se src/supabaseClient.js) sparar sessionen
// under nyckeln `sb-<projekt-ref>-auth-token`, där <projekt-ref> är
// subdomänen i VITE_SUPABASE_URL — exakt samma uträkning klienten själv gör
// internt (SupabaseClient-konstruktorn). Räknad här UTAN att importera
// @supabase/supabase-js alls, så den här filen (och därmed marknadssidans
// bunt) aldrig behöver dra in Supabase-klienten bara för att kolla om en
// session-nyckel råkar finnas i storage.
//
// sessionStorage, INTE localStorage (kundönskemål: förbli inloggad så
// länge fliken är öppen, men kräva ny inloggning nästa gång sajten öppnas
// efter att den stängts) — se supabaseClient.js:s egen kommentar om
// storage-valet där. Måste hållas i synk: klienten där och kollen här
// måste läsa ur SAMMA storage, annars slutar den här optimeringen fungera
// tyst (en redan inloggad användare skulle se ett onödigt landningssides-
// flimmer innan App.jsx själv hinner läsa sessionen på sitt eget sätt).
function getSupabaseSessionKey() {
  try {
    const url = new URL(import.meta.env.VITE_SUPABASE_URL);
    return `sb-${url.hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

// Avgör om App-bunten (den inloggade appen) ska laddas DIREKT vid första
// målning av "/", istället för att först visa LandingPage. Måste vara
// FÖRSIKTIGT konservativ — att av misstag visa bara LandingPage när det
// egentligen var en riktig inloggnings-/betal-länk skulle tysta trasa
// sönder e-postbekräftelse, lösenordsåterställning och Stripe-flöden:
//
//  1. Redan sparad Supabase-session i den här webbläsaren (återkommande
//     inloggad användare) — samma nyckel klienten själv skulle läsa.
//  2. En Supabase auth-callback i URL:ens hash (e-postbekräftelse,
//     inbjudan, lösenordsåterställning skickar alla `#access_token=...`
//     eller `#error=...` hit) — supabase-js läser och tolkar denna
//     automatiskt vid klient-initiering (detectSessionInUrl), vilket bara
//     händer om App.jsx (och därmed dess Supabase-klient) faktiskt laddas.
//  3. Frågeparametrar App.jsx:s egna useEffects redan explicit lyssnar på
//     (Stripe-anslutning, prenumerations-checkout-status).
//
// Allt annat (den vanliga förstagångsbesökaren på "/") får den lätta
// marknadsbunten, ingenting mer.
function shouldLoadAppImmediately() {
  if (typeof window === 'undefined') return false;
  try {
    const sessionKey = getSupabaseSessionKey();
    if (sessionKey && sessionStorage.getItem(sessionKey)) return true;
  } catch { /* privat läge/blockerad storage — inte ett skäl att anta inloggad */ }

  const hash = window.location.hash || '';
  if (/access_token=|refresh_token=|type=(recovery|signup|invite)|error=/.test(hash)) return true;

  const search = window.location.search || '';
  if (/[?&](stripe_connect|subscription_checkout)=/.test(search)) return true;

  return false;
}

// "/" — startsidan när utloggad, den riktiga appen när inloggad (eller på
// väg in). Samma `location.state.enterApp`-flagga som App.jsx redan läste
// (satt av MarketingHeader/PricingPage m.fl. via `navigate('/', {state:
// {enterApp:true}}}`) återanvänds rakt av — ingen ny mekanism, bara samma
// signal lyssnad på från ett steg längre ut.
function RootRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [wantsApp, setWantsApp] = useState(shouldLoadAppImmediately);

  useEffect(() => {
    if (location.state?.enterApp) setWantsApp(true);
  }, [location.state]);

  if (wantsApp) {
    return (
      <Suspense fallback={<AppLoadingFallback />}>
        <App />
      </Suspense>
    );
  }

  return (
    <LandingPage
      onEnterApp={(mode, plan, options) => {
        // Samma state-flagga som App.jsx:s egen useEffect förväntar sig
        // (och rensar) direkt efter mount, så Auth-skärmen visas direkt
        // istället för att App.jsx skulle rendera sin EGEN LandingPage-gren
        // en gång till ovanpå den här. authMode följer med samma väg så
        // "Kom igång"/"Skapa konto" landar på registrering, inte inloggning.
        // `plan` är abonnemanget besökaren klickade i prissektionen — utan
        // det skulle registreringen alltid anta den dyraste nivån oavsett
        // vilket kort som klickades.
        // `options.uf` sätts av /uf-sidans knappar (marketing/UfPage.jsx) —
        // registreringen ska då starta i UF-läge: inget organisationsnummer,
        // inget betalsteg. Går samma väg som `plan` (location.state), inte
        // via en egen mekanism.
        navigate('.', { state: { enterApp: true, authMode: mode, ...(plan ? { plan } : {}), ...(options?.uf ? { uf: true } : {}) } });
        setWantsApp(true);
      }}
    />
  );
}

// Kundönskemål ("när man trycker på policy eller sektion ska den alltid
// gå högst upp") — React Router byter INTE scrollposition automatiskt vid
// en <Link>-navigering (till skillnad från en vanlig, icke-SPA sidladdning)
// — stod man t.ex. och läste FAQ:n längst ner på startsidan och klickade
// "Integritetspolicy" i sidfoten, monterades PrivacyPolicy fortfarande
// scrollad lika långt ner. Nyckt på `pathname` (inte hela `location` —
// hash-ändringar, t.ex. Supabase-inloggningslänkar i RootRoute ovan, eller
// den inloggade appens egen aktiva-flik-hash i App.jsx, ska INTE trigga
// detta) och en instant hopp (inte smooth) — matchar hur en vanlig
// sidladdning redan beter sig, till skillnad från loggans EGEN smooth-
// scroll vid klick på samma sida (MarketingLayout.jsx), som är en annan,
// avsiktligt mjukare animation för ett annat fall (redan på sidan).
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function AppRouter() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootRoute />} />
        {/* Sitemap (Sida 29) — varje marknadssida en egen riktig route/URL,
            inte ett skroll-ankare på startsidan. Loggan i MarketingLayout
            går alltid till "/" oavsett vilken av dessa man står på. */}
        <Route path="/funktioner" element={<Suspense fallback={<AppLoadingFallback />}><FeaturesPage /></Suspense>} />
        <Route path="/priser" element={<Suspense fallback={<AppLoadingFallback />}><PricingPage /></Suspense>} />
        <Route path="/om-oss" element={<Suspense fallback={<AppLoadingFallback />}><AboutPage /></Suspense>} />
        <Route path="/kontakt" element={<Suspense fallback={<AppLoadingFallback />}><ContactPage /></Suspense>} />
        <Route path="/boka-genomgang" element={<Suspense fallback={<AppLoadingFallback />}><BookingPage /></Suspense>} />
        {/* Googles callback efter "Logga in med Google" i Inställningar.
            MÅSTE vara exakt den här sökvägen: adressen är registrerad hos
            Google och får inte innehålla någon frågesträng. Att det är en
            vy i appen och inte en serverlös funktion är också medvetet —
            se api/_gmail.js. Inte förrenderad och inte i sitemap: sidan är
            bara ett mellansteg, inte något att hitta i en sökmotor. */}
        <Route path="/koppla-mejl" element={<Suspense fallback={<AppLoadingFallback />}><GmailConnectCallback /></Suspense>} />
        <Route path="/byt-bokforingsprogram" element={<Suspense fallback={<AppLoadingFallback />}><SwitchPage /></Suspense>} />
        <Route path="/koppla-bank" element={<Suspense fallback={<AppLoadingFallback />}><BankPage /></Suspense>} />
        <Route path="/uf" element={<Suspense fallback={<AppLoadingFallback />}><UfPage /></Suspense>} />
        <Route path="/integrationer" element={<Suspense fallback={<AppLoadingFallback />}><IntegrationsPage /></Suspense>} />
        <Route path="/sakerhet" element={<Suspense fallback={<AppLoadingFallback />}><SecurityPage /></Suspense>} />
        <Route path="/ordlista" element={<Suspense fallback={<AppLoadingFallback />}><OrdlistaPage /></Suspense>} />
        <Route path="/blogg" element={<Suspense fallback={<AppLoadingFallback />}><BlogListPage /></Suspense>} />
        <Route path="/blogg/:slug" element={<Suspense fallback={<AppLoadingFallback />}><BlogPostPage /></Suspense>} />
        <Route path="/internal" element={<Suspense fallback={<AppLoadingFallback />}><InternalApp /></Suspense>} />
        {/* Verktygsnavet + räknarna. Sökvägarna måste hållas i
            synk med TOOLS i marketing/tools/toolsConfig.js (sidfoten,
            navet och korsläkarna bygger sina länkar därifrån), med
            PRERENDER_ROUTES i entry-server.jsx och med rewrites i
            vercel.json — samma tre ställen som varje annan statisk
            marknadssida redan står på. */}
        <Route path="/verktyg" element={<Suspense fallback={<AppLoadingFallback />}><ToolsHubPage /></Suspense>} />
        <Route path="/verktyg/momskalkylator" element={<Suspense fallback={<AppLoadingFallback />}><MomsKalkylatorPage /></Suspense>} />
        <Route path="/verktyg/lonekalkylator" element={<Suspense fallback={<AppLoadingFallback />}><LonekalkylatorPage /></Suspense>} />
        <Route path="/verktyg/egenavgifter" element={<Suspense fallback={<AppLoadingFallback />}><EgenavgifterPage /></Suspense>} />
        <Route path="/verktyg/rot-rut" element={<Suspense fallback={<AppLoadingFallback />}><RotRutKalkylatorPage /></Suspense>} />
        <Route path="/verktyg/drojsmalsranta" element={<Suspense fallback={<AppLoadingFallback />}><DrojsmalsrantaPage /></Suspense>} />
        <Route path="/verktyg/utdelning" element={<Suspense fallback={<AppLoadingFallback />}><UtdelningPage /></Suspense>} />
        <Route path="/verktyg/momsdatum" element={<Suspense fallback={<AppLoadingFallback />}><MomsDatumPage /></Suspense>} />
        <Route path="/verktyg/arsredovisning" element={<Suspense fallback={<AppLoadingFallback />}><ArsredovisningPage /></Suspense>} />
        <Route path="/privacy" element={<Suspense fallback={<AppLoadingFallback />}><PrivacyPolicy /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<AppLoadingFallback />}><TermsPolicy /></Suspense>} />
        {/* GDPR-innehållet är nu fullt inbakat i den utökade Integritetspolicyn
            (avsnitt 6, "Dina rättigheter") — en egen tunnare GDPR-sida skulle
            bara bli en sämre, lätt-att-glömma-uppdatera dubblett. */}
        <Route path="/gdpr" element={<Navigate to="/privacy" replace />} />
        <Route path="/cookies" element={<Suspense fallback={<AppLoadingFallback />}><CookiesPolicy /></Suspense>} />
        <Route path="/pub" element={<Suspense fallback={<AppLoadingFallback />}><PersonuppgiftsBitradesAvtal /></Suspense>} />
        {/* Länken i inbjudningsmejlet (max 3 användare/företag, se
            supabase-setup.sql: company_members) — se InviteRedeem.jsx för
            varför den inte gör något RLS-uppslag själv, bara sparar tokenet
            och skickar vidare till inloggning/registrering. */}
        <Route path="/invite" element={<Suspense fallback={<AppLoadingFallback />}><InviteRedeem /></Suspense>} />
        {/* Okänd sökväg (t.ex. en gammal djuplänk in i den inloggade appen)
            — samma "/" -fallback som förut. RootRoute ovan avgör sedan
            själv, via shouldLoadAppImmediately, om det ska bli App eller
            LandingPage. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Monterad utanför <Routes> så den syns på ALLA sidor — marknad OCH
          (eftersom AppRouter alltid ligger utanpå App också) den inloggade
          appen. Bara EN instans totalt, till skillnad från tidigare då
          App.jsx hade sin egen — App.jsx monterar INTE längre någon egen,
          se kommentaren i den filen. */}
      <CookieBanner />
    </>
  );
}
