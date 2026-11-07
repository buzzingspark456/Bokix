// ── Landningssidor per funktion ────────────────────────────────────────
// Samma upplägg som bolagsformssidorna (orgTypes.js) och samma komponent
// (OrgTypePage.jsx), men för sökningar på en funktion: "faktureringsprogram",
// "bokföringsprogram med lager", "anläggningsregister". Sökningar där Bokix
// har funktionen men sajten saknade en sida.
//
// Bara sådant Bokix faktiskt gör:
//  - Fakturor: offert till faktura, egen logga, ROT/RUT, Stripe-betalning,
//    utländsk valuta, delbetalning, kreditfaktura, skicka från egen Gmail
//    eller SMTP. Påminnelsen öppnas förifylld i användarens eget mejlprogram.
//    Ingen e-faktura via Peppol och ingen återkommande faktura.
//  - Lager (utils/inventory.js): FIFO eller vägt genomsnitt, lägsta värdets
//    princip, bokslutsverifikation mot 1460/4960 m.fl., fakturerade varor
//    dras från lagret. Prissättningsfliken räknar påslag och marginal.
//  - Anläggningsregister (utils/fixedAssets.js): linjär avskrivning per
//    månad, en verifikation per månad, försäljning/utrangering bokförs.

const PRICE = '129 kr/mån utan anställda och 179 kr/mån med anställda. Ingen moms tillkommer och allt ingår.';

