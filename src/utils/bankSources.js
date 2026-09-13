// ── Bankerna Bokix läser kontoutdrag från ────────────────────────────────
// EN källa för namn, logotyp och "var ligger exportknappen i den där
// internetbanken?" — exakt samma resonemang som migrationSources.js redan
// gör för bokföringsprogrammen, fast för banker. Konsumeras av tre ytor
// som annars garanterat hade glidit isär:
//
//   1. Bank.jsx (importguidens "Så exporterar du från din bank") — inloggat.
//   2. marketing/BankFlow.jsx — animationen på startsidan och /koppla-bank.
//   3. marketing/BankPage.jsx (/koppla-bank) — den publika bankväljaren.
//
// VIKTIGT om vad listan ÄR och inte är: Bokix har ingen direktkoppling
// (PSD2/open banking) mot någon bank, och listan här är därför INTE en
// lista över "integrationer". Den är en lista över internetbanker vars
// exportfil vi vet att importen läser, plus klickvägen dit. Importen
// (utils/bankImport.js) är en generell CSV/Excel-läsare med
// kolumnmappning — den vet ingenting om avsändarbanken, precis som
// SIE4-parsern inte vet vilket program som skrev filen. En bank som inte
// står i listan fungerar alltså lika bra; det enda som saknas är den
// färdiga klickvägen. Marknadsföringstexterna MÅSTE hålla den linjen:
// säger sajten "koppla din bank" i betydelsen "logga in med BankID i
// Bokix så hämtas transaktionerna" är det ett påstående om en funktion
// som inte finns.
//
// Klickvägarna är KUNDENS EGNA uppgifter (levererade ordagrant), inte
// gissade eller hämtade från bankernas sidor av mig — låg tidigare som
// BANK_EXPORT_PATHS i Bank.jsx och är flyttade hit ORÖRDA. Ändrar en bank
// sin meny räcker det fortfarande att rätta raden på ett ställe.
//
// Logotyperna: bildfilerna ligger i public/logos/banks/ och renderas via
// BankLogo i shared/BrandLogos.jsx. Kunden skickade själv bildkällorna
// (samma beslutsväg som Bolagsverket/Skatteverket/BAS-loggorna, se
// filkommentaren i BrandLogos.jsx). Varje fil är beskuren till märkets
// egen ytterkant — originalen hade vitt luftrum inbakat i olika mängd,
// vilket hade gjort Skandia hälften så stor som Nordea i samma rad utan
// att någon designat det så. `ratio` (bredd/höjd på den BESKURNA filen),
// `scale` och `radius` finns för att loggorna ska väga optiskt lika trots
// att måtten går från 9,7:1 (Handelsbanken, ren ordbild) till 0,97:1
// (Northmill, staplad symbol+ordbild) och trots att två av dem är solida
// färgplattor i stället för fristående märken — se BankLogo för hur de
// används.
//
// Bara identifierande användning: "exportera din fil härifrån", inga
// påståenden OM bankerna, ingen antydan om partnerskap eller godkännande.

