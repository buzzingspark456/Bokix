// ── Enda källan för Bokix-bloggens inlägg ───────────────────────────────
// Läses av både BlogPage.jsx (listan på /blogg) och varje enskilt
// inläggs egen sida (t.ex. EnkelBokforingPage.jsx, /enkel-bokforing) — ett
// inlägg skrivs in HÄR en gång, sen syns det på båda ställena, i stället
// för att titel/datum/ingress riskerar att glida isär mellan en lista och
// själva artikeln.
//
// Ett inlägg bor kvar på sin egen, redan existerande sökväg (t.ex.
// /enkel-bokforing) snarare än att flyttas under /blogg/<slug> — den
// sökvägen kan redan vara indexerad, och att flytta den utan en 301 hade
// tappat det. `path` pekar dit; `/blogg` är bara en lista med länkar dit,
// inte en ny mapp inläggen bor i.
export const BLOG_POSTS = [
  {
    slug: 'enkel-bokforing',
    path: '/enkel-bokforing',
    title: 'Så gör Bokix bokföring enkelt',
    excerpt: 'Sex konkreta saker Bokix faktiskt gör så att bokföring inte kräver att du kan bokföring: OCR-läsning av kvitton, automatiska verifikationer, en granskningskö för det osäkra, bankimport som matchar sig själv, och moms/löner/bokslut inbyggt.',
    image: '/blog/enkel-bokforing-hero.jpg',
    imageAlt: 'För att bokföring ska vara enkelt — Bokix',
    datePublished: '2026-09-13',
    dateModified: '2026-09-13',
    readTime: '~4 min läsning',
  },
];
