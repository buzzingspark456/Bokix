// Konkurrentjämförelser — /jamfor/fortnox, /jamfor/bokio, /jamfor/visma-eekonomi.
//
// VIKTIGT om siffrorna nedan: konkurrenternas priser är hämtade från
// tredjepartsjämförelser (inte leverantörernas egna sidor direkt — de gick
// inte att nå när det här skrevs) och ändras då och då (Bokio t.ex. tog
// bort sin gratisplan och höjde priserna under 2026). Varje kort nedan
// pekar därför alltid vidare till leverantörens EGEN prissida istället för
// att låtsas vara den slutgiltiga sanningen — och `checked` markerar när
// siffran senast stämdes av, så det syns om den behöver kontrolleras igen.
// Ändra aldrig ett pris här utan att verifiera det på riktigt hos
// leverantören först — en felaktig jämförande prisuppgift är inte bara
// slarvigt, det är marknadsföring som kan ifrågasättas juridiskt.
//
// Tonen är medvetet sansad, inte nedvärderande — exakt samma disciplin som
// resten av marknadssidorna redan håller (se PricingPage.jsx FAQ-kommentar:
// "Ärliga, konkreta frågor — inga påhittade..."). Varje jämförelse har
// också en ärlig "när X kan passa bättre"-sektion.

