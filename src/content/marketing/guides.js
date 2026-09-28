// Videoguiderna på /guider: titel, kort beskrivning och längd per film.
// Används av GuidesPage.jsx och av llms-full.txt (scripts/prerender.mjs).
// Filmerna spelas in med scripts/record-guide-videos.mjs; ny guide = post i
// GUIDES där, inspelning, och en rad här.
export const GUIDE_GROUPS = [
  {
    title: 'Sälja och fakturera',
    guides: [
      { slug: 'lagg-upp-kund', title: 'Lägg upp en kund', lead: 'Namn, e-post och organisationsnummer.', duration: 'PT38S' },
      { slug: 'skapa-faktura', title: 'Skapa en faktura', lead: 'Välj kund, skriv vad du sålt. Momsen räknas ut.', duration: 'PT45S' },
      { slug: 'skicka-faktura', title: 'Skicka en faktura', lead: 'Välj mall, skicka med e-post och en Betala nu-knapp via Stripe.', duration: 'PT59S' },
      { slug: 'registrera-betalning', title: 'Registrera en betalning', lead: 'Markera som betald med ett klick, eller registrera en delbetalning.', duration: 'PT40S' },
      { slug: 'skapa-offert', title: 'Skapa en offert', lead: 'Blir det ja gör du om den till en faktura.', duration: 'PT32S' },
      { slug: 'ny-artikel', title: 'Spara en artikel', lead: 'Det du säljer ofta, klart att välja på fakturan.', duration: 'PT29S' },
    ],
  },
  {
    title: 'Kostnader och bokföring',
    guides: [
      { slug: 'ladda-upp-kvitto', title: 'Ladda upp ett kvitto', lead: 'Datum, belopp och moms läses av åt dig.', duration: 'PT32S' },
      { slug: 'ny-verifikation', title: 'Bokför ett köp', lead: 'Utan debet och kredit. Bokix sköter kontona.', duration: 'PT41S' },
    ],
  },
  {
    title: 'Personal och projekt',
    guides: [
      { slug: 'ny-anstalld', title: 'Lägg till en anställd', lead: 'Lön, kommun och skattetabell, sedan kan du köra lön.', duration: 'PT47S' },
      { slug: 'nytt-projekt', title: 'Starta ett projekt', lead: 'Samla tid och fakturor per uppdrag.', duration: 'PT25S' },
    ],
  },
  {
    title: 'Moms och rapporter',
    guides: [
      { slug: 'momsdeklaration', title: 'Gör momsdeklarationen', lead: 'Kontrollera, granska, bokför och lämna in.', duration: 'PT49S' },
      { slug: 'rapporter', title: 'Gå igenom rapporterna', lead: 'Företagsöversikt, resultaträkning, balansräkning, nyckeltal och moms.', duration: 'PT85S' },
    ],
  },
];
