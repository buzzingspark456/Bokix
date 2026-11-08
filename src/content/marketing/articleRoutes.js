// Adresserna till blogg- och nyhetsartiklarna (de med `body` i blog.js och
// news.js), utan själva texterna. AppRouter behöver bara adresserna; att
// importera news.js drog in alla artiklar (~75 kB) på varje sida, även
// startsidan (2026-11-07). articleRoutes.test.js larmar om listan och
// artiklarna går isär: lägg till en rad här när en ny artikel skrivs.
export const ARTICLE_ROUTES = [
  { slug: "bokfora-stripe", path: "/blogg/bokfora-stripe" },
  { slug: "valja-bokforingsprogram", path: "/blogg/valja-bokforingsprogram" },
  { slug: "enkel-bokforing", path: "/enkel-bokforing" },
  { slug: "sie4-flytta-bokforing", path: "/blogg/sie4-flytta-bokforing" },
  { slug: "bokforing-uf-foretag", path: "/blogg/bokforing-uf-foretag" },
  { slug: "moms-deklaration-steg-for-steg", path: "/blogg/moms-deklaration-steg-for-steg" },
  { slug: "spara-kvitton-bokforingslagen", path: "/blogg/spara-kvitton-bokforingslagen" },
  { slug: "bokslut-checklista", path: "/blogg/bokslut-checklista" },
  { slug: "lon-eller-utdelning-ab", path: "/blogg/lon-eller-utdelning-ab" },
  { slug: "enskild-firma-bokforing-ne", path: "/blogg/enskild-firma-bokforing-ne" },
  { slug: "agi-fil-och-arbetsgivaravgift-efter-alder", path: "/nyheter/agi-fil-och-arbetsgivaravgift-efter-alder" },
  { slug: "bokforingen-sparas-i-sju-ar", path: "/nyheter/bokforingen-sparas-i-sju-ar" },
  { slug: "kvittoavlasning-flera-momssatser-och-returer", path: "/nyheter/kvittoavlasning-flera-momssatser-och-returer" },
  { slug: "ta-betalt-med-kort-och-stripe", path: "/nyheter/ta-betalt-med-kort-och-stripe" },
  { slug: "kassaforsaljning-och-dagsavslut-med-zettle", path: "/nyheter/kassaforsaljning-och-dagsavslut-med-zettle" },
  { slug: "skicka-fakturor-fran-din-egen-gmail", path: "/nyheter/skicka-fakturor-fran-din-egen-gmail" },
  { slug: "skicka-en-skarmbild-till-supporten", path: "/nyheter/skicka-en-skarmbild-till-supporten" },
  { slug: "logga-in-med-face-id", path: "/nyheter/logga-in-med-face-id" },
];
