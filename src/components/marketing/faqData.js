// ── FAQ-innehåll, EN källa ──────────────────────────────────────────────
// Används av /vanliga-fragor (FaqPage.jsx), startsidans FAQ-kort och
// FAQPage-schemat nedan, så att det besökaren ser och det Google och
// AI-tjänster läser aldrig glider isär.
//
// Frågorna är grupperade efter vad man vill veta. Varje svar börjar med det
// raka svaret (ja, nej, ett pris) och förklarar sedan kort; det gör sidan
// lätt att skumma och ger svarsmotorer en mening att citera. `top` markerar
// de sex frågor som visas överst som "Det viktigaste", med `short` som
// kortsvar där. Inga löften som inte finns i produkten.
export const FAQ_GROUPS = [
  {
    id: 'kom-igang',
    title: 'Kom igång',
    items: [
      { top: true, q: 'Behöver jag kunna bokföring?', short: 'Nej. Bokix bokför dina kvitton och fakturor åt dig och frågar bara när något är osäkert.', a: 'Nej. Bokix skapar verifikationerna från dina kvitton och fakturor, med rätt konto och moms. Det som är osäkert gissas aldrig fram, utan hamnar i Granskning med en förklaring, så att du bara behöver ta ställning till det.' },
      { top: true, q: 'Vilka företag passar Bokix för?', short: 'Enskild firma, aktiebolag, handelsbolag, kommanditbolag och ekonomisk förening.', a: 'Enskild firma, aktiebolag, handelsbolag, kommanditbolag och ekonomisk förening. Bokix känner igen bolagsformen på organisationsnumret när du lägger upp företaget och följer reglerna som gäller för den, till exempel årsredovisning enligt K2 för aktiebolag.' },
      { q: 'Kan jag byta från mitt nuvarande program?', a: 'Ja. Du exporterar en SIE4-fil ur programmet du använder i dag och läser in den i Bokix. Konton, verifikationer och ingående balanser följer med, och ingenting skrivs in förrän du har godkänt hur kontona matchas.' },
      { q: 'Finns det hjälp för att komma igång?', a: 'Ja. Det finns tolv korta videoguider med berättarröst som visar hur du gör, från första kunden till momsdeklarationen, och support ingår i priset.' },
      { q: 'Finns det något för UF-företag?', a: 'Ja. UF-företag använder Bokix gratis i tre månader, utan organisationsnummer och utan betaluppgifter, med en meny som bara visar det ett UF-företag behöver.' },
    ],
  },
  {
    id: 'pris',
    title: 'Pris och avtal',
    items: [
      { top: true, q: 'Vad kostar Bokix?', short: '129 kr/mån utan anställda, 179 kr/mån med. Ingen moms tillkommer.', a: '129 kr/mån utan anställda och 179 kr/mån med anställda. Med årsplanen blir det 109 respektive 149 kr/mån. Ingen moms tillkommer eftersom Bokix inte är momsregistrerat, och allt ingår: obegränsat med fakturor och kvitton, inga tillägg att köpa.' },
      { top: true, q: 'Kan jag prova gratis?', short: 'Ja, i 30 dagar. Avslutar du innan dess kostar det ingenting.', a: 'Ja, i 30 dagar. Du lägger in dina betaluppgifter hos Stripe när du skapar kontot, men ingenting dras under de första 30 dagarna. Avslutar du innan dess kostar det dig aldrig något.' },
      { q: 'Finns det bindningstid?', a: 'Nej, inte på månadsplanen. Du avslutar när du vill. Årsplanen ger ett lägre pris mot att den gäller i minst tre månader, sedan avslutar du den lika fritt.' },
      { q: 'Vad är skillnaden mellan de två priserna?', a: 'Samma bokföring och fakturering i båda. Med anställda lägger till lönekörning med skatteavdrag, lönebesked, AGI-fil till Skatteverket och en betalfil till banken.' },
      { q: 'Ingår support?', a: 'Ja, i båda priserna. Du når oss på support@bokix.se eller via kontaktformuläret.' },
    ],
  },
  {
    id: 'bokforing',
    title: 'Bokföring, moms och bokslut',
    items: [
      { top: true, q: 'Hur fungerar kvitton?', short: 'Fota kvittot, så läser Bokix av datum, belopp och moms.', a: 'Fota kvittot eller ladda upp en bild eller pdf. Bokix läser av datum, belopp och moms, även när samma kvitto har flera momssatser, och föreslår ett konto. Du ser alltid förslaget innan det bokförs, och papperskvittot får du slänga när du har fotat det.' },
      { q: 'Hur gör jag momsdeklarationen?', a: 'Bokix räknar fram momsdeklarationen ruta för ruta, per månad, kvartal eller år. Du laddar ner filen och lämnar in den hos Skatteverket med BankID. Bokix skickar aldrig in något åt dig, och påminner i god tid före varje datum.' },
      { q: 'Klarar Bokix bokslut och årsredovisning?', a: 'Ja. Bokix hjälper dig genom bokslutet, tar fram SRU-filer till inkomstdeklarationen och gör årsredovisningen enligt K2 för aktiebolag som en pdf att skriva under. Själva inlämningen gör du hos Skatteverket och Bolagsverket.' },
      { q: 'Kan jag koppla banken?', a: 'Du läser in kontoutdraget som en fil från internetbanken, och raderna matchas mot dina fakturor. Det finns ingen direktkoppling mot banken, så du lämnar aldrig ut några bankuppgifter.' },
      { q: 'Följer Bokix svenska regler?', a: 'Ja. Bokix bokför enligt BAS-kontoplanen och bokföringslagen, räknar moms med 25, 12 och 6 procent och skatteavdrag enligt Skatteverkets tabeller, och sparar bokföringen i sju år.' },
    ],
  },
  {
    id: 'fakturor',
    title: 'Fakturor och betalningar',
    items: [
      { top: true, q: 'Kan kunden betala fakturan med kort?', short: 'Ja, via Stripe. Betalningen bokförs automatiskt.', a: 'Ja. Kopplar du Stripe får fakturan en Betala nu-knapp, och kunden betalar med kort, Apple Pay eller Google Pay. Betalningen prickas av mot fakturan och bokförs, med Stripes avgift som en egen kostnad.' },
      { q: 'Kan fakturorna skickas från min egen e-post?', a: 'Ja. Koppla ditt Gmail-konto eller din egen e-postadress, så går fakturor, offerter och påminnelser från din adress och svaren hamnar i din inkorg. Bokix får bara skicka e-post, aldrig läsa den.' },
      { q: 'Fungerar ROT- och RUT-avdrag?', a: 'Ja. Avdraget räknas på arbetskostnaden och visas både på fakturan och i underlaget till Skatteverket.' },
      { q: 'Jag säljer i butik. Fungerar kassan?', a: 'Ja, om du tar betalt med Zettle. Bokix hämtar dagens försäljning och gör ett färdigt dagsavslut med rätt moms och avgifter, som du godkänner med ett klick.' },
    ],
  },
  {
    id: 'lon',
    title: 'Lön och anställda',
    items: [
      { q: 'Kan Bokix sköta lönen?', a: 'Ja, med priset för anställda. Lönekörningen räknar skatteavdrag enligt Skatteverkets tabeller och arbetsgivaravgift efter ålder, ger lönebesked som pdf, en AGI-fil att lämna in hos Skatteverket och en betalfil till banken.' },
      { q: 'Hur många användare kan vi vara?', a: 'Upp till tre användare per företag, och du kan ha flera företag under samma konto.' },
    ],
  },
  {
    id: 'sakerhet',
    title: 'Säkerhet och data',
    items: [
      { q: 'Var lagras min bokföring?', a: 'Inom EU, i Frankfurt. Varje företags data är avskild i databasen så att ingen annan kommer åt den, och du kan slå på tvåstegsverifiering.' },
      { q: 'Kan jag ta med mig bokföringen om jag slutar?', a: 'Ja. Du exporterar allt som en SIE4-fil, som alla svenska bokföringsprogram kan läsa. Slutar du betala kan du fortfarande ladda ner din bokföring, och den sparas i sju år som lagen kräver.' },
    ],
  },
];

// Alla frågor i en lista, i visningsordning.
export const FAQ_ITEMS = FAQ_GROUPS.flatMap(g => g.items);
export const FAQ_TOP = FAQ_ITEMS.filter(i => i.top);

// FAQPage-schema byggt direkt av frågorna ovan.
export const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};
