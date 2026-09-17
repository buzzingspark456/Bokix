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
import { DEFAULT_LOCALE, LOCALE_META, availableLocalesFor, localizedPath } from '../content/marketing/routes';

export const SITE_URL = 'https://www.bokix.se';
export const SITE_NAME = 'Bokix';
// 1200×630 (2x, 2400×1260, för skärpa på Retina-förhandsvisningar) —
// mörk bakgrund, samma gradientordmärke (BokixWordmark) och blobfärger
// som Hero-sektionen på startsidan, så en delad länk faktiskt visar en
// riktig bild i stället för den återanvända kvadratiska app-ikonen som
// låg här tidigare (troligen förklaringen till att Google-bildsök bara
// visade favicon: ingen sida hade någonsin gett crawlern en riktig
// fotoformad bild att indexera).
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** En sidas titel/beskrivning/canonical + Open Graph/Twitter Card-taggar,
 * på en gång — varje marknadssida (LandingPage/FeaturesPage/PricingPage/
 * AboutPage/ContactPage) renderar en av dessa högst upp i sitt JSX-träd.
 * Utan den här (tidigare läget) delade ALLA sidor exakt samma <title>/
 * <meta description> från index.html — Google/Bing och AI-crawlers såg
 * fem identiska sidor istället för fem olika, vilket both skadar ranking
 * och gör att en delad länk till t.ex. /priser visade startsidans titel. */
/** `locale`/`basePath` är valfria — sidor som ännu bara finns på svenska
 * (dvs. alla anrop skrivna innan detta lades till) beter sig precis som
 * förut: `locale` faller tillbaka till sv, `basePath` till `path`, vilket
 * ger en enda hreflang-länk (sv → sig själv) och samma og:locale som
 * tidigare. En lokaliserad sida (se t.ex. LandingPage.jsx/PricingPage.jsx
 * för no/dk/fi/en) skickar in sitt eget `locale` och den GEMENSAMMA,
 * oprefixerade `basePath` (t.ex. "/priser" även när `path` är
 * "/no/priser") så alla språkvarianter av samma sida känner till
 * varandra — se availableLocalesFor()/localizedPath() i
 * content/marketing/routes.js, den enda källan för vilka språk som
 * faktiskt finns per sida. */
export function PageMeta({ title, description, path = '/', basePath, locale = DEFAULT_LOCALE, image = DEFAULT_OG_IMAGE, type = 'website' }) {
  const url = `${SITE_URL}${path}`;
  const base = basePath || path;
  const siblings = availableLocalesFor(base);
  const ogLocale = LOCALE_META[locale]?.og || LOCALE_META[DEFAULT_LOCALE].og;
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {/* React-proppen MÅSTE stavas "hrefLang" (camelCase) — provade
          gemener ("hreflang") för att SSR-strängen (renderToString i
          entry-server.jsx/prerender.mjs) annars skrev ut den bokstavligt
          istället för att mappa den till HTML-attributet, men det bröt
          client-renderingen: React kände inte igen gemener som samma DOM-
          egenskap och varnade "Invalid DOM property, did you mean
          hrefLang?" i konsolen varje gång de här sidorna renderas rent
          klientsidan (Vite dev-servern, eller en SPA-navigering till en
          marknadssida utan full sidladdning). renderToString skriver
          visserligen ut "hrefLang" (versal L) rakt av i den förrenderade
          filen, men HTML5-specen är attributnamn-okänslig vid parsning
          (tokenizern gemenar namnet), så varje riktig HTML-parser —
          Googlebot inräknat — läser den identiskt med "hreflang" ändå. */}
      {siblings.map((l) => (
        <link key={l} rel="alternate" hrefLang={LOCALE_META[l].hreflang} href={`${SITE_URL}${localizedPath(l, base)}`} />
      ))}
      {/* x-default pekar på den svenska versionen — sajten är i grunden
          svensk, sv är den enda sidan som alltid finns oavsett hur många
          språk en given route hunnit få. */}
      <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${base}`} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content={ogLocale} />
      {siblings.filter((l) => l !== locale).map((l) => (
        <meta key={l} property="og:locale:alternate" content={LOCALE_META[l].og} />
      ))}
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
