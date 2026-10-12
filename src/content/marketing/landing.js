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
      // Sökordet synligt ovanför rubriken (Google väger text högt upp på sidan).
      eyebrow: 'Bokföringsprogram för småföretag',
      titlePrefix: 'För att bokföring',
      titleSuffix: 'ska vara ',
      titleEm: 'enkelt',
      subtitle: 'Bokix är ett bokföringsprogram med fakturor, löner, moms och bokslut i ett enda verktyg. Byggt för svenska småföretagare som hellre fokuserar på sin verksamhet än sin bokföring.',
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
    },
    features: {
      heading: 'Automatiskt, från kvitto till bokslut',
      subheading: 'Du lägger in underlaget. Bokix bokför, räknar moms och skatt, och håller koll på vad som behöver din uppmärksamhet. Resten sköts i bakgrunden.',
      items: [
        { title: 'Bokföring', desc: 'Kvitton och fakturor blir verifikationer av sig själva. Det osäkra hamnar i Granskning i stället för att gissas.' },
        { title: 'Fakturering', desc: 'Fyra mallar, din logotyp, kortbetalning via Stripe.' },
        { title: 'Skatt och bokslut', desc: 'Moms, AGI och ett bokslut som låser året.' },
        { title: 'Personal', desc: 'Rätt skatteavdrag, lönebesked och betalfil till banken.' },
      ],
      allLink: 'Se alla funktioner i detalj',
    },
    benefits: {
      heading: 'Vad du faktiskt gör i Bokix',
      subheading: 'Allt ingår i priset. Inget kostar extra.',
      items: [
        { title: 'Utgifter och kvitton', desc: 'Fota eller ladda upp kvittot, så läser OCR:en av datum, belopp och moms åt dig. Underlaget sitter kvar på verifikationen.' },
        { title: 'Offerter', desc: 'Blir faktura med ett klick när kunden tackat ja.' },
        { title: 'Projekt', desc: 'Se vilket uppdrag som faktiskt bär sig.' },
        { title: 'Kunder och kontakter', desc: 'Fylls i från organisationsnumret.' },
        { title: 'Rapport och analys', desc: 'Resultat, balans, kassaflöde, huvudbok, nyckeltal.' },
        { title: 'Konto och behörighet', desc: 'Tvåfaktor, tre användare, flera företag.' },
      ],
    },
    connections: {
      heading: 'Kopplat till tjänsterna du redan använder',
      subheading: 'Betalningar, kassa och myndigheter: Bokix pratar med rätt system istället för att du ska hålla ordning själv.',
      labels: { stripe: 'Kortbetalningar', zettle: 'Kassaförsäljning', bolagsverket: 'Företagsuppslag', skatteverket: 'Rätt filformat' },
      groups: { Betalningar: 'Betalningar', Myndigheter: 'Myndigheter' },
    },
    trustPoints: ['Byggt efter svensk bokföringslag', 'GDPR', 'BAS-kontoplan'],
    receipts: {
      heading: 'Kvitton läser sig själva',
      subheading: 'Fota kvittot eller ladda upp en bild eller PDF, så föreslår Bokix datum, belopp, moms och konto automatiskt. Du bekräftar dem. Du gissar aldrig.',
      cta: 'Testa OCR-läsningen själv',
    },
    bank: {
      heading: 'Banken in i bokföringen',
      subheading: 'Exportera kontoutdraget ur din internetbank och läs in det i Bokix. Inbetalningar matchas mot dina obetalda fakturor, utbetalningar mot leverantörsfakturorna. Du lämnar aldrig ut någon bankinloggning.',
      cta: 'Se hur bankimporten fungerar',
    },
    switchProgram: {
      heading: 'Ta med dig bokföringen hit',
      subheading: 'Bokför du i Fortnox, Visma, Spiris, Bokio, Björn Lundén, Wint eller SpeedLedger? Exportera en SIE4-fil därifrån och läs in den i Bokix. Konton, verifikationer och ingående balanser följer med.',
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
