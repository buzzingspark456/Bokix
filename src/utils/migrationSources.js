// ── Bokföringsprogram folk faktiskt byter FRÅN till Bokix ────────────
// EN källa för namn, logotyp och "var ligger SIE-exporten i det där
// programmet?" — konsumeras av tre helt olika ytor som annars garanterat
// hade glidit isär:
//
//   1. SieImportModal.jsx (steg 1, "Program") — inloggat importflöde.
//   2. Settings.jsx (Data-fliken) — logotyprad ovanför importknappen.
//   3. marketing/SwitchPage.jsx (/byt-bokforingsprogram) — publik sida.
//
// Listan är MEDVETET bara namn + exportvägledning. Inga påståenden OM
// konkurrenterna (pris, funktioner, "sämre än Bokix") — samma princip
// som AlternativePage.jsx/ChooseSoftwareGuidePage.jsx redan motiverar
// utförligt i sina egna filkommentarer: vi kan inte verifiera deras
// uppgifter, de kan ändra dem när som helst, och jämförande reklam med
// oreviderade sifferpåståenden är juridiskt känsligt (marknadsförings-
// lagen). Att nämna dem vid namn och visa deras logotyp för att förklara
// "byt hit från X" är däremot precis vad en besökare som söker på det
// vill se, och en normal identifierande användning.
//
// Vägledningen nedan är generellt formulerad och AVSIKTLIGT hedgad —
// INTE exakta, garanterat aktuella menyvägar. Varje leverantör kan (och
// kommer) ändra sitt eget gränssnitt; det är ett känt underhållsbehov,
// inte något som går att koda bort. Vägledningen påverkar ALDRIG
// tolkningslogiken i sieImport.js: SIE4 är samma filstandard oavsett
// vilket program som skrev filen, parsern är en enda generell parser och
// vet ingenting om avsändarprogrammet.
//
// Logotypfilerna ligger i public/logos/ (se ProgramLogo i
// shared/BrandLogos.jsx för hur de renderas — samma "gör det inte
// trivialt att dra ut bilden"-hantering som övriga tredjepartsloggor).

export const MIGRATION_SOURCES = [
  {
    id: 'fortnox',
    name: 'Fortnox',
    logo: '/logos/fortnox.svg',
    steps: [
      'Logga in på Fortnox och öppna Bokföring.',
      'Leta upp Arkiv eller Exportera (ofta under ett kugghjul/verktygsmeny i bokföringsvyn).',
      'Välj SIE-export och typ 4 (SIE4), välj räkenskapsår och spara filen.',
    ],
  },
  // Visma och Spiris stod tidigare som två separata rader, vilket såg ut
  // som två konkurrenter men i praktiken var samma väg för de flesta:
  // Spiris är det nya namnet på Visma eEkonomi. Att gissa exakt hur
  // varumärkena är uppdelade idag vore att påstå något vi inte kan
  // verifiera — och för själva SIE-exporten spelar det ingen roll, menyn
  // ser likadan ut. EN rad som täcker båda namnen, med Spiris logotyp
  // (det nuvarande märket) och vägledning som nämner båda.
  {
    id: 'spiris',
    name: 'Visma / Spiris',
    note: 'Spiris hette tidigare Visma eEkonomi',
    logo: '/logos/spiris.png',
    steps: [
      'Logga in på Spiris (tidigare Visma eEkonomi) eller ditt Visma-program och öppna Bokföring/Redovisning.',
      'Leta upp Arkiv eller Import/Export i menyn.',
      'Välj SIE-export, typ 4, och spara filen.',
    ],
  },
  {
    id: 'bokio',
    name: 'Bokio',
    logo: '/logos/bokio.png',
    steps: [
      'Logga in på Bokio och öppna Bokföring.',
      'Leta upp Inställningar eller Exportera i sidomenyn.',
      'Välj SIE-fil (SIE 4), spara filen.',
    ],
  },
  {
    id: 'bjornlunden',
    name: 'Björn Lundén',
    note: 'BL Bokföring / BL Administration',
    logo: '/logos/bjornlunden.png',
    steps: [
      'Öppna BL-programmet och gå till det räkenskapsår du vill flytta med dig.',
      'Leta upp Arkiv eller Import/Export i menyn.',
      'Välj SIE-export, typ 4, och spara filen.',
    ],
  },
  {
    id: 'wint',
    name: 'Wint',
    logo: '/logos/wint.png',
    steps: [
      'Logga in på Wint och öppna bokföringen/rapporterna.',
      'Leta efter Exportera eller SIE under inställningar eller i bokföringsvyn.',
      'Hittar du ingen SIE-export själv: be Wints support om en SIE4-fil för räkenskapsåret. Bokföringen är din, oavsett vem som skött den.',
    ],
  },
  {
    id: 'speedledger',
    name: 'SpeedLedger',
    note: 'e-bokföring',
    logo: '/logos/speedledger.png',
    steps: [
      'Logga in på SpeedLedger e-bokföring.',
      'Öppna Inställningar eller Arkiv och leta upp Export/SIE.',
      'Välj SIE 4 och spara filen.',
    ],
  },
];

// Svaret för "mitt program står inte i listan" — samma text på alla tre
// ytorna, och sant: SIE4 är en branschstandard, inte en integration per
// leverantör.
export const OTHER_PROGRAM_HINT =
  'De flesta svenska bokföringsprogram har ett menyval i stil med "Exportera SIE-fil" under Arkiv eller Inställningar. Leta efter "SIE" eller "Exportera bokföring".';

export const MENU_MOVED_HINT =
  'Hittar du inte exportfunktionen? Sök efter "SIE" eller "Exportera bokföring" i programmets hjälpcenter — menyplaceringen kan ha ändrats sedan den här guiden skrevs.';
