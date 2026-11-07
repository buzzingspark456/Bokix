// ── Bokföringsprogram per bolagsform ───────────────────────────────────
// En landningssida per bolagsform (/bokforingsprogram-enskild-firma osv.),
// renderad av OrgTypePage.jsx. Varje sida svarar på en egen sökning
// ("bokföringsprogram för aktiebolag") och visar Google att sajten handlar
// om bokföringsprogram. Samma idé som Lumion och Bokio.
//
// Bara sådant Bokix faktiskt gör (se bokixFacts.js och Taxes.jsx):
//  - NE-bilagan finns bara för enskild firma, med förslag ur bokföringen.
//  - INK2 (med SRU-fil) för aktiebolag och ekonomisk förening.
//  - Handels- och kommanditbolag: ingen INK2. Bilagorna till INK4 (INK4R,
//    INK4S och INK4DU per delägare) som SRU-fil; delägarna deklarerar sin
//    andel själva (N3A). Själva INK4 fylls i Skatteverkets e-tjänst.
//  - Årsredovisning enligt K2 för aktiebolag och ekonomisk förening, som PDF
//    att skriva under (föreningen med medlemsinsatser och föreningsstämma).
//    Bokix lämnar inte in något till Bolagsverket eller Skatteverket.
//  - Ideell förening och stiftelse: bokföring, moms, lön, årsbokslut och
//    bilagorna till INK3 (INK3R, INK3S, INK3SUF och INK3SUS) som SRU-fil.

const PRICE = '129 kr/mån utan anställda och 179 kr/mån med anställda. Ingen moms tillkommer och allt ingår.';

