// ── SSG-renderare för marknadssidorna — körs bara vid BUILD-tid (Node, via
// scripts/prerender.mjs), aldrig i webbläsaren och aldrig i produktions-
// runtimen. Syfte: samma sex publika sidor som redan finns i public/sitemap.xml
// med priority ≥ 0.5 (Startsida/Funktioner/Priser/Guide/Om oss/Kontakt) ska
// ha RIKTIG text/rubriker i den råa HTML:en en crawler faktiskt läser,
// istället för ett tomt <div id="root"></div> — se README-anteckningen i
// scripts/prerender.mjs för hela bakgrunden.
//
// Bara import av de sex sidkomponenterna, INGEN AppRouter/App.jsx — den
// inloggade appen (Stripe/Supabase/hela bokföringsappen) ska aldrig röras
// av eller bunt:as in i den här SSR-byggnaden.
import { renderToString } from 'react-dom/server';
// react-router-dom v7 (säkerhetsgranskningen: npm audit fix, tog bort en
// critical jsPDF-sårbarhet i samma uppgradering) slog ihop /server-
// subpath-exporten in i huvudpaketet — den separata './server'-vägen
// finns inte kvar i v7:s package.json exports-fält alls (bekräftat: SSR-
// bygget kraschade med "'./server' is not exported" innan den här raden
// ändrades), StaticRouter exporteras nu bara härifrån.
import { StaticRouter } from 'react-router-dom';
import { allLocalizedRoutes } from './content/marketing/routes';

import LandingPage from './components/LandingPage.jsx';
import FeaturesPage from './components/marketing/FeaturesPage.jsx';
import PricingPage from './components/marketing/PricingPage.jsx';
import AboutPage from './components/marketing/AboutPage.jsx';
import ContactPage from './components/marketing/ContactPage.jsx';
import SwitchPage from './components/marketing/SwitchPage.jsx';
import BankPage from './components/marketing/BankPage.jsx';
import UfPage from './components/marketing/UfPage.jsx';
import ToolsHubPage from './components/marketing/tools/ToolsHubPage.jsx';
import ScanReceiptPage from './components/marketing/tools/ScanReceiptPage.jsx';
import MomsKalkylatorPage from './components/marketing/tools/MomsKalkylatorPage.jsx';
import LonekalkylatorPage from './components/marketing/tools/LonekalkylatorPage.jsx';
import EgenavgifterPage from './components/marketing/tools/EgenavgifterPage.jsx';
import RotRutKalkylatorPage from './components/marketing/tools/RotRutKalkylatorPage.jsx';
import DrojsmalsrantaPage from './components/marketing/tools/DrojsmalsrantaPage.jsx';
import UtdelningPage from './components/marketing/tools/UtdelningPage.jsx';
import MomsDatumPage from './components/marketing/tools/MomsDatumPage.jsx';
import ArsredovisningPage from './components/marketing/tools/ArsredovisningPage.jsx';
import OrdlistaPage from './components/marketing/OrdlistaPage.jsx';
import GuidesPage from './components/marketing/GuidesPage.jsx';
import GuideVideoPage from './components/marketing/GuideVideoPage.jsx';
import { GUIDE_GROUPS } from './content/marketing/guides.js';
import BokixFactsPage from './components/marketing/BokixFactsPage.jsx';
import HomeScreenPage from './components/marketing/HomeScreenPage.jsx';
import FaqPage from './components/marketing/FaqPage.jsx';
import IntegrationsPage from './components/marketing/IntegrationsPage.jsx';
import SecurityPage from './components/marketing/SecurityPage.jsx';
import PayrollPage from './components/marketing/PayrollPage.jsx';
import OrgTypePage from './components/marketing/OrgTypePage.jsx';
import { ORG_TYPE_PAGES } from './content/marketing/orgTypes.js';
import { FEATURE_PAGES } from './content/marketing/featurePages.js';
import BlogPage from './components/marketing/BlogPage.jsx';
import NewsPage from './components/marketing/NewsPage.jsx';
import StatusPage from './components/marketing/StatusPage.jsx';
import { BLOG_ARTICLE_PAGES } from './components/marketing/BlogPostPage.jsx';

