// ── SEO/AEO-metadata för marknadssidorna (Sida: "SEO måste vara bäst") ──
// .jsx (inte .js som resten av mappen) eftersom filen faktiskt innehåller
// JSX — Vites standard-esbuild-loader för .js-filer kan inte tolka JSX,
// bara .jsx/.tsx görs det via @vitejs/plugin-react (se vite.config.js).
//
// Bygger INTE på react-helmet-async: React 19 (package.json: ^19.2.7)
// hissar <title>/<meta>/<link> automatiskt till <head> när de renderas var
// som helst i komponentträdet, och tar bort dem igen när komponenten
// avmonteras (routen byts) — ingen extra dependency eller useEffect behövs.
// index.html:s egna <title>/<meta description> är bara fallbacken innan
// första routen hunnit rendera klart.
import React from 'react';

export const SITE_URL = 'https://www.bokix.se';
export const SITE_NAME = 'Bokix';
// Ingen egen 1200×630-delningsbild finns ännu (bra att ta fram separat,
// ett designjobb i sig) — kvadratiska app-ikonen är bättre än ingen
// og:image alls (utan den visar LinkedIn/Facebook/X/Slack ingen
// förhandsvisning när en Bokix-länk delas).
export const DEFAULT_OG_IMAGE = `${SITE_URL}/icon-512.png`;

/** En sidas titel/beskrivning/canonical + Open Graph/Twitter Card-taggar,
 * på en gång — varje marknadssida (LandingPage/FeaturesPage/PricingPage/
 * AboutPage/ContactPage) renderar en av dessa högst upp i sitt JSX-träd.
 * Utan den här (tidigare läget) delade ALLA sidor exakt samma <title>/
 * <meta description> från index.html — Google/Bing och AI-crawlers såg
 * fem identiska sidor istället för fem olika, vilket both skadar ranking
 * och gör att en delad länk till t.ex. /priser visade startsidans titel. */
export function PageMeta({ title, description, path = '/', image = DEFAULT_OG_IMAGE, type = 'website' }) {
  const url = `${SITE_URL}${path}`;
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="sv_SE" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </>
  );
}

/** Strukturerad data (schema.org), t.ex. Organization/SoftwareApplication/
 * FAQPage — det Google (rika sökresultat) och AI-svarsmotorer (Claude/
 * ChatGPT/Perplexity när de faktiskt läser sidan) helst plockar fakta
 * ifrån, hellre än att gissa utifrån brödtexten. `data` som ett vanligt
 * JSX-textbarn (inte dangerouslySetInnerHTML) — React sätter textbarn som
 * en riktig DOM-textnod, inte via innerHTML, så JSON:en kan aldrig råka
 * HTML-tolkas eller gå sönder även om ett fält skulle innehålla "<"/">". */
export function JsonLd({ data }) {
  return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}