export const COMPARISONS = {
  fortnox: {
    slug: 'fortnox',
    name: 'Fortnox',
    checked: 'augusti 2026',
    pricingUrl: 'https://www.fortnox.se/program/bokforingsprogram/priser',
    intro: 'Fortnox är Sveriges mest kända molnbaserade bokföringsprogram — ett stort, etablerat system med ett eget paket för enskild firma och separata, dyrare paket ju större företaget är.',
    pricingSummary: 'Fortnox säljer bokföring i flera nivåer (t.ex. Mini, Liten, Mellan+, Stor+) plus ett billigare paket riktat specifikt till enskild firma. Lön och bokslut är egna tillägg som läggs på ovanpå grundpriset, inte inkluderade från början.',
    pricingRows: [
      { label: 'Enskild firma-paket', value: 'från ca 149 kr/mån' },
      { label: 'Mini', value: 'ca 209 kr/mån' },
      { label: 'Liten', value: 'ca 349 kr/mån' },
      { label: 'Tillägg: Lön', value: '+ ca 199 kr/mån + per anställd' },
      { label: 'Tillägg: Bokslut', value: '+ ca 89 kr/mån' },
    ],
    bokixEdge: [
      'Ett enda pris (99 kr/mån) med bokföring, fakturering, lön och deklarationsunderlag inbakat — inga tillägg att räkna ihop för att veta vad du faktiskt landar på.',
      'Inget behov av att först välja rätt paketstorlek innan du ens kommit igång.',
      '30 dagar helt gratis att testa hela funktionsutbudet, inte bara en begränsad startplan.',
    ],
    fortnoxEdge: [
      'Betydligt större ekosystem: fler tredjepartsintegrationer och ett stort nätverk av redovisningsbyråer som redan jobbar i Fortnox.',
      'Ett äldre, väletablerat namn — om din revisor eller redovisningskonsult redan kör Fortnox kan det vara enklare att stanna där.',
      'Fler nischade tilläggsmoduler för större eller mer komplexa verksamheter.',
    ],
    faq: [
      { q: 'Är Bokix billigare än Fortnox?', a: 'För en enskild firma med lön, fakturering och bokslutsunderlag samlat i ett pris landar Bokix (99 kr/mån) ofta lägre än Fortnox med motsvarande tillägg — men jämför alltid mot Fortnox aktuella priser för just din situation, de ändras då och då.' },
      { q: 'Kan jag byta från Fortnox till Bokix mitt i räkenskapsåret?', a: 'Ja, tekniskt går det när som helst, men det är enklast vid ett årsskifte eller kvartalsskifte — då slipper du dela samma räkenskapsår mellan två system. Bokix har idag ingen automatisk import av Fortnox-data; du exporterar din gamla bokföring (t.ex. som SIE-fil eller PDF) för egen arkivering och startar löpande bokföring i Bokix från bytesdagen.' },
      { q: 'Har Fortnox och Bokix samma funktioner?', a: 'De täcker samma grundbehov (bokföring, fakturering, lön, moms/skatt), men Fortnox har fler tilläggsmoduler för större verksamheter. Bokix är byggt smalare och djupare för just småföretag och enskilda firmor, till ett pris utan tillägg.' },
    ],
  },

  bokio: {
    slug: 'bokio',
    name: 'Bokio',
    checked: 'augusti 2026',
    pricingUrl: 'https://www.bokio.se/priser/',
    intro: 'Bokio blev populärt tack vare sin tidigare gratisplan för enskilda firmor. Den gratisplanen togs bort i januari 2026, och Bokio är numera ett helt betalprogram.',
    pricingSummary: 'Bokio prissätter numera efter plan snarare än med en gratisnivå — priset beror på om du binder dig årsvis eller betalar månadsvis, och på om du driver enskild firma eller aktiebolag.',
    pricingRows: [
      { label: 'Basic (årsdebitering)', value: 'ca 269 kr/mån' },
      { label: 'Standard', value: 'ca 299 kr/mån' },
      { label: 'Aktiebolag/avancerat', value: 'från ca 249 kr/mån och uppåt' },
    ],
    bokixEdge: [
      'Ett flatt pris (99 kr/mån) oavsett bolagsform — ingen separat, dyrare nivå bara för att du har ett aktiebolag.',
      '30 dagar gratis att testa, ingen bindningstid för lägre pris.',
      'Lönekörning och deklarationsunderlag ingår i samma pris, inte en egen betalnivå.',
    ],
    bokioEdge: [
      'Längre historik och ett stort community av användarguider/forumtrådar byggt upp under åren med gratisplanen.',
      'Brett känt namn bland svenska enskilda firmor, även efter att gratisplanen försvann.',
    ],
    faq: [
      { q: 'Har Bokio fortfarande en gratisplan?', a: 'Nej. Bokios gratisplan togs bort i januari 2026 — idag är samtliga Bokio-planer betalplaner. Bokix har aldrig haft en gratisplan, men ger 30 dagar helt gratis att testa allt innan du behöver betala något.' },
      { q: 'Är Bokix billigare än Bokio?', a: 'Efter Bokios prishöjning 2026 ligger Bokix (99 kr/mån, allt inkluderat) ofta lägre än Bokios betalplaner — men priser ändras, jämför alltid mot Bokios aktuella prissida.' },
      { q: 'Kan jag exportera min bokföring från Bokio och fortsätta i Bokix?', a: 'Du kan exportera din bokföring från Bokio (t.ex. som SIE-fil) för egen arkivering. Bokix har idag ingen automatisk import av data från Bokio — löpande bokföring i Bokix börjar från den dag du sätter igång.' },
    ],
  },

  'visma-eekonomi': {
    slug: 'visma-eekonomi',
    name: 'Visma eEkonomi',
    checked: 'augusti 2026',
    pricingUrl: 'https://www.spiris.se/program/ekonomiprogram/eekonomi/priser',
    intro: 'Visma eEkonomi är en del av Visma-koncernen, en av de största aktörerna inom svensk ekonomiprogramvara — mycket använt bland redovisningsbyråer. Programmet har nyligen bytt namn till Spiris.',
    pricingSummary: 'Visma eEkonomi (Spiris) prissätts i tre nivåer som växer med hur mycket automatisering och hur många funktioner du behöver.',
    pricingRows: [
      { label: 'Start', value: 'ca 179 kr/mån' },
      { label: 'Smart', value: 'ca 299 kr/mån' },
      { label: 'Pro', value: 'ca 449–498 kr/mån' },
    ],
    bokixEdge: [
      'Ett enda pris (99 kr/mån) — inget behov av att räkna ut om du behöver "Smart" eller "Pro" för att få lönekörning eller full bokföring.',
      'Byggt specifikt för svenska småföretag/enskilda firmor, inte som en nedskalad variant av ett större byråsystem.',
      '30 dagar gratis, ingen bindningstid.',
    ],
    vismaEdge: [
      'Ingår i en mycket större koncern med djup integration mot redovisningsbyråer (Visma Advisor) — starkt val om du redan jobbar nära en byrå som kör Visma.',
      'Bredare produktfamilj (lön, CRM, e-handel m.m.) om verksamheten växer förbi ren bokföring.',
    ],
    faq: [
      { q: 'Är Visma eEkonomi samma sak som Spiris?', a: 'Visma eEkonomi har bytt namn till Spiris. Kontrollera alltid leverantörens egen sida för det aktuella namnet och priset, namnbyten som detta kan ställa till det i äldre jämförelser (inklusive den här).' },
      { q: 'Passar Bokix eller Visma eEkonomi bäst för en enskild firma?', a: 'Om du bara behöver löpande bokföring, fakturering, ett fåtal löner och deklarationsunderlag utan att välja mellan flera nivåer är Bokix (ett pris, allt ingår) ofta enklare. Om du redan jobbar med en redovisningsbyrå som kör Visma kan det vara smidigare att stanna där.' },
    ],
  },
};

export const COMPARISON_LIST = Object.values(COMPARISONS);
