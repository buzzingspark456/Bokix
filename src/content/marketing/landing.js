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
      heading: 'Byggt för dig som inte är ekonom',
      subheading: 'Du behöver inte kunna debet och kredit. Bokix säger vad som ska göras, frågar när något är osäkert och gissar aldrig.',
      items: [
        { title: 'Bokföring', desc: 'Frågar hellre än gissar. Inget bokförs tyst, det osäkra visas för dig med en förklaring.' },
        { title: 'Fakturor', desc: 'Kunden kan betala med kort direkt på fakturan, och betalningen bokför sig själv.' },
        { title: 'Moms och bokslut', desc: 'Siffrorna kommer från bokföringen, inte från en kalkyl du måste dubbelkolla.' },
        { title: 'Lön', desc: 'Hela lönen i en körning. Inget att föra över för hand.' },
        { title: 'Offerter', desc: 'Säger kunden ja blir offerten en faktura med ett klick.' },
        { title: 'Projekt', desc: 'Se vad varje uppdrag tjänar, inte bara vad du fakturerat.' },
        { title: 'Lager', desc: 'Lagervärdet räknas åt dig, klart till bokslutet.' },
        { title: 'Rapporter', desc: 'Startsidan visar hur det går, utan att du öppnar en rapport.' },
      ],
      allLink: 'Se alla funktioner i detalj',
    },
    connections: {
      heading: 'Kopplat till tjänsterna du redan använder',
      subheading: 'Kortbetalningar och kassaförsäljning bokförs av sig själva, företagsuppgifterna hämtas från Bolagsverket och filerna till Skatteverket har rätt format.',
      labels: { stripe: 'Kortbetalning och försäljning', zettle: 'Kassaförsäljning', bolagsverket: 'Företagsuppslag', skatteverket: 'Rätt filformat' },
      groups: { Betalningar: 'Betalningar', Myndigheter: 'Myndigheter' },
    },
    trustPoints: ['Byggt efter svensk bokföringslag', 'GDPR', 'BAS-kontoplan'],
    receipts: {
      heading: 'Kvitton läser sig själva',
      subheading: 'Slipp skriva av kvitton. Fota eller ladda upp en bild eller PDF, så läser Bokix av datum, belopp, moms och kvittonummer. Kontot väljer du första gången, sedan fylls det i för samma butik. Inget bokförs förrän du har sett det.',
      cta: 'Testa med ett eget kvitto',
    },
    bank: {
      heading: 'Läs in kontoutdraget, Bokix matchar resten',
      subheading: 'Exportera kontoutdraget ur din internetbank och läs in det i Bokix. Inbetalningar matchas mot dina obetalda fakturor, utbetalningar mot leverantörsfakturorna och kortköp mot kvittot, så att inget bokförs två gånger. Du lämnar aldrig ut någon bankinloggning.',
      // Grundarens beslut 2026-11-21: säg att direktkopplingen är på gång.
      soon: 'Direkt bankkoppling',
      cta: 'Se hur bankimporten fungerar',
    },
    switchProgram: {
      heading: 'Byt utan att börja om',
      subheading: 'Bokför du i Fortnox, Visma, Spiris, Bokio, Björn Lundén, Wint eller SpeedLedger? Exportera en SIE4-fil därifrån och läs in den i Bokix. Konton, verifikationer och ingående balanser följer med, och du väljer om allt ska med eller bara ett visst år.',
      cta: 'Se hur bytet går till',
    },
    pricing: {
      heading: 'Ett pris, allt ingår',
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