export const ORG_TYPE_PAGES = [
  {
    slug: 'enskild-firma',
    video: { title: 'Så fungerar Bokix för enskild firma', description: 'Ett kvitto läses av och bokförs, och NE-bilagan fylls i med förslag ur bokföringen.', date: '2026-10-17' },
    path: '/bokforingsprogram-enskild-firma',
    short: 'Enskild firma',
    seoTitle: 'Bokföringsprogram för enskild firma, från 129 kr/mån | Bokix',
    seoDescription: 'Bokix är ett enkelt bokföringsprogram för enskild firma. Kvitton, fakturor, moms och NE-bilaga i ett verktyg. 30 dagar gratis, sedan 129 kr/mån.',
    eyebrow: 'Bokföringsprogram för enskild firma',
    title: 'Bokföringsprogram för enskild firma',
    lead: 'Fota kvittot och skicka fakturan. När året är slut får du förslag till NE-bilagan.',
    highlights: ['Kvitton läses av från ett foto', 'Fakturor med egen logga', 'Momsdeklaration som fil', 'Förslag till NE-bilagan'],
    included: [
      'Löpande bokföring i ett enkelt läge, där du väljer vad som hänt i stället för konton.',
      'Kvitton läses av från ett foto: datum, belopp och moms, även flera momssatser på samma kvitto.',
      'Fakturor och offerter med din logga och ROT- och RUT-avdrag. Kortbetalning via Stripe finns om du vill.',
      'Momsdeklarationen räknas fram per månad, kvartal eller år, som fil att lämna in hos Skatteverket.',
      'NE-bilagan med förslag på beloppen ur bokföringen, som du stämmer av och lämnar in själv.',
      'Egna uttag och insättningar bokförs rätt mot eget kapital, utan att du behöver veta kontonumren.',
    ],
    steps: [
      { title: 'Skapa kontot med organisationsnumret', body: 'Bokix hämtar företagets uppgifter och väljer räkenskapsår och momsperiod åt dig. Det tar några minuter.' },
      { title: 'Lägg in kvitton och fakturor löpande', body: 'Fota kvittot eller skicka fakturan från Bokix. Det som är osäkert hamnar i Att granska i stället för att gissas.' },
      { title: 'Deklarera moms och gör bokslutet', body: 'Momsen och NE-bilagan räknas fram ur bokföringen. Du laddar ned filerna och lämnar in hos Skatteverket med BankID.' },
    ],
    facts: [
      { title: "Du och firman är samma person", body: "En enskild firma är ingen egen juridisk person. Överskottet beskattas hos dig som inkomst av näringsverksamhet, och det redovisas på NE-bilagan i din egen deklaration." },
      { title: "Egenavgifter i stället för arbetsgivaravgift", body: "Du betalar egenavgifter på överskottet, inte arbetsgivaravgift på en lön. Räkna på vad som blir kvar i egenavgiftskalkylatorn." },
      { title: "Förenklat årsbokslut räcker oftast", body: "Är omsättningen normalt högst 3 miljoner kr räcker ett förenklat årsbokslut. Det sparas med bokföringen och är underlaget för NE-bilagan." },
    ],
    faq: [
      { q: 'Behöver jag ett bokföringsprogram för enskild firma?', a: 'Alla enskilda firmor är bokföringsskyldiga. Ett bokföringsprogram är inget krav, men det gör jobbet mycket enklare: momsen och NE-bilagan räknas fram ur det du redan bokfört, och kvitton och fakturor sparas på samma ställe.' },
      { q: 'Fyller Bokix i NE-bilagan?', a: 'Bokix ger förslag på beloppen i NE-bilagan utifrån bokföringen. Du stämmer av dem och lämnar in själv hos Skatteverket. Bokix skickar aldrig in något åt dig.' },
      { q: 'Vad kostar Bokix för en enskild firma?', a: PRICE + ' De första 30 dagarna är gratis och det finns ingen bindningstid på månadsplanen.' },
      { q: 'Kan jag räkna ut mina egenavgifter?', a: 'Ja, med den fria egenavgiftskalkylatorn på bokix.se/verktyg/egenavgifter kan du se vad som blir kvar efter egenavgifter och skatt.' },
    ],
    related: [
      { label: 'Enskild firma: bokföring, egenavgifter och NE-bilaga', to: '/blogg/enskild-firma-bokforing-ne' },
      { label: 'Egenavgiftskalkylator', to: '/verktyg/egenavgifter' },
    ],
    // Produktsidan (2026-11-07): riktiga bilder ur appen, se productKit.jsx.
    product: {
      h1Tail: 'Kvitton, fakturor och NE-bilagan i ett program.',
      lead: 'Fota kvittot och skicka fakturan under året. När året är slut räknar Bokix fram momsen och ger förslag till NE-bilagan.',
      heroTabs: [
        { label: 'Översikt', shot: 'start', caption: 'Startsidan: resultat, pengar på banken och det som ska göras härnäst.' },
        { label: 'Kvitton', shot: 'kvitton', caption: 'Kvittona med vad som är bokfört och vad som behöver granskas.' },
        { label: 'Fakturor', shot: 'kundfakturor', caption: 'Kundfakturorna med vad som är obetalt och vad som har förfallit.' },
        { label: 'Moms', shot: 'moms', caption: 'Momsdeklarationen fylls i ur bokföringen, ruta för ruta.' },
        { label: 'NE-bilaga', shot: 'ef-ne', caption: 'NE-bilagan förifylld ur bokföringen, som SRU-fil och PDF.' },
      ],
      reasonsTitle: 'Därför passar Bokix en enskild firma',
      reasons: [
        { title: 'Du behöver inte kunna debet och kredit', body: 'I det enkla läget väljer du vad som hänt, till exempel en försäljning eller ett köp. Bokix väljer konton.' },
        { title: 'Egna uttag bokförs rätt', body: 'Pengar du tar ut eller sätter in själv bokförs mot eget kapital, utan att du behöver kunna kontonumren.' },
        { title: 'NE-bilagan ur bokföringen', body: 'När bokslutet är klart föreslår Bokix beloppen i NE-bilagan. Du kontrollerar och lämnar in.' },
      ],
      featuresTitle: 'Det här gör du i Bokix',
      features: [
        { kicker: 'Kvitton', title: 'Fota kvittot, resten fylls i', shot: 'kvitton-c', body: 'Datum, belopp och moms läses av från fotot. Det som är osäkert hamnar i Att granska i stället för att gissas.', points: ['Flera momssatser på samma kvitto', 'Foto, PDF eller en hel mapp på en gång', 'Kvittot sparas med verifikationen i sju år'] },
        { kicker: 'Fakturering', title: 'Fakturor med din logga', shot: 'kundfakturor-c', body: 'Skicka fakturan med e-post från Bokix. När kunden betalar bokförs betalningen mot fakturan.', points: ['ROT- och RUT-avdrag på fakturan', 'Bankgiro och OCR-nummer på fakturan', 'Påminnelse när fakturan har förfallit'] },
        { kicker: 'Moms', title: 'Momsdeklarationen räknas fram', shot: 'moms-c', body: 'Rutorna fylls i ur bokföringen. Du kontrollerar, granskar och bokför, och laddar ner filen till Skatteverket.', points: ['Per år, kvartal eller månad', 'Kontroll av perioden innan du lämnar in', 'Momsen bokförs mot skattekontot'] },
        { kicker: 'Deklaration', title: 'NE-bilagan ur bokföringen', shot: 'ef-ne-c', body: 'Bokix fyller i det som går från bokföringen. Du skriver över ett fält om det är fel och laddar ner filen.', points: ['SRU-fil att läsa in hos Skatteverket', 'PDF att kontrollera siffrorna mot', 'Du lämnar in med BankID, som privatperson'] },
        { kicker: 'Översikt', title: 'Alla datum på ett ställe', shot: 'ef-skatt-c', body: 'Under Skatt och bokslut ser du vad som ska lämnas in härnäst och hur långt du har kommit.', points: ['Moms, årsbokslut och NE-bilaga i ordning', 'Dagar kvar till varje datum', 'Ett klick till rätt steg'] },
      ],
      year: {
        title: 'Ditt år med enskild firma',
        lead: 'Det här ska göras under ett vanligt år. Bokix visar dina egna datum under Skatt och bokslut.',
        every: 'Preliminärskatten (F-skatt) dras från skattekontot den 12:e, i januari och augusti den 17:e.',
        quarters: [
          { label: 'Januari–mars', events: [
            { date: 'Januari', title: 'Bokslut för förra året', bokix: 'Årsbokslutet steg för steg: bank, kundfakturor, leverantörer, periodisering och lager.', key: true },
          ] },
          { label: 'April–juni', events: [
            { date: '2 maj', title: 'Inkomstdeklaration 1 med NE-bilaga', bokix: 'Förslag på beloppen, SRU-fil och PDF. Du lämnar in med BankID.', key: true },
            { date: '12 maj', title: 'Moms för hela förra året', bokix: 'Deklarationen fylls i ur bokföringen.', key: true },
          ] },
          { label: 'Juli–september', events: [], empty: 'Löpande bokföring: kvitton, fakturor och bank.' },
          { label: 'Oktober–december', events: [
            { date: '31 december', title: 'Räkenskapsåret slutar', bokix: 'En enskild firma har nästan alltid kalenderår. Året låses när bokslutet är klart.' },
          ] },
        ],
        note: 'Exemplet gäller moms per år, som är vanligt när omsättningen är högst en miljon kronor. Infaller ett datum på en helg flyttas det till nästa vardag.',
      },
      compare: {
        title: 'Själv, med byrå eller med Bokix',
        lead: 'En byrå passar om du vill lämna bort allt. Bokix passar om du vill ha koll själv och betala lite.',
        cols: ['I Excel', 'Med redovisningsbyrå', 'Med Bokix'],
        rows: [
          ['Kostnad', 'Inget program, men mycket tid', 'Arvode per timme eller månad', '129 kr/mån'],
          ['Kvitton', 'Sparas i en pärm eller mapp', 'Skickas till byrån', 'Fotas och läses av, sparas i sju år'],
          ['Moms', 'Du räknar och fyller i själv', 'Byrån gör det', 'Räknas fram ur bokföringen, du lämnar in'],
          ['NE-bilagan', 'Du räknar fram beloppen själv', 'Byrån gör det', 'Förslag ur bokföringen, som SRU-fil'],
          ['Koll på siffrorna', 'När du själv har uppdaterat', 'När byrån har skickat rapporten', 'Hela tiden, på startsidan'],
        ],
      },
      price: { amount: '129 kr', unit: '/mån', text: 'Allt ovan ingår. 179 kr/mån om du har anställda. 109 respektive 149 kr/mån med årsplan. Ingen moms tillkommer. 30 dagar gratis.' },
    },
  },
  {
    slug: 'aktiebolag',
    video: { title: 'Så fungerar Bokix för aktiebolag', description: 'Resultaträkningen blir INK2 och en årsredovisning enligt K2 som styrelsen skriver under.', date: '2026-10-17' },
    path: '/bokforingsprogram-aktiebolag',
    short: 'Aktiebolag',
    seoTitle: 'Bokföringsprogram för aktiebolag, från 129 kr/mån | Bokix',
    seoDescription: 'Bokix är ett enkelt bokföringsprogram för aktiebolag. Fakturor, moms, lön, INK2 och årsredovisning enligt K2 i ett verktyg. 30 dagar gratis.',
    eyebrow: 'Bokföringsprogram för aktiebolag',
    title: 'Bokföringsprogram för aktiebolag',
    lead: 'Fakturor, lön och moms under året. INK2 och årsredovisning när året är slut.',
    highlights: ['Lön med AGI-fil', 'INK2 med SRU-fil', 'Årsredovisning enligt K2', 'Utdelning bokförd rätt'],
    included: [
      'Löpande bokföring med BAS-kontoplanen, med ett enkelt läge för dig som inte kan debet och kredit.',
      'Kund- och leverantörsfakturor och offerter. Kortbetalning via Stripe finns om du vill.',
      'Lön med skattetabeller, arbetsgivaravgift efter ålder, lönebesked, AGI-fil och betalfil till banken.',
      'Momsdeklarationen per månad, kvartal eller år, som fil att lämna in hos Skatteverket.',
      'Bokslut och INK2 med SRU-fil till inkomstdeklarationen.',
      'Årsredovisning enligt K2 som PDF att skriva under, och utdelning som bokförs mot rätt konton.',
    ],
    steps: [
      { title: 'Skapa kontot med organisationsnumret', body: 'Bokix hämtar bolagets uppgifter från Bolagsverket och väljer räkenskapsår och momsperiod åt dig.' },
      { title: 'Bokför löpande under året', body: 'Kvitton läses av, fakturor bokförs när de skickas och betalas, och lönen bokförs när du kört den.' },
      { title: 'Gör bokslut och årsredovisning', body: 'Bokix räknar fram INK2 och årsredovisningen. Du granskar, skriver under och lämnar in själv.' },
    ],
    facts: [
      { title: "Bolaget är en egen juridisk person", body: "Aktiebolaget betalar bolagsskatt och lämnar en egen inkomstdeklaration, INK2. Du tar ut pengar som lön eller utdelning." },
      { title: "Årsredovisning inom sju månader", body: "Årsredovisningen ska vara hos Bolagsverket senast sju månader efter räkenskapsårets slut. Bolagsstämman hålls senast sex månader efter." },
      { title: "Utdelning beslutas på stämman", body: "Utdelningen beslutas på bolagsstämman och bokförs som en skuld tills den betalas ut. Hur mycket som beskattas som kapital avgörs av gränsbeloppet enligt 3:12." },
    ],
    faq: [
      { q: 'Vilket bokföringsprogram passar ett litet aktiebolag?', a: 'Ett som klarar hela året: fakturor, moms, lön och bokslut med INK2 och årsredovisning. Bokix har allt det i samma pris, utan tillägg per funktion.' },
      { q: 'Gör Bokix årsredovisningen?', a: 'Ja, för aktiebolag enligt K2. Du får en PDF att skriva under. Bokix lämnar inte in den till Bolagsverket, det gör du själv.' },
      { q: 'Vad kostar Bokix för ett aktiebolag?', a: PRICE + ' Med årsplan 109 respektive 149 kr/mån. De första 30 dagarna är gratis.' },
      { q: 'Kan jag räkna på lön eller utdelning?', a: 'Ja. Utdelningskalkylatorn räknar gränsbeloppet enligt 3:12-reglerna, och i Bokix bokförs beslutad utdelning mot rätt konton.' },
    ],
    related: [
      { label: 'Lön eller utdelning i aktiebolag: så väljer du', to: '/blogg/lon-eller-utdelning-ab' },
      { label: 'Utdelningskalkylator 2026', to: '/verktyg/utdelning' },
    ],
    // Produktsidan (2026-11-07): riktiga bilder ur appen, se productKit.jsx.
    product: {
      h1Tail: 'Hela bolagets år i ett program.',
      lead: 'Fakturor, lön och moms under året. Bokslut, INK2 och årsredovisning när året är slut. Bokix räknar fram siffrorna, du granskar och lämnar in.',
      heroTabs: [
        { label: 'Översikt', shot: 'start', caption: 'Startsidan: resultat, pengar på banken och det som ska göras härnäst.' },
        { label: 'Fakturor', shot: 'kundfakturor', caption: 'Kundfakturorna med vad som är obetalt och vad som har förfallit.' },
        { label: 'Moms', shot: 'moms', caption: 'Momsdeklarationen fylls i ur bokföringen, ruta för ruta.' },
        { label: 'Lön', shot: 'lonekorning-ny', caption: 'En lönekörning för alla anställda, med skatt och arbetsgivaravgift uträknade.' },
        { label: 'INK2', shot: 'ink2', caption: 'Inkomstdeklaration 2 med räkenskapsschemat ifyllt ur bokföringen.' },
      ],
      reasonsTitle: 'Därför passar Bokix ett aktiebolag',
      reasons: [
        { title: 'Lön och utdelning i samma program', body: 'Lönekörningen ger AGI-fil och betalfil. Utdelningen som stämman beslutar bokförs som skuld tills den betalas ut.' },
        { title: 'Bokslutet i fyra steg', body: 'Årsbokslut, årsredovisning, utdelning och INK2 i ordning, och Bokix visar vad som saknas innan du går vidare.' },
        { title: 'Bolaget hämtas från Bolagsverket', body: 'Skriv organisationsnumret, så fylls namn och adress i. Räkenskapsår och momsperiod väljs när kontot skapas.' },
      ],
      featuresTitle: 'Det här gör du i Bokix',
      features: [
        { kicker: 'Fakturering', title: 'Fakturera och få betalt', shot: 'kundfakturor-c', body: 'Skicka fakturan med e-post direkt från Bokix. När kunden betalar bokförs betalningen mot fakturan.', points: ['Offerten blir en faktura när kunden säger ja', 'Bankgiro och OCR-nummer på fakturan', 'Påminnelse när fakturan har förfallit'] },
        { kicker: 'Moms', title: 'Momsdeklarationen räknas fram', shot: 'moms-c', body: 'Rutorna fylls i ur bokföringen. Du kontrollerar, granskar och bokför, och laddar ner filen till Skatteverket.', points: ['Per månad, kvartal eller år', 'Kontroll av perioden innan du lämnar in', 'Momsen bokförs mot skattekontot'] },
        { kicker: 'Lön', title: 'Lön utan lönebyrå', shot: 'lonekorning-ny-c', body: 'Välj månad och utbetalningsdag. Bokix räknar skatt och arbetsgivaravgift för varje anställd och bokför lönen.', points: ['Skattetabeller och arbetsgivaravgift efter ålder', 'Lönebesked till de anställda', 'AGI-fil och betalfil till banken'] },
        { kicker: 'Deklaration', title: 'INK2 ur bokföringen', shot: 'ink2-c', body: 'Balans- och resultaträkningen hämtas från bokföringen. Du fyller bara i det som gäller bolagets skatt.', points: ['Räkenskapsschemat ifyllt rad för rad', 'SRU-fil och Skatteverkets blankett ifylld', 'Det som behöver kontrolleras markeras'] },
        { kicker: 'Årsredovisning', title: 'Årsredovisning enligt K2', shot: 'arsredovisning-c', body: 'Siffrorna kommer från bokslutet. Du skriver förvaltningsberättelsen och vinstdispositionen, och får en PDF att skriva under.', points: ['Förvaltningsberättelse med förslag ur bokföringen', 'Vinstdisposition och underskrifter', 'PDF som styrelsen skriver under'] },
      ],
      year: {
        title: 'Ditt år som aktiebolag',
        lead: 'Det här ska göras under ett vanligt år. Bokix visar dina egna datum under Skatt och bokslut.',
        every: 'Lön och arbetsgivardeklaration. Den lämnas och betalas den 12:e månaden efter löneutbetalningen, i januari och augusti den 17:e.',
        quarters: [
          { label: 'Januari–mars', events: [
            { date: 'Januari', title: 'Bokslut för förra året', bokix: 'Årsbokslutet steg för steg: bank, kundfakturor, leverantörer, periodisering och lager.', key: true },
            { date: '12 februari', title: 'Moms för oktober–december', bokix: 'Deklarationen fylls i ur bokföringen.' },
          ] },
          { label: 'April–juni', events: [
            { date: '12 maj', title: 'Moms för januari–mars', bokix: 'Deklarationen fylls i ur bokföringen.' },
            { date: 'Senast 30 juni', title: 'Bolagsstämma', bokix: 'Stämman fastställer årsredovisningen och beslutar om utdelning, som Bokix bokför.', key: true },
          ] },
          { label: 'Juli–september', events: [
            { date: 'Senast 31 juli', title: 'Årsredovisningen till Bolagsverket', bokix: 'PDF enligt K2. Du lämnar in den själv.', key: true },
            { date: '1 augusti', title: 'Inkomstdeklaration 2', bokix: 'SRU-fil och blankett ifylld. Datumet gäller när du lämnar in digitalt.', key: true },
            { date: '17 augusti', title: 'Moms för april–juni', bokix: 'Deklarationen fylls i ur bokföringen.' },
          ] },
          { label: 'Oktober–december', events: [
            { date: '12 november', title: 'Moms för juli–september', bokix: 'Deklarationen fylls i ur bokföringen.' },
            { date: '31 december', title: 'Räkenskapsåret slutar', bokix: 'Året låses när bokslutet är klart, så att inget ändras i efterhand.' },
          ] },
        ],
        note: 'Exemplet gäller räkenskapsår som kalenderår och moms per kvartal. Infaller ett datum på en helg flyttas det till nästa vardag.',
      },
      compare: {
        title: 'Själv, med byrå eller med Bokix',
        lead: 'En byrå passar om du vill lämna bort allt. Bokix passar om du vill ha koll själv och betala lite.',
        cols: ['I Excel', 'Med redovisningsbyrå', 'Med Bokix'],
        rows: [
          ['Kostnad', 'Inget program, men mycket tid', 'Arvode per timme eller månad', '129 kr/mån, 179 kr/mån med anställda'],
          ['Moms och AGI', 'Du räknar och fyller i själv', 'Byrån gör det', 'Räknas fram ur bokföringen, du lämnar in'],
          ['Bokslut, INK2 och årsredovisning', 'Svårt utan förkunskaper', 'Byrån gör det', 'Steg för steg, med PDF och SRU-fil'],
          ['Koll på siffrorna', 'När du själv har uppdaterat', 'När byrån har skickat rapporten', 'Hela tiden, på startsidan'],
          ['Vem som gör jobbet', 'Du', 'Byrån', 'Du, och du kan bjuda in din konsult'],
        ],
      },
      price: { amount: '129 kr', unit: '/mån', text: 'Allt ovan ingår. 179 kr/mån med anställda, 109 respektive 149 kr/mån med årsplan. Ingen moms tillkommer. 30 dagar gratis.' },
    },
  },
  {
    slug: 'handelsbolag',
    video: { title: 'Så fungerar Bokix för handelsbolag', description: 'Årets resultat delas på delägarna, och var och en får sin bilaga INK4DU.', date: '2026-10-17' },
    path: '/bokforingsprogram-handelsbolag',
    short: 'Handelsbolag och KB',
    seoTitle: 'Bokföringsprogram för handelsbolag och KB | Bokix',
    seoDescription: 'Bokix är ett enkelt bokföringsprogram för handelsbolag och kommanditbolag. Fakturor, moms, lön och INK4 med delägaruppgifter i ett verktyg. 30 dagar gratis.',
    eyebrow: 'Bokföringsprogram för handelsbolag',
    title: 'Bokföringsprogram för handelsbolag',
    lead: 'Bokföringen för hela bolaget, och underlaget till varje delägares deklaration.',
    highlights: ['Tre användare ingår', 'INK4 som SRU-fil', 'Bokslut per delägare', 'Lön med AGI-fil'],
    included: [
      'Löpande bokföring med BAS-kontoplanen, med ett enkelt läge utan debet och kredit.',
      'Kvitton läses av från ett foto, och fakturor och offerter skickas från Bokix.',
      'Momsdeklarationen per månad, kvartal eller år, som fil att lämna in hos Skatteverket.',
      'Lön med skattetabeller, lönebesked, AGI-fil och betalfil till banken.',
      'Bokslut där årets resultat förs över till delägarnas kapitalkonton.',
      'Bilagorna till inkomstdeklaration 4 som SRU-fil: räkenskapsschema (INK4R), skattemässiga justeringar (INK4S) och delägaruppgifter (INK4DU) för varje delägare.',
      'Upp till tre personer i samma bokföring, till exempel båda delägarna och er revisor.',
    ],
    steps: [
      { title: 'Skapa kontot med organisationsnumret', body: 'Bokix känner igen att det är ett handels- eller kommanditbolag och anpassar skatt och bokslut efter det.' },
      { title: 'Bjud in delägaren', body: 'Ni kan arbeta i samma bokföring samtidigt. Tre användare ingår i priset.' },
      { title: 'Gör bokslut och INK4', body: 'Resultatet fördelas på delägarna. Bokix tar fram bilagorna till INK4 som fil, och varje delägare deklarerar sin andel i sin egen deklaration.' },
    ],
    facts: [
      { title: "Bolaget betalar ingen inkomstskatt", body: "Ett handelsbolag beskattas inte självt. Årets resultat delas på delägarna, som var och en beskattas för sin andel i sin egen deklaration." },
      { title: "Varje delägare har ett eget kapitalkonto", body: "Insättningar, uttag och andel av resultatet bokförs per delägare. Vid bokslutet förs årets resultat över till delägarnas kapitalkonton." },
      { title: "Kommanditbolag har två sorters delägare", body: "I ett kommanditbolag finns minst en komplementär med obegränsat ansvar och minst en kommanditdelägare med begränsat ansvar." },
    ],
    faq: [
      { q: 'Lämnar ett handelsbolag INK2?', a: 'Nej. Ett handels- eller kommanditbolag betalar ingen egen bolagsskatt och lämnar inkomstdeklaration 4 (INK4) i stället. Resultatet fördelas på delägarna, som deklarerar sin andel i sin egen deklaration.' },
      { q: 'Gör Bokix INK4?', a: 'Bokix tar fram bilagorna till INK4 som SRU-fil: räkenskapsschemat (INK4R), de skattemässiga justeringarna (INK4S) och delägaruppgifterna (INK4DU) med varje delägares andel, tillskott och uttag. Själva INK4 fyller du i Skatteverkets e-tjänst, där du också laddar upp filen.' },
      { q: 'Kan båda delägarna använda Bokix?', a: 'Ja. Upp till tre personer kan arbeta i samma bokföring, och det ingår i priset.' },
      { q: 'Vad kostar Bokix för ett handelsbolag?', a: PRICE + ' De första 30 dagarna är gratis.' },
      { q: 'Kan jag ta med bokföringen från ett annat program?', a: 'Ja. Exportera en SIE4-fil ur ditt nuvarande program och läs in den i Bokix, så följer konton, verifikationer och ingående balanser med.' },
    ],
    related: [
      { label: 'Byt bokföringsprogram med en SIE4-fil', to: '/byt-bokforingsprogram' },
      { label: 'Bokslut för småföretag: checklista', to: '/blogg/bokslut-checklista' },
    ],
    // Produktsidan (2026-11-07): riktiga bilder ur appen, se productKit.jsx.
    product: {
      h1Tail: 'Bokföringen för bolaget, underlaget för varje delägare.',
      lead: 'Fakturor, kvitton och moms under året. I bokslutet delas resultatet på delägarna, och Bokix tar fram bilagorna till INK4.',
      heroTabs: [
        { label: 'Översikt', shot: 'start', caption: 'Startsidan: resultat, pengar på banken och det som ska göras härnäst.' },
        { label: 'Fakturor', shot: 'kundfakturor', caption: 'Kundfakturorna med vad som är obetalt och vad som har förfallit.' },
        { label: 'Moms', shot: 'moms', caption: 'Momsdeklarationen fylls i ur bokföringen, ruta för ruta.' },
        { label: 'Delägare', shot: 'hb-delagare', caption: 'Delägarna med sina andelar, och underlaget till varje delägares N3A.' },
        { label: 'INK4', shot: 'hb-ink4', caption: 'Bilagorna till inkomstdeklaration 4, steg för steg och som SRU-fil.' },
      ],
      reasonsTitle: 'Därför passar Bokix ett handelsbolag',
      reasons: [
        { title: 'Tre användare ingår', body: 'Båda delägarna och er revisor kan arbeta i samma bokföring, utan extra kostnad.' },
        { title: 'Ett kapitalkonto per delägare', body: 'Varje delägare får en egen kontoserie för insättningar, uttag och sin andel av resultatet.' },
        { title: 'Bilagorna till INK4 som fil', body: 'INK4R, INK4S och INK4DU för varje delägare tas fram ur bokföringen, som SRU-fil.' },
      ],
      featuresTitle: 'Det här gör ni i Bokix',
      features: [
        { kicker: 'Fakturering', title: 'Fakturera och få betalt', shot: 'kundfakturor-c', body: 'Skicka fakturan med e-post från Bokix. När kunden betalar bokförs betalningen mot fakturan.', points: ['Offerten blir en faktura när kunden säger ja', 'Bankgiro och OCR-nummer på fakturan', 'Påminnelse när fakturan har förfallit'] },
        { kicker: 'Kvitton', title: 'Fota kvittot, resten fylls i', shot: 'kvitton-c', body: 'Datum, belopp och moms läses av från fotot. Det som är osäkert hamnar i Att granska i stället för att gissas.', points: ['Flera momssatser på samma kvitto', 'Foto, PDF eller en hel mapp på en gång', 'Kvittot sparas med verifikationen i sju år'] },
        { kicker: 'Delägare', title: 'Resultatet delas på delägarna', shot: 'hb-delagare-c', body: 'Lägg in delägarna och deras andelar. När året låses bokförs varje delägares andel på hans eller hennes resultatkonto.', points: ['Egen kontoserie per delägare', 'Insättningar och uttag per delägare', 'Underlag till varje delägares N3A'] },
        { kicker: 'Deklaration', title: 'INK4 steg för steg', shot: 'hb-ink4-c', body: 'Räkenskaperna hämtas från bokföringen. Du går igenom justeringar och delägare, och laddar ner SRU-filen.', points: ['Räkenskapsschema (INK4R)', 'Skattemässiga justeringar (INK4S)', 'Delägaruppgifter (INK4DU) för varje delägare'] },
        { kicker: 'Moms', title: 'Momsdeklarationen räknas fram', shot: 'moms-c', body: 'Rutorna fylls i ur bokföringen. Du kontrollerar, granskar och bokför, och laddar ner filen till Skatteverket.', points: ['Per år, kvartal eller månad', 'Kontroll av perioden innan du lämnar in', 'Momsen bokförs mot skattekontot'] },
      ],
      year: {
        title: 'Ert år som handelsbolag',
        lead: 'Det här ska göras under ett vanligt år. Bokix visar era egna datum under Skatt och bokslut.',
        every: 'Bolaget betalar ingen inkomstskatt. Varje delägare betalar preliminärskatt på sin andel av resultatet, på sitt eget skattekonto.',
        quarters: [
          { label: 'Januari–mars', events: [
            { date: 'Januari', title: 'Bokslut för förra året', bokix: 'Årsbokslutet steg för steg. När året låses bokförs resultatet på delägarnas konton.', key: true },
            { date: '26 februari', title: 'Moms för hela förra året', bokix: 'Deklarationen fylls i ur bokföringen.', key: true },
          ] },
          { label: 'April–juni', events: [
            { date: 'Början av maj', title: 'INK4 för bolaget, N3A för delägarna', bokix: 'Bilagorna till INK4 som SRU-fil, och underlaget till varje delägares N3A.', key: true },
          ] },
          { label: 'Juli–september', events: [], empty: 'Löpande bokföring: kvitton, fakturor och bank.' },
          { label: 'Oktober–december', events: [
            { date: '31 december', title: 'Räkenskapsåret slutar', bokix: 'Året låses när bokslutet är klart, så att inget ändras i efterhand.' },
          ] },
        ],
        note: 'Exemplet gäller räkenskapsår som kalenderår och moms per år. Exakta datum för INK4 står hos Skatteverket. Infaller ett datum på en helg flyttas det till nästa vardag.',
      },
      compare: {
        title: 'Själv, med byrå eller med Bokix',
        lead: 'En byrå passar om ni vill lämna bort allt. Bokix passar om ni vill ha koll själva och betala lite.',
        cols: ['I Excel', 'Med redovisningsbyrå', 'Med Bokix'],
        rows: [
          ['Kostnad', 'Inget program, men mycket tid', 'Arvode per timme eller månad', '129 kr/mån, tre användare ingår'],
          ['Delägarnas andelar', 'Räknas för hand', 'Byrån gör det', 'Fördelas i bokslutet, per delägare'],
          ['INK4 med bilagor', 'Svårt utan förkunskaper', 'Byrån gör det', 'Steg för steg, som SRU-fil'],
          ['Arbeta tillsammans', 'En fil som skickas runt', 'Byrån har bokföringen', 'Samma bokföring, samtidigt'],
          ['Koll på siffrorna', 'När någon har uppdaterat', 'När byrån har skickat rapporten', 'Hela tiden, på startsidan'],
        ],
      },
      price: { amount: '129 kr', unit: '/mån', text: 'Allt ovan ingår, och tre användare. 179 kr/mån med anställda, 109 respektive 149 kr/mån med årsplan. Ingen moms tillkommer. 30 dagar gratis.' },
    },
  },
  {
    slug: 'ekonomisk-forening',
    video: { title: 'Så fungerar Bokix för ekonomisk förening', description: 'Kassör, ordförande och revisor arbetar i samma bokföring, revisorn granskar och INK2 och årsredovisningen blir klara.', date: '2026-10-17' },
    path: '/bokforingsprogram-ekonomisk-forening',
    short: 'Ekonomisk förening',
    seoTitle: 'Bokföringsprogram för ekonomisk förening | Bokix',
    seoDescription: 'Bokix är ett enkelt bokföringsprogram för ekonomiska föreningar. Fakturor, moms, lön, INK2 och årsredovisning enligt K2 i ett verktyg. 30 dagar gratis.',
    eyebrow: 'Bokföringsprogram för ekonomisk förening',
    title: 'Bokföringsprogram för ekonomisk förening',
    lead: 'Kassör, styrelse och revisor i samma bokföring, ända fram till årsredovisningen.',
    highlights: ['Tre användare ingår', 'INK2 med SRU-fil', 'Årsredovisning enligt K2', 'Rapporter till styrelsen'],
    included: [
      'Löpande bokföring med BAS-kontoplanen, med ett enkelt läge utan debet och kredit.',
      'Fakturor och offerter, och kvitton som läses av från ett foto.',
      'Momsdeklarationen per månad, kvartal eller år, som fil att lämna in hos Skatteverket.',
      'Lön med skattetabeller, lönebesked, AGI-fil och betalfil till banken.',
      'Bokslut och INK2 med SRU-fil till inkomstdeklarationen.',
      'Årsredovisning enligt K2 som PDF att skriva under, med medlemsinsatser och förslag till föreningsstämman.',
      'Återbäring till medlemmarna efter hur mycket var och en handlat med föreningen, bokförd och med avdraget i INK2.',
      'Resultat- och balansräkning och nyckeltal att visa styrelsen och på stämman.',
    ],
    steps: [
      { title: 'Skapa kontot med organisationsnumret', body: 'Bokix hämtar föreningens uppgifter och väljer räkenskapsår och momsperiod åt dig.' },
      { title: 'Bjud in kassören eller revisorn', body: 'Upp till tre personer kan arbeta i samma bokföring.' },
      { title: 'Gör bokslut, INK2 och årsredovisning', body: 'Bokix räknar fram INK2 och årsredovisningen ur bokföringen. Styrelsen skriver under och föreningsstämman fastställer den.' },
    ],
    facts: [
      { title: "Föreningsstämman beslutar", body: "Medlemmarna fastställer resultat- och balansräkningen på föreningsstämman och beslutar om hur överskottet ska användas." },
      { title: "Föreningen ska ha en revisor", body: "En ekonomisk förening ska ha minst en revisor. Revisorn kan bjudas in i Bokix och granska samma bokföring som kassören." },
      { title: "Beskattas som ett aktiebolag", body: "En ekonomisk förening betalar inkomstskatt och lämnar INK2, precis som ett aktiebolag." },
    ],
    faq: [
      { q: 'Passar Bokix en ekonomisk förening?', a: 'Ja. Den löpande bokföringen, moms, lön, bokslut med INK2 och årsredovisning enligt K2 finns i Bokix. Årsredovisningen använder föreningens egna poster, som medlemsinsatser, och föreningsstämman i stället för årsstämma.' },
      { q: 'Måste föreningen skicka årsredovisningen till Bolagsverket?', a: 'Det beror på föreningens storlek, till exempel antal anställda och tillgångarnas värde. Kolla vad som gäller för er på bolagsverket.se. Bokix gör årsredovisningen, men skickar inte in den åt er.' },
      { q: 'Kan flera i styrelsen använda Bokix?', a: 'Ja. Upp till tre personer kan arbeta i samma bokföring, och det ingår i priset.' },
      { q: 'Vad kostar Bokix för en ekonomisk förening?', a: PRICE + ' De första 30 dagarna är gratis.' },
      { q: 'Fungerar Bokix för en ideell förening?', a: 'Ja, för bokföring, moms, lön, årsbokslut och bilagorna till inkomstdeklarationen (INK3). Läs mer på sidan för ideella föreningar: bokix.se/bokforingsprogram-ideell-forening.' },
    ],
    related: [
      { label: 'Momsdeklaration steg för steg', to: '/blogg/moms-deklaration-steg-for-steg' },
      { label: 'Bokslut för småföretag: checklista', to: '/blogg/bokslut-checklista' },
    ],
    // Produktsidan (2026-11-07): riktiga bilder ur appen, se productKit.jsx.
    product: {
      h1Tail: 'Kassör, styrelse och revisor i samma bokföring.',
      lead: 'Fakturor, lön och moms under året. Bokslut, INK2 och årsredovisning enligt K2 till föreningsstämman.',
      heroTabs: [
        { label: 'Översikt', shot: 'start', caption: 'Startsidan: resultat, pengar på banken och det som ska göras härnäst.' },
        { label: 'Fakturor', shot: 'kundfakturor', caption: 'Kundfakturorna med vad som är obetalt och vad som har förfallit.' },
        { label: 'Moms', shot: 'moms', caption: 'Momsdeklarationen fylls i ur bokföringen, ruta för ruta.' },
        { label: 'Årsredovisning', shot: 'ek-arsredovisning', caption: 'Årsredovisningen enligt K2 med föreningens egna poster, steg för steg.' },
        { label: 'INK2', shot: 'ink2', caption: 'Inkomstdeklaration 2 med räkenskapsschemat ifyllt ur bokföringen.' },
      ],
      reasonsTitle: 'Därför passar Bokix en ekonomisk förening',
      reasons: [
        { title: 'Tre användare ingår', body: 'Kassören, ordföranden och revisorn kan arbeta i samma bokföring, utan extra kostnad.' },
        { title: 'Årsredovisning för en förening', body: 'Medlemsinsatser, förslag till föreningsstämman och styrelsens underskrifter, enligt K2.' },
        { title: 'Återbäring till medlemmarna', body: 'Bokix räknar fram återbäringen per medlem, bokför beslut och utbetalning och tar med avdraget i INK2.' },
      ],
      featuresTitle: 'Det här gör ni i Bokix',
      features: [
        { kicker: 'Fakturering', title: 'Fakturera och få betalt', shot: 'kundfakturor-c', body: 'Skicka fakturan med e-post från Bokix. När kunden betalar bokförs betalningen mot fakturan.', points: ['Offerten blir en faktura när kunden säger ja', 'Bankgiro och OCR-nummer på fakturan', 'Påminnelse när fakturan har förfallit'] },
        { kicker: 'Lön', title: 'Lön till de anställda', shot: 'lonekorning-ny-c', body: 'Välj månad och utbetalningsdag. Bokix räknar skatt och arbetsgivaravgift för varje anställd och bokför lönen.', points: ['Skattetabeller och arbetsgivaravgift efter ålder', 'Lönebesked till de anställda', 'AGI-fil och betalfil till banken'] },
        { kicker: 'Rapporter', title: 'Siffrorna till styrelsemötet', shot: 'resultatrakning-c', body: 'Resultaträkningen med en kort sammanfattning i ord, att visa styrelsen eller skriva ut till mötet.', points: ['Resultat- och balansräkning', 'Utveckling per månad', 'Skriv ut eller spara som PDF'] },
        { kicker: 'Årsredovisning', title: 'Årsredovisning enligt K2', shot: 'ek-arsredovisning-c', body: 'Siffrorna kommer från bokslutet. Ni skriver förvaltningsberättelsen och förslaget om överskottet, och får en PDF att skriva under.', points: ['Medlemsinsatser i eget kapital', 'Förslag till föreningsstämman', 'PDF som styrelsen skriver under'] },
        { kicker: 'Deklaration', title: 'INK2 ur bokföringen', shot: 'ink2-c', body: 'Balans- och resultaträkningen hämtas från bokföringen. Ni fyller bara i det som gäller föreningens skatt.', points: ['Räkenskapsschemat ifyllt rad för rad', 'SRU-fil och Skatteverkets blankett ifylld', 'Avdraget för återbäring följer med'] },
      ],
      year: {
        title: 'Ert år som ekonomisk förening',
        lead: 'Det här ska göras under ett vanligt år. Bokix visar era egna datum under Skatt och bokslut.',
        every: 'Har föreningen anställda: lön och arbetsgivardeklaration, som lämnas och betalas den 12:e månaden efter löneutbetalningen, i januari och augusti den 17:e.',
        quarters: [
          { label: 'Januari–mars', events: [
            { date: 'Januari', title: 'Bokslut för förra året', bokix: 'Årsbokslutet steg för steg: bank, kundfakturor, leverantörer, periodisering och lager.', key: true },
            { date: '12 februari', title: 'Moms för oktober–december', bokix: 'Deklarationen fylls i ur bokföringen.' },
          ] },
          { label: 'April–juni', events: [
            { date: '12 maj', title: 'Moms för januari–mars', bokix: 'Deklarationen fylls i ur bokföringen.' },
            { date: 'Senast 30 juni', title: 'Föreningsstämma', bokix: 'Stämman fastställer årsredovisningen och beslutar om överskottet och eventuell återbäring.', key: true },
          ] },
          { label: 'Juli–september', events: [
            { date: '1 augusti', title: 'Inkomstdeklaration 2', bokix: 'SRU-fil och blankett ifylld. Datumet gäller när ni lämnar in digitalt.', key: true },
            { date: '17 augusti', title: 'Moms för april–juni', bokix: 'Deklarationen fylls i ur bokföringen.' },
          ] },
          { label: 'Oktober–december', events: [
            { date: '12 november', title: 'Moms för juli–september', bokix: 'Deklarationen fylls i ur bokföringen.' },
            { date: '31 december', title: 'Räkenskapsåret slutar', bokix: 'Året låses när bokslutet är klart, så att inget ändras i efterhand.' },
          ] },
        ],
        note: 'Exemplet gäller räkenskapsår som kalenderår och moms per kvartal. Om årsredovisningen ska skickas till Bolagsverket beror på föreningens storlek. Infaller ett datum på en helg flyttas det till nästa vardag.',
      },
      compare: {
        title: 'Själva, med byrå eller med Bokix',
        lead: 'En byrå passar om ni vill lämna bort allt. Bokix passar om kassören vill ha koll själv och föreningen vill betala lite.',
        cols: ['I Excel', 'Med redovisningsbyrå', 'Med Bokix'],
        rows: [
          ['Kostnad', 'Inget program, men mycket tid', 'Arvode per timme eller månad', '129 kr/mån, tre användare ingår'],
          ['När kassören byts', 'Filer och pärmar lämnas över', 'Byrån har bokföringen', 'Bjud in den nya kassören'],
          ['Revisionen', 'Revisorn får papper eller filer', 'Byrån tar fram underlaget', 'Revisorn granskar samma bokföring'],
          ['INK2 och årsredovisning', 'Svårt utan förkunskaper', 'Byrån gör det', 'Steg för steg, med PDF och SRU-fil'],
          ['Koll på siffrorna', 'När någon har uppdaterat', 'När byrån har skickat rapporten', 'Hela tiden, på startsidan'],
        ],
      },
      price: { amount: '129 kr', unit: '/mån', text: 'Allt ovan ingår, och tre användare. 179 kr/mån med anställda, 109 respektive 149 kr/mån med årsplan. Ingen moms tillkommer. 30 dagar gratis.' },
    },
  },
];