export const BANK_SOURCES = [
  {
    id: 'nordea',
    name: 'Nordea',
    logo: '/logos/banks/nordea.png',
    ratio: 498 / 105,
    path: 'Logga in → Konton → Välj konto → Transaktioner → Exportera (CSV)',
  },
  {
    id: 'swedbank',
    name: 'Swedbank',
    logo: '/logos/banks/swedbank.png',
    ratio: 640 / 138,
    path: 'Logga in → Konton → Transaktioner → Exportera kontoutdrag (CSV)',
  },
  {
    id: 'handelsbanken',
    name: 'Handelsbanken',
    logo: '/logos/banks/handelsbanken.png',
    ratio: 640 / 66,
    path: 'Logga in → Konton → Transaktioner → Ladda ner (CSV)',
  },
  {
    id: 'lansforsakringar',
    name: 'Länsförsäkringar',
    logo: '/logos/banks/lansforsakringar.png',
    ratio: 640 / 127,
    path: 'Logga in → Konton → Kontoutdrag → Exportera (CSV)',
  },
  {
    id: 'ica-banken',
    name: 'ICA Banken',
    logo: '/logos/banks/ica-banken.png',
    ratio: 640 / 103,
    path: 'Logga in → Konton → Transaktioner → Exportera till fil (CSV)',
  },
  {
    // Enda staplade lockupen (symbol ÖVER ordbild) i listan — därav
    // scale > 1: en kvadratisk logga som får samma höjdtak som en ren
    // ordbild ser hälften så stor ut fast den tar lika mycket plats.
    id: 'northmill',
    name: 'Northmill',
    logo: '/logos/banks/northmill.png',
    ratio: 473 / 488,
    scale: 1.28,
    path: 'Logga in → Konto → Kontoutdrag → Ladda ner (CSV)',
  },
  // De två sista är SOLIDA färgplattor (vit ordbild ur en fylld
  // fyrkant), inte transparenta ordbilder som de sju ovan — därav
  // `radius`: en knivskarp mättad kvadrat mitt i en vit, rundad bricka
  // läser som ett fel, samma skäl StripeIconLogo redan rundar sitt eget
  // ikonmärke. `scale` av samma skäl som Northmill ovan, fast en aning
  // mer: hela filens yta ÄR märket, men den ytan är kvadratisk — utan
  // bumpen landar de på 62% av brickans HÖJD medan ordbilderna tar 84% av
  // dess BREDD, och de såg ut som frimärken bredvid grannarna.
  {
    id: 'seb',
    name: 'SEB',
    logo: '/logos/banks/seb.png',
    ratio: 640 / 619,
    radius: '15%',
    scale: 1.3,
    path: 'Logga in → Konton → Transaktioner → Exportera (CSV), eller Kontoutdrag → Hämta som fil (CSV)',
  },
  {
    id: 'lunar',
    name: 'Lunar',
    logo: '/logos/banks/lunar.png',
    ratio: 1,
    radius: '15%',
    scale: 1.3,
    path: 'Logga in → Konto → Transaktioner → Exportera (CSV)',
  },
  {
    id: 'danske-bank',
    name: 'Danske Bank',
    logo: '/logos/banks/danske-bank.svg',
    // Ren ordbild, samma kategori som Handelsbanken (9,7:1) — SVG i
    // stället för PNG (enda i listan): filen kom redan tight beskuren till
    // sin egen viewBox (0 0 1920 195) från danskebank.com, ingen
    // rastrering/konvertering behövdes. BankLogo (BrandLogos.jsx) storlekssätter
    // rent via CSS/ratio oavsett filformat, så det är ett drop-in-byte.
    ratio: 1920 / 195,
    // Mättest (Playwright, se PR/commit): utan scale renderas Danske Bank
    // EXAKT lika stor som Handelsbanken (~129×13px, samma ordbildsform,
    // samma 9,7-9,85:1-kvot) — "ser mindre ut"-intrycket är alltså
    // typsnittets STRECKTJOCKLEK, inte storleken. 1.4 är den praktiska
    // taket: brickan klipper/krymper bilden tillbaka oavsett hur mycket
    // högre scale sätts (testat upp till 3, identisk pixelbredd som 1.4).
    // Danske Banks riktiga logotyp är en lång, smal ordbild precis som
    // Handelsbanken — INTE Nordeas kompaktare form — och kan inte bli lika
    // "tjock" som Nordea utan att antingen göra just den här brickan större
    // än de andra eller förvanska det riktiga märket.
    scale: 1.4,
    // Kundens egen uppdatering (2026-09-13), inte längre den generiska
    // gissningen som stod här först. Kortad till klickväg-formen samma
    // sätt som resten av listan.
    path: 'Logga in → Konton → Kontoöversikt → Välj konto → Välj period → Spara (CSV)',
  },
];

// Bankerna som har en bildfil. Just nu ÄR det alla nio, men filtret står
// kvar med flit: nästa bank som läggs till kommer sannolikt in som en rad
// med klickväg innan någon har hittat en logotyp åt den, och då ska
// loggväggen hoppa över den i stället för att rendera en trasig bild.
export const BANK_LOGOS = BANK_SOURCES.filter(b => b.logo);

// Svaret på "min bank står inte med" — samma text överallt, och sant:
// importen är en generell fil-läsare med kolumnmappning, inte en
// integration per bank (se filkommentaren ovan).
export const OTHER_BANK_HINT =
  'Leta efter "Exportera", "Ladda ner" eller "Hämta som fil" i transaktionslistan i din internetbank. Alla filer med en rubrikrad fungerar — kolumnerna kopplas i nästa steg.';

// Klickvägarna är skrivna som "Steg → Steg → Steg" (kundens egen form).
// Marknadssidan renderar dem som brickor med pilar emellan i stället för
// en enda textrad; den här hjälpen finns för att den uppdelningen inte
// ska göras på två ställen med två olika separatorer.
export function splitBankPath(path) {
  return path.split('→').map(s => s.trim()).filter(Boolean);
}

// Filreglerna för uppladdningen. Bodde tidigare i Bank.jsx, flyttade hit
// eftersom /koppla-bank utlovar dem i text ("CSV, TXT, XLSX eller XLS,
// max 10 MB") — och en marknadssida som lovar ett annat tak än det appen
// faktiskt kontrollerar är precis den sortens tysta glidning som en delad
// konstant finns för att förhindra. Reglerna kontrolleras på riktigt i
// handleFile (Bank.jsx), det här är inte bara skyltning.
export const MAX_BANK_FILE_MB = 10;
export const ACCEPTED_BANK_EXTENSIONS = ['.csv', '.txt', '.xlsx', '.xls'];
