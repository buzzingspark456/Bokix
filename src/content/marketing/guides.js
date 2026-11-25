// Videoguiderna på /guider: titel, kort beskrivning och längd per film.
// Används av GuidesPage.jsx och av llms-full.txt (scripts/prerender.mjs).
// Filmerna spelas in med scripts/record-guide-videos.mjs; ny guide = post i
// GUIDES där, inspelning, och en rad här.
export const GUIDE_UPLOAD_DATE = '2026-10-11';

export const GUIDE_GROUPS = [
  {
    title: 'Sälja och fakturera',
    guides: [
      { slug: 'lagg-upp-kund', seoDescription: 'Så lägger du upp en kund i Bokix: namn, kontaktperson, adress och organisationsnummer, sparat till nästa faktura. Kort video med berättarröst.', title: 'Lägg upp en kund', lead: 'Namn, kontaktperson, adress och organisationsnummer.', duration: 'PT50S' },
      { slug: 'skapa-faktura', seoDescription: 'Så skapar du en faktura i Bokix: välj kund, skriv vad du sålt och momsen räknas ut. Kort video med berättarröst och instruktion steg för steg.', title: 'Skapa en faktura', lead: 'Välj kund, skriv vad du sålt. Momsen räknas ut.', duration: 'PT40S' },
      { slug: 'skicka-faktura', seoDescription: 'Så skickar du en faktura från Bokix med e-post, med egen mall och en Betala nu-knapp för kortbetalning via Stripe. Kort video med berättarröst.', title: 'Skicka en faktura', lead: 'Välj mall, skicka med e-post och en Betala nu-knapp via Stripe.', duration: 'PT53S' },
      { slug: 'registrera-betalning', seoDescription: 'Så registrerar du att en faktura är betald i Bokix, med ett klick eller som delbetalning, och bokföringen görs åt dig. Kort video steg för steg.', title: 'Registrera en betalning', lead: 'Markera som betald med ett klick, eller registrera en delbetalning.', duration: 'PT37S' },
      { slug: 'skapa-offert', seoDescription: 'Så skapar du en offert i Bokix och gör om den till en faktura när kunden säger ja, utan att skriva något två gånger. Kort video med berättarröst.', title: 'Skapa en offert', lead: 'Blir det ja gör du om den till en faktura.', duration: 'PT28S' },
      { slug: 'ny-artikel', seoDescription: 'Så sparar du en artikel i Bokix med pris och moms, så att det du säljer ofta är klart att välja på fakturan och offerten. Kort video steg för steg.', title: 'Spara en artikel', lead: 'Det du säljer ofta, klart att välja på fakturan.', duration: 'PT25S' },
    ],
  },
  {
    title: 'Kostnader och bokföring',
    guides: [
      { slug: 'ladda-upp-kvitto', seoDescription: 'Så laddar du upp ett kvitto i Bokix. Datum, belopp och moms läses av från fotot och kvittot sparas som underlag i sju år. Kort video med berättarröst.', title: 'Ladda upp ett kvitto', lead: 'Datum, belopp och moms läses av åt dig.', duration: 'PT31S' },
      { slug: 'ny-verifikation', seoDescription: 'Så bokför du ett köp i Bokix utan debet och kredit. Du beskriver köpet, Bokix väljer kontona och momsen. Kort video med berättarröst steg för steg.', title: 'Bokför ett köp', lead: 'Utan debet och kredit. Bokix sköter kontona.', duration: 'PT35S' },
    ],
  },
  {
    title: 'Personal och projekt',
    guides: [
      { slug: 'ny-anstalld', seoDescription: 'Så lägger du till en anställd i Bokix med lön, kommun och skattetabell, så att du kan köra lön och få AGI-filen. Kort video med berättarröst.', title: 'Lägg till en anställd', lead: 'Lön, kommun och skattetabell, sedan kan du köra lön.', duration: 'PT36S' },
      { slug: 'nytt-projekt', seoDescription: 'Så startar du ett projekt i Bokix och samlar tid, kostnader och fakturor per uppdrag, så att du ser vad varje jobb ger. Kort video steg för steg.', title: 'Starta ett projekt', lead: 'Samla tid och fakturor per uppdrag.', duration: 'PT22S' },
    ],
  },
  {
    title: 'Moms och rapporter',
    guides: [
      { slug: 'momsdeklaration', seoDescription: 'Så gör du momsdeklarationen i Bokix: kontrollera, granska, bokför och ladda upp filen hos Skatteverket med BankID. Kort video med berättarröst.', title: 'Gör momsdeklarationen', lead: 'Kontrollera, granska, bokför och lämna in.', duration: 'PT47S' },
      { slug: 'rapporter', seoDescription: 'Så läser du rapporterna i Bokix: företagsöversikt, resultaträkning, balansräkning, nyckeltal och moms, förklarade på en minut. Kort video.', title: 'Gå igenom rapporterna', lead: 'Företagsöversikt, resultaträkning, balansräkning, nyckeltal och moms.', duration: 'PT1M7S' },
    ],
  },
];