export const FEATURE_PAGES = [
  {
    slug: 'fakturering',
    video: { title: 'Så fungerar faktureringen i Bokix', description: 'En faktura skickas från din egen Gmail, kunden betalar med kort och fakturan bokförs som betald.' },
    linkLabel: 'Fakturering',
    ctaTitle: 'Skicka din första faktura i dag',
    path: '/faktureringsprogram',
    short: 'Fakturering',
    seoTitle: 'Faktureringsprogram för småföretag, från 129 kr/mån | Bokix',
    seoDescription: 'Bokix är ett faktureringsprogram med bokföringen inbyggd. Fakturor med egen logga, ROT och RUT och påminnelser. Bokförs av sig själv. 30 dagar gratis.',
    eyebrow: 'Faktureringsprogram',
    title: 'Faktureringsprogram som bokför åt dig',
    lead: 'Skicka fakturan från din egen mejl. När den betalas bokförs den av sig själv.',
    highlights: ['Egen logga på fakturan', 'Påminnelser och kreditfakturor', 'Skickas från din Gmail', 'Bokförs av sig själv'],
    factsTitle: 'Bra att veta om fakturor',
    factsLead: 'Det som gäller för alla fakturor, oavsett program.',
    includedTitle: 'Det här ingår i faktureringen',
    included: [
      'Fakturor och offerter med din logga, där en godkänd offert blir en faktura med ett klick.',
      'Skicka från din egen Gmail eller annan e-post, så kunden ser ditt företags adress som avsändare.',
      'Betalning till ditt bankgiro med OCR-nummer, och kortbetalning via Stripe om du vill.',
      'ROT- och RUT-avdrag på fakturan, med underlag för begäran till Skatteverket.',
      'Fakturor i utländsk valuta och med omvänd moms vid försäljning till andra länder.',
      'Delbetalningar, kreditfakturor och påminnelser när en faktura inte betalats i tid.',
      'Leverantörsfakturor på samma ställe, så att du ser både det du ska få in och det du ska betala.',
    ],
    steps: [
      { title: 'Lägg upp kunden', body: 'Namn, adress och e-post, en gång. Har du kunderna i ett annat program kan du importera dem som en lista.' },
      { title: 'Skapa och skicka fakturan', body: 'Välj artiklar eller skriv fritt. Fakturan skickas som PDF från din egen mejladress.' },
      { title: 'Registrera betalningen', body: 'När pengarna kommer bokförs betalningen mot fakturan. Med Stripe sker det av sig själv.' },
    ],
    facts: [
      { title: 'Det här ska stå på en faktura', body: 'Datum, ett löpnummer, ditt momsregistreringsnummer, båda parternas namn och adress, vad som sålts, när, och momsen per momssats. Bokix lägger in uppgifterna åt dig.' },
      { title: 'Dröjsmålsränta när kunden betalar sent', body: 'Har ni inte avtalat något annat får du ta ut dröjsmålsränta: referensräntan plus åtta procentenheter. Räkna på det i dröjsmålsräntekalkylatorn.' },
      { title: 'Fakturan är en verifikation', body: 'Kundfakturan är underlaget för försäljningen i bokföringen och ska sparas i sju år. I Bokix sparas den med verifikationen.' },
    ],
    faq: [
      { q: 'Är Bokix ett faktureringsprogram eller ett bokföringsprogram?', a: 'Båda. Faktureringen är en del av bokföringsprogrammet, så varje faktura och betalning bokförs utan att du behöver föra över något.' },
      { q: 'Kan kunden betala fakturan med kort?', a: 'Ja, om du kopplar Stripe. Då får fakturan en betalknapp, och betalningen bokförs när den kommer in. Stripes avgift och utbetalningen till banken hämtas in och bokförs med ett klick.' },
      { q: 'Kan jag skicka fakturor från min egen e-postadress?', a: 'Ja. Koppla din Gmail eller en annan e-post via SMTP under Inställningar, så skickas fakturan från din adress.' },
      { q: 'Kan Bokix skicka e-faktura via Peppol?', a: 'Inte än. Fakturorna skickas som PDF via e-post. Ska du fakturera en myndighet som kräver e-faktura behövs en annan lösning för just de fakturorna.' },
      { q: 'Vad kostar faktureringen?', a: PRICE + ' Inga avgifter per faktura. De första 30 dagarna är gratis.' },
    ],
    related: [
      { label: 'Så bokför du Stripe', to: '/blogg/bokfora-stripe' },
      { label: 'Skicka fakturor från din egen Gmail', to: '/nyheter/skicka-fakturor-fran-din-egen-gmail' },
      { label: 'Videoguide: skapa en faktura', to: '/guider/skapa-faktura' },
      { label: 'Dröjsmålsräntekalkylator', to: '/verktyg/drojsmalsranta' },
    ],
    // Produktsidan (2026-11-07): riktiga bilder ur appen, se productKit.jsx.
    product: {
      h1Tail: 'Skicka fakturan. Bokföringen sköter sig själv.',
      lead: 'Fakturor och offerter med din logga, från din egen e-post. När kunden betalar bokförs betalningen mot fakturan.',
      heroTabs: [
        { label: 'Fakturor', shot: 'kundfakturor', caption: 'Kundfakturorna med vad som är obetalt och vad som har förfallit.' },
        { label: 'Ny faktura', shot: 'ny-faktura', caption: 'En ny faktura: kund, datum, rader och moms på samma sida.' },
        { label: 'Fakturan', shot: 'faktura', caption: 'Fakturan som kunden får, med bankgiro och OCR-nummer.' },
        { label: 'Offerter', shot: 'offerter', caption: 'Offerterna, som blir fakturor när kunden säger ja.' },
        { label: 'Kunder', shot: 'kunder', caption: 'Kundregistret med kontaktuppgifter, så att fakturan fylls i av sig själv.' },
      ],
      reasonsTitle: 'Därför fakturerar du i Bokix',
      reasons: [
        { title: 'Från din egen e-post', body: 'Koppla Gmail eller en annan e-post, så kommer fakturan från ditt företags adress.' },
        { title: 'Koll på vad som är obetalt', body: 'Du ser direkt vilka fakturor som är obetalda och förfallna, och skickar en påminnelse när det behövs.' },
        { title: 'Inget att föra över', body: 'Fakturering och bokföring är samma program. Varje faktura och betalning bokförs direkt.' },
      ],
      featuresTitle: 'Från offert till betald faktura',
      features: [
        { kicker: 'Skapa', title: 'En faktura på en minut', shot: 'ny-faktura-c', body: 'Välj kund och artiklar eller skriv fritt. Moms, belopp och förfallodag räknas ut medan du skriver.', points: ['ROT- och RUT-avdrag på fakturan', 'Utländsk valuta och omvänd moms', 'Kontantfaktura när kunden redan har betalat'] },
        { kicker: 'Utseende', title: 'Fakturan som kunden får', shot: 'faktura', body: 'Förhandsgranska innan du skickar. Välj mall och färg, och lägg till din logga.', points: ['Sex mallar att välja mellan', 'Din logga och en egen accentfärg', 'Bankgiro och OCR-nummer på fakturan'] },
        { kicker: 'Uppföljning', title: 'Koll på vad som är betalt', shot: 'kundfakturor-c', body: 'Se på en gång vad som är obetalt, förfallet och betalt. Det som har förfallit visas också på startsidan.', points: ['Påminnelse när fakturan har förfallit', 'Delbetalningar och kreditfakturor', 'Betalningen bokförs mot fakturan'] },
        { kicker: 'Offerter', title: 'Offerten blir en faktura', shot: 'offerter', body: 'Skicka en offert med samma utseende som fakturan. När kunden säger ja skapar du fakturan från offerten.', points: ['Samma rader och priser följer med', 'Status: skickad, accepterad eller utgången', 'Samma mall och logga som fakturan'] },
      ],
      compare: {
        title: 'Word, en faktureringstjänst eller Bokix',
        lead: 'Det som skiljer är vad som händer efter att fakturan är skickad.',
        cols: ['I Word eller Excel', 'Separat faktureringstjänst', 'Med Bokix'],
        rows: [
          ['Bokföringen', 'Förs över för hand', 'Exporteras till bokföringen', 'Bokförs direkt'],
          ['Betalningar', 'Stäms av mot banken för hand', 'Beror på tjänsten', 'Bokförs mot fakturan'],
          ['Offerter', 'Skrivs för sig', 'Beror på tjänsten', 'Blir en faktura när kunden säger ja'],
          ['Påminnelser', 'Skrivs för hand', 'Ja', 'Ja'],
          ['Moms och bokslut', 'I ett annat program', 'I ett annat program', 'I samma program'],
        ],
      },
      price: { amount: '129 kr', unit: '/mån', text: 'Fakturering och bokföring i samma pris, utan avgift per faktura. 179 kr/mån med anställda. Ingen moms tillkommer. 30 dagar gratis.' },
    },
  },
  {
    slug: 'lager',
    video: { title: 'Så fungerar lagret i Bokix', description: 'Varor läggs i lager, lagervärdet räknas fram med FIFO och en såld vara dras från lagret.' },
    linkLabel: 'Lager och artiklar',
    ctaTitle: 'Håll koll på lagret i samma program som bokföringen',
    path: '/bokforingsprogram-med-lager',
    short: 'Lager och artiklar',
    seoTitle: 'Bokföringsprogram med lager och artiklar | Bokix',
    seoDescription: 'Bokix har artikelregister, lagersaldo och lagervärdering med FIFO eller genomsnitt inbyggt i bokföringen. Bokslutet för lagret görs åt dig. 30 dagar gratis.',
    eyebrow: 'Bokföringsprogram med lager',
    title: 'Bokföringsprogram med lager',
    lead: 'Se vad du har i lager och vad det är värt. Bokslutet för lagret görs åt dig.',
    highlights: ['Artikelregister', 'FIFO eller genomsnitt', 'Lägsta värdets princip', 'Påslag och marginal'],
    factsTitle: 'Bra att veta om lager i bokföringen',
    factsLead: 'Det som gäller för varulager i ett litet företag.',
    includedTitle: 'Det här ingår för lager och artiklar',
    included: [
      'Artikelregister med försäljningspris, inköpspris, enhet, moms och streckkod.',
      'Lagersaldo per artikel med inleveranser, uttag och inventering.',
      'Fakturerade varor dras från lagret av sig själva, och en ändrad eller borttagen faktura ger rätt saldo direkt.',
      'Lagervärdering med först in, först ut (FIFO) eller vägt genomsnitt, och lägsta värdets princip.',
      'Verifikationen vid bokslutet justerar lagerkontot och lagerförändringen åt dig.',
      'Prissättning: påslag och marginal per artikel, prisförslag mot din målmarginal och vad en rabatt gör med marginalen.',
    ],
    steps: [
      { title: 'Slå på artiklar och lager', body: 'Lager är avstängt tills du behöver det. Slå på det under Inställningar så dyker Artiklar upp i menyn.' },
      { title: 'Lägg in artiklarna och ingående saldo', body: 'Lägg in dem en och en eller importera en lista. Ange vad du har i lager och vad varorna kostade.' },
      { title: 'Inventera vid bokslutet', body: 'Räkna lagret, för in antalet och låt Bokix räkna fram värdet och bokföra lagerförändringen.' },
    ],
    facts: [
      { title: 'Lägsta värdets princip', body: 'Lagret får inte tas upp till mer än det lägsta av vad varorna kostade och vad de kan säljas för. Varor som tappat i värde skrivs ned.' },
      { title: 'Lagret påverkar resultatet', body: 'Det du köpt in men inte sålt är en tillgång, inte en kostnad. Ändringen av lagrets värde under året bokförs som en lagerförändring vid bokslutet.' },
      { title: 'Inventera vid årets slut', body: 'Lagret ska räknas vid räkenskapsårets slut, och inventeringen sparas med bokföringen som underlag för lagervärdet.' },
    ],
    faq: [
      { q: 'Vilka lagervärderingsmetoder har Bokix?', a: 'Först in, först ut (FIFO) och vägt genomsnittligt anskaffningsvärde. Lägsta värdets princip tillämpas per artikel.' },
      { q: 'Dras sålda varor från lagret automatiskt?', a: 'Ja, varor på dina fakturor dras från lagret. Ändrar eller tar du bort en faktura räknas saldot om direkt.' },
      { q: 'Kan jag se marginalen på mina varor?', a: 'Ja. Fliken Prissättning visar påslag och marginal per artikel, markerar artiklar som säljs under din målmarginal och föreslår ett nytt pris.' },
      { q: 'Kostar lagret extra?', a: PRICE + ' Lager och artiklar ingår, det finns inga tillägg.' },
    ],
    related: [
      { label: 'Videoguide: lägg upp en artikel', to: '/guider/ny-artikel' },
      { label: 'Bokslut för småföretag: checklista', to: '/blogg/bokslut-checklista' },
      { label: 'Kassaförsäljning och dagsavslut med Zettle', to: '/nyheter/kassaforsaljning-och-dagsavslut-med-zettle' },
    ],
    // Produktsidan (2026-11-07): riktiga bilder ur appen, se productKit.jsx.
    product: {
      h1Tail: 'Se vad du har i lager och vad det är värt.',
      lead: 'Artiklar, lagersaldo och lagervärde i samma program som bokföringen. Vid bokslutet bokförs lagret åt dig.',
      heroTabs: [
        { label: 'Lager', shot: 'lager', caption: 'Lagervärdet per vara, vad som snart tar slut och vad som ska bokföras.' },
        { label: 'Prissättning', shot: 'prissattning', caption: 'Marginal och påslag per artikel, mot ditt eget mål.' },
        { label: 'Artiklar', shot: 'artiklar-butik', caption: 'Artikelregistret med pris, inköpspris och moms.' },
        { label: 'Fakturor', shot: 'kundfakturor', caption: 'Varor på fakturan dras från lagret.' },
      ],
      reasonsTitle: 'Därför sköter du lagret i Bokix',
      reasons: [
        { title: 'Lagervärdet räknas åt dig', body: 'Först in, först ut (FIFO) eller vägt genomsnitt, med lägsta värdets princip per artikel.' },
        { title: 'Sålda varor dras av sig själva', body: 'Varor på fakturorna dras från lagret. Ändras en faktura räknas saldot om direkt.' },
        { title: 'Bokslutet för lagret', body: 'Bokix räknar fram lagerförändringen och bokför den mot lagerkontot när året är slut.' },
      ],
      featuresTitle: 'Det här gör du i Bokix',
      features: [
        { kicker: 'Lager', title: 'Vad du har och vad det är värt', shot: 'lager-c', body: 'Lagervärdet per vara, och en Att göra-lista med det som snart tar slut och det som ska bokföras.', points: ['Beställningspunkt per vara', 'Inleverans, uttag och inventering', 'Inventeringslista att skriva ut'] },
        { kicker: 'Prissättning', title: 'Rätt pris med rätt marginal', shot: 'prissattning-c', body: 'Sätt en målmarginal, så ser du vilka varor som når den och vilka som borde kosta mer.', points: ['Marginal och påslag per artikel', 'Artiklar under målet markeras', 'Räkna på pris, rabatt, nollpunkt och timpris'] },
        { kicker: 'Artiklar', title: 'Ett artikelregister för allt', shot: 'artiklar-butik-c', body: 'Varor och tjänster med pris, inköpspris, enhet och moms. Välj dem på fakturan i stället för att skriva.', points: ['Streckkod (EAN) per artikel', 'Importera och exportera som lista', 'Varor på fakturan dras från lagret'] },
      ],
      compare: {
        title: 'Excel, ett lagersystem eller Bokix',
        lead: 'För ett litet företag med varor räcker ofta ett lager i bokföringsprogrammet.',
        cols: ['I Excel', 'Separat lagersystem', 'Med Bokix'],
        rows: [
          ['Lagervärde', 'Räknas för hand', 'Ja', 'FIFO eller genomsnitt'],
          ['Sålda varor', 'Dras för hand', 'Ja, om det är kopplat', 'Dras från fakturorna'],
          ['Bokslutet för lagret', 'Räknas och bokförs för hand', 'Förs över till bokföringen', 'Bokförs åt dig'],
          ['Marginal per vara', 'Egna formler', 'Ibland', 'Ja, mot ditt mål'],
          ['Kostnad', 'Inget program, men mycket tid', 'Eget abonnemang', 'Ingår i 129 kr/mån'],
        ],
      },
      price: { amount: '129 kr', unit: '/mån', text: 'Lager och artiklar ingår, utan tillägg. 179 kr/mån med anställda. Ingen moms tillkommer. 30 dagar gratis.' },
    },
  },
  {
    slug: 'anlaggningsregister',
    video: { title: 'Så fungerar anläggningsregistret i Bokix', description: 'En dator för 24 000 kr skrivs av varje månad, och avskrivningen bokförs av sig själv.' },
    linkLabel: 'Anläggningsregister',
    ctaTitle: 'Låt avskrivningarna sköta sig själva',
    path: '/anlaggningsregister',
    short: 'Anläggningsregister',
    seoTitle: 'Anläggningsregister och avskrivningar | Bokix',
    seoDescription: 'Bokix har ett anläggningsregister inbyggt i bokföringen. Avskrivningarna räknas och bokförs varje månad, och försäljning bokförs rätt. 30 dagar gratis.',
    eyebrow: 'Anläggningsregister',
    title: 'Anläggningsregister med avskrivningar',
    lead: 'Lägg in tillgången en gång. Avskrivningen räknas och bokförs varje månad.',
    highlights: ['Avskrivning varje månad', 'Färdiga kategorier och konton', 'Bokfört värde när som helst', 'Försäljning bokförs rätt'],
    factsTitle: 'Bra att veta om inventarier',
    factsLead: 'Det som avgör om ett inköp ska skrivas av eller dras direkt.',
    includedTitle: 'Det här ingår i anläggningsregistret',
    included: [
      'Färdiga kategorier, som datorer, inventarier, bilar, maskiner och byggnader, med rätt konton och en föreslagen avskrivningstid.',
      'Linjär avskrivning per månad från den månad tillgången togs i bruk, ned till ett restvärde om du har ett.',
      'Alla månadens avskrivningar bokförs i en verifikation, och låsta år lämnas orörda.',
      'Bokfört värde och avskrivningsplan för varje tillgång.',
      'Försäljning eller utrangering bokförs med vinst eller förlust mot rätt konton.',
      'Bokix hittar inköp som bokförts på tillgångskonton men saknas i registret, så att inget glöms.',
    ],
    steps: [
      { title: 'Lägg in tillgången', body: 'Slå på Anläggningstillgångar under Inställningar. Välj kategori, ange vad tillgången kostade och när den togs i bruk. Avskrivningstiden föreslås.' },
      { title: 'Bokför avskrivningarna', body: 'Varje månad visar Bokix vad som ska skrivas av, och du bokför alla med ett klick.' },
      { title: 'Sälj eller utrangera', body: 'När tillgången säljs eller slängs bokförs det rätt, med vinst eller förlust.' },
    ],
    facts: [
      { title: 'Billiga inköp dras direkt', body: 'Inventarier av mindre värde, under ett halvt prisbasbelopp, och sådant som håller kortare än tre år får dras av direkt som en kostnad.' },
      { title: 'Dyrare inventarier skrivs av', body: 'En dator, bil eller maskin som håller i flera år kostnadsförs med en del per år genom avskrivningar.' },
      { title: 'Avskrivningen påverkar resultatet', body: 'Avskrivningen är en kostnad i resultaträkningen, och tillgången står kvar i balansräkningen till sitt bokförda värde.' },
    ],
    faq: [
      { q: 'Vilken avskrivningsmetod använder Bokix?', a: 'Linjär avskrivning per månad: lika mycket varje månad under avskrivningstiden. Du väljer själv tiden och om tillgången har ett restvärde.' },
      { q: 'Kan jag lägga in tillgångar jag redan bokfört?', a: 'Ja. Bokix visar inköp på tillgångskontona som saknas i registret, och du lägger in dem därifrån.' },
      { q: 'Vad händer när jag säljer en inventarie?', a: 'Du anger datum och vad du fick betalt. Bokix bokför försäljningen, tar bort tillgången och de samlade avskrivningarna och bokför vinsten eller förlusten.' },
      { q: 'Kostar anläggningsregistret extra?', a: PRICE + ' Anläggningsregistret ingår.' },
    ],
    related: [
      { label: 'Bokslut för småföretag: checklista', to: '/blogg/bokslut-checklista' },
      { label: 'Bokföringsordlista', to: '/ordlista' },
    ],
  },

  // ── Sökningar på "bokföringsprogram" + pris, dator och läge ──────────
  {
    slug: 'billigt',
    video: { title: 'Det här ingår i Bokix för 179 kr i månaden', description: 'Med anställda kostar Bokix 179 kr i månaden, och fakturor, lön, moms, bokslut, lager och support ingår.' },
    path: '/billigt-bokforingsprogram',
    short: 'Billigt bokföringsprogram',
    linkLabel: 'Pris och vad som ingår',
    ctaTitle: 'Prova Bokix gratis i 30 dagar',
    seoTitle: 'Billigt bokföringsprogram: allt ingår, 129 kr/mån | Bokix',
    seoDescription: 'Bokix är ett prisvärt bokföringsprogram där allt ingår: fakturor, lön, moms och bokslut. 129 kr/mån utan anställda, inga tillägg. 30 dagar gratis.',
    eyebrow: 'Billigt bokföringsprogram',
    title: 'Billigt bokföringsprogram där allt ingår',
    lead: '129 kr i månaden, 179 kr med anställda. Inga tillägg.',
    highlights: ['129 kr/mån utan anställda', 'Ingen moms tillkommer', 'Inga tillägg per funktion', 'Ingen bindningstid'],
    factsTitle: 'Så jämför du priset på bokföringsprogram',
    factsLead: 'Månadspriset säger inte allt. Räkna på det du faktiskt kommer att använda under ett år.',
    includedTitle: 'Det här ingår i priset',
    included: [
      'Löpande bokföring, med ett enkelt läge för dig som inte kan debet och kredit.',
      'Kvitton som läses av från ett foto och fakturor med egen logga, utan avgift per faktura.',
      'Lön med skattetabeller, AGI-fil och lönebesked (179 kr/mån med anställda).',
      'Momsdeklaration som fil, bokslut, NE-bilaga eller INK2 och årsredovisning enligt K2.',
      'Lager, anläggningsregister och projekt när du behöver dem.',
      'Support via e-post, och bokföringen sparas i sju år.',
    ],
    steps: [
      { title: 'Prova gratis i 30 dagar', body: 'Allt i Bokix är öppet under provperioden, så du hinner prova det du behöver.' },
      { title: 'Välj månad eller år', body: '129 eller 179 kr/mån på månadsplanen. Med årsplan 109 respektive 149 kr/mån.' },
      { title: 'Säg upp när du vill', body: 'Månadsplanen har ingen bindningstid. Bokföringen kan alltid laddas ned som SIE4-fil.' },
    ],
    facts: [
      { title: 'Räkna med tilläggen', body: 'Många program har ett lågt grundpris och tar extra för lön, bokslut, fler användare eller per faktura. Lägg ihop det du behöver under ett helt år.' },
      { title: 'Kolla om moms tillkommer', body: 'Bokix är inte momsregistrerat, så 129 kr är slutpriset. Hos andra kan priset stå utan moms.' },
      { title: 'Bokslutet är dyrast att missa', body: 'Ett program utan bokslut och deklaration kan bli dyrt den dag du behöver köpa hjälp med det. I Bokix ingår det.' },
    ],
    faq: [
      { q: 'Är Bokix gratis?', a: 'De första 30 dagarna är gratis. Därefter kostar Bokix 129 kr/mån utan anställda och 179 kr/mån med anställda.' },
      { q: 'Tillkommer moms på priset?', a: 'Nej. Bokix är inte momsregistrerat, så priset är slutbeloppet.' },
      { q: 'Finns det någon bindningstid?', a: 'Inte på månadsplanen. Årsplanen, som är billigare per månad, gäller i minst tre månader.' },
      { q: 'Kostar lön eller bokslut extra?', a: 'Nej. Med anställda kostar Bokix 179 kr/mån, och då ingår lönen. Bokslut, deklarationsunderlag och årsredovisning ingår alltid.' },
    ],
    related: [
      { label: 'Alla priser', to: '/priser' },
      { label: 'Så väljer du bokföringsprogram', to: '/blogg/valja-bokforingsprogram' },
      { label: 'Byt bokföringsprogram och ta med bokföringen', to: '/byt-bokforingsprogram' },
    ],
  },
  {
    slug: 'nystartat',
    video: { title: 'Så kommer ett nytt företag igång i Bokix', description: 'Organisationsnumret skrivs in, företagets uppgifter hämtas och bokföringen kan börja samma dag.' },
    path: '/bokforingsprogram-nystartat-foretag',
    short: 'Nystartat företag',
    linkLabel: 'För nystartade företag',
    ctaTitle: 'Starta bokföringen samma dag som företaget',
    seoTitle: 'Bokföringsprogram för nystartade företag | Bokix',
    seoDescription: 'Bokix är ett enkelt bokföringsprogram för dig som just startat företag. Uppgifterna hämtas från organisationsnumret och inget kräver förkunskaper.',
    eyebrow: 'Bokföringsprogram för nystartade företag',
    title: 'Bokföringsprogram för nya företag',
    lead: 'Skriv in organisationsnumret, så är du igång på några minuter.',
    highlights: ['Uppgifterna hämtas åt dig', 'Ingen förkunskap behövs', 'Det osäkra hamnar i Att granska', '30 dagar gratis'],
    factsTitle: 'Bra att veta när du startar företag',
    factsLead: 'Det första året är det mesta nytt. Det här är bra att ha koll på från början.',
    includedTitle: 'Det här hjälper dig i början',
    included: [
      'Företagets namn, adress och bolagsform hämtas från organisationsnumret.',
      'Räkenskapsår och momsperiod föreslås, och kan ändras om du valt något annat hos Skatteverket.',
      'Ett enkelt läge där du väljer vad som hänt, till exempel ett köp eller en försäljning, i stället för konton.',
      'Kvitton läses av från ett foto, och det Bokix inte är säker på hamnar i Att granska i stället för att gissas.',
      'En Att göra-lista som visar när moms och deklarationer ska lämnas in.',
      'Videoguider för det vanligaste: kund, faktura, kvitto, moms och lön.',
    ],
    steps: [
      { title: 'Skapa kontot med organisationsnumret', body: 'Bokix hämtar uppgifterna och föreslår räkenskapsår och momsperiod.' },
      { title: 'Bokför det du redan gjort', body: 'Lägg in startkapitalet och de första kvittona. Bokix visar vad som ska bokföras och hur.' },
      { title: 'Skicka din första faktura', body: 'Med din logga och från din egen mejladress. Betalningen bokförs när den kommer in.' },
    ],
    facts: [
      { title: 'Bokföringen börjar direkt', body: 'Alla företag är bokföringsskyldiga från start. Spara kvitton och fakturor redan från de första inköpen.' },
      { title: 'Första räkenskapsåret kan vara längre', body: 'Det första räkenskapsåret får vara kortare eller längre än tolv månader, som längst 18 månader.' },
      { title: 'F-skatt och moms', body: 'F-skatt och momsregistrering ansöker du om hos Skatteverket, enklast via verksamt.se. Vilken momsperiod du får styr hur ofta du deklarerar.' },
    ],
    faq: [
      { q: 'Behöver jag kunna bokföring för att använda Bokix?', a: 'Nej. I det enkla läget väljer du vad som hänt, och Bokix väljer konton och moms. Det som är osäkert hamnar i Att granska.' },
      { q: 'När ska jag börja bokföra?', a: 'Från första affärshändelsen, till exempel när du sätter in startkapitalet eller gör det första inköpet.' },
      { q: 'Vilka bolagsformer fungerar?', a: 'Enskild firma, aktiebolag, handelsbolag, kommanditbolag och ekonomisk förening.' },
      { q: 'Vad kostar Bokix?', a: PRICE + ' De första 30 dagarna är gratis.' },
    ],
    related: [
      { label: 'Bokföringsprogram för enskild firma', to: '/bokforingsprogram-enskild-firma' },
      { label: 'Bokföringsprogram för aktiebolag', to: '/bokforingsprogram-aktiebolag' },
      { label: 'Videoguider', to: '/guider' },
    ],
    // Produktsidan (2026-11-07): riktiga bilder ur appen, se productKit.jsx.
    product: {
      h1Tail: 'Igång på några minuter, utan förkunskaper.',
      lead: 'Skriv in organisationsnumret, så hämtas företaget åt dig. Sedan väljer du vad som hänt, och Bokix väljer konton och moms.',
      heroTabs: [
        { label: 'Översikt', shot: 'start', caption: 'Startsidan: resultat, pengar på banken och det som ska göras härnäst.' },
        { label: 'Att göra', shot: 'skatt', caption: 'Vad som ska lämnas in härnäst, med dagar kvar.' },
        { label: 'Kvitton', shot: 'kvitton', caption: 'Kvittona med vad som är bokfört och vad som behöver granskas.' },
        { label: 'Fakturan', shot: 'faktura', caption: 'Din första faktura, med bankgiro och OCR-nummer.' },
        { label: 'Moms', shot: 'moms', caption: 'Momsdeklarationen fylls i ur bokföringen, ruta för ruta.' },
      ],
      reasonsTitle: 'Därför passar Bokix när du är ny',
      reasons: [
        { title: 'Företaget hämtas åt dig', body: 'Namn, adress och bolagsform hämtas från organisationsnumret. Räkenskapsår och momsperiod föreslås.' },
        { title: 'Du väljer vad som hänt', body: 'Ett köp, en försäljning eller pengar du satt in. Bokix väljer konton och moms.' },
        { title: 'Det osäkra gissas inte', body: 'Det Bokix inte är säker på hamnar i Att granska, så att du kan titta på det i stället för att det blir fel.' },
      ],
      featuresTitle: 'Det här gör du i Bokix',
      features: [
        { kicker: 'Kvitton', title: 'Fota kvittot, resten fylls i', shot: 'kvitton-c', body: 'Datum, belopp och moms läses av från fotot. Spara kvittona från första inköpet, så är allt på plats.', points: ['Flera momssatser på samma kvitto', 'Foto, PDF eller en hel mapp på en gång', 'Kvittot sparas med verifikationen i sju år'] },
        { kicker: 'Fakturering', title: 'Din första faktura', shot: 'ny-faktura-c', body: 'Välj kund och skriv vad du sålt. Moms och förfallodag räknas ut, och fakturan skickas från din egen e-post.', points: ['Din logga på fakturan', 'Bankgiro och OCR-nummer', 'Betalningen bokförs när den kommer in'] },
        { kicker: 'Att göra', title: 'Datumen du inte får missa', shot: 'skatt-c', body: 'Under Skatt och bokslut ser du vad som ska lämnas in härnäst och hur många dagar du har kvar.', points: ['Moms, arbetsgivardeklaration och bokslut', 'Dagar kvar till varje datum', 'Ett klick till rätt steg'] },
        { kicker: 'Moms', title: 'Momsdeklarationen räknas fram', shot: 'moms-c', body: 'Rutorna fylls i ur bokföringen. Du kontrollerar, granskar och bokför, och laddar ner filen till Skatteverket.', points: ['Per månad, kvartal eller år', 'Kontroll av perioden innan du lämnar in', 'Momsen bokförs mot skattekontot'] },
      ],
      year: {
        title: 'Ditt första år',
        lead: 'Så brukar det första året se ut, oavsett bolagsform.',
        every: 'Spara kvitton och fakturor från första affärshändelsen. Alla företag är bokföringsskyldiga från start.',
        quarters: [
          { label: 'Första dagen', events: [
            { date: 'Några minuter', title: 'Skapa kontot', bokix: 'Organisationsnumret fyller i företaget. Räkenskapsår och momsperiod föreslås.', key: true },
          ] },
          { label: 'Första veckan', events: [
            { date: 'Startkapitalet', title: 'Bokför det du redan gjort', bokix: 'Startkapitalet och de första kvittona. Bokix visar hur.' },
            { date: 'Första kunden', title: 'Skicka din första faktura', bokix: 'Med din logga och från din egen e-post.', key: true },
          ] },
          { label: 'Första perioden', events: [
            { date: 'Efter perioden', title: 'Första momsdeklarationen', bokix: 'Fylls i ur bokföringen. Datumet står under Skatt och bokslut.', key: true },
          ] },
          { label: 'När året är slut', events: [
            { date: 'Bokslut', title: 'Första bokslutet', bokix: 'Steg för steg, med det som gäller din bolagsform: NE-bilaga, INK2 eller INK4.', key: true },
          ] },
        ],
        note: 'Det första räkenskapsåret får vara kortare eller längre än tolv månader, som längst 18 månader.',
      },
      compare: {
        title: 'Själv, med byrå eller med Bokix',
        lead: 'Många nya företag börjar i Excel och byter när det blir för mycket. Det är enklare att börja rätt.',
        cols: ['I Excel', 'Med redovisningsbyrå', 'Med Bokix'],
        rows: [
          ['Kostnad', 'Inget program, men mycket tid', 'Arvode per timme eller månad', '129 kr/mån, 30 dagar gratis'],
          ['Förkunskaper', 'Du behöver kunna konton', 'Inga', 'Inga, du väljer vad som hänt'],
          ['Moms och deklaration', 'Du räknar själv', 'Byrån gör det', 'Räknas fram, du lämnar in'],
          ['Koll på siffrorna', 'När du själv har uppdaterat', 'När byrån har skickat rapporten', 'Hela tiden, på startsidan'],
        ],
      },
      price: { amount: '129 kr', unit: '/mån', text: 'De första 30 dagarna är gratis. Sedan 129 kr/mån, 179 kr/mån med anställda. Ingen moms tillkommer och ingen bindningstid på månadsplanen.' },
    },
  },
  // ── Alternativ till Fortnox ──────────────────────────────────────────
  // Ärlig jämförelse: om Fortnox står bara allmänt kända saker (direkt
  // bankkoppling, e-faktura, stor marknadsplats, många byråer), inga priser
  // som kan bli fel och inga påståenden om att Fortnox är sämre. Sidan säger
  // när Fortnox passar bättre. Länkas från /byt-bokforingsprogram, inte från
  // sidfoten (användarens önskan 2026-10-15).
  {
    slug: 'fortnox',
    path: '/alternativ-till-fortnox',
    short: 'Alternativ till Fortnox',
    linkLabel: 'Alternativ till Fortnox',
    ctaTitle: 'Prova Bokix bredvid det du har i dag',
    video: { title: 'Så flyttar du bokföringen till Bokix', description: 'En SIE4-fil från ditt nuvarande program läses in i Bokix, och konton, verifikationer och kunder följer med.' },
    seoTitle: 'Alternativ till Fortnox: ett pris, allt ingår | Bokix',
    seoDescription: 'Letar du efter ett alternativ till Fortnox? Bokix är ett enklare bokföringsprogram där allt ingår för 129 kr/mån. Flytta med en SIE4-fil. 30 dagar gratis.',
    eyebrow: 'Alternativ till Fortnox',
    title: 'Ett enklare alternativ till Fortnox',
    lead: 'Ett pris där allt ingår, och en bokföring du klarar utan debet och kredit. Flytta med en SIE4-fil.',
    factsTitle: 'När passar vilket?',
    factsLead: 'Båda är bra program. Det avgör vad ditt företag behöver.',
    includedTitle: 'Det här får du i Bokix',
    included: [
      'Ett pris: 129 kr/mån utan anställda och 179 kr/mån med. Ingen moms tillkommer och inga tillägg per funktion.',
      'Ett enkelt läge där du väljer vad som hänt i stället för konton, och Debet och kredit när du vill.',
      'Kvitton som läses av från ett foto och fakturor som skickas från din egen Gmail.',
      'Moms, lön med AGI-fil, bokslut, INK2 eller NE och årsredovisning enligt K2 i samma program.',
      'Lager, anläggningsregister och projekt när du behöver dem, utan extra kostnad.',
      'Bjud in din redovisningskonsult eller revisor i samma bokföring.',
    ],
    compare: {
      title: 'Bokix och Fortnox i korthet',
      lead: 'Uppgifterna om Fortnox är allmänna. Kolla alltid det aktuella på fortnox.se.',
      cols: ['Bokix', 'Fortnox'],
      rows: [
        ['Pris', '129 kr/mån, 179 kr med anställda. Allt ingår.', 'Beror på vilket paket och vilka tillägg du väljer.'],
        ['Bokföring utan debet och kredit', 'Ja, ett enkelt läge.', 'Bokföring med konton och mallar.'],
        ['Banken', 'Kontoutdrag läses in som fil.', 'Direktkoppling till banken.'],
        ['E-faktura via Peppol', 'Inte än.', 'Ja.'],
        ['Integrationer', 'Stripe, Zettle, Gmail och SIE4.', 'En stor marknadsplats med integrationer.'],
        ['Redovisningsbyrå', 'Bjud in din konsult i samma bokföring.', 'Många byråer arbetar redan i Fortnox.'],
      ],
    },
    steps: [
      { title: 'Exportera en SIE4-fil ur Fortnox', body: 'SIE-exporten finns bland bokföringens inställningar i Fortnox. Välj SIE4 och hela räkenskapsåret.' },
      { title: 'Läs in den i Bokix', body: 'Konton, verifikationer och ingående balanser följer med. Inget sparas förrän du godkänt förhandsgranskningen.' },
      { title: 'Prova sida vid sida', body: 'Kör Bokix i 30 dagar gratis innan du säger upp något.' },
    ],
    facts: [
      { title: 'Bokix passar dig som', body: 'Har ett litet företag, vill ha ett fast pris där allt ingår och hellre väljer vad som hänt än konton.' },
      { title: 'Fortnox passar bättre om', body: 'Du behöver direkt bankkoppling, e-faktura via Peppol eller en särskild integration från deras marknadsplats.' },
      { title: 'Byt vid årsskiftet', body: 'Enklast är att byta när ett räkenskapsår börjar. Då tar du bara med de ingående balanserna, eller hela historiken om du vill.' },
    ],
    faq: [
      { q: 'Är Bokix ett bra alternativ till Fortnox?', a: 'För de flesta småföretag, ja. Bokix har bokföring, fakturor, moms, lön och bokslut till ett fast pris. Behöver du direkt bankkoppling eller e-faktura via Peppol passar Fortnox bättre i dag.' },
      { q: 'Hur flyttar jag från Fortnox till Bokix?', a: 'Exportera en SIE4-fil i Fortnox och läs in den under Inställningar och Import och export i Bokix. Konton, verifikationer och ingående balanser följer med.' },
      { q: 'Följer kunderna och fakturorna med?', a: 'Bokföringen följer med i SIE4-filen. Kundregistret kan du importera som en lista. Gamla fakturor finns kvar som verifikationer.' },
      { q: 'Vad kostar Bokix jämfört med Fortnox?', a: PRICE + ' Fortnox pris beror på vilket paket du väljer, så jämför med det du betalar i dag.' },
    ],
    related: [
      { label: 'Byt bokföringsprogram och ta med bokföringen', to: '/byt-bokforingsprogram' },
      { label: 'SIE4 förklarat: så flyttar du bokföringen', to: '/blogg/sie4-flytta-bokforing' },
      { label: 'Så väljer du bokföringsprogram', to: '/blogg/valja-bokforingsprogram' },
    ],
  },
];

