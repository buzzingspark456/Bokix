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
  '/jamfor': {
    title: 'Jämför bokföringsprogram | Bokix',
    description: 'Bokix jämfört med Fortnox, Bokio och Visma eEkonomi — pris, funktioner och vad som faktiskt skiljer.',
  },
  '/jamfor/fortnox': {
    title: 'Bokix vs Fortnox — jämförelse och pris | Bokix',
    description: 'Fortnox eller Bokix? Jämför pris, vad som ingår och vad som skiljer. Fortnox priser senast kontrollerade augusti 2026.',
  },
  '/jamfor/bokio': {
    title: 'Bokix vs Bokio — jämförelse och pris | Bokix',
    description: 'Bokio eller Bokix? Jämför pris, vad som ingår och vad som skiljer. Bokio priser senast kontrollerade augusti 2026.',
  },
  '/jamfor/visma-eekonomi': {
    title: 'Bokix vs Visma eEkonomi — jämförelse och pris | Bokix',
    description: 'Visma eEkonomi (Spiris) eller Bokix? Jämför pris, vad som ingår och vad som skiljer.',
  },
  '/guider': {
    title: 'Guider om bokföring och företagande | Bokix',
    description: 'Praktiska guider om bokföring, moms, fakturering och att välja bokföringsprogram för svenska småföretag och enskilda firmor.',
  },
  '/guider/enskild-firma-bokforing': {
    title: 'Bokföring för enskild firma — komplett guide 2026 | Bokix',
    description: 'Så bokför du som enskild firma: vad du måste spara, momsregistrering, F-skatt och löpande bokföring steg för steg.',
  },
  '/guider/momsdeklaration': {
    title: 'Momsdeklaration steg för steg — guide 2026 | Bokix',
    description: 'Så fungerar momsdeklaration för enskild firma och aktiebolag: redovisningsperioder, deadlines och vanliga misstag.',
  },
  '/guider/fakturering-vad-kravs': {
    title: 'Fakturera som enskild firma eller aktiebolag — vad krävs? | Bokix',
    description: 'Vilka uppgifter en svensk faktura måste innehålla, betalningsvillkor, dröjsmålsränta och vanliga faktureringsmisstag.',
  },
  '/guider/valja-bokforingsprogram': {
    title: 'Vad kostar ett bokföringsprogram? Jämförelse 2026 | Bokix',
    description: 'Så jämför du bokföringsprogram som Fortnox, Bokio och Visma eEkonomi på riktigt — pris, vad som faktiskt ingår, och frågor att ställa innan du väljer.',
  },
};
