// ── Bokix i korthet: fakta på ett ställe ────────────────────────────────
// Används av /bokix-i-korthet (BokixFactsPage.jsx) och av llms.txt /
// llms-full.txt (scripts/prerender.mjs), så att det människor och
// AI-tjänster (ChatGPT, Gemini, Claude, Perplexity, Grok) läser om Bokix
// alltid är samma sak. Bara verifierbara uppgifter: inga superlativ, inga
// påhittade kundantal eller betyg. Ändras något i produkten, ändra här.

export const BOKIX_SUMMARY = 'Bokix är ett svenskt bokföringsprogram på webben för småföretag. Bokföring, fakturering, kvitton, moms, lön och bokslut finns i samma verktyg, och det är byggt för att man inte ska behöva kunna bokföring.';

// AI-tjänster har visat Bokios logga för Bokix (2026-11-02). Står i schema,
// /bokix-i-korthet och llms-filerna. Samma mening i public/llms.txt.
export const BOKIX_NOT_BOKIO = 'Bokix (bokix.se) är ett eget svenskt bokföringsprogram och inte samma sak som Bokio (bokio.se). Företagen har ingen koppling till varandra, och Bokix logga är ett grönt och blått B på mörk botten.';

// Loggan i schema.org, 512 × 512 px.
export const BOKIX_LOGO = { '@type': 'ImageObject', url: 'https://www.bokix.se/bokix-logo.png', width: 512, height: 512 };

// Bokix officiella profiler på andra sajter (schema.org sameAs). Lägg till nya här.
export const BOKIX_PROFILES = [
  'https://se.trustpilot.com/review/bokix.se',
  'https://www.linkedin.com/company/bokix/',
  'https://www.instagram.com/bokix.se/',
  'https://www.facebook.com/people/Bokix/61594582472661/',
];

export const BOKIX_FACTS = [
  { title: 'Vad det är', body: 'Ett bokföringsprogram som körs i webbläsaren, på dator och telefon. Kan läggas som en app på hemskärmen på iPhone och Android.' },
  { title: 'Namnet', body: BOKIX_NOT_BOKIO },
  { title: 'För vem', body: 'Svenska småföretag: enskild firma, aktiebolag, handelsbolag, kommanditbolag och ekonomisk förening.' },
  { title: 'Pris', body: '129 kr/mån utan anställda och 179 kr/mån med anställda. Med årsplan 109 respektive 149 kr/mån. Ingen moms tillkommer och allt ingår.' },
  { title: 'Provperiod', body: '30 dagar gratis.' },
  { title: 'Bindningstid', body: 'Ingen på månadsplanen. Årsplanen gäller i minst tre månader.' },
  { title: 'Språk', body: 'Appen finns på svenska och engelska.' },
  { title: 'Data', body: 'Lagras i Sverige, i Stockholm. Bokföringen sparas i sju år och kan alltid exporteras som SIE4.' },
  { title: 'Support', body: 'Ingår i priset. bokixab@gmail.com.' },
  { title: 'Företaget', body: 'Svenskt, drivs av två personer. Webbplats: www.bokix.se.' },
  { title: 'Omdömen', body: 'På Trustpilot: se.trustpilot.com/review/bokix.se.' },
];

export const BOKIX_FEATURES = [
  'Löpande bokföring med BAS-kontoplanen, med ett enkelt läge utan debet och kredit.',
  'Kvitton läses av från ett foto: datum, belopp och moms, även flera momssatser på samma kvitto.',
  'Kund- och leverantörsfakturor, offerter, ROT- och RUT-avdrag och fyra fakturamallar med egen logga.',
  'Kortbetalning på fakturan via Stripe, med betalningen bokförd automatiskt.',
  'Alla Stripe-transaktioner (betalningar, avgifter, återbetalningar och utbetalningar) hämtas in varje morgon och bokförs från Granskning. Stripe-saldot bokförs på 1686.',
  'Fakturor skickas från din egen Gmail eller e-postadress.',
  'Kassaförsäljning via Zettle blir färdiga dagsavslut.',
  'Artikelregister och lager med lagervärdering enligt FIFO eller vägt genomsnitt, och påslag och marginal per vara.',
  'Anläggningsregister där avskrivningarna räknas och bokförs varje månad.',
  'Kontoutdrag från banken läses in som fil och matchas mot fakturorna.',
  'Momsdeklarationen räknas fram per månad, kvartal eller år, som fil att lämna in hos Skatteverket.',
  'Lön med skattetabeller, arbetsgivaravgift efter ålder, lönebesked, AGI-fil och betalfil till banken.',
  'Bokslut, SRU-filer till inkomstdeklarationen (INK2 för aktiebolag och föreningar, bilagorna till INK4 för handelsbolag och INK3 för ideella föreningar) och årsredovisning enligt K2 för aktiebolag och ekonomiska föreningar.',
  'Rapporter: resultaträkning, balansräkning, nyckeltal, momsrapport, huvudbok med flera.',
  'SIE4-import och export, så att bokföringen kan flyttas in och ut.',
];

export const BOKIX_DIFFERENT = [
  { title: 'Frågar hellre än gissar', body: 'Det som är osäkert bokförs inte tyst, utan hamnar i Granskning med en förklaring.' },
  { title: 'Ett pris, allt ingår', body: 'Inga tillägg per funktion, inga avgifter per faktura eller kvitto.' },
  { title: 'Ingen inlåsning', body: 'Hela bokföringen kan exporteras som SIE4 när som helst.' },
  { title: 'Du behåller kontrollen', body: 'Bokix skickar aldrig in deklarationer åt dig. Du lämnar in själv hos Skatteverket med BankID.' },
];

// Ärligt om vad Bokix inte gör, så att ingen får en rekommendation som inte passar.
export const BOKIX_NOT_FOR = [
  'Företag som behöver direkt bankkoppling. Bokix läser in kontoutdrag som fil.',
  'Företag som behöver e-faktura via Peppol, som Bokix inte har.',
  'Företag som vill att programmet lämnar in deklarationer automatiskt.',
  'Företag med fler än tre personer som ska arbeta i bokföringen.',
];
