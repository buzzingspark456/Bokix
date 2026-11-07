// ── Textinnehåll för "/" (LandingPage.jsx) per språk. sv är ordagrant
// samma text som redan stod hårdkodad i komponenten (ren extraktion).
// en/no/dk/fi är äkta, varumärkesskrivna texter för läsare som ska driva
// ett SVENSKT bolag men läser på sitt eget språk — samma produkt/regler/
// bolagsformer/myndigheter (Bolagsverket, Skatteverket, SIE4, BAS) på
// alla fem språk, bara orden byts. Bolagsformerna (companyTypes) ger den
// officiella svenska termen i parentes, eftersom de inte har en exakt
// motsvarighet i NO/DK/FI lagstiftning. KRÄVER granskning av en
// modersmålstalare innan lansering för no/dk/fi.
export const LANDING_CONTENT = {
  sv: {
    meta: {
      // Startsidan är Bokix egen sida: namnet först, sedan vad Bokix är.
      title: 'Bokix: enkelt bokföringsprogram för småföretag',
      description: 'Bokix är ett enkelt bokföringsprogram för småföretag. Bokföring, fakturering, kvitton, lön och moms i ett verktyg, för alla bolagsformer. Från 129 kr/mån.',
    },
    schema: {
      orgDescription: 'Bokix är ett svenskt bokföringsprogram på webben för småföretag. Bokföring, fakturering, kvitton, moms, lön och bokslut finns i samma verktyg, och det är byggt för att man inte ska behöva kunna bokföring.',
      softwareDescription: 'Bokföring, fakturering, lönehantering och momsredovisning för svenska företag i alla bolagsformer.',
    },
    hero: {
      titlePrefix: 'För att bokföring',
      titleSuffix: 'ska vara ',
      titleEm: 'enkelt',
      subtitle: 'Bokföringsprogrammet för svenska småföretag, med fakturor, lön, moms och bokslut i ett verktyg.',
      ctaPrimary: 'Prova gratis',
      ctaSecondary: 'Se demo',
    },
    companyTypes: ['Enskild firma', 'Aktiebolag (AB)', 'Handelsbolag / KB', 'Ekonomisk förening', 'Ideell förening / stiftelse'],
    companyTypesHeading: 'Ett bokföringsprogram för alla bolagsformer',
    // Bolagsformer med en egen sida (content/marketing/orgTypes.js).
    companyTypeLinks: {
      'Enskild firma': '/bokforingsprogram-enskild-firma',
      'Aktiebolag (AB)': '/bokforingsprogram-aktiebolag',
      'Handelsbolag / KB': '/bokforingsprogram-handelsbolag',
      'Ekonomisk förening': '/bokforingsprogram-ekonomisk-forening',
      'Ideell förening / stiftelse': '/bokforingsprogram-ideell-forening',
    },
    features: {
      heading: 'Automatiskt, från kvitto till bokslut',
      subheading: 'Du lägger in underlaget. Bokix bokför, räknar moms och lön och säger till när något behöver ditt val.',
      items: [
        { title: 'Bokföring', desc: 'Kvitton och fakturor bokförs direkt. Det Bokix inte är säker på hamnar i Granskning, aldrig en gissning.' },
        { title: 'Fakturor', desc: 'Din logotyp, ROT och RUT, och kunden kan betala med kort.' },
        { title: 'Moms och bokslut', desc: 'Rutorna räknas fram ur bokföringen, och filen är klar att ladda upp.' },
        { title: 'Lön', desc: 'Skatteavdrag, lönebesked med semestersaldo, AGI och betalfil i samma körning.' },
        { title: 'Offerter', desc: 'Blir en faktura med ett klick.' },
        { title: 'Projekt', desc: 'Tid, fakturering och resultat per uppdrag.' },
        { title: 'Lager', desc: 'FIFO, inventering och inventeringslista till bokslutet.' },
        { title: 'Rapporter', desc: 'Resultat, balans och kassaflöde.' },
      ],
      allLink: 'Se alla funktioner i detalj',
    },
    connections: {
      heading: 'Kopplat till tjänsterna du redan använder',
      subheading: 'Betalningar, kassa och myndigheter: Bokix pratar med rätt system istället för att du ska hålla ordning själv.',
      labels: { stripe: 'Kortbetalning och försäljning', zettle: 'Kassaförsäljning', bolagsverket: 'Företagsuppslag', skatteverket: 'Rätt filformat' },
      groups: { Betalningar: 'Betalningar', Myndigheter: 'Myndigheter' },
    },
    trustPoints: ['Byggt efter svensk bokföringslag', 'GDPR', 'BAS-kontoplan'],
    receipts: {
      heading: 'Kvitton läser sig själva',
      subheading: 'Fota kvittot eller ladda upp en bild eller PDF, så läser Bokix av datum, belopp, moms och kvittonummer. Kontot väljer du första gången, sedan fylls det i för samma butik. Inget bokförs förrän du har sett det.',
      cta: 'Testa OCR-läsningen själv',
    },
    bank: {
      heading: 'Banken in i bokföringen',
      subheading: 'Exportera kontoutdraget ur din internetbank och läs in det i Bokix. Inbetalningar matchas mot dina obetalda fakturor, utbetalningar mot leverantörsfakturorna och kortköp mot kvittot, så att inget bokförs två gånger. Du lämnar aldrig ut någon bankinloggning.',
      cta: 'Se hur bankimporten fungerar',
    },
    switchProgram: {
      heading: 'Ta med dig bokföringen hit',
      subheading: 'Bokför du i Fortnox, Visma, Spiris, Bokio, Björn Lundén, Wint eller SpeedLedger? Exportera en SIE4-fil därifrån och läs in den i Bokix. Konton, verifikationer och ingående balanser följer med, och du väljer om allt ska med eller bara ett visst år.',
      cta: 'Se hur bytet går till',
    },
    pricing: {
      heading: 'Ett pris för din situation',
      subheading: 'Samma bokföring och fakturering i båda, skillnaden är om du har personal på lönelistan.',
      monthly: 'Månadsvis',
      yearly: 'Årsplan',
      yearlyBadge: 'spara upp till 360 kr/år',
      freeTrialSuffix: 'gratis i 30 dagar',
      yearlySavingsNote: (kr) => `Dras varje månad · du sparar ${kr} kr per år`,
      cta: 'Skapa konto gratis',
      yearlyMinimumNote: (months) => `Dras varje månad som vanligt. Minst ${months} månader, sedan säger du upp när du vill.`,
      seeAllLink: 'Se allt som ingår →',
    },
    faqTeaser: {
      heading: 'Vanliga frågor',
      subheading: 'Det mesta du undrar över innan du sätter igång.',
      cardTitle: 'Se alla vanliga frågor',
      cardSubtitle: 'Pris, bolagsform, support och mer',
    },
    demoOverlay: {
      ariaLabel: 'Produktdemo',
      title: 'Demo',
      sampleData: 'Exempeldata',
      close: 'Stäng demo',
    },
  },
};
