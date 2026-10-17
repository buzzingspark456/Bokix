// ── Bilder ur appen i blogginläggen ─────────────────────────────────────
// { t: 'image', shot: 'stripe' } i blog.js. Bilderna ritas av
// scripts/render-blog-shots.mjs (appfönster i ram, ljust + mörkt) till
// public/blog/app/<namn>.jpg och <namn>-mork.jpg.

export const BLOG_SHOT_WIDTH = 1600;
export const BLOG_SHOT_HEIGHT = 1100;

export const BLOG_SHOTS = {
  startsida: {
    alt: 'Startsidan i bokföringsprogrammet Bokix med årets resultat, intäkter och kostnader per månad och en att göra-lista',
    caption: 'Startsidan: resultatet hittills i år och det som ska göras.',
  },
  stripe: {
    alt: 'Stripe-transaktioner i Bokix: Stripes avgift för en kortbetalning, en utbetalning till banken och en försäljning att bokföra',
    caption: 'Stripe i Granskning: avgifter och utbetalningar bokförs med ett klick.',
  },
  moms: {
    alt: 'Skatt och bokslut i Bokix med nästa momsdeklaration, årsbokslut och inkomstdeklaration och hur många dagar som är kvar',
    caption: 'Skatt och bokslut: momsdeklarationen och allt annat som ska lämnas in, i ordning.',
  },
  kvitton: {
    alt: 'Kvitton i Bokix med datum, belopp, moms och konto för varje kvitto',
    caption: 'Kvitton: datum, belopp och moms läses av när du fotar kvittot.',
  },
};

export function blogShotSrc(name, dark = false) {
  return `/blog/app/${name}${dark ? '-mork' : ''}.jpg`;
}
