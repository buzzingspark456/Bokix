// Schema.org JSON-LD-generatorer — delad källa mellan scripts/prerender.mjs
// (skriver in dem i varje statisk sida) och index.html (skriver in
// Organization/SoftwareApplication direkt, som en garanterad baslinje som
// finns kvar även om hela förrenderingspipelinen någon gång skulle
// misslyckas — se prerender.mjs:s "fail open"-kommentar).
//
// Varför det här är värt att göra: sök- och AI-svarsmotorer (Google AI
// Overviews, Perplexity, ChatGPT/Claude med webbsökning) hämtar strukturerad
// data för att kunna citera EXAKTA fakta (pris, vad som ingår, svar på
// vanliga frågor) istället för att gissa eller hitta på siffror ur
// löptexten. FAQPage-schemat återanvänder ordagrant samma frågor/svar som
// visas på /priser (PricingPage.jsx FAQ-arrayen) — aldrig egna påhittade
// frågor, exakt samma disciplin som texten på sidan redan håller sig till.

export const SITE_URL = 'https://www.bokix.se';

export function getOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Bokix',
    // Disambiguering: "Bokix" delar tyvärr namn med Nasdaq-fondtickern
    // BOKIX (en BlackRock-fond) — alternateName + en beskrivning som
    // direkt nämner "bokföringsprogram"/"Sverige" hjälper sök- och
    // AI-motorer skilja på de två helt orelaterade sakerna.
    alternateName: 'Bokix bokföringsprogram',
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description: 'Bokix är ett svenskt, webbaserat bokföringsprogram (bokix.se) för småföretag och enskilda firmor — inte att förväxla med fondtickern BOKIX.',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@bokix.se',
      contactType: 'customer support',
      areaServed: 'SE',
      availableLanguage: ['Swedish'],
    },
  };
}

export function getSoftwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Bokix',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: 'Bokix är ett modernt, enkelt och kraftfullt bokföringsprogram för svenska småföretagare och enskilda firmor — löpande bokföring, fakturering, lönekörning och deklarationsunderlag i ett pris.',
    offers: {
      '@type': 'Offer',
      price: '99',
      priceCurrency: 'SEK',
      url: `${SITE_URL}/priser`,
      description: '99 kr/mån exkl. moms, 30 dagar gratis, ingen bindningstid.',
    },
  };
}

/** `faq`: samma { q, a }[]-form som PricingPage.jsx FAQ-arrayen — importeras
 * därifrån av anroparen, aldrig omskriven här, så schemat garanterat
 * matchar det som faktiskt står på sidan. */
export function getFaqJsonLd(faq) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}