ORG_TYPE_PAGES.push({
  slug: 'ideell-forening',
  video: { title: 'Så fungerar Bokix för ideell förening', description: 'Föreningens år räknas fram ur bokföringen, revisorn granskar och årsbokslutet är klart till årsmötet.', date: '2026-10-17' },
  path: '/bokforingsprogram-ideell-forening',
  short: 'Ideell förening',
  seoTitle: 'Bokföringsprogram för ideell förening och stiftelse | Bokix',
  seoDescription: 'Bokix är ett enkelt bokföringsprogram för ideella föreningar och stiftelser. Kvitton, fakturor, moms, lön och årsbokslut i ett verktyg. 30 dagar gratis.',
  eyebrow: 'Bokföringsprogram för ideell förening',
  title: 'Bokföringsprogram för ideell förening',
  lead: 'Kassören bokför, styrelsen ser hur det går och revisorn granskar samma bokföring.',
  highlights: ['Tre användare ingår', 'Enkelt läge utan debet och kredit', 'Med eller utan moms', 'Årsbokslut och INK3'],
  included: [
    'Löpande bokföring med BAS-kontoplanen, med ett enkelt läge där du väljer vad som hänt i stället för konton.',
    'Kvitton läses av från ett foto, och underlaget sparas med verifikationen i sju år.',
    'Fakturor för medlemsavgifter, sponsring och uthyrning, med kortbetalning via Stripe om ni vill.',
    'Momsdeklaration om föreningen är momsregistrerad. Är den inte det bokförs allt utan moms.',
    'Lön till anställda med skattetabeller, lönebesked, AGI-fil och betalfil till banken.',
    'Årsbokslut med resultat- och balansräkning att visa styrelsen och på årsmötet.',
    'Bilagorna till inkomstdeklaration 3 som SRU-fil: särskild uppgift för en allmännyttig förening, och räkenskapsschema och justeringar om det finns skattepliktig verksamhet.',
  ],
  steps: [
    { title: 'Skapa kontot med organisationsnumret', body: 'Bokix känner igen att det är en ideell förening eller stiftelse och väljer räkenskapsår åt dig.' },
    { title: 'Bjud in kassören eller revisorn', body: 'Upp till tre personer kan arbeta i samma bokföring.' },
    { title: 'Gör årsbokslutet', body: 'Resultat- och balansräkningen räknas fram ur bokföringen, och bilagorna till INK3 laddar ni ner som en fil till Skatteverket.' },
  ],
  facts: [
    { title: 'Alla föreningar behöver inte bokföra', body: 'En ideell förening är bokföringsskyldig om den bedriver näringsverksamhet eller har tillgångar på mer än 1,5 miljoner kr. Många bokför ändå, för att ha ordning inför årsmötet.' },
    { title: 'Förenklat årsbokslut räcker ofta', body: 'Är nettoomsättningen normalt högst 3 miljoner kr får föreningen göra ett förenklat årsbokslut.' },
    { title: 'Deklarationen heter INK3', body: 'Ideella föreningar och stiftelser lämnar Inkomstdeklaration 3. En allmännyttig förening utan skattepliktig verksamhet lämnar bara första sidan och en särskild uppgift. Medlemsavgifter, gåvor och bidrag till den ideella verksamheten är skattefria.' },
  ],
  faq: [
    { q: 'Passar Bokix en ideell förening?', a: 'Ja, för den löpande bokföringen, fakturor, moms, lön, årsbokslutet och bilagorna till inkomstdeklarationen (INK3). Första sidan fyller ni i Skatteverkets e-tjänst.' },
    { q: 'Vår förening är inte momsregistrerad. Fungerar det?', a: 'Ja. Du väljer det när kontot skapas, och då bokförs kvitton och fakturor utan moms.' },
    { q: 'Kan kassören och revisorn använda samma konto?', a: 'Ja. Upp till tre personer kan arbeta i samma bokföring, och det ingår i priset.' },
    { q: 'Fungerar Bokix för en stiftelse?', a: 'Ja, på samma sätt som för en ideell förening: bokföring, moms, lön, årsbokslut och bilagorna till INK3, med den särskilda uppgiften för allmännyttiga stiftelser (INK3SUS).' },
    { q: 'Vad kostar Bokix för en ideell förening?', a: PRICE + ' De första 30 dagarna är gratis.' },
  ],
  related: [
    { label: 'Bokslut för småföretag: checklista', to: '/blogg/bokslut-checklista' },
    { label: 'Momsdeklaration steg för steg', to: '/blogg/moms-deklaration-steg-for-steg' },
  ],
      // Produktsidan (2026-11-07): riktiga bilder ur appen, se productKit.jsx.
    product: {
      h1Tail: 'Ordning på föreningens pengar, klart till årsmötet.',
      lead: 'Kassören bokför, styrelsen ser hur det går och revisorn granskar samma bokföring. Med eller utan moms.',
      heroTabs: [
        { label: 'Översikt', shot: 'start', caption: 'Startsidan: resultat, pengar på banken och det som ska göras härnäst.' },
        { label: 'Kvitton', shot: 'kvitton', caption: 'Kvittona med vad som är bokfört och vad som behöver granskas.' },
        { label: 'Fakturor', shot: 'kundfakturor', caption: 'Fakturor för medlemsavgifter, sponsring och uthyrning.' },
        { label: 'Rapporter', shot: 'resultatrakning', caption: 'Resultaträkningen att visa styrelsen och på årsmötet.' },
        { label: 'INK3', shot: 'ideell-ink3', caption: 'Bilagorna till inkomstdeklaration 3 som SRU-fil.' },
      ],
      reasonsTitle: 'Därför passar Bokix en ideell förening',
      reasons: [
        { title: 'Kassören behöver inte vara ekonom', body: 'I det enkla läget väljer kassören vad som hänt, till exempel en medlemsavgift eller ett inköp. Bokix väljer konton.' },
        { title: 'Revisorn granskar i samma bokföring', body: 'Tre användare ingår. Bjud in revisorn, så slipper ni skicka pärmar och filer.' },
        { title: 'Lätt att lämna över', body: 'När kassören byts bjuder ni in den nya. Allt underlag ligger kvar i sju år.' },
      ],
      featuresTitle: 'Det här gör ni i Bokix',
      features: [
        { kicker: 'Kvitton', title: 'Fota kvittot, resten fylls i', shot: 'kvitton-c', body: 'Datum, belopp och moms läses av från fotot. Det som är osäkert hamnar i Att granska i stället för att gissas.', points: ['Utan moms om föreningen inte är momsregistrerad', 'Foto, PDF eller en hel mapp på en gång', 'Kvittot sparas med verifikationen i sju år'] },
        { kicker: 'Fakturering', title: 'Medlemsavgifter och sponsring', shot: 'kundfakturor-c', body: 'Skicka fakturan med e-post från Bokix. När den betalas bokförs betalningen mot fakturan.', points: ['Bankgiro och OCR-nummer på fakturan', 'Påminnelse när fakturan har förfallit', 'Se vilka som har betalat'] },
        { kicker: 'Rapporter', title: 'Siffrorna till styrelsen och årsmötet', shot: 'resultatrakning-c', body: 'Resultaträkningen med en kort sammanfattning i ord, att visa på styrelsemötet eller skriva ut till årsmötet.', points: ['Resultat- och balansräkning', 'Utveckling per månad', 'Skriv ut eller spara som PDF'] },
        { kicker: 'Deklaration', title: 'Bilagorna till INK3', shot: 'ideell-ink3-c', body: 'Svara på några frågor om föreningen, så tar Bokix fram de bilagor som gäller er som SRU-fil.', points: ['Särskild uppgift för allmännyttiga föreningar', 'Räkenskapsschema om det finns skattepliktig verksamhet', 'Första sidan fyller ni i hos Skatteverket'] },
        { kicker: 'Översikt', title: 'Alla datum på ett ställe', shot: 'ideell-skatt-c', body: 'Under Skatt och bokslut ser ni vad som ska göras härnäst och hur långt ni har kommit.', points: ['Årsbokslut och deklaration i ordning', 'Dagar kvar till varje datum', 'Ett klick till rätt steg'] },
      ],
      year: {
        title: 'Föreningens år',
        lead: 'Så brukar året se ut för en ideell förening med kalenderår som räkenskapsår.',
        every: 'Löpande bokföring: kvitton, medlemsavgifter och bank. Har föreningen anställda: lön och arbetsgivardeklaration varje månad.',
        quarters: [
          { label: 'Januari–mars', events: [
            { date: 'Januari', title: 'Bokslut för förra året', bokix: 'Årsbokslutet steg för steg, med resultat- och balansräkning.', key: true },
            { date: 'Efter bokslutet', title: 'Revisorn granskar', bokix: 'Revisorn bjuds in och granskar samma bokföring.' },
          ] },
          { label: 'April–juni', events: [
            { date: 'Enligt stadgarna', title: 'Årsmöte', bokix: 'Resultat- och balansräkningen att visa. Årsmötet beslutar om ansvarsfrihet för styrelsen.', key: true },
          ] },
          { label: 'Juli–september', events: [
            { date: '1 augusti', title: 'Inkomstdeklaration 3', bokix: 'Bilagorna som SRU-fil. Datumet gäller när ni lämnar in digitalt.', key: true },
          ] },
          { label: 'Oktober–december', events: [
            { date: '31 december', title: 'Räkenskapsåret slutar', bokix: 'Året låses när bokslutet är klart, så att inget ändras i efterhand.' },
          ] },
        ],
        note: 'När årsmötet hålls står i föreningens stadgar. Är föreningen momsregistrerad tillkommer momsdeklarationen, som Bokix fyller i ur bokföringen.',
      },
      compare: {
        title: 'Själva, med byrå eller med Bokix',
        lead: 'En byrå passar om ni vill lämna bort allt. Bokix passar om kassören vill ha koll själv och föreningen vill betala lite.',
        cols: ['I Excel', 'Med redovisningsbyrå', 'Med Bokix'],
        rows: [
          ['Kostnad', 'Inget program, men mycket tid', 'Arvode per timme eller månad', '129 kr/mån, tre användare ingår'],
          ['När kassören byts', 'Filer och pärmar lämnas över', 'Byrån har bokföringen', 'Bjud in den nya kassören'],
          ['Revisionen', 'Revisorn får papper eller filer', 'Byrån tar fram underlaget', 'Revisorn granskar samma bokföring'],
          ['Till årsmötet', 'Rapporten görs för hand', 'Byrån skickar rapporten', 'Resultat- och balansräkning direkt'],
          ['Kvitton', 'Sparas i en pärm', 'Skickas till byrån', 'Fotas och sparas i sju år'],
        ],
      },
      price: { amount: '129 kr', unit: '/mån', text: 'Allt ovan ingår, och tre användare. 179 kr/mån med anställda, 109 respektive 149 kr/mån med årsplan. Ingen moms tillkommer. 30 dagar gratis.' },
    },
});

export const ORG_TYPE_BY_PATH = Object.fromEntries(ORG_TYPE_PAGES.map(p => [p.path, p]));
