import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import LandingPage from './components/LandingPage.jsx';
import FeaturesPage from './components/marketing/FeaturesPage.jsx';
import PricingPage from './components/marketing/PricingPage.jsx';
import AboutPage from './components/marketing/AboutPage.jsx';
import ContactPage from './components/marketing/ContactPage.jsx';
import PrivacyPolicy from './components/PrivacyPolicy.jsx';
import TermsPolicy from './components/TermsPolicy.jsx';
import CookiesPolicy from './components/CookiesPolicy.jsx';
import CompareHub from './components/marketing/comparisons/CompareHub.jsx';
import CompareFortnox from './components/marketing/comparisons/CompareFortnox.jsx';
import CompareBokio from './components/marketing/comparisons/CompareBokio.jsx';
import CompareVisma from './components/marketing/comparisons/CompareVisma.jsx';

// Återexporterad rakt av: scripts/prerender.mjs behöver den EXAKTA FAQ-
// arrayen som PricingPage.jsx faktiskt renderar (för FAQPage-JSON-LD), men
// kan inte importera en .jsx-fil direkt i vanlig Node (ingen JSX-transform
// där) — den här redan Vite-byggda bunten är enda stället där PricingPage.jsx
// redan blivit ren JS.
export { FAQ } from './components/marketing/PricingPage.jsx';

// Byggs till en SEPARAT Node-bunt (`vite build --ssr src/entry-server.jsx`,
// se scripts/prerender.mjs) — bara till för att producera statiska HTML-
// ögonblicksbilder av de publika marknadssidorna vid build-tiden, aldrig
// till för att faktiskt betjäna trafik (det gör fortfarande main.jsx/
// App.jsx, oförändrat). Kräver därför INTE att varje sida är helt
// SSR-säker rakt igenom — bara att den inte kastar vid en engångs
// server-rendering. Den enda kända bovlingen var DemoWorkspace (hela den
// riktiga appens UI, Recharts-diagram m.m., förutsätter webbläsar-DOM),
// löst separat i SsrSafeDemo.jsx.
const PAGES = {
  '/': LandingPage,
  '/funktioner': FeaturesPage,
  '/priser': PricingPage,
  '/om-oss': AboutPage,
  '/kontakt': ContactPage,
  '/privacy': PrivacyPolicy,
  '/terms': TermsPolicy,
  '/cookies': CookiesPolicy,
  '/jamfor': CompareHub,
  '/jamfor/fortnox': CompareFortnox,
  '/jamfor/bokio': CompareBokio,
  '/jamfor/visma-eekonomi': CompareVisma,
};

export function render(path) {
  const Page = PAGES[path];
  if (!Page) return null;
  return renderToString(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>
  );
}
