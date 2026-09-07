import { GRAD } from './aurora';
import { ACCENT } from './marketingTokens';

// ── Delad prisdata — Startsidan (LandingPage.jsx) och prissidan
// (PricingPage.jsx) visade tidigare två OBEROENDE listor över vad som
// ingår, som redan hade börjat glida isär (PricingPage.jsx nämnde bl.a.
// "Granskning" och "PDF-export", Startsidan inte). Samma princip som
// FAQ_SCHEMA redan följer i LandingPage.jsx: EN källa, aldrig en egen
// dubblettlista. Kundönskemål ("se till att prissidan har all
// information") — flyttat hit så båda sidorna alltid visar exakt samma
// två nivåer.
//
// Kundönskemål ("inga påhittade funktioner — vi har INGEN bankkoppling"):
// "Automatisk bokföring med bankkoppling" stod tidigare på båda sidorna —
// fel, Bokix bokför automatiskt utifrån KVITTON och FAKTUROR, ingen
// levande bankkoppling.
export const BASE_FEATURES = [
  'Automatisk bokföring från kvitton och fakturor',
  'Kund- och leverantörsfakturor, obegränsat antal',
  'Fyra fakturamallar med egen logotyp och accentfärg',
  'Momsdeklaration varje kvartal',
  'Bokslutsflöde som låser räkenskapsåret',
  'Kortbetalningar direkt på fakturan via Stripe',
  'SIE4-export — din bokföring är alltid din',
];

// Det som faktiskt skiljer nivåerna åt — bara lön/personal-modulen.
export const EMPLOYER_FEATURES = [
  'Lönekörning med automatiskt skatteavdrag',
  'AGI- och kontrolluppgiftssammanställningar',
  'Betalfil (ISO 20022), klar att ladda upp till banken',
];

// Kundönskemål ("två sorters prissättning, folk vill jämföra") — kunden
// bad mig välja SJÄLVA AXELN (jag rekommenderade "har du anställda eller
// inte", inte ett godtyckligt funktionsavdrag) eftersom det är den enda
// uppdelning som faktiskt är ärlig: lön är den enda modulen en stor del
// av kunderna (enskilda firmor utan personal) aldrig kommer använda.
// Priset på "Utan personal" (129 kr) är kundens egen siffra, inte
// påhittat. 179 kr/mån "Med personal" är OFÖRÄNDRAT — exakt samma pris/
// funktioner som redan stått på sidan, aldrig höjt för att få plats med
// en billigare granne.
export const PRICING_TIERS = [
  {
    key: 'solo',
    name: 'Utan personal',
    subtitle: 'För dig utan anställda',
    price: 129,
    gradient: GRAD.blueTeal,
    // Tema-medvetet CSS-variabel-tema (ljust/mörkt), inte en rå hex från
    // gradienten — samma ACCENT-token FAQ:n och trovärdighetsraden redan
    // använder, så kortets bock-cirklar/badge/kant alltid har rätt kontrast
    // i båda lägen istället för en gradientfärg som råkar funka i ljust läge.
    accent: ACCENT.blue,
    // Kundönskemål ("rekommendation för vilken passar mig") — ärligt
    // grundat i den enda faktiska skillnaden (personal eller inte), inte
    // en påhittad regel om bolagsform. Enskild firma/konsult är bara det
    // vanligaste exemplet på "ingen anställd", inte ett krav.
    recommend: 'Passar dig utan anställda — t.ex. enskild firma eller konsult som fakturerar själv.',
    features: BASE_FEATURES,
    // Kundönskemål ("med den billigare vill man känna att man missar
    // något") — samma tre lönerelaterade rader som "Med personal" har,
    // gråtonade med ett kryss istället för bock. Ärligt (det är exakt
    // vad kunden inte får), inte påhittat för säljtryckets skull.
    missing: EMPLOYER_FEATURES,
  },
  {
    key: 'employer',
    name: 'Med personal',
    subtitle: 'För dig med anställda',
    price: 179,
    gradient: GRAD.tealLime,
    accent: ACCENT.green,
    featured: true,
    recommend: 'Passar dig med anställda — t.ex. ett aktiebolag som kör egen lön.',
    // Kundönskemål ("ha allt i båda, och det extra på den dyrare med") —
    // hela listan (bas + lön) rakt av, inte en förkortad "Allt i Utan
    // personal, plus:"-rad.
    features: [...BASE_FEATURES, ...EMPLOYER_FEATURES],
  },
];
