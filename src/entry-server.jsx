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
import ChooseSoftwareGuidePage from './components/marketing/ChooseSoftwareGuidePage.jsx';
import AlternativePage from './components/marketing/AlternativePage.jsx';

export const PRERENDER_ROUTES = ['/', '/funktioner', '/priser', '/om-oss', '/kontakt', '/valja-bokforingsprogram', '/alternativ'];

const PAGES = {
  '/': LandingPage,
  '/funktioner': FeaturesPage,
  '/priser': PricingPage,
  '/om-oss': AboutPage,
  '/kontakt': ContactPage,
  '/valja-bokforingsprogram': ChooseSoftwareGuidePage,
  '/alternativ': AlternativePage,
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
