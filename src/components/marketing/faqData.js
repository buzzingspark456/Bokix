// ── FAQ-innehåll, EN källa ──────────────────────────────────────────────
// Flyttad ut ur LandingPage.jsx (där listan tidigare bara låg lokalt) så
// den kan återanvändas av både startsidans FAQ-sektion och den egna
// /vanliga-fragor-sidan (FaqPage.jsx) utan att de två riskerar glida isär
// — samma "en källa"-princip som PRICING_TIERS (pricingTiers.js) och TOOLS
// (tools/toolsConfig.js) redan följer i den här kodbasen.

// Kundönskemål ("fler frågor som bör finnas") — två nya rader tillagda
// (skillnaden mellan nivåerna, support), och prissvaret uppdaterat till de
// två faktiska nivåerna (129/179 kr) istället för det gamla enda priset.
export const FAQ_ITEMS = [
  { q: 'Behöver jag kunna bokföring sedan innan?', a: 'Nej. Verifikationer skapas automatiskt utifrån dina kvitton och fakturor. Det enda som kräver din uppmärksamhet hamnar i Granskning, med tydlig anledning till varför. Resten sköts av Bokix.' },
  { q: 'Fungerar Bokix för min bolagsform?', a: 'Ja. Enskild firma, aktiebolag, handelsbolag/KB, ekonomisk förening och ideell förening/stiftelse: Bokix känner av rätt bolagsform automatiskt utifrån ditt organisationsnummer när du skapar konto.' },
  { q: 'Vad kostar det, och vad ingår?', a: 'Två priser, beroende på om du har personal: 129 kr/mån utan anställda, 179 kr/mån med. Obegränsat med kund- och leverantörsfakturor, fyra fakturamallar med egen logotyp, löpande bokföring och kortbetalningar via Stripe ingår i båda, ingen bindningstid på månadsplanen. Ingen moms tillkommer — Bokix är inte momsregistrerat.' },
  { q: 'Vad är skillnaden mellan de två prisnivåerna?', a: 'Samma bokföring och fakturering i båda. Med personal lägger till lönekörning med automatiskt skatteavdrag, AGI- och kontrolluppgiftssammanställningar samt en betalfil klar att ladda upp till banken: allt du behöver den dagen du har någon anställd.' },
  { q: 'Kan jag ta med mig min bokföring om jag vill byta bort från Bokix senare?', a: 'Ja. Din bokföring går att exportera som SIE4-fil, det standardformat svenska bokföringsprogram och redovisningskonsulter använder för att flytta data mellan system. Din data är aldrig inlåst.' },
  { q: 'Är Bokix anpassat efter svensk bokföringslag och Skatteverkets regler?', a: 'Ja, det är hela utgångspunkten. BAS-kontoplan, momsdeklaration per kvartal (25/12/6 %), AGI- och kontrolluppgiftssammanställningar samt skatteavdrag enligt Skatteverkets egna skattetabeller vid lönekörning.' },
  { q: 'Hur fungerar de 30 dagarna gratis?', a: 'Du lägger in dina betaluppgifter hos Stripe när du skapar konto, men debiteras ingenting under de första 30 dagarna. Avslutar du innan dess kostar det dig aldrig något, annars börjar ditt månadspris dras automatiskt.' },
  { q: 'Ingår support i priset?', a: 'Ja, support ingår i båda nivåerna. Du når oss på support@bokix.se.' },
  // Nio frågor tillagda för att täcka det folk faktiskt söker på (kvitton,
  // bank, byte, moms, lön, ROT/RUT, UF, datalagring, användare). Varje svar
  // bygger på vad som redan står på /funktioner, /sakerhet, /uf,
  // /koppla-bank och /byt-bokforingsprogram — inget nytt löfte här.
  { q: 'Hur läser Bokix av mina kvitton?', a: 'Fota kvittot eller ladda upp en bild eller pdf. Bokix läser texten direkt i webbläsaren och föreslår datum, belopp och momssats, och ett bokföringskonto när handlaren känns igen. Det du ser är alltid ett förslag som du kan ändra, och det som är osäkert hamnar i Granskning i stället för att gissas.' },
  { q: 'Kan jag koppla banken till Bokix?', a: 'Du exporterar kontoutdraget som en fil ur din internetbank och läser in det i Bokix. Raderna matchas mot dina obetalda kund- och leverantörsfakturor. Du behöver aldrig lämna ut några bankuppgifter eller inloggningar.' },
  { q: 'Kan jag byta till Bokix från Fortnox, Visma eller Bokio?', a: 'Ja. Du exporterar en SIE4-fil ur ditt nuvarande program och läser in den i Bokix. Guiden visar vad den hittade, och ingenting skrivs in i bokföringen förrän du bekräftat kontomappningen. Historiken ligger sedan kvar och du bokför vidare löpande.' },
  { q: 'Hur fungerar momsdeklarationen i Bokix?', a: 'Bokix sammanställer momsdeklarationen ruta för ruta, som pdf och som eSKD-fil som du laddar upp hos Skatteverket. Bokix skickar aldrig in något automatiskt åt dig, det är du som lämnar in. Du får också en påminnelse i god tid före varje deadline.' },
  { q: 'Kan Bokix hantera lön och anställda?', a: 'Ja, i nivån med personal. Lönekörningen räknar skatteavdrag enligt Skatteverkets skattetabeller, ger lönebesked som pdf per anställd, beräknar semesteravsättning och arbetsgivaravgifter, och ger en AGI-sammanställning samt en betalfil till banken.' },
  { q: 'Kan jag använda ROT- och RUT-avdrag på fakturorna?', a: 'Ja. ROT- och RUT-avdrag räknas på arbetskostnaden och visas både på fakturan och i underlaget till Skatteverket.' },
  { q: 'Finns det ett gratis alternativ för UF-företag?', a: 'Ja. Bokix har ett eget UF-konto som är gratis i tre månader, utan organisationsnummer och utan betaluppgifter. Menyn innehåller bara det ett UF-företag använder.' },
  { q: 'Var lagras min bokföring, och vem kommer åt den?', a: 'Databasen ligger inom EU (Frankfurt, Tyskland). Varje företags data är avskild på databasnivå, så ingen annan användare kommer åt din bokföring, och du kan slå på tvåstegsverifiering på ditt konto. Mer om detta finns på säkerhetssidan.' },
  { q: 'Kan jag ha flera företag och flera användare?', a: 'Ja. Du kan ha flera företag under samma konto och upp till tre användare.' },
];

// FAQPage-schema byggt direkt av FAQ_ITEMS ovan — samma frågor/svar som
// faktiskt visas, aldrig en egen dubblettlista som kan glida isär från vad
// besökaren ser.
export const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};
