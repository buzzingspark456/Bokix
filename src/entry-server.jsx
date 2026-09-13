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

import LandingPage from './components/LandingPage.jsx';
import FeaturesPage from './components/marketing/FeaturesPage.jsx';
import PricingPage from './components/marketing/PricingPage.jsx';
import AboutPage from './components/marketing/AboutPage.jsx';
import ContactPage from './components/marketing/ContactPage.jsx';
import SwitchPage from './components/marketing/SwitchPage.jsx';
import BankPage from './components/marketing/BankPage.jsx';
import UfPage from './components/marketing/UfPage.jsx';
import ToolsHubPage from './components/marketing/tools/ToolsHubPage.jsx';
import MomsKalkylatorPage from './components/marketing/tools/MomsKalkylatorPage.jsx';
import LonekalkylatorPage from './components/marketing/tools/LonekalkylatorPage.jsx';
import EgenavgifterPage from './components/marketing/tools/EgenavgifterPage.jsx';
import RotRutKalkylatorPage from './components/marketing/tools/RotRutKalkylatorPage.jsx';
import DrojsmalsrantaPage from './components/marketing/tools/DrojsmalsrantaPage.jsx';
import UtdelningPage from './components/marketing/tools/UtdelningPage.jsx';
import MomsDatumPage from './components/marketing/tools/MomsDatumPage.jsx';
import ArsredovisningPage from './components/marketing/tools/ArsredovisningPage.jsx';
import OrdlistaPage from './components/marketing/OrdlistaPage.jsx';
import IntegrationsPage from './components/marketing/IntegrationsPage.jsx';
import SecurityPage from './components/marketing/SecurityPage.jsx';
import EnkelBokforingPage from './components/marketing/EnkelBokforingPage.jsx';

// Verktygssidorna är statiska tills besökaren skriver i ett fält —
// startvärdena i respektive useState renderas alltså ut som riktig text i
// den förrenderade HTML:en (en crawler som inte kör JS ser ett ifyllt
// exempel, inte en tom ruta), och räknaren blir interaktiv först när
// klientbunten tagit över. Ordlistan förrenderas av samma skäl: femtio
// definitioner i rå HTML är hela poängen med den sidan.
export const PRERENDER_ROUTES = [
  '/', '/funktioner', '/priser', '/om-oss', '/kontakt',
  '/byt-bokforingsprogram', '/koppla-bank', '/uf',
  '/integrationer', '/sakerhet', '/ordlista', '/enkel-bokforing',
  '/verktyg', '/verktyg/momskalkylator', '/verktyg/lonekalkylator', '/verktyg/egenavgifter',
  '/verktyg/rot-rut', '/verktyg/drojsmalsranta', '/verktyg/utdelning',
  '/verktyg/momsdatum', '/verktyg/arsredovisning',
];

const PAGES = {
  '/': LandingPage,
  '/funktioner': FeaturesPage,
  '/priser': PricingPage,
  '/om-oss': AboutPage,
  '/kontakt': ContactPage,
  '/byt-bokforingsprogram': SwitchPage,
  '/koppla-bank': BankPage,
  '/uf': UfPage,
  '/integrationer': IntegrationsPage,
  '/sakerhet': SecurityPage,
  '/ordlista': OrdlistaPage,
  '/enkel-bokforing': EnkelBokforingPage,
  '/verktyg': ToolsHubPage,
  '/verktyg/momskalkylator': MomsKalkylatorPage,
  '/verktyg/lonekalkylator': LonekalkylatorPage,
  '/verktyg/egenavgifter': EgenavgifterPage,
  '/verktyg/rot-rut': RotRutKalkylatorPage,
  '/verktyg/drojsmalsranta': DrojsmalsrantaPage,
  '/verktyg/utdelning': UtdelningPage,
  '/verktyg/momsdatum': MomsDatumPage,
  '/verktyg/arsredovisning': ArsredovisningPage,
};

/** Renderar en enda route till en HTML-sträng + de <title>/<meta>/<link>-
 * taggar sidans <PageMeta>/<JsonLd> (src/utils/seo.jsx) satte, samlade var
 * för sig — se prerender.mjs för varför de hanteras separat från
 * kropps-HTML:en istället för att förlita sig på React 19:s klient-bara
 * DOM-hissning (som inte gäller här, renderToString producerar bara text,
 * ingen riktig `document`). */
export function render(path) {
  const Page = PAGES[path];
  if (!Page) return null;
  const html = renderToString(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>
  );
  return html;
}
