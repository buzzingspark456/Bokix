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
