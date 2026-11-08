// ── Enda källa för marknadssidornas routing + språk ─────────────────────
// Används av src/entry-server.jsx (SSR-förrendering), src/AppRouter.jsx
// (klienthydrering), src/utils/seo.jsx (hreflang/og:locale) och
// MarketingHeader (språkväxlaren). vercel.json kan inte importera JS och
// underhålls separat, men växer inte per route/språk tack vare den
// generiska locale-rewriten där — se kommentaren i vercel.json.
//
// DEFAULT_LOCALE (sv) ligger alltid oprefixerad på sin bassökväg
// (`/priser`). Övriga språk prefixas (`/no/priser`). Se localizedPath().

import { ARTICLE_ROUTES } from './articleRoutes.js';
import { GUIDE_GROUPS } from './guides.js';
import { ORG_TYPE_PAGES } from './orgTypes.js';
import { FEATURE_PAGES } from './featurePages.js';

export const DEFAULT_LOCALE = 'sv';

// Metadata per språk: `hreflang` är ISO-språkkoden <link rel="alternate">
// ska använda (INTE samma sträng som URL-prefixet — dansk hreflang är
// "da", inte "dk", vilket är en landskod, inte en språkkod), `og` är
// Open Graph-formatet (språk_LAND).
// Flaggikonen till varje språk är en riktig SVG i public/flags/<kod>.svg
// (Wikimedia Commons), inte emoji — se LanguageSwitcher i MarketingLayout.jsx.
export const LOCALE_META = {
  sv: { hreflang: 'sv-SE', og: 'sv_SE', label: 'Svenska' },
};

export const LOCALES = Object.keys(LOCALE_META);

// De ~24 marknadssidornas bassökvägar (oprefixerade, dvs. de svenska
// URL:erna som redan finns) — flyttad hit från dupliceringen som tidigare
// fanns separat i entry-server.jsx/AppRouter.jsx.
export const MARKETING_ROUTES = [
  '/', '/funktioner', '/priser', '/om-oss', '/kontakt',
  '/byt-bokforingsprogram', '/koppla-bank',
  // Bokföringsprogram per bolagsform (orgTypes.js).
  ...ORG_TYPE_PAGES.map(p => p.path),
  // Funktionssidor och sökordssidor (featurePages.js), samma komponent.
  ...FEATURE_PAGES.map(p => p.path),
  '/integrationer', '/sakerhet', '/lon', '/ordlista', '/guider', '/bokix-i-korthet', '/lagg-till-pa-hemskarmen', '/vanliga-fragor', '/blogg', '/nyheter',
  ...GUIDE_GROUPS.flatMap(group => group.guides.map(guide => `/guider/${guide.slug}`)),
  '/verktyg', '/verktyg/skanna-kvitto', '/verktyg/momskalkylator', '/verktyg/lonekalkylator', '/verktyg/egenavgifter',
  '/verktyg/rot-rut', '/verktyg/drojsmalsranta', '/verktyg/utdelning',
  '/verktyg/momsdatum', '/verktyg/arsredovisning',
  // Blogg- och nyhetsartiklarna (med `body`, se blog.js och news.js) —
  // härledda, så ett nytt inlägg dyker upp här av sig självt.
  ...ARTICLE_ROUTES.map(p => p.path),
];

// Vilka av MARKETING_ROUTES som faktiskt har riktig, varumärkesskriven
// text på vilka språk (utöver sv, som alltid finns). Avsiktligt EN lista
// som fylls på sida för sida — att generera /no/uf innan äkta norsk text
// finns skulle bara publicera en dubblett av den svenska sidan bakom ett
// hreflang="nb-NO"-löfte den inte håller, vilket är sämre för SEO än att
// inte ha sidan alls.
//
// 2026-10-02: webbplatsen finns bara på svenska. /en, /no, /dk och /fi
// (startsidan och priser) togs bort och omdirigeras permanent till de
// svenska sidorna (vercel.json). Mekanismen finns kvar om ett språk ska
// tillbaka: språket i LOCALE_META, sidan här och texten i landing.js/pricing.js.
export const TRANSLATED_ROUTES = {};

/** Sökväg → { locale, basePath } för de sökvägar som faktiskt existerar
 * (bassökvägen på sv, plus prefixade varianter enligt TRANSLATED_ROUTES). */
export function localizedPath(locale, basePath) {
  if (locale === DEFAULT_LOCALE) return basePath;
  return basePath === '/' ? `/${locale}` : `/${locale}${basePath}`;
}

/** Alla språk en given bassökväg faktiskt finns på, sv alltid inkluderad. */
export function availableLocalesFor(basePath) {
  return [DEFAULT_LOCALE, ...(TRANSLATED_ROUTES[basePath] || [])];
}

/** { fullPath, locale, basePath } för varje route × språk-kombination som
 * faktiskt ska finnas — genererar entry-server.jsx:s PRERENDER_ROUTES/
 * PAGES-nycklar och AppRouter.jsx:s <Route>-lista, så ingen av de två
 * kan glida isär från den andra eller från TRANSLATED_ROUTES ovan. */
export function allLocalizedRoutes() {
  const out = [];
  for (const basePath of MARKETING_ROUTES) {
    for (const locale of availableLocalesFor(basePath)) {
      out.push({ fullPath: localizedPath(locale, basePath), locale, basePath });
    }
  }
  return out;
}

/** Nuvarande sökväg → { locale, basePath }, för språkväxlaren. Okänd
 * sökväg (inte en marknadssida) returnerar null. */
export function parseLocalizedPath(pathname) {
  const seg = pathname.split('/')[1];
  if (LOCALES.includes(seg) && seg !== DEFAULT_LOCALE) {
    const rest = pathname.slice(seg.length + 1) || '/';
    if (MARKETING_ROUTES.includes(rest)) return { locale: seg, basePath: rest };
    return null;
  }
  if (MARKETING_ROUTES.includes(pathname)) return { locale: DEFAULT_LOCALE, basePath: pathname };
  return null;
}
