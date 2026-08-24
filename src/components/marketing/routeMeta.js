// Enda källan för varje publik sidas titel/beskrivning — används BÅDE
// klient-side (varje sida skickar sin egen post härifrån till
// useDocumentMeta via MarketingLayout) OCH av scripts/prerender.mjs för att
// bygga <head> i de statiskt förrenderade HTML-filerna. Utan en enda delad
// källa skulle de två riskera att glida isär över tid.
export const ROUTE_META = {
  '/': {
    title: 'Bokix - Smart & Enkel Bokföring online',
    description: 'Bokix - Ett modernt, enkelt och kraftfullt bokföringsprogram för småföretagare och enskilda firmor.',
  },
  '/priser': {
    title: 'Priser | Bokix',
    description: 'Ett pris, allt ingår: 99 kr/mån exkl. moms. 30 dagar gratis, ingen bindningstid, avsluta när du vill.',
  },
  '/funktioner': {
    title: 'Funktioner | Bokix',
    description: 'Löpande bokföring, fakturering, lönekörning och deklarationsunderlag — allt ett svenskt företag faktiskt behöver, i ett pris.',
  },
  '/om-oss': {
    title: 'Om oss | Bokix',
    description: 'Varför Bokix finns och vilka principer det är byggt kring — inga påhittade siffror, ingen tyst gissning.',
  },
  '/kontakt': {
    title: 'Kontakta oss | Bokix',
    description: 'Frågor om support, fakturering eller integritet? Skriv till oss — en riktig person läser och svarar på din e-post.',
  },
  '/privacy': {
    title: 'Integritetspolicy | Bokix',
    description: 'Så behandlar Bokix dina personuppgifter enligt GDPR — vad vi samlar in, varför, hur länge, och dina rättigheter.',
  },
  '/terms': {
    title: 'Användarvillkor | Bokix',
    description: 'Villkoren som styr din och ditt företags användning av Bokix — vad tjänsten är, uppsägning, ansvar och betalning.',
  },
  '/cookies': {
    title: 'Cookiepolicy | Bokix',
    description: 'Vilka cookies Bokix använder, varför, och hur du styr ditt samtycke. Inga marknadsföringscookies.',
  },
};
