// ── Riktiga skärmbilder ur appen på marknadssidorna ─────────────────────
// Sidorna visar produkten mest med ritade demos (HTML/SVG), och sådana kan
// Google bildsök inte indexera. Här står de riktiga bilderna (public/
// screenshots/, tagna med scripts/capture-seo-screenshots.mjs ur demot med
// exempeldata) och vilka sidor som visar dem som <img> med alt-text.
// Ta om bilderna när appen ändrats, filnamnen kan stå kvar.

export const SHOT_WIDTH = 1440;
export const SHOT_HEIGHT = 847;

export const SHOTS = {
  startsida: {
    src: '/screenshots/bokix-startsida-oversikt.jpg',
    alt: 'Startsidan i bokföringsprogrammet Bokix med årets resultat, intäkter och kostnader per månad, en att göra-lista och obetalda fakturor',
    caption: 'Startsidan: resultatet hittills i år, vad som ska göras och vilka fakturor som inte är betalda.',
  },
  granskning: {
    src: '/screenshots/bokix-granskning-kvitton.jpg',
    alt: 'Granskning i Bokix där kvitton som saknar konto väntar på att konteras',
    caption: 'Granskning: det Bokix inte är säker på väntar här i stället för att gissas.',
  },
  stripe: {
    src: '/screenshots/bokix-granskning-stripe.jpg',
    alt: 'Stripe-transaktioner i Bokix: Stripes avgift för en kortbetalning, en utbetalning till banken och en försäljning där momssats och intäktskonto väljs',
    caption: 'Stripe i Granskning: avgifter och utbetalningar bokförs med ett klick, försäljningen väljer du momssats för.',
  },
  zettle: {
    src: '/screenshots/bokix-granskning-zettle.jpg',
    alt: 'Kassaförsäljning från Zettle i Bokix med kortköp, kontantköp och en återbetalning att bokföra',
    caption: 'Zettle i Granskning: varje köp i kassan blir en försäljning att bokföra.',
  },
  kunder: {
    src: '/screenshots/bokix-kunder.jpg',
    alt: 'Kundregistret i Bokix med organisationsnummer, kontaktperson, senaste faktura och fakturerat belopp i år',
    caption: 'Kunder: uppgifterna hämtas från organisationsnumret.',
  },
  artiklar: {
    src: '/screenshots/bokix-artiklar-lager.jpg',
    alt: 'Artikelregistret i Bokix med artikelnummer, pris och momssats för varje artikel',
    caption: 'Artiklar: pris och moms följer med till offerten och fakturan.',
  },
  offerter: {
    src: '/screenshots/bokix-offerter.jpg',
    alt: 'Offerter i Bokix med status skickad, accepterad och avböjd',
    caption: 'Offerter: en accepterad offert blir en faktura med ett klick.',
  },
  kundfakturor: {
    src: '/screenshots/bokix-kundfakturor.jpg',
    alt: 'Kundfakturor i Bokix med förfallodatum, belopp och status betald, obetald eller förfallen',
    caption: 'Kundfakturor: se direkt vad som är betalt och vad som har förfallit.',
  },
  kvitton: {
    src: '/screenshots/bokix-kvitton.jpg',
    alt: 'Kvitton i Bokix med inköpsställe, belopp, moms och konto för varje kvitto',
    caption: 'Kvitton: fotat underlag med datum, belopp, moms och konto.',
  },
  leverantorsfakturor: {
    src: '/screenshots/bokix-leverantorsfakturor.jpg',
    alt: 'Leverantörsfakturor i Bokix med förfallodatum och status',
    caption: 'Leverantörsfakturor: det du ska betala, på samma ställe som det du ska få in.',
  },
  bank: {
    src: '/screenshots/bokix-bank-kontoutdrag.jpg',
    alt: 'Bankavstämning i Bokix där rader från kontoutdraget matchas mot fakturor och bokförs',
    caption: 'Bank: raderna från kontoutdraget matchas mot fakturor och verifikationer.',
  },
  bokforing: {
    src: '/screenshots/bokix-bokforing-verifikationer.jpg',
    alt: 'Verifikationer i Bokix grupperade per månad med verifikationsnummer, datum och belopp',
    caption: 'Bokföring: alla verifikationer, per månad och serie.',
  },
  rapporter: {
    src: '/screenshots/bokix-rapporter-resultat.jpg',
    alt: 'Rapport och analys i Bokix: resultaträkning, balansräkning, kassaflödesanalys, nyckeltal och bokslutsrapporter',
    caption: 'Rapporter: resultat, balans, huvudbok och nyckeltal.',
  },
  skatt: {
    src: '/screenshots/bokix-skatt-och-bokslut.jpg',
    alt: 'Skatt och bokslut i Bokix med en att göra-lista: momsdeklaration, årsbokslut och inkomstdeklaration med sista datum',
    caption: 'Skatt och bokslut: allt som ska lämnas in, med datum.',
  },
  moms: {
    src: '/screenshots/bokix-momsdeklaration.jpg',
    alt: 'Momsdeklarationen i Bokix i fyra steg: kontrollera, granska, bokför och lämna in',
    caption: 'Momsdeklarationen räknas fram ur bokföringen, steg för steg.',
  },
  projekt: {
    src: '/screenshots/bokix-projekt.jpg',
    alt: 'Projekt i Bokix med nedlagd tid mot budget och lönsamhet per projekt',
    caption: 'Projekt: se vilket uppdrag som bär sig.',
  },
  lon: {
    src: '/screenshots/bokix-anstallda-och-lon.jpg',
    alt: 'Anställda och lön i Bokix med anställda, anställningsdatum, månadslön och flikar för lönekörningar och semester',
    caption: 'Anställda och lön: lönekörning, lönebesked och AGI.',
  },
  sakerhet: {
    src: '/screenshots/bokix-sakerhet-inloggning.jpg',
    alt: 'Säkerhetsinställningarna i Bokix med lösenord, tvåfaktorsautentisering, aktiva sessioner och krav på tvåstegsverifiering för alla användare',
    caption: 'Säkerhet: tvåfaktor, aktiva sessioner och krav på tvåstegsverifiering för hela företaget.',
  },
  installningar: {
    src: '/screenshots/bokix-installningar.jpg',
    alt: 'Import och export i Bokix: flytta hit bokföringen med en SIE4-fil från Fortnox, Visma, Bokio, Björn Lundén, Wint eller SpeedLedger',
    caption: 'Import och export: flytta hit bokföringen med en SIE4-fil, och ta med den ut igen.',
  },
};

// Sökväg → bilder som visas på sidan, i ordning.
export const PAGE_SHOTS = {
  '/funktioner': ['bokforing', 'kundfakturor', 'kvitton', 'moms', 'bank', 'rapporter', 'lon', 'projekt'],
  '/faktureringsprogram': ['kundfakturor', 'offerter'],
  '/bokforingsprogram-med-lager': ['artiklar'],
  '/billigt-bokforingsprogram': ['kvitton'],
  '/bokforingsprogram-nystartat-foretag': ['granskning'],
  '/alternativ-till-fortnox': ['bokforing'],
  '/bokforingsprogram-enskild-firma': ['skatt'],
  '/bokforingsprogram-aktiebolag': ['rapporter'],
  '/bokforingsprogram-handelsbolag': ['leverantorsfakturor'],
  '/bokforingsprogram-ekonomisk-forening': ['kunder'],
  '/integrationer': ['stripe', 'zettle'],
  '/koppla-bank': ['bank'],
  '/lon': ['lon'],
  '/byt-bokforingsprogram': ['installningar'],
};

export function shotsFor(path) {
  return (PAGE_SHOTS[path] || []).map(key => SHOTS[key]).filter(Boolean);
}