// Verktygssidorna är statiska tills besökaren skriver i ett fält —
// startvärdena i respektive useState renderas alltså ut som riktig text i
// den förrenderade HTML:en (en crawler som inte kör JS ser ett ifyllt
// exempel, inte en tom ruta), och räknaren blir interaktiv först när
// klientbunten tagit över. Ordlistan förrenderas av samma skäl: femtio
// definitioner i rå HTML är hela poängen med den sidan.
// Bassökväg → komponent — samma 24 sidor som förut. Vilka språk var och
// en faktiskt renderas på styrs helt av content/marketing/routes.js
// (TRANSLATED_ROUTES); att lägga till ett nytt språk för en sida är alltså
// EN rad där, aldrig en ändring här.
const BASE_PAGES = {
  '/': LandingPage,
  '/funktioner': FeaturesPage,
  '/priser': PricingPage,
  '/om-oss': AboutPage,
  '/kontakt': ContactPage,
  '/byt-bokforingsprogram': SwitchPage,
  ...Object.fromEntries([...ORG_TYPE_PAGES, ...FEATURE_PAGES].map(p => [p.path, () => <OrgTypePage path={p.path} />])),
  '/koppla-bank': BankPage,
  '/uf': UfPage,
  '/integrationer': IntegrationsPage,
  '/sakerhet': SecurityPage,
  '/lon': PayrollPage,
  '/ordlista': OrdlistaPage,
  '/guider': GuidesPage,
  ...Object.fromEntries(GUIDE_GROUPS.flatMap(group => group.guides.map(guide => [
    `/guider/${guide.slug}`,
    () => <GuideVideoPage slug={guide.slug} />,
  ]))),
  '/bokix-i-korthet': BokixFactsPage,
  '/lagg-till-pa-hemskarmen': HomeScreenPage,
  '/vanliga-fragor': FaqPage,
  '/blogg': BlogPage,
  '/nyheter': NewsPage,
  '/status': StatusPage,
  ...BLOG_ARTICLE_PAGES,
  '/verktyg': ToolsHubPage,
  '/verktyg/skanna-kvitto': ScanReceiptPage,
  '/verktyg/momskalkylator': MomsKalkylatorPage,
  '/verktyg/lonekalkylator': LonekalkylatorPage,
  '/verktyg/egenavgifter': EgenavgifterPage,
  '/verktyg/rot-rut': RotRutKalkylatorPage,
  '/verktyg/drojsmalsranta': DrojsmalsrantaPage,
  '/verktyg/utdelning': UtdelningPage,
  '/verktyg/momsdatum': MomsDatumPage,
  '/verktyg/arsredovisning': ArsredovisningPage,
};

// PRERENDER_ROUTES/PAGES byggda från allLocalizedRoutes() (routes.js) —
// en rad per route×språk som faktiskt ska finnas (sv alltid, övriga
// enligt TRANSLATED_ROUTES). En sida utan översättning renderas alltså
// bara på sin svenska, oprefixerade sökväg precis som innan detta lades
// till.
export const PRERENDER_ROUTES = [];
const PAGES = {};
for (const { fullPath, locale, basePath } of allLocalizedRoutes()) {
  PRERENDER_ROUTES.push(fullPath);
  PAGES[fullPath] = { Component: BASE_PAGES[basePath], locale };
}

/** Renderar en enda route till en HTML-sträng + de <title>/<meta>/<link>-
 * taggar sidans <PageMeta>/<JsonLd> (src/utils/seo.jsx) satte, samlade var
 * för sig — se prerender.mjs för varför de hanteras separat från
 * kropps-HTML:en istället för att förlita sig på React 19:s klient-bara
 * DOM-hissning (som inte gäller här, renderToString producerar bara text,
 * ingen riktig `document`). `locale` skickas in som prop på sidan, som i
 * sin tur väljer rätt textinnehåll (se t.ex. LandingPage.jsx/
 * content/marketing/landing/index.js). */
export function render(path) {
  const entry = PAGES[path];
  if (!entry) return null;
  const { Component, locale } = entry;
  const html = renderToString(
    <StaticRouter location={path}>
      <Component locale={locale} />
    </StaticRouter>
  );
  return html;
}