// Lön och Integrationer har egna sidor men visas bland korten under "Mer i Bokix".
export const PAYROLL_CARD = { path: '/lon', linkLabel: 'Lön och arbetsgivare' };
export const INTEGRATIONS_CARD = { path: '/integrationer', linkLabel: 'Integrationer' };

// Filmen överst på varje funktionssida: public/videos/hero/<fil>.mp4 och .jpg,
// inspelade av scripts/render-hero-videos.mjs. Filnamnet är sidans sökväg.
export const HERO_VIDEO_DATE = '2026-10-15';
export const HERO_VIDEO_DURATION = 'PT10S';
export const heroVideoFile = (page) => page.path.slice(1);

export const FEATURE_BY_PATH = Object.fromEntries(FEATURE_PAGES.map(p => [p.path, p]));

// Lön och arbetsgivare (/lon), 2026-11-07: samma produktsida som de andra
// (ProductOrgPage), men en egen sida och inte med bland FEATURE_PAGES.
export const PAYROLL_PRODUCT_PAGE = {
  slug: 'lon',
  path: '/lon',
  short: 'Lön',
  seoTitle: 'Löneprogram: lönekörning, AGI-fil och lönebesked | Bokix',
  seoDescription: 'Lönekörning med skattetabeller och arbetsgivaravgift efter ålder, AGI-fil till Skatteverket, lönebesked som PDF och betalfil till banken. Bokförs direkt.',
  eyebrow: 'Lön och arbetsgivare',
  title: 'Löneprogram',
  ctaTitle: 'Kör din första lön i Bokix',
  faq: [
    { q: 'Ingår lönen i abonnemanget?', a: 'Ja. Med anställda kostar Bokix 179 kr/mån, oavsett hur många anställda du har. Det finns ingen avgift per lönebesked eller per anställd.' },
    { q: 'Hur lämnar jag arbetsgivardeklarationen?', a: 'Bokix skapar AGI-filen när lönekörningen är klar. Du loggar in hos Skatteverket med BankID och laddar upp filen i e-tjänsten Arbetsgivardeklaration.' },
    { q: 'Fungerar betalfilen med min bank?', a: 'Betalfilen följer standarden ISO 20022 (pain.001), som de stora svenska bankerna tar emot. Kontrollera med din bank att filöverföring är påslaget.' },
    { q: 'Hur får de anställda sina lönebesked?', a: 'Som PDF med e-post. Filen är skyddad med de fyra sista siffrorna i den anställdas personnummer.' },
    { q: 'Kan jag räkna på en lön innan jag anställer?', a: 'Ja, i den fria lönekalkylatorn ser du nettolön, arbetsgivaravgift och vad lönen kostar företaget.' },
  ],
  related: [
    { label: 'Lönekalkylator', to: '/verktyg/lonekalkylator' },
    { label: 'Videoguide: lägg till en anställd', to: '/guider/ny-anstalld' },
  ],
  product: {
    hero: { type: 'payslip', payslip: {
      name: 'Johanna Exempel', period: 'November 2026',
      rows: [{ label: 'Månadslön', amount: 38500 }, { label: 'Skatt, tabell 33', amount: -8039 }],
      net: 30461,
      costRows: [{ label: 'Bruttolön', amount: 38500 }, { label: 'Arbetsgivaravgift 31,42 %', amount: 12097 }, { label: 'Semesterlön och avgift', amount: 5472 }],
      totalCost: 56069,
    } },
    signature: {
      kicker: 'Varje månad', title: 'Din lönemånad',
      lead: 'Fyra steg, och filerna är klara när du behöver dem.',
      type: 'flow',
      steps: [
        { title: 'Lönekörningen', body: 'Välj månad och utbetalningsdag. Skatt och avgifter räknas för varje anställd.' },
        { title: 'Lönedagen', body: 'Betalfilen läses in i banken, och lönebeskeden skickas med e-post.' },
        { title: 'Bokföringen', body: 'Bruttolön, skatt, arbetsgivaravgift och nettolön bokförs på rätt konton.' },
        { title: 'Den 12:e', body: 'AGI-filen laddas upp hos Skatteverket, och skatten betalas till skattekontot.' },
      ],
    },
    h1Tail: 'Lönen, skatten och filerna på samma ställe.',
    lead: 'Välj månad och utbetalningsdag. Bokix räknar skatt och arbetsgivaravgift, tar fram AGI-filen och betalfilen och bokför lönen.',
    featuresTitle: 'Det här gör du i Bokix',
    features: [
      { kicker: 'Lönekörning', title: 'Lönen steg för steg', shot: 'lonekorning-ny-c', body: 'Välj månad och utbetalningsdag, så tas alla aktiva anställda med. Lägg till tillägg och avdrag per person.', points: ['Månadslön och timlön', 'Traktamente, milersättning och förmåner', 'Lönebesked som PDF med e-post'] },
      { kicker: 'Semester', title: 'Koll på semestern', shot: 'semester-c', body: 'Se hur många dagar varje anställd har kvar och vad de kostar, med semesterlön och arbetsgivaravgift.', points: ['Semesterlagens regler', 'Sparade dagar till nästa år', 'Semester tas ut i lönekörningen'] },
      { kicker: 'Anställda', title: 'Allt om de anställda på ett ställe', shot: 'anstalld-c', body: 'Personuppgifter, anställning, lön, skattetabell och bankkonto för utbetalningen.', points: ['Skattetabell och kolumn per anställd', 'Bankkonto till betalfilen', 'Export av alla anställda'] },
    ],
    compare: {
      title: 'För hand, lönebyrå eller Bokix',
      lead: 'En lönebyrå passar om du vill lämna bort allt. Bokix passar om du har några anställda och vill köra lönen själv.',
      cols: ['För hand', 'Med lönebyrå', 'Med Bokix'],
      rows: [
        ['Kostnad', 'Inget program, men mycket tid', 'Avgift per lönebesked eller månad', '179 kr/mån, oavsett antal anställda'],
        ['Skatt och avgifter', 'Slås upp i tabeller', 'Byrån räknar', 'Räknas åt dig'],
        ['AGI och betalfil', 'Fylls i för hand', 'Byrån gör det', 'Filerna skapas varje månad'],
        ['Bokföringen', 'Förs in för hand', 'Byrån skickar underlag', 'Bokförs direkt'],
      ],
    },
    price: { amount: '179 kr', unit: '/mån', text: 'Med anställda, oavsett hur många. Bokföring, fakturor och moms ingår också. 149 kr/mån med årsplan. Ingen moms tillkommer. 30 dagar gratis.' },
  },
};
