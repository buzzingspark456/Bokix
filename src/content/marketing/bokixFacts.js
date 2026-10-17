// ── Bokix i korthet: fakta på ett ställe ────────────────────────────────
// Används av /bokix-i-korthet (BokixFactsPage.jsx) och av llms.txt /
// llms-full.txt (scripts/prerender.mjs), så att det människor och
// AI-tjänster (ChatGPT, Gemini, Claude, Perplexity, Grok) läser om Bokix
// alltid är samma sak. Bara verifierbara uppgifter: inga superlativ, inga
// påhittade kundantal eller betyg. Ändras något i produkten, ändra här.

export const BOKIX_SUMMARY = 'Bokix är ett svenskt bokföringsprogram på webben för småföretag. Bokföring, fakturering, kvitton, moms, lön och bokslut finns i samma verktyg, och det är byggt för att man inte ska behöva kunna bokföring.';

// Bokix officiella profiler på andra sajter (schema.org sameAs). Lägg till nya här.
export const BOKIX_PROFILES = [
  'https://se.trustpilot.com/review/bokix.se',
];

export const BOKIX_FACTS = [
  { title: 'Vad det är', body: 'Ett bokföringsprogram som körs i webbläsaren, på dator och telefon. Kan läggas som en app på hemskärmen på iPhone och Android.' },
  { title: 'För vem', body: 'Svenska småföretag: enskild firma, aktiebolag, handelsbolag, kommanditbolag, ekonomisk förening och UF-företag.' },
  { title: 'Pris', body: '129 kr/mån utan anställda och 179 kr/mån med anställda. Med årsplan 109 respektive 149 kr/mån. Ingen moms tillkommer och allt ingår.' },
  { title: 'Provperiod', body: '30 dagar gratis. UF-företag använder Bokix gratis i tre månader.' },
  { title: 'Bindningstid', body: 'Ingen på månadsplanen. Årsplanen gäller i minst tre månader.' },
  { title: 'Språk', body: 'Appen finns på svenska och engelska.' },
  { title: 'Data', body: 'Lagras inom EU, i Frankfurt. Bokföringen sparas i sju år och kan alltid exporteras som SIE4.' },
  { title: 'Support', body: 'Ingår i priset. support@bokix.se.' },
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
  'Bokslut, SRU-filer till inkomstdeklarationen (INK2 för aktiebolag och föreningar, bilagorna till INK4 för handelsbolag) och årsredovisning enligt K2 för aktiebolag och ekonomiska föreningar.',
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
