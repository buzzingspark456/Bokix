// ── Enda källan för Bokix-bloggens inlägg ───────────────────────────────
// Läses av både BlogPage.jsx (listan på /blogg) och varje enskilt
// inläggs egen sida (t.ex. EnkelBokforingPage.jsx, /enkel-bokforing) — ett
// inlägg skrivs in HÄR en gång, sen syns det på båda ställena, i stället
// för att titel/datum/ingress riskerar att glida isär mellan en lista och
// själva artikeln.
//
// Ett inlägg bor kvar på sin egen, redan existerande sökväg (t.ex.
// /enkel-bokforing) snarare än att flyttas under /blogg/<slug> — den
// sökvägen kan redan vara indexerad, och att flytta den utan en 301 hade
// tappat det. `path` pekar dit; `/blogg` är bara en lista med länkar dit,
// inte en ny mapp inläggen bor i.
export const BLOG_POSTS = [
  {
    slug: 'bokfora-stripe',
    path: '/blogg/bokfora-stripe',
    category: 'Bokföring',
    title: 'Så bokför du Stripe',
    seoTitle: 'Bokföra Stripe: kortbetalningar, avgifter och utbetalningar',
    seoDescription: 'Så bokför du Stripe rätt: kortbetalning på fakturan, försäljning i webbshop, Stripes avgift, återbetalningar och utbetalningen till banken. Med konton och exempel.',
    excerpt: 'Kortbetalningar, avgifter och utbetalningen till banken.',
    image: '/blog/bokfora-stripe-hero.jpg',
    imageAlt: 'Tecknad utbetalningsspecifikation från Stripe med en fakturabetalning, webbshopsköp, Stripes avgift och en återbetalning, bredvid en stapel mynt',
    datePublished: '2026-10-17',
    dateModified: '2026-10-17',
    readTime: '~5 min läsning',
    tldr: [
      'Pengarna landar först på ditt Stripe-saldo. Bokför saldot på ett eget konto, till exempel 1686, och flytta det till 1930 när Stripe betalar ut.',
      'Stripes avgift bokförs på 6570 Bankkostnader. Själva kortavgiften är utan moms.',
      'Bokför varje betalning för sig, inte bara utbetalningen. Annars blir momsen och försäljningen fel.',
    ],
    body: [
      { t: 'p', x: 'Stripe används på två sätt i ett litet företag. Kunden betalar **fakturan med kort**, eller så säljer du direkt via Stripe i en webbshop, en betallänk eller en prenumeration.' },
      { t: 'p', x: 'Båda ska bokföras. Och i båda fallen kommer pengarna till banken senare, efter att Stripe dragit sin avgift.' },

      { t: 'h2', x: 'Pengarna stannar först hos Stripe' },
      { t: 'p', x: 'När kunden betalar hamnar pengarna på ditt **Stripe-saldo**. Stripe drar sin avgift direkt.' },
      { t: 'p', x: 'Några dagar senare betalar Stripe ut till ditt bankkonto. En utbetalning innehåller ofta flera betalningar, minus avgifter och återbetalningar.' },
      { t: 'p', x: 'Därför går det inte att bokföra bara utbetalningen. Då försvinner avgiften, momsen blir fel och ingen faktura blir betald.' },

      { t: 'h2', x: 'Stripe-saldot får ett eget konto' },
      { t: 'p', x: 'Behandla saldot som ett eget litet konto. I BAS 2026 passar **1686 Fordringar för kontokort och kuponger**. Tidigare användes ofta 1580.' },
      { t: 'p', x: 'Allt som händer i Stripe går via det kontot. När utbetalningen kommer flyttas pengarna till **1930 Företagskonto**, och 1686 går ner till noll igen.' },
      { t: 'table', caption: 'Kunden betalar en faktura på 1 250 kr med kort', head: ['Händelse', 'Debet', 'Kredit'], rows: [
        ['Kunden betalar fakturan', '1686 Stripe-saldo 1 250', '1510 Kundfordringar 1 250'],
        ['Stripes avgift', '6570 Bankkostnader 22', '1686 Stripe-saldo 22'],
        ['Stripe betalar ut', '1930 Företagskonto 1 228', '1686 Stripe-saldo 1 228'],
      ] },
      { t: 'p', x: 'Momsen på fakturan bokfördes redan när du skickade den. Betalningen nollar bara kundfordran.' },

      { t: 'h2', x: 'Försäljning utan faktura bokförs med moms' },
      { t: 'p', x: 'Säljer du i en webbshop eller via en betallänk finns ingen faktura. Då är betalningen själva försäljningen, och momsen bokförs samtidigt.' },
      { t: 'table', caption: 'Webbshopsköp på 500 kr med 25 % moms', head: ['Konto', 'Debet', 'Kredit'], rows: [
        ['1686 Stripe-saldo', '500', ''],
        ['3001 Försäljning 25 % moms', '', '400'],
        ['2611 Utgående moms 25 %', '', '100'],
      ] },
      { t: 'p', x: 'Säljer du böcker eller livsmedel gäller 6 eller 12 %. Säljer du till företag i andra EU-länder kan det vara omvänd moms. Läs mer i [momsdeklaration steg för steg](/blogg/moms-deklaration-steg-for-steg).' },

      { t: 'h2', x: 'Stripes kortavgift är utan moms' },
      { t: 'p', x: 'Avgiften för att ta emot en kortbetalning är en finansiell tjänst. Den har ingen moms, varken att dra av eller att redovisa som omvänd moms.' },
      { t: 'p', x: 'Andra Stripe-tjänster, som Billing eller Radar, kan ha moms. Stripe skickar en månadsfaktura för avgifterna. Spara den som underlag.' },

      { t: 'h2', x: 'Återbetalningar vänder försäljningen' },
      { t: 'p', x: 'När du betalar tillbaka till en kund bokförs försäljningen och momsen i omvänd riktning. Pengarna går ut från Stripe-saldot, 1686.' },

      { t: 'h2', x: 'Utbetalningen bokförs en gång' },
      { t: 'p', x: 'Utbetalningen syns både i Stripe och på ditt bankkontoutdrag. Bokför den bara på ett av ställena. Annars hamnar pengarna två gånger på 1930.' },
      { t: 'callout', kind: 'tips', title: 'Stäm av 1686 varje månad', x: 'Saldot på 1686 ska vara samma som ditt saldo i Stripe. Skiljer det sig har en betalning, avgift eller utbetalning inte bokförts.' },

      { t: 'h2', x: 'Så gör Bokix det åt dig' },
      { t: 'p', x: 'Kopplar du Stripe till Bokix får fakturan en **Betala nu**-knapp. Kunden betalar med kort, Apple Pay eller Google Pay, och fakturan bokförs som betald mot 1686.' },
      { t: 'p', x: 'Varje morgon hämtar Bokix alla nya transaktioner från Stripe: betalningar, avgifter, återbetalningar och utbetalningar. När du kopplar Stripe kommer de senaste 90 dagarna direkt.' },
      { t: 'image', shot: 'stripe' },
      { t: 'steps', x: [
        { h: 'Avgifter och utbetalningar', p: 'Allt kommer från Stripe, så de bokförs med ett klick. Med Bokför alla säkra tar du alla på en gång.' },
        { h: 'Försäljning utan faktura', p: 'Du väljer momssats och intäktskonto. Bokix föreslår det du valde förra gången, men gissar aldrig.' },
        { h: 'Återbetalningar', p: 'Bokförs på samma sätt, i omvänd riktning.' },
      ] },
      { t: 'p', x: 'Läs mer om kopplingen på [Integrationer](/integrationer), eller hur fakturan fungerar i [faktureringsprogrammet](/faktureringsprogram).' },
    ],
    faq: [
      { q: 'Vilket konto ska Stripe-saldot bokföras på?', a: '1686 Fordringar för kontokort och kuponger i BAS 2026. Tidigare användes 1580. Kontot går ner till noll när Stripe betalar ut till banken.' },
      { q: 'Har Stripes avgift moms?', a: 'Avgiften för kortbetalningar är en momsfri finansiell tjänst. Andra tjänster, som Stripe Billing eller Radar, kan ha moms med omvänd skattskyldighet.' },
      { q: 'Räcker det att bokföra utbetalningen från Stripe?', a: 'Nej. Utbetalningen är flera betalningar minus avgifter. Varje försäljning och avgift behöver bokföras för sig, så att moms och resultat blir rätt.' },
    ],
  },
  {
    slug: 'valja-bokforingsprogram',
    path: '/blogg/valja-bokforingsprogram',
    category: 'Kom igång',
    title: 'Så väljer du bokföringsprogram',
    seoTitle: 'Bokföringsprogram för småföretag: så väljer du rätt',
    seoDescription: 'Vad ska ett bokföringsprogram klara för just ditt företag? Nio saker att jämföra, vad varje bolagsform behöver och när ett program inte passar.',
    excerpt: 'Nio saker att jämföra innan du bestämmer dig.',
    image: '/blog/valja-bokforingsprogram-hero.jpg',
    imageAlt: 'Tecknad checklista med saker att jämföra, en blyertspenna och en lapp som frågar vad som ingår i priset',
    datePublished: '2026-10-12',
    dateModified: '2026-10-12',
    readTime: '~7 min läsning',
    tldr: [
      'Börja med din bolagsform. Enskild firma behöver NE-bilagan, aktiebolag behöver INK2 och årsredovisning.',
      'Jämför vad som ingår i priset, inte bara grundpriset. Lön, fakturor och kvitton kostar extra i en del program.',
      'Se till att du kan ta med bokföringen ut igen. SIE4 är standardformatet som alla svenska program kan läsa.',
    ],
    body: [
      { t: 'p', x: 'Alla bokföringsprogram i Sverige följer samma lag och samma kontoplan, BAS. Skillnaden är vad programmet gör åt dig och vad som ingår i priset.' },
      { t: 'p', x: 'Välj efter ditt företag, inte efter vem som syns mest.' },

      { t: 'h2', x: 'Börja med din bolagsform' },
      { t: 'p', x: 'Bolagsformen avgör vad programmet måste klara när året är slut. Den löpande bokföringen är lik för alla, men deklarationen och bokslutet skiljer sig.' },
      { t: 'table', caption: 'Vad bolagsformen kräver vid årets slut', head: ['Bolagsform', 'Deklaration', 'Bokslut'], rows: [
        ['Enskild firma', 'NE-bilagan i din egen deklaration', 'Förenklat årsbokslut (K1) om omsättningen normalt är högst 3 miljoner kr'],
        ['Aktiebolag', 'Inkomstdeklaration 2 (INK2)', 'Årsredovisning (K2 eller K3) till Bolagsverket inom sju månader'],
        ['Handelsbolag och KB', 'Inkomstdeklaration 4 (INK4), och delägarna deklarerar sin andel (N3A)', 'Årsbokslut, årsredovisning bara för större bolag'],
        ['Ekonomisk förening', 'Inkomstdeklaration 2 (INK2)', 'Årsredovisning'],
      ] },
      { t: 'p', x: 'Läs mer om vad Bokix gör för din bolagsform: [enskild firma](/bokforingsprogram-enskild-firma), [aktiebolag](/bokforingsprogram-aktiebolag), [handelsbolag](/bokforingsprogram-handelsbolag) och [ekonomisk förening](/bokforingsprogram-ekonomisk-forening).' },
      { t: 'image', shot: 'startsida', caption: 'Så ser startsidan ut i Bokix: resultatet hittills i år och det som ska göras.' },

      { t: 'h2', x: 'Nio saker att jämföra' },
      { t: 'checklist', x: [
        'Behöver du kunna debet och kredit, eller finns det ett enkelt läge där du väljer vad som hänt?',
        'Kan kvitton läsas av från ett foto, så att du slipper skriva in belopp och moms själv?',
        'Klarar fakturorna det du behöver: egen logga, ROT och RUT, kortbetalning?',
        'Räknas momsdeklarationen fram ur bokföringen, för din period (månad, kvartal eller år)?',
        'Ingår lön med skattetabeller, arbetsgivardeklaration (AGI) och lönebesked, eller kostar det extra?',
        'Klarar programmet bokslutet för din bolagsform: NE-bilaga, INK2 eller årsredovisning?',
        'Hur kommer banken in i bokföringen: direkt bankkoppling eller kontoutdrag som fil?',
        'Kan du flytta in din gamla bokföring, och ta med den ut igen, med en SIE4-fil?',
        'Vad ingår i priset? Räkna på hela året med det du faktiskt använder.',
      ] },
      { t: 'callout', kind: 'tips', title: 'Prova med ditt eget underlag', x: 'De flesta program har en gratis provperiod. Lägg in några riktiga kvitton och en faktura under provperioden i stället för att bara titta runt. Då märker du snabbt vad som går smidigt och vad som skaver.' },

      { t: 'h2', x: 'Vad ett bokföringsprogram kostar' },
      { t: 'p', x: 'Priserna ligger ofta mellan ett hundratal och några hundra kronor i månaden. Men grundpriset säger lite, eftersom lön, fler användare eller kvitton kan kosta extra.' },
      { t: 'p', x: 'Räkna på det du faktiskt kommer att använda, och kolla om priset är med eller utan moms.' },
      { t: 'p', x: 'Bokix kostar 129 kr/mån utan anställda och 179 kr/mån med anställda, med årsplan 109 respektive 149 kr/mån. Ingen moms tillkommer och allt ingår. Se [priser](/priser).' },

      { t: 'h2', x: 'Att byta program är enklare än det låter' },
      { t: 'p', x: 'Alla svenska bokföringsprogram kan spara bokföringen som en SIE4-fil. Den läser du in i det nya programmet, och då följer kontoplan, verifikationer och balanser med.' },
      { t: 'p', x: 'Kundregister och kvittobilder följer oftast inte med, så spara dem från det gamla programmet. Läs mer i [Flytta bokföringen med SIE4](/blogg/sie4-flytta-bokforing).' },

      { t: 'h2', x: 'När Bokix inte passar' },
      { t: 'p', x: 'Bokix är byggt för småföretag som vill ha det enkelt. Det passar sämre om du behöver något av det här:' },
      { t: 'ul', x: [
        'Direkt bankkoppling. Bokix läser in kontoutdrag som fil.',
        'E-faktura via Peppol, som Bokix inte har.',
        'Att programmet lämnar in deklarationer automatiskt. I Bokix laddar du ned filen och lämnar in själv med BankID.',
        'Fler än tre personer som ska arbeta i bokföringen.',
      ] },
      { t: 'p', x: 'Passar inget av det in på dig är Bokix värt att prova. De första 30 dagarna är gratis.' },
    ],
    faq: [
      { q: 'Vilket bokföringsprogram är bäst för småföretag?', a: 'Det som klarar din bolagsform hela året, som du förstår utan att kunna bokföring och där det du använder ingår i priset. Jämför de nio punkterna i guiden och prova med ditt eget underlag under provperioden.' },
      { q: 'Behöver jag ett bokföringsprogram?', a: 'Lagen kräver att du bokför, inte att du använder ett program. Men ett program räknar fram momsen och bokslutet ur det du redan bokfört och sparar underlagen på samma ställe, vilket sparar mycket tid och minskar risken för fel.' },
      { q: 'Vad kostar ett bokföringsprogram?', a: 'Ofta mellan ett hundratal och några hundra kronor i månaden. Jämför vad som ingår, eftersom lön, fler användare och kvittohantering är tillägg i en del program.' },
      { q: 'Kan jag byta bokföringsprogram mitt i året?', a: 'Ja. Exportera en SIE4-fil ur det gamla programmet och läs in den i det nya. Många byter vid ett periodskifte, till exempel vid ett nytt kvartal, för att det blir enklast att stämma av.' },
      { q: 'Vilket bokföringsprogram passar en enskild firma?', a: 'Ett som ger dig NE-bilagan ur bokföringen och klarar moms och fakturor utan att du behöver kunna debet och kredit. Läs mer om Bokix för enskild firma.' },
    ],
  },
  {
    slug: 'enkel-bokforing',
    path: '/enkel-bokforing',
    category: 'Så funkar Bokix',
    title: 'Från kvitto till moms',
    seoTitle: 'Enkel bokföring: från kvitto till moms',
    seoDescription: 'Så sköter Bokix jobbet mellan kvitto och moms: kvitton läses av, fakturor bokförs och det osäkra hamnar i Granskning. Du behöver inte kunna bokföring.',
    excerpt: 'Så tar Bokix hand om jobbet mellan kvittot och deklarationen.',
    image: '/blog/enkel-bokforing.jpg',
    imageAlt: 'Tecknat kvitto från en kontorshandel bredvid en telefon som visar belopp, moms och konto, med en stämpel där det står Bokförd',
    datePublished: '2026-09-13',
    dateModified: '2026-09-20',
    readTime: '~8 min läsning',
    tldr: [
      'Bokix gör grovjobbet: läser av kvitton, bokför fakturor, matchar betalningar och kontoutdrag och förbereder momsen.',
      'Det som är osäkert gissas aldrig fram i tysthet. Det hamnar i Granskning, med anledningen utskriven, och du avgör det.',
      'Moms ingår i båda prisnivåerna, lön i nivån med personal, och hela bokföringen går alltid att exportera som SIE4.',
    ],
    body: [
      { t: 'p', x: 'Bokföring är en lång rad små händelser: ett kvitto, en faktura, en betalning. Varje händelse ska bli en verifikation med rätt konto och rätt moms. Det är där tiden går.' },
      { t: 'p', x: 'Bokix har en enkel regel: **det du inte kan gör Bokix åt dig, och det som är osäkert gissas aldrig fram.** Så här fungerar det, från kvitto till moms.' },

      { t: 'h2', x: 'Så delas jobbet mellan dig och Bokix' },
      { t: 'p', x: 'Din del är den som bara du kan göra: fota kvittot, skriva fakturan och avgöra det som är oklart. Resten sköter Bokix.' },
      { t: 'table', caption: 'Vem gör vad', head: ['Du', 'Bokix'], rows: [
        ['Fotar kvittot eller laddar upp en pdf', 'Läser av datum, belopp och moms och föreslår konto'],
        ['Skriver och skickar fakturan', 'Bokför den, matchar kortbetalningen och håller koll på förfallodatum'],
        ['Läser in kontoutdraget från banken', 'Matchar raderna mot dina obetalda fakturor'],
        ['Avgör det som är osäkert', 'Samlar det i Granskning, med anledningen utskriven'],
        ['Lämnar in momsdeklarationen', 'Sammanställer den ruta för ruta och påminner i god tid'],
      ] },
      { t: 'diagram', id: 'enkel-flow', caption: 'Varje händelse tar en av två vägar. Det säkra blir en verifikation, det osäkra stannar i Granskning tills du har avgjort det.' },

      { t: 'h2', x: 'Kvitton: fota, så läser Bokix' },
      { t: 'p', x: 'Du behöver inte skriva in datum och belopp själv:' },
      { t: 'steps', x: [
        { h: 'Fota eller ladda upp', p: 'Ta en bild med mobilen, eller ladda upp en bild eller pdf. Texten läses direkt i webbläsaren.' },
        { h: 'Bokix föreslår', p: 'Datum, belopp och momssats fylls i. Känner Bokix igen handlaren, till exempel en bensinmack, en matbutik eller ett molntjänstabonnemang, föreslås även rätt bokföringskonto.' },
        { h: 'Du kontrollerar', p: 'Varje avläst fält har en liten markering, och den försvinner så fort du ändrar fältet själv. Det du ser är alltid ett förslag, aldrig ett påstående.' },
      ] },
      { t: 'callout', kind: 'tips', title: 'Varför ett förslag och inte en automatik?', x: 'En avläsning kan ha fel: en fläck, ett vikt hörn eller en handlare som skriver ut momsen på ett ovanligt sätt. Genom att alltid visa avläsningen som något du kan ändra fångar du felet innan det hamnar i bokföringen. Vill du se hur avläsningen fungerar utan att skapa konto kan du prova det gratis: [Skanna kvitto](/verktyg/skanna-kvitto).' },

      { t: 'h2', x: 'Fakturor: skriv, skicka, bocka av' },
      { t: 'p', x: 'Du väljer bland fyra fakturamallar och lägger till din egen logotyp.' },
      { t: 'ul', x: [
        '**Kortbetalning på fakturan.** Kunden kan betala direkt på fakturan via Stripe. Betalningen matchas mot rätt faktura och blir en färdig verifikation, utan att du behöver stämma av något i efterhand.',
        '**Påminnelser.** När en faktura passerat förfallodatum skickas en betalningspåminnelse automatiskt.',
        '**ROT och RUT.** Avdraget räknas på arbetskostnaden och visas både på fakturan och i underlaget till Skatteverket.',
        '**Leverantörsfakturor.** De registreras snabbt och bokförs automatiskt när du valt konto.',
        '**Din avsändare.** Fakturan kan skickas från din egen e-postdomän i stället för en delad avsändaradress.',
      ] },

      { t: 'h2', x: 'Granskning: det osäkra stannar hos dig' },
      { t: 'p', x: 'Ett suddigt kvitto, en Swish utan tydlig avsändare eller en summa som inte går ihop. Där blir en gissning dyr.' },
      { t: 'diagram', id: 'review-queue', caption: 'Så kan Granskning se ut. Varje rad har en tydlig anledning till att Bokix stannade.' },
      { t: 'p', x: 'Därför hamnar sådant i Granskning, med anledningen utskriven. Bokix föreslår konto utifrån det du bokfört förut, men du bestämmer. Du ser felet samma dag, inte tre månader senare.' },
      { t: 'callout', kind: 'info', title: 'Tyst gissning är det som blir dyrt', x: 'Ett fel som bokförts i tysthet syns först vid bokslut eller när revisorn frågar. Ett fel som Bokix stannar på syns direkt, med orsaken bredvid. Därför är Granskning en funktion och inte ett undantag.' },

      { t: 'h2', x: 'Kontoutdrag: läs in filen, ingen bankinloggning' },
      { t: 'steps', x: [
        { h: 'Exportera filen', p: 'Hämta kontoutdraget som en fil ur din internetbank. Det fungerar på samma sätt oavsett vilken bank du har.' },
        { h: 'Läs in den i Bokix', p: 'Filen läser du in precis som vanligt. Du behöver aldrig lämna ut några bankuppgifter eller inloggningar.' },
        { h: 'Raderna matchas', p: 'Transaktionerna matchas mot dina obetalda kund- och leverantörsfakturor, så att de som är betalda kan bockas av.' },
      ] },
      { t: 'p', x: 'Vill du se hur exporten går till i just din bank finns en guide här: [Koppla banken till Bokix](/koppla-bank).' },

      { t: 'h2', x: 'Moms, lön och skatt: förberett åt dig' },
      { t: 'h3', x: 'Momsdeklarationen' },
      { t: 'p', x: 'Bokix sammanställer momsdeklarationen ruta för ruta, som pdf och som eSKD-fil som du laddar upp hos Skatteverket. Satserna 25, 12 och 6 % stöds. Du får en påminnelse i god tid före varje deadline.' },
      { t: 'h3', x: 'Lön och personal' },
      { t: 'p', x: 'Har du anställda gör lönekörningen det här åt dig:' },
      { t: 'ul', x: [
        'Skatteavdrag enligt Skatteverkets skattetabeller.',
        'Lönebesked som pdf till varje anställd.',
        'Arbetsgivaravgifter efter ålder och semesteravsättning.',
        'En AGI-fil till Skatteverket och en betalfil till banken.',
      ] },
      { t: 'p', x: 'Lön ingår i nivån med personal.' },
      { t: 'h3', x: 'Bokslut' },
      { t: 'p', x: 'Ett bokslutsflöde stämmer av och låser räkenskapsåret. För aktiebolag förbereds också inkomstdeklaration 2 med räkenskapsschema (INK2R) och SRU-filer.' },
      { t: 'callout', kind: 'tips', title: 'Aldrig skickat utan din signatur', x: 'Allt som ska in hos Skatteverket förbereds åt dig, men skickas aldrig automatiskt. Du kontrollerar och lämnar in själv.' },

      { t: 'h2', x: 'För vilka passar Bokix?' },
      { t: 'p', x: 'Enskild firma, aktiebolag, handelsbolag, kommanditbolag, ekonomisk och ideell förening samt stiftelse. Bokix känner av bolagsformen från organisationsnumret. Du kan ha flera företag och upp till tre användare.' },

      { t: 'h2', x: 'Ingen inlåsning' },
      { t: 'p', x: 'Hela bokföringen går att spara som en SIE4-fil, standarden alla svenska program kan läsa. Du behöver inte fråga oss om lov. Läs mer i [Flytta bokföringen med SIE4](/blogg/sie4-flytta-bokforing).' },

      { t: 'h2', x: 'Vad kostar det?' },
      { t: 'p', x: '**129 kr/mån** utan anställda och **179 kr/mån** med anställda. Fakturor, bokföring och moms ingår i båda, och månadsplanen har ingen bindningstid. Priserna är slutbelopp.' },
      { t: 'p', x: 'De första 30 dagarna är gratis. Avslutar du innan dess kostar det ingenting. Se [Priser](/priser).' },
    ],
    faq: [
      { q: 'Behöver jag kunna bokföring sedan innan?', a: 'Nej. Verifikationer skapas automatiskt utifrån dina kvitton och fakturor. Det enda som kräver din uppmärksamhet hamnar i Granskning, med tydlig anledning till varför. Resten sköts av Bokix.' },
      { q: 'Hur läser Bokix av mina kvitton?', a: 'Fota kvittot eller ladda upp en bild eller pdf. Bokix läser texten direkt i webbläsaren och föreslår datum, belopp och momssats, och ett bokföringskonto när handlaren känns igen. Det du ser är alltid ett förslag som du kan ändra.' },
      { q: 'Vad händer med det Bokix är osäker på?', a: 'Det bokförs inte i tysthet. Det hamnar i Granskning med anledningen utskriven, till exempel en betalning utan tydlig avsändare eller ett kvitto som inte gick att läsa fullt ut, och du avgör hur det ska bokföras.' },
      { q: 'Kan jag koppla banken till Bokix?', a: 'Du exporterar kontoutdraget som en fil ur din internetbank och läser in det i Bokix. Raderna matchas mot dina obetalda kund- och leverantörsfakturor. Du behöver aldrig lämna ut några bankuppgifter eller inloggningar.' },
      { q: 'Ingår moms och lön i priset?', a: 'Ja. Momsdeklarationen ingår i båda prisnivåerna. Lönekörning med skatteavdrag, AGI-fil och betalfil ingår i nivån med personal, 179 kr/mån. Inget av det är ett separat tillägg.' },
      { q: 'Kan jag ta med mig bokföringen om jag vill byta senare?', a: 'Ja. Din bokföring går att exportera som SIE4-fil, standardformatet svenska bokföringsprogram och redovisningskonsulter använder. Din data är aldrig inlåst.' },
    ],
  },
  // ── Artiklar med `body` renderas av BlogPostPage.jsx på /blogg/<slug> ──
  // Ett inlägg skrivs alltså HÄR, en gång, och får sida, listkort,
  // schema.org-data, sitemap-post och förrendering av sig själv (routes.js,
  // entry-server.jsx, AppRouter.jsx och prerender.mjs läser alla den här
  // listan). Enda manuella steget är en rewrite-rad i vercel.json.
  //
  // Fält utöver de vanliga: category (etikett). tldr och faq finns kvar i
  // en del inlägg men visas inte sedan 2026-10-13 (användaren ville ha en
  // vanlig blogg utan Kort svar och frågelista). Skriv in det i texten.
  //
  // Blocktyper (t):
  //   h2 (får ankare), h3, p, ul, ol,
  //   steps  { x: [{ h, p }] }            numrerade stegkort
  //   checklist { x: [text] }             bockad lista
  //   callout { kind: info|tips|warn, title, x, logo?, logoAlt? }
  //   code   { title, x, notes: [{ k, v }] }   kodruta + förklaringslista
  //   table  { head, rows, caption }
  //   diagram { id, caption }             se BlogDiagrams.jsx
  //   programs                            exportguide per program (migrationSources.js)
  // I text kan [länktext](/sökväg) och **fetstil** användas.
  //
  // Absolut regel, som på övriga marknadssidor: bara sådant som stämmer
  // med produkten (SwitchPage.jsx, UfPage.jsx, utils/ufMode.js) eller är
  // allmänt etablerad fakta. Inga påhittade siffror eller löften.
  {
    slug: 'sie4-flytta-bokforing',
    path: '/blogg/sie4-flytta-bokforing',
    category: 'Byta program',
    title: 'Flytta bokföringen med SIE4',
    seoTitle: 'SIE4: så flyttar du bokföringen till nytt program',
    seoDescription: 'Vad SIE4 är, hur filen ser ut inuti och hur du exporterar, läser in och kontrollerar din bokföring när du byter bokföringsprogram, utan att tappa historiken.',
    excerpt: 'Exportera, läs in och kontrollera, utan att tappa historiken.',
    image: '/blog/sie4-hero.jpg',
    imageAlt: 'Tecknad SIE-fil med rader som #VER och #TRANS på väg från en gammal låda till en ny',
    datePublished: '2026-09-20',
    dateModified: '2026-09-20',
    readTime: '~7 min läsning',
    tldr: [
      'SIE4 är den svenska standardfilen för att flytta hela bokföringen mellan program: kontoplan, ingående balanser och varje verifikation.',
      'Exportera SIE typ 4 ur det gamla programmet, läs in filen i det nya, granska kontomappningen och stäm av resultat- och balansräkningen.',
      'Spara originalfilen. Räkenskapsinformation ska bevaras i sju år.',
    ],
    body: [
      { t: 'p', x: 'Byter du bokföringsprogram behöver du inte skriva in något på nytt. Nästan alla svenska program kan spara och läsa samma fil, SIE. Därför tar ett byte en eftermiddag, inte en vecka.' },

      { t: 'h2', x: 'Vad är SIE?' },
      { t: 'p', x: 'SIE står för **Standard Import Export**. Det är ett svenskt filformat för att flytta bokföring mellan program, eller lämna den till revisorn. En fil från Fortnox går att läsa in i Bokix, och tvärtom.' },
      { t: 'callout', kind: 'info', title: 'Det är bara text', x: 'En SIE-fil är vanlig textfil, oftast med filändelsen .se. Du kan öppna den i ett textprogram och läsa den. Det är bra för att förstå vad som flyttas, men redigera den inte för hand.' },

      { t: 'h2', x: 'SIE 1 till 4: vilken typ ska du välja?' },
      { t: 'p', x: 'Det finns fyra typer, och varje typ innehåller allt den föregående gör plus något mer. När du byter program vill du ha **typ 4**, eftersom det är den enda som innehåller själva verifikationerna.' },
      { t: 'table', caption: 'De fyra SIE-typerna', head: ['Typ', 'Innehåller', 'Passar för'], rows: [
        ['SIE 1', 'Saldon per konto och räkenskapsår', 'Enkla slutsiffror'],
        ['SIE 2', 'Typ 1 plus saldon per period, alltså per månad', 'Rapportering månad för månad'],
        ['SIE 3', 'Typ 2 plus saldon per objekt, till exempel projekt eller kostnadsställe', 'Uppföljning per projekt'],
        ['**SIE 4**', 'Allt ovan plus **varje verifikation med alla konteringsrader**', '**Byta program: historiken följer med**'],
      ] },
      { t: 'callout', kind: 'tips', title: 'Möter du 4E eller 4I?', x: 'Beteckningarna 4E och 4I är varianter av typ 4. 4E är exportfilen med hela bokföringen, och det är den du vill ha. 4I är en mindre importfil som bara är avsedd för att lägga in verifikationer i ett program som redan har en bokföring.' },

      { t: 'h2', x: 'Så ser en SIE4-fil ut' },
      { t: 'p', x: 'Varje rad börjar med ett #-tecken följt av en etikett. Här är en förenklad fil för ett påhittat bolag med två verifikationer: en kundfaktura på 12 500 kr inklusive moms, och betalningen av den.' },
      { t: 'code', title: 'exempelbolaget.se', x: `#FLAGGA 0
#PROGRAM "Exempelprogram" 1.0
#FORMAT PC8
#GEN 20261231
#SIETYP 4
#FNAMN "Exempelbolaget AB"
#ORGNR 556000-0000
#RAR 0 20260101 20261231
#KONTO 1510 "Kundfordringar"
#KONTO 1930 "Företagskonto"
#KONTO 2081 "Aktiekapital"
#KONTO 2611 "Utgående moms på försäljning inom Sverige, 25 %"
#KONTO 3001 "Försäljning inom Sverige, 25 % moms"
#IB 0 1930 25000.00
#IB 0 2081 -25000.00
#VER "A" "1" 20260105 "Kundfaktura 1001"
{
   #TRANS 1510 {} 12500.00
   #TRANS 3001 {} -10000.00
   #TRANS 2611 {} -2500.00
}
#VER "A" "2" 20260120 "Inbetalning faktura 1001"
{
   #TRANS 1930 {} 12500.00
   #TRANS 1510 {} -12500.00
}
#UB 0 1930 37500.00
#UB 0 2081 -25000.00
#UB 0 2611 -2500.00
#RES 0 3001 -10000.00`, notes: [
        { k: '#FLAGGA', v: 'Anger om filen redan lästs in. 0 betyder att den inte gjort det.' },
        { k: '#PROGRAM', v: 'Vilket program som skrev filen.' },
        { k: '#FORMAT PC8', v: 'Teckenuppsättningen. PC8 är den gamla DOS-tabellen som SIE-filer traditionellt använder.' },
        { k: '#SIETYP 4', v: 'Filen är av typ 4 och innehåller alltså verifikationer.' },
        { k: '#FNAMN, #ORGNR', v: 'Företagets namn och organisationsnummer.' },
        { k: '#RAR 0', v: 'Räkenskapsåret. 0 är det aktuella året, -1 är året före.' },
        { k: '#KONTO', v: 'Kontoplanen: vilka konton som används och vad de heter.' },
        { k: '#IB, #UB', v: 'Ingående och utgående balans per balanskonto (klass 1 och 2).' },
        { k: '#RES', v: 'Årets summa per resultatkonto (klass 3 till 8).' },
        { k: '#VER, #TRANS', v: 'En verifikation med sina konteringsrader mellan klammerparenteserna.' },
      ] },
      { t: 'p', x: 'Så här läser du den första verifikationen. Samma tre konteringsrader, uppställda som i en vanlig bokföring:' },
      { t: 'table', caption: 'Verifikation A1 (Kundfaktura 1001) i vanlig bokföringsform', head: ['Konto', 'Namn', 'Debet', 'Kredit'], rows: [
        ['1510', 'Kundfordringar', '12 500', ''],
        ['3001', 'Försäljning inom Sverige, 25 % moms', '', '10 000'],
        ['2611', 'Utgående moms på försäljning', '', '2 500'],
        ['**Summa**', '', '**12 500**', '**12 500**'],
      ] },
      { t: 'p', x: 'Två saker att lägga märke till:' },
      { t: 'ul', x: [
        'Debet är positivt och kredit negativt. **Varje verifikation blir noll** när du summerar den.',
        'Balanskonton ligger i #IB och #UB. Resultatkonton ligger i #RES.',
      ] },
      { t: 'diagram', id: 'sie-balance', caption: 'Samma kontroll gör du efter bytet: ingående balans plus årets verifikationer ska ge utgående balans.' },
      { t: 'callout', kind: 'warn', title: 'Ser å, ä och ö konstiga ut?', x: 'SIE-filer sparas traditionellt i teckentabellen PC8. Öppnar du filen i ett program som antar en annan tabell blir å, ä och ö fel. Det är bara visningen som blir fel, inte filen, och programmet som läser in den känner igen #FORMAT-raden. Spara alltså inte om filen från ett textprogram.' },

      { t: 'h2', x: 'Steg 1: exportera SIE4 ur ditt nuvarande program' },
      { t: 'p', x: 'Välj **SIE typ 4** och de räkenskapsår du vill ta med. Menyerna ändras ibland, så se det här som en riktning:' },
      { t: 'programs' },
      { t: 'callout', kind: 'tips', title: 'Hittar du ingen SIE-export?', x: 'Sök efter "SIE" eller "Exportera bokföring" i programmets hjälpcenter. Finns ingen export i ditt paket kan supporten ofta ta fram filen åt dig. Bokföringen är din, oavsett vem som skött den. Vill du se en guide per program finns den här: [Byt bokföringsprogram till Bokix](/byt-bokforingsprogram).' },

      { t: 'h2', x: 'Steg 2: läs in filen i Bokix' },
      { t: 'steps', x: [
        { h: 'Ladda upp filen', p: 'Under Inställningar finns importen från andra bokföringsprogram. Guiden läser filen och visar vad den hittade: konton, verifikationer och ingående balanser.' },
        { h: 'Granska kontomappningen', p: 'Konton som saknas i din kontoplan, eller som heter något annat i filen, flaggas var för sig så att du bestämmer var de ska hamna.' },
        { h: 'Bekräfta importen', p: 'Ingenting skrivs in i bokföringen förrän du bekräftar i sista steget. Fram till dess kan du backa utan att något hänt.' },
        { h: 'Bokför vidare', p: 'Historiken ligger inne och du fortsätter löpande från den dag du bytte.' },
      ] },

      { t: 'h2', x: 'Steg 3: kontrollera att allt stämmer' },
      { t: 'p', x: 'Lägg tio minuter på det här innan du säger upp det gamla programmet:' },
      { t: 'checklist', x: [
        'Jämför resultat- och balansräkningen för det senaste avslutade räkenskapsåret i det gamla och det nya programmet. Summorna ska vara identiska.',
        'Kontrollera att ingående balanser för innevarande år stämmer med utgående balanser föregående år.',
        'Titta igenom verifikationslistan: antalet och numreringen ska se rimlig ut.',
        'Stäm av bankkontot. Saldot på företagskontot vid årsskiftet ska stämma med kontoutdraget.',
      ] },
      { t: 'callout', kind: 'info', title: 'En SIE-fil flyttar bokföringen, inte allt annat', x: 'Filen innehåller konton, balanser och verifikationer. Den innehåller inte kvittobilder, bifogade dokument eller öppna fakturor som fortfarande ligger och väntar på betalning. Kund- och leverantörsfakturor som är obetalda vid bytet behöver du därför ofta stämma av eller lägga in separat.' },

      { t: 'h2', x: 'Vanliga problem och hur du löser dem' },
      { t: 'h3', x: 'Summorna stämmer inte' },
      { t: 'p', x: 'Kontrollera först att du exporterade rätt räkenskapsår och typ 4. Titta sedan på ingående balans: den ska vara lika med föregående års utgående balans. Har du fortsatt bokföra i det gamla programmet efter exporten behöver du exportera på nytt.' },
      { t: 'h3', x: 'Konton saknas eller heter något annat' },
      { t: 'p', x: 'Det är vanligt. Företag lägger till egna konton, och programmen döper ibland samma konto olika. Importguiden visar dem i kontomappningen så att du väljer var de ska hamna i stället för att de gissas.' },
      { t: 'h3', x: 'Importen ger ett felmeddelande' },
      { t: 'p', x: 'Kontrollera att filen verkligen är en SIE-fil av typ 4, och inte en rapport eller en pdf som råkat få fel filändelse. Öppna den i ett textprogram: första raderna ska börja med #FLAGGA och #SIETYP 4.' },
      { t: 'h3', x: 'Programmet saknar SIE-export' },
      { t: 'p', x: 'Be supporten om en SIE4-fil för räkenskapsåret. Som fallback kan du spara resultat- och balansräkning och huvudbok som pdf, men då följer inte verifikationerna med som data och du får bygga ingående balanser för hand.' },

      { t: 'h2', x: 'Spara originalet i sju år' },
      { t: 'p', x: 'Bokföringen ska sparas i sju år efter utgången av det kalenderår då räkenskapsåret slutade. Spara SIE-filen, och gärna en pdf av bokföringen, innan du säger upp det gamla programmet.' },

      { t: 'h2', x: 'Ingen inlåsning åt andra hållet heller' },
      { t: 'p', x: 'Samma fil fungerar åt andra hållet. Från Bokix kan du när som helst spara hela bokföringen som SIE4, utan att fråga oss om lov.' },
    ],
    faq: [
      { q: 'Vad betyder SIE?', a: 'SIE står för Standard Import Export. Det är ett svenskt filformat för att flytta bokföringsdata mellan bokföringsprogram och lämna över den till en revisor.' },
      { q: 'Vad är skillnaden mellan SIE4 och de andra SIE-typerna?', a: 'Typ 1 till 3 innehåller saldon, till exempel per konto, period eller objekt. Typ 4 innehåller dessutom varje verifikation med alla konteringsrader, och det är den du behöver när du byter program och vill behålla historiken.' },
      { q: 'Kan jag öppna en SIE-fil själv?', a: 'Ja, den är en vanlig textfil. Du kan öppna den i ett textprogram för att titta på innehållet. Redigera den inte och spara om den, eftersom teckentabellen kan gå förlorad och å, ä och ö då blir fel.' },
      { q: 'Vad följer inte med i en SIE-fil?', a: 'Bokföringen följer med: kontoplan, balanser och verifikationer. Kvittobilder, bifogade dokument och inställningar i det gamla programmet ingår inte, och obetalda fakturor behöver ofta stämmas av separat.' },
      { q: 'Hur länge ska jag spara SIE-filen?', a: 'Räkenskapsinformation ska enligt bokföringslagen bevaras i sju år efter utgången av det kalenderår då räkenskapsåret avslutades. Spara filen tills dess, och fråga din revisor om du är osäker.' },
      { q: 'Kan jag exportera min bokföring från Bokix?', a: 'Ja. Du kan när som helst exportera hela bokföringen som en SIE4-fil och ta den med till ett annat program.' },
    ],
  },
  {
    slug: 'bokforing-uf-foretag',
    path: '/blogg/bokforing-uf-foretag',
    // Dolt (2026-10-20): UF är inte i fokus. Sidan finns kvar för den som har
    // länken men listas inte, syns inte i sitemap/llms och har noindex.
    hidden: true,
    category: 'UF-företag',
    title: 'Bokföring för UF-företag',
    seoTitle: 'Bokföring för UF-företag: så gör ni under året',
    seoDescription: 'Vad ett UF-företag behöver bokföra, en checklista för underlag, fem vanor som gör bokslutet enkelt och de vanligaste misstagen. Med exempel från ett UF-år.',
    excerpt: 'Vad ni ska bokföra och fem vanor som gör bokslutet enkelt.',
    image: '/blog/uf-hero.jpg',
    imageAlt: 'Tecknat spiralblock där ett UF-företag skrivit upp startkapital, inköp och försäljning, bredvid en hög mynt',
    datePublished: '2026-09-20',
    dateModified: '2026-09-20',
    readTime: '~6 min läsning',
    tldr: [
      'Bokför allt som rör pengar i företaget och spara ett underlag för varje händelse: faktura, kvitto eller en rad på kontoutdraget.',
      'Bokför löpande, till exempel en gång i veckan, i stället för allt på en gång i maj.',
      'Bokix har ett eget UF-konto med bara de delar ett UF-företag använder. Det är gratis i tre månader och kräver inget organisationsnummer.',
    ],
    body: [
      { t: 'p', x: 'Ett UF-företag finns i ett läsår, men bokföringen ska vara i ordning hela vägen. Ni behöver inte kunna mycket. Det viktiga är en vana: låt inget ligga.' },
      { t: 'diagram', id: 'uf-year', caption: 'UF-året i fyra faser. Bokföringen följer med hela vägen, den är inget som görs först i slutet.' },

      { t: 'h2', x: 'Vad behöver ett UF-företag bokföra?' },
      { t: 'p', x: 'Allt som rör pengar: försäljning, inköp, kostnader och betalningar.' },
      { t: 'p', x: 'Varje händelse ska ha ett **underlag** som visar vad som hänt, till exempel en faktura, ett kvitto eller en rad på kontoutdraget. Var noga med underlagen från början.' },
      { t: 'callout', kind: 'info', title: 'Följ alltid UF:s egna riktlinjer', logo: '/logos/uf-logo.svg', logoAlt: 'Ung Företagsamhet', x: 'Ung Företagsamhet har egna riktlinjer och material för bokföring och bokslut. Följ alltid dem och fråga er UF-rådgivare om något är oklart. Den här artikeln är en allmän guide, inte en ersättning. Bokix är ett fristående bokföringsprogram och drivs inte av, och är inte i samarbete med, Ung Företagsamhet.' },

      { t: 'h2', x: 'Vanliga händelser i ett UF-företag' },
      { t: 'p', x: 'De flesta UF-företag har samma händelser hela året:' },
      { t: 'table', caption: 'Händelser, underlag och vad ni ska tänka på', head: ['Händelse', 'Underlag', 'Att tänka på'], rows: [
        ['Startkapital från de som går in i företaget', 'Lista över vem som betalat in vad, och kontoutdraget', 'Bokför insättningen på företagskontot så att startpengarna syns från dag ett.'],
        ['Försäljning på mässa eller via Swish', 'Kvitto, kassalista eller Swish-rader på kontoutdraget', 'Skriv ner vad ni sålde och för hur mycket samma dag, inte veckor senare.'],
        ['Faktura till en kund', 'Fakturan', 'Skriv den när affären är klar och bocka av när den är betald.'],
        ['Inköp av material', 'Kvittot', 'Fota det direkt. Kvittot ska visa vad som köpts, inte bara summan.'],
        ['Utlägg med privata pengar', 'Kvitto och en notering om vem som lagt ut', 'Ta reda på i förväg hur ni gör med återbetalning enligt UF:s riktlinjer.'],
        ['Avgifter från banken', 'Kontoutdraget', 'Syns bara där, och är lätta att glömma tills det inte stämmer.'],
      ] },

      { t: 'h2', x: 'Fem vanor som gör bokslutet enkelt' },
      { t: 'steps', x: [
        { h: 'Spara varje kvitto', p: 'Fota det direkt och lägg upp det, i stället för att låta en hög växa i väskan. Ett kvitto som tappats bort går sällan att ersätta.' },
        { h: 'Bokför löpande', p: 'En gång i veckan eller efter varje mässa är bättre än allt på en gång i maj. Det är också mycket lättare att komma ihåg vad något var för en vecka sedan än för sex månader sedan.' },
        { h: 'Skriv fakturan när affären är klar', p: 'Håll ordning på vem som betalat och skicka en påminnelse när förfallodatumet passerat.' },
        { h: 'Stäm av mot banken', p: 'Gå igenom kontoutdraget och se att varje rad har en motsvarighet i bokföringen. Det är så ni hittar avgifter och betalningar ni glömt.' },
        { h: 'Kolla resultatet under året', p: 'Ser siffrorna märkliga ut är det enklare att rätta i oktober än i april.' },
      ] },

      { t: 'h2', x: 'Vanliga misstag att undvika' },
      { t: 'ul', x: [
        '**Privat och företag blandas.** Betala företagets saker från företagets konto. Blir det ändå ett privat utlägg, notera det direkt.',
        '**Kvitton utan bild.** Kassakvitton bleknar. Fota dem samma dag.',
        '**Att vänta till slutet.** Bokslutet blir då ett detektivarbete i stället för en genomgång.',
        '**Bokföring utan underlag.** Saknas underlaget, skriv ner vad som hände och vem som kan intyga det, så fort ni märker det.',
        '**Glömda bankavgifter.** De syns bara på kontoutdraget. Läs in det regelbundet.',
      ] },

      { t: 'h2', x: 'Det här kan ni göra i Bokix' },
      { t: 'p', x: 'Bokix har ett eget UF-konto som bara innehåller de delar ett UF-företag använder:' },
      { t: 'ul', x: [
        '**Fakturor:** skicka på mejl och håll koll på vem som betalat.',
        '**Kvitton:** fota och lägg upp, så läser Bokix av datum, belopp och moms.',
        '**Bokföring:** BAS-kontoplanen används automatiskt, så ni behöver inte veta vilka konton som finns.',
        '**Bank:** läs in kontoutdraget så matchas raderna mot era fakturor.',
        '**Granskning:** fångar det som ser fel ut i stället för att gissa i tysthet.',
        '**Rapporter och årsbokslut:** resultat och balans, och ett sätt att stänga året när ni är klara.',
      ] },
      { t: 'p', x: 'Menyn är kortare än i ett vanligt företag. Offerter, projekt och lön finns inte, eftersom ett UF-företag normalt inte har anställda och säljer direkt. Ni skriver fakturan när affären är klar.' },

      { t: 'h2', x: 'Vad kostar det?' },
      { t: 'p', x: 'UF-kontot är gratis i tre månader. Ni behöver inget organisationsnummer och lämnar inga betaluppgifter. Upp till fem fakturor per dygn ryms, vilket räcker gott för ett UF-företag. Alla villkor står på sidan [Bokix för UF-företag](/uf).' },
    ],
    faq: [
      { q: 'Måste ett UF-företag bokföra?', a: 'Bokföring och bokslut är en viktig del av UF-året, och Ung Företagsamhet har egna riktlinjer för hur det ska göras. Följ dem och fråga er UF-rådgivare om något är oklart.' },
      { q: 'Behöver vi ett organisationsnummer för att använda Bokix?', a: 'Nej. UF-kontot i Bokix kräver inget organisationsnummer och inga betaluppgifter, och det är gratis i tre månader.' },
      { q: 'Vad är ett underlag?', a: 'Ett underlag är det som visar att en händelse har skett: en faktura, ett kvitto eller en rad på kontoutdraget. Varje bokförd händelse ska ha ett.' },
      { q: 'Hur ofta ska vi bokföra?', a: 'Ju oftare desto enklare. En gång i veckan, eller efter varje mässa, är en bra vana. Då minns ni vad varje händelse var och bokslutet blir en genomgång i stället för ett detektivarbete.' },
      { q: 'Kan vi använda ett vanligt bokföringsprogram i stället?', a: 'Ja, men ett vanligt program har många delar ett UF-företag inte använder. Har er skola eller UF-rådgivare särskilda krav på programmet, följ dem.' },
    ],
  },
  {
    slug: 'moms-deklaration-steg-for-steg',
    path: '/blogg/moms-deklaration-steg-for-steg',
    category: 'Moms',
    title: 'Momsdeklaration steg för steg',
    seoTitle: 'Momsdeklaration steg för steg: datum och rutor',
    seoDescription: 'Vem som ska redovisa moms och hur ofta, datumen för 2026, vilka rutor beloppen hamnar i och en checklista i fyra steg.',
    excerpt: 'Datum, rutor och en checklista i fyra steg.',
    image: '/blog/moms-deklaration-hero.jpg',
    imageAlt: 'Tecknad kalender som visar 12 februari bredvid en momsdeklaration med rutorna 05, 10, 48 och 49',
    datePublished: '2026-09-22',
    dateModified: '2026-09-22',
    readTime: '~7 min läsning',
    tldr: [
      'De flesta mindre företag redovisar moms kvartalsvis. Förfallodagen är den 12:e i andra månaden efter kvartalet, utom när den månaden är januari eller augusti, då är det den 17:e.',
      'Deklarationen är utgående moms minus ingående moms, ruta för ruta enligt SKV 4700. Betalningen ska vara hos Skatteverket samma dag som deklarationen.',
      'Fyra steg varje gång: kontrollera att allt är bokfört, granska rutorna, låt momsen bokföras, och lämna in. Ingenting skickas automatiskt, du signerar alltid själv.',
    ],
    body: [
      { t: 'p', x: 'Momsdeklarationen är enklare än den ser ut. Det är momsen du tagit ut av dina kunder, minus momsen du själv betalat på inköp.' },
      { t: 'p', x: 'Här är datumen, rutorna och de fyra stegen.' },
      { t: 'diagram', id: 'moms-steps', caption: 'Samma fyra steg varje kvartal. Bokix håller reda på datumen och räknar ut rutorna, men signaturen är alltid din.' },

      { t: 'h2', x: 'Vem ska redovisa moms, och hur ofta?' },
      { t: 'p', x: 'Säljer du momspliktiga varor eller tjänster ska du vara momsregistrerad och lämna momsdeklaration. Hur ofta beror på omsättningen. Skatteverket bestämmer, och perioden står i ditt registreringsbevis.' },
      { t: 'table', caption: 'Redovisningsperioder', head: ['Period', 'Kräver', 'Deklareras'], rows: [
        ['Årsvis', 'Beskattningsbar omsättning på högst 1 miljon kr, vanligast bland enskilda firmor', 'I samma deklaration som inkomstskatten'],
        ['Kvartalsvis', 'Beskattningsbar omsättning på högst 40 miljoner kr, vanligast för aktiebolag och enskilda firmor', 'Fyra gånger per år, en period i taget'],
        ['Månadsvis', 'Krävs över 40 miljoner kr i omsättning, eller väljs själv av ett mindre företag', 'Tolv gånger per år'],
      ] },
      { t: 'callout', kind: 'info', title: 'Osäker på din period?', x: 'Perioden står i beslutet från momsregistreringen och i Skatteverkets e-tjänst. Resten av texten utgår från kvartal, det vanligaste.' },

      { t: 'h2', x: 'När ska deklarationen vara inne?' },
      { t: 'p', x: 'Deklaration och betalning ska vara hos Skatteverket senast **den 12:e i andra månaden efter kvartalet**. I januari och augusti gäller **den 17:e** i stället. Är det helg flyttas datumet till nästa vardag.' },
      { t: 'table', caption: 'Kvartalsvisa deadlines 2026 (helgframflyttning inräknad)', head: ['Period', 'Avser', 'Senast'], rows: [
        ['Kvartal 1', 'Januari–mars', '12 maj 2026'],
        ['Kvartal 2', 'April–juni', '17 augusti 2026'],
        ['Kvartal 3', 'Juli–september', '12 november 2026'],
        ['Kvartal 4', 'Oktober–december', '12 februari 2027'],
      ] },
      { t: 'p', x: 'Se ditt nästa datum i verktyget [Momsdatum](/verktyg/momsdatum).' },
      { t: 'callout', kind: 'warn', title: 'För sent inlämnad eller betald', x: 'Missar du datumet riskerar du en förseningsavgift, och en obetald moms räntebeläggs. Är du osäker på om du hinner, lämna en så korrekt deklaration du kan i tid hellre än en perfekt en för sent, du kan begära omprövning i efterhand om något visar sig fel.' },

      { t: 'h2', x: 'Vad räknas in i deklarationen?' },
      { t: 'p', x: '**Utgående moms** är den du tagit ut av kunderna. **Ingående moms** är den du betalat på inköp. Skillnaden betalar du in, eller får tillbaka.' },
      { t: 'table', caption: 'De vanligaste rutorna (SKV 4700)', head: ['Ruta', 'Vad den visar'], rows: [
        ['05', 'Momspliktig försäljning för perioden, exklusive moms'],
        ['10 / 11 / 12', 'Utgående moms på försäljningen: 25 %, 12 % respektive 6 %'],
        ['48', 'Ingående moms du har rätt att dra av på periodens inköp'],
        ['49', '**Moms att betala eller få tillbaka**, 10+11+12 minus 48'],
      ] },
      { t: 'p', x: 'Köper du tjänster från ett utländskt företag utan svensk moms redovisar du ofta momsen själv, i rutorna 21, 22 och 30–32. Kontrollera sådana inköp innan perioden stängs.' },

      { t: 'h2', x: 'Så gör du i fyra steg' },
      { t: 'steps', x: [
        { h: '1. Kontrollera att allt är bokfört', p: 'Gå igenom att kvartalets kvitton, fakturor och kontoutdrag faktiskt kommit in i bokföringen. Ligger något kvar i Granskning ska det avgöras innan deklarationen sammanställs, annars saknas det i uträkningen.' },
        { h: '2. Granska rutorna', p: 'Bokix räknar ihop utgående och ingående moms ur verifikationerna och sammanställer dem ruta för ruta. Stäm av att beloppen ser rimliga ut mot vad du minns av kvartalet, särskilt om något ovanligt hänt: en stor engångsförsäljning, ett dyrare inköp eller en tjänst köpt från utlandet.' },
        { h: '3. Låt momsen bokföras', p: 'När du är klar bokförs momsskulden (eller momsfordran, om du ska få tillbaka) automatiskt mot rätt konto, så att bokföringen och deklarationen stämmer mot varandra.' },
        { h: '4. Lämna in hos Skatteverket', p: 'Ladda upp filen i Skatteverkets e-tjänst, eller fyll i rutorna för hand efter pdf:en om du föredrar det. Du loggar in och signerar med BankID hos Skatteverket, det är alltid du som lämnar in, aldrig Bokix.' },
      ] },
      { t: 'callout', kind: 'tips', title: 'Se hela flödet innan du börjar', x: 'I Bokix samlas kvartalets status under Skatt och bokslut. Där markerar du perioden som inlämnad när du är klar. Läs mer under [Funktioner](/funktioner).' },
      { t: 'image', shot: 'moms' },

      { t: 'h2', x: 'Bra att veta' },
      { t: 'h3', x: 'Mer ingående än utgående moms' },
      { t: 'p', x: 'Då blir ruta 49 negativ och du får tillbaka skillnaden från Skatteverket.' },
      { t: 'h3', x: 'Fel i en inlämnad deklaration' },
      { t: 'p', x: 'Du begär omprövning hos Skatteverket. Rätta också bokföringen, så att nästa period blir rätt.' },
      { t: 'h3', x: 'Månad, kvartal eller år' },
      { t: 'p', x: 'Det bestämmer Skatteverket utifrån omsättningen. Bokix följer perioden i ditt registreringsbevis.' },

      { t: 'h2', x: 'Ingen gissning, ingen automatisk inlämning' },
      { t: 'p', x: 'Rutorna räknas ur din bokföring, aldrig ur en uppskattning. Det som är osäkert stannar i Granskning.' },
      { t: 'p', x: 'Ingenting skickas till Skatteverket åt dig. Bokix förbereder, du lämnar in med BankID.' },
    ],
    faq: [
      { q: 'Vem ska lämna momsdeklaration?', a: 'De flesta som säljer momspliktiga varor eller tjänster i Sverige och är momsregistrerade. Hur ofta du ska deklarera, månadsvis, kvartalsvis eller årsvis, beslutar Skatteverket utifrån din omsättning.' },
      { q: 'När ska momsdeklarationen vara inne 2026?', a: 'Vid kvartalsvis redovisning: kvartal 1 senast 12 maj, kvartal 2 senast 17 augusti, kvartal 3 senast 12 november och kvartal 4 senast 12 februari 2027. Landar datumet på en helg flyttas det till nästa vardag.' },
      { q: 'Varför är förfallodagen den 17:e i augusti och januari, men den 12:e annars?', a: 'Skatteverkets egna uppehåll kring sommaren och nyåret flyttar fram gränsen just de månaderna. Alla andra månader gäller den 12:e.' },
      { q: 'Vilka rutor är viktigast i momsdeklarationen?', a: 'Ruta 05 visar den momspliktiga försäljningen, 10–12 den utgående momsen per skattesats, 48 den ingående momsen du får dra av, och 49 mellanskillnaden, det du ska betala eller få tillbaka.' },
      { q: 'Bokför och skickar Bokix momsen automatiskt?', a: 'Bokix sammanställer deklarationen ur din bokföring och bokför momsskulden eller -fordran, men skickar aldrig in något hos Skatteverket åt dig. Du laddar upp filen eller fyller i uppgifterna och signerar alltid själv med BankID.' },
      { q: 'Vad händer om jag missar deadlinen?', a: 'En försenad deklaration kan ge en förseningsavgift, och en försenad betalning räntebeläggs. Lämna in så snart du kan även om du är sen, i stället för att vänta till en senare period.' },
    ],
  },
  {
    slug: 'spara-kvitton-bokforingslagen',
    path: '/blogg/spara-kvitton-bokforingslagen',
    category: 'Underlag',
    title: 'Hur länge ska kvitton sparas?',
    seoTitle: 'Spara kvitton: vad du måste spara och hur länge',
    seoDescription: 'Vilka underlag bokföringslagen kräver, hur länge de ska sparas och när du får slänga papperskvittot efter att ha fotat det.',
    excerpt: 'Sju år, och när du får slänga papperskvittot.',
    image: '/blog/spara-kvitton-hero.jpg',
    imageAlt: 'Tecknad arkivlåda märkt 7 år med kvitton ovanför och en telefon med ett fotat kvitto',
    datePublished: '2026-09-23',
    dateModified: '2026-09-23',
    readTime: '~5 min läsning',
    tldr: [
      'Varje bokförd händelse ska ha en verifikation, alltså ett underlag som visar vad som hänt, ett kvitto, en faktura eller en rad på kontoutdraget.',
      'Räkenskapsinformation ska enligt bokföringslagen sparas i sju år, räknat från utgången av det kalenderår räkenskapsåret avslutades.',
      'Sedan en lagändring 1 juli 2024 får du slänga pappersoriginalet direkt efter att du fotat eller skannat det, så länge kopian är hel, läsbar och oförändrad.',
    ],
    body: [
      { t: 'p', x: 'Här är vad lagen säger om kvitton: vad som ska sparas, hur länge, och när du får slänga papperet.' },
      { t: 'diagram', id: 'receipt-archive', caption: 'Kvittot fotas, kopian sparas i sju år, och sedan 2024 behöver du inte spara papperet också.' },

      { t: 'h2', x: 'Vad är en verifikation?' },
      { t: 'p', x: 'Allt du bokför ska ha en **verifikation**, ett underlag som visar att det hänt. Det kan vara ett kvitto, en faktura eller en rad på kontoutdraget.' },
      { t: 'p', x: 'Verifikationen ska visa vad som hänt, när och hur mycket.' },
      { t: 'callout', kind: 'info', title: 'Ingen verifikation, ingen bokföring', x: 'Utan underlag går det inte att bokföra rätt. Leta först efter kvittot, till exempel på mejl eller i en app.' },

      { t: 'h2', x: 'Spara i sju år' },
      { t: 'p', x: 'Verifikationer, bokföring och årsredovisning ska sparas i **sju år** efter utgången av det kalenderår då räkenskapsåret slutade (bokföringslagen 7 kap.).' },
      { t: 'p', x: 'Ett räkenskapsår som slutar 31 december 2026 sparas alltså till och med 2033.' },
      { t: 'p', x: 'Det gäller både papper och digitalt.' },

      { t: 'h2', x: 'Papperet får slängas efter foto' },
      { t: 'p', x: 'Sedan **1 juli 2024** får du slänga papperskvittot när du fotat eller skannat det, om två villkor uppfylls:' },
      { t: 'ul', x: [
        '**Informationen är överförd till en annan form**, ett foto, en skanning eller ett digitalt kvitto.',
        '**Överföringen får inte riskera att informationen ändras eller går förlorad.** Bilden ska vara hel, läsbar och stämma med originalet.',
      ] },
      { t: 'p', x: 'Ett vanligt mobilfoto duger om det är helt och går att läsa. Ett kvitto på mejl eller i en app är redan originalet.' },
      { t: 'callout', kind: 'tips', title: 'Fota direkt, inte i efterhand', x: 'Kvitton från kassaremsa bleknar ofta inom några månader. Fota eller ladda upp kvittot samma dag du får det, innan det blir oläsligt. Med [Skanna kvitto](/verktyg/skanna-kvitto) kan du testa hur avläsningen fungerar utan att skapa konto.' },

      { t: 'h2', x: 'Bygg en vana, inte en kvittohög' },
      { t: 'p', x: 'Fota kvittot direkt när du får det. I Bokix läses datum, belopp och moms av, och kvittot sparas i sju år.' },
      { t: 'image', shot: 'kvitton' },
      { t: 'p', x: 'Har du redan en hög? Fota det som går att läsa och skriv ner det som har bleknat.' },

      { t: 'h2', x: 'Om ett kvitto saknas helt' },
      { t: 'p', x: 'Be butiken om en kopia. Många kan skicka en i efterhand.' },
      { t: 'p', x: 'Går det inte, skriv ner vad du köpte, datum och belopp. En anteckning är bättre än ingenting.' },
    ],
    faq: [
      { q: 'Kan jag slänga originalet efter att jag skannat eller fotat det?', a: 'Ja, sedan en lagändring 1 juli 2024. Villkoren är att informationen är överförd till en annan form (foto, skanning, digitalt kvitto) och att överföringen inte riskerar att ändra eller förlora informationen, bilden ska vara hel och läsbar.' },
      { q: 'Hur länge sparar jag underlag?', a: 'Sju år, räknat från utgången av det kalenderår då räkenskapsåret avslutades. Det gäller kvitton, fakturor och all annan räkenskapsinformation.' },
      { q: 'Vad gör jag om ett kvitto saknas?', a: 'Be om en kopia från leverantören om möjligt. Går inte det, notera vad köpet gällde, datum och belopp så noggrant du kan. Bäst är att fota kvittot direkt när du får det, så uppstår problemet aldrig.' },
      { q: 'Räknas ett kvitto på mejl eller i en app som ett original?', a: 'Ja. Ett digitalt kvitto är redan i digital form, och det finns inget pappersoriginal att ta ställning till. Spara det digitala kvittot i sju år på samma sätt.' },
      { q: 'Måste jag spara kvitton även för små belopp?', a: 'Ja, samma regler gäller oavsett belopp. Varje bokförd händelse ska ha ett underlag.' },
    ],
  },
  {
    slug: 'bokslut-checklista',
    path: '/blogg/bokslut-checklista',
    category: 'Bokslut',
    title: 'Bokslut i nio steg',
    seoTitle: 'Bokslut för småföretag: checklista i nio steg',
    seoDescription: 'Nio steg från sista bokföringen till ett låst räkenskapsår: avstämning, avskrivningar, periodiseringar och tidsgränserna för bokslut och årsredovisning.',
    excerpt: 'Från sista verifikationen till ett låst räkenskapsår.',
    image: '/blog/bokslut-checklista-hero.jpg',
    imageAlt: 'Tecknade pärmar för tre räkenskapsår bredvid ett hänglås',
    datePublished: '2026-09-24',
    dateModified: '2026-09-24',
    readTime: '~6 min läsning',
    tldr: [
      'Bokslutet stämmer av året: banken, avskrivningar, periodiseringar och lager, innan resultatet beräknas och räkenskapsåret låses.',
      'Enskild firma med en omsättning på högst 3 miljoner kr kan använda förenklat årsbokslut (K1). Aktiebolag gör alltid en fullständig årsredovisning.',
      'Aktiebolagets årsredovisning ska vara hos Bolagsverket senast sju månader efter räkenskapsårets slut, annars väntar förseningsavgifter.',
    ],
    body: [
      { t: 'p', x: 'Bokslutet är en avstämning av det du redan bokfört, plus några poster som hör till årets slut. Gör stegen i ordning så är det bara en checklista.' },

      { t: 'h2', x: 'De nio stegen' },
      { t: 'checklist', x: [
        'Stäm av bankkontot. Saldot i bokföringen ska stämma med kontoutdraget vid räkenskapsårets slut.',
        'Bokför årets sista kundfakturor, så att intäkter hamnar i rätt räkenskapsår.',
        'Bokför årets sista leverantörsfakturor, av samma anledning.',
        'Kör den sista lönekörningen för året, inklusive semesterlöneskuld och sociala avgifter.',
        'Gör avskrivningar på inventarier och andra anläggningstillgångar.',
        'Gör periodiseringar: kostnader och intäkter som hör till ett annat år flyttas dit.',
        'Inventera lager och pågående arbeten, om verksamheten har det.',
        'Beräkna och bokför årets resultat.',
        'Lås räkenskapsåret så att inget bokförs i det av misstag i efterhand.',
      ] },
      { t: 'callout', kind: 'info', title: 'Ordningen spelar roll', x: 'Avskrivningar och periodiseringar ska vara gjorda innan resultatet beräknas, annars stämmer inte resultatet. Bankavstämningen görs först eftersom den ofta avslöjar transaktioner som inte bokförts än.' },

      { t: 'h2', x: 'Två nyckelbegrepp' },
      { t: 'h3', x: 'Avskrivning' },
      { t: 'p', x: 'En dator eller maskin dras inte av direkt. Kostnaden delas upp över flera år, och varje års del är avskrivningen.' },
      { t: 'h3', x: 'Periodisering' },
      { t: 'p', x: 'En kostnad hör till det år den gäller, inte året fakturan kom. Betalar du i december en försäkring för nästa år, flyttas kostnaden till nästa år.' },

      { t: 'h2', x: 'Förenklat årsbokslut eller fullständig årsredovisning?' },
      { t: 'p', x: 'Vilken typ av bokslut som krävs beror på bolagsform och storlek.' },
      { t: 'table', caption: 'Vilket bokslut passar', head: ['Bolagsform', 'Kräver', 'Klart senast'], rows: [
        ['Enskild firma, omsättning normalt högst 3 miljoner kr', 'Förenklat årsbokslut (K1)', '30 juni året efter, som underlag till NE-bilagan'],
        ['Enskild firma, större omsättning', 'Fullständigt årsbokslut', 'Inför deklarationen'],
        ['Aktiebolag (alla storlekar)', 'Fullständig årsredovisning (K2 eller K3)', 'Senast 7 månader efter räkenskapsårets slut, hos Bolagsverket'],
      ] },
      { t: 'p', x: 'Ett förenklat årsbokslut lämnas inte in. Du sparar det med bokföringen och använder det till NE-bilagan.' },
      { t: 'p', x: 'Gränsen gäller omsättningen du **normalt** har. Ett enstaka år över gränsen ändrar inte det.' },
      { t: 'callout', kind: 'warn', title: 'Aktiebolagets deadline är sträng', x: 'Missar ett aktiebolag 7-månadersgränsen till Bolagsverket väntar förseningsavgifter, och fortsätter dröjsmålet kan Bolagsverket besluta om tvångslikvidation. Bolagsstämman ska hållas senast 6 månader efter räkenskapsårets slut, så att årsredovisningen hinner lämnas in inom den sjunde.' },

      { t: 'h2', x: 'Vad händer efter bokslutet?' },
      { t: 'p', x: '**Enskild firma:** bokslutet blir underlag för NE-bilagan i din deklaration.' },
      { t: 'p', x: '**Aktiebolag:** årsredovisningen går till Bolagsverket, och bolaget lämnar INK2 med INK2R och INK2S till Skatteverket.' },
      { t: 'p', x: 'Läs mer om vad som gäller vid deklarationen i [Skatt och bokslut](/funktioner), eller om din bolagsform i [ordlistan](/ordlista) under K2 och K3.' },
    ],
    faq: [
      { q: 'När ska bokslutet vara klart?', a: 'Ett förenklat årsbokslut ska vara klart senast 30 juni året efter räkenskapsåret, som grund för NE-bilagan. Ett aktiebolags årsredovisning ska vara hos Bolagsverket senast sju månader efter räkenskapsårets slut.' },
      { q: 'Måste alla göra periodiseringar?', a: 'De flesta mindre bokslut har åtminstone någon periodisering, till exempel en försäkring eller ett abonnemang som sträcker sig över årsskiftet. Har du inga sådana poster behövs ingen periodisering det året.' },
      { q: 'Vad är förenklat årsbokslut?', a: 'Ett bokslut enligt K1-regelverket för enskilda näringsidkare med en omsättning som normalt inte överstiger 3 miljoner kr. Det lämnas inte in till Skatteverket utan sparas som underlag för NE-bilagan.' },
      { q: 'Vad är skillnaden mellan K2 och K3?', a: 'Båda är regelverk för fullständig årsredovisning. K2 är förenklat och schablonmässigt, K3 ger mer utrymme för egna bedömningar och krävs för större företag. De flesta mindre aktiebolag väljer K2.' },
      { q: 'Vad händer om ett aktiebolag missar deadlinen till Bolagsverket?', a: 'Förseningsavgifter tillkommer stegvis, och fortsätter dröjsmålet kan Bolagsverket besluta om tvångslikvidation. Lämna in så snart som möjligt även om ni är sena.' },
    ],
  },
  {
    slug: 'lon-eller-utdelning-ab',
    path: '/blogg/lon-eller-utdelning-ab',
    category: 'Aktiebolag',
    title: 'Lön eller utdelning?',
    seoTitle: 'Lön eller utdelning i aktiebolag: så väljer du',
    seoDescription: 'Två sätt att ta ut pengar ur ett fåmansföretag, med olika skatt och olika följder för pension och sjukpenning. Principerna, förklarade enkelt.',
    excerpt: 'Två sätt att ta ut pengar ur aktiebolaget, och vad som skiljer.',
    image: '/blog/lon-eller-utdelning-hero.jpg',
    imageAlt: 'Tecknat lönebesked på ena sidan och ett cirkeldiagram med en utbruten bit på den andra',
    datePublished: '2026-09-25',
    dateModified: '2026-09-25',
    readTime: '~6 min läsning',
    tldr: [
      'Lön kostar bolaget arbetsgivaravgifter men ger dig pensionsgrundande och sjukpenninggrundande inkomst, direkt beskattad varje månad.',
      'Utdelning beslutas på bolagsstämman, kräver utdelningsbara medel i bolaget och beskattas olika inom och utanför gränsbeloppet, men ger ingen pensionsrätt.',
      'Reglerna (särskilt 3:12) och beloppen ändras år till år. Den här artikeln förklarar principerna, inte siffrorna. Räkna på ditt eget läge i verktygen.',
    ],
    body: [
      { t: 'p', x: 'Äger du ett aktiebolag kan du ta ut pengar som lön eller som utdelning. De har olika skatt, olika krav och olika betydelse för din pension.' },
      { t: 'p', x: 'Beloppen ändras varje år, så här förklaras bara principerna. Siffrorna räknar du fram i verktygen.' },
      { t: 'diagram', id: 'pay-or-dividend', caption: 'Samma bolag, två olika vägar ut. Ingenting hindrar dig från att kombinera dem.' },
      { t: 'callout', kind: 'warn', title: 'Inte personlig skatterådgivning', x: 'Reglerna för fåmansföretag (3:12-reglerna) är detaljerade och ändras ofta. Prata med en revisor inför stora beslut.' },

      { t: 'h2', x: 'Lön: enklare, och den ger pensionsrätt' },
      { t: 'p', x: 'Bolaget betalar lönen plus arbetsgivaravgifter. Du betalar skatt på lönen varje månad, som på vilken lön som helst.' },
      { t: 'p', x: 'Fördelen är att lön ger **pension och sjukpenning**. Utan lön byggs ingen allmän pension upp från bolaget.' },

      { t: 'h2', x: 'Utdelning: kräver ett beslut och utdelningsbara medel' },
      { t: 'p', x: 'Utdelning beslutas på bolagsstämman, oftast en gång om året. Bolaget måste ha **utdelningsbara medel**, alltså fritt eget kapital.' },
      { t: 'p', x: 'Utdelning inom ditt **gränsbelopp** beskattas lägre än den del som går över. Gränsbeloppet räknas fram för varje ägare och år.' },
      { t: 'p', x: 'Utdelning ger ingen pension eller sjukpenning.' },
      { t: 'callout', kind: 'tips', title: 'Räkna på ditt eget läge', x: 'Gränsbelopp, skiktgränser och arbetsgivaravgifter ändras år till år. Räkna fram aktuella belopp i [Utdelning](/verktyg/utdelning) och [Lönekalkylator](/verktyg/lonekalkylator) i stället för att utgå från förra årets siffror.' },

      { t: 'h2', x: 'Både lön och utdelning' },
      { t: 'p', x: 'Ja. Många tar en lön och fyller på med utdelning. Lönen kan också göra gränsbeloppet större.' },
      { t: 'p', x: 'Du måste inte ta lön för att få ta utdelning. Rätt balans beror på bolagets resultat och din situation.' },

      { t: 'h2', x: 'Så syns det i bokföringen' },
      { t: 'p', x: '**Lön** bokförs som lönekostnad, skatteavdrag och arbetsgivaravgifter.' },
      { t: 'p', x: '**Utdelning** bokförs som en skuld till dig tills den betalas ut, och minskar bolagets fria egna kapital.' },
      { t: 'p', x: 'I Bokix ger lönekörningen lönebesked, skatteavdrag och betalfil. Utdelningen hjälper dig hålla koll på beslut och gränsbelopp. Läs mer under [Funktioner](/funktioner).' },
    ],
    faq: [
      { q: 'Kan jag ta både lön och utdelning?', a: 'Ja. Många ägare av fåmansföretag kombinerar ett löneuttag med utdelning. Vad som är rätt balans beror på bolagets resultat och din egen situation. Rådgör med en revisor för ditt specifika läge.' },
      { q: 'Måste jag ha lön för att ta utdelning?', a: 'Nej, det finns ingen generell plikt att ta lön för att få ta utdelning. Löneuttag kan däremot påverka hur stort ditt gränsbelopp blir enligt 3:12-reglerna, beroende på vilken beräkningsmodell som används.' },
      { q: 'Vad är gränsbelopp?', a: 'Den del av utdelningen som beskattas till den lägre skattesatsen för kvalificerade andelar i ett fåmansföretag. Det räknas fram per ägare och år och ändras med reglerna, se [Utdelning](/verktyg/utdelning) för aktuell uträkning.' },
      { q: 'Ger utdelning pensionsrätt?', a: 'Nej. Bara lön räknas som pensionsgrundande och sjukpenninggrundande inkomst. Tar du enbart utdelning byggs ingen allmän pension upp från den inkomsten.' },
      { q: 'Ändras reglerna ofta?', a: 'Ja, särskilt 3:12-reglerna och de belopp som styr gränsbeloppet ändras återkommande. Den här artikeln beskriver principerna, räkna fram aktuella belopp i verktygen eller fråga en rådgivare inför ett enskilt beslut.' },
    ],
  },
  {
    slug: 'enskild-firma-bokforing-ne',
    path: '/blogg/enskild-firma-bokforing-ne',
    category: 'Enskild firma',
    title: 'Enskild firma och NE-bilagan',
    seoTitle: 'Enskild firma: bokföring, egenavgifter, NE-bilaga',
    seoDescription: 'Så bokför du eget uttag och egen insättning, vad egenavgifter är och hur NE-bilagan hänger ihop med bokföringen i en enskild firma.',
    excerpt: 'Eget uttag, egenavgifter och hur NE-bilagan fylls i.',
    image: '/blog/enskild-firma-ne-hero.jpg',
    imageAlt: 'Tecknad NE-bilaga med ifyllda rader och en penna',
    datePublished: '2026-09-26',
    dateModified: '2026-09-26',
    readTime: '~6 min läsning',
    tldr: [
      'I en enskild firma är du och firman samma person juridiskt. Det finns ingen lön till dig själv, bara eget uttag och egen insättning.',
      'Du betalar egenavgifter i stället för arbetsgivaravgifter, och skatt på det som blir kvar efter kostnaderna, inte på det du tar ut.',
      'NE-bilagan byggs på din bokföring och lämnas med din inkomstdeklaration. Bokix förbereder den som pdf, men den lämnas i Skatteverkets e-tjänst eller på blankett, inte som SRU-fil.',
    ],
    body: [
      { t: 'p', x: 'En enskild firma är enkel att starta. Men bokföringen skiljer sig från ett aktiebolag, eftersom firman och du är samma person.' },
      { t: 'diagram', id: 'enskild-firma-flow', caption: 'Firman och du är samma person. Pengarna rör sig mellan er, men beskattas hos dig en gång om året.' },

      { t: 'h2', x: 'Firman och du är juridiskt samma person' },
      { t: 'p', x: 'En enskild firma är ingen egen juridisk person. Du driver den i eget namn och ansvarar själv för avtal och skulder.' },
      { t: 'p', x: 'I bokföringen hålls pengarna ändå isär med **eget uttag** och **egen insättning**. Då syns firmans resultat.' },

      { t: 'h2', x: 'Eget uttag och egen insättning' },
      { t: 'p', x: 'Tar du pengar ur firman till dig själv är det ett **eget uttag**, inte lön. Det bokförs på konto **2013 Övriga egna uttag**.' },
      { t: 'p', x: 'Uttaget beskattas inte i sig. Du betalar skatt på firmans överskott, oavsett hur mycket du tagit ut.' },
      { t: 'p', x: 'Sätter du in egna pengar i firman är det en **egen insättning**, konto **2018 Övriga egna insättningar**.' },
      { t: 'callout', kind: 'info', title: 'Inget lönebesked, ingen preliminärskatt på uttaget', x: 'Ett eget uttag ger dig ingen lönespecifikation och drar ingen skatt vid uttaget. Skatten på firmans resultat betalas i stället som preliminärskatt och stäms av i deklarationen.' },

      { t: 'h2', x: 'Egenavgifter i stället för arbetsgivaravgifter' },
      { t: 'p', x: 'I en enskild firma betalar du **egenavgifter** på överskottet. De liknar arbetsgivaravgifter men räknas på annat sätt.' },
      { t: 'p', x: 'Med F-skatt betalar du preliminärt varje månad. I deklarationen stäms det av mot det riktiga resultatet.' },
      { t: 'p', x: 'Procentsatsen beror på din ålder och ändras ibland. Räkna fram din i [Egenavgifter](/verktyg/egenavgifter).' },

      { t: 'h2', x: 'NE-bilagan' },
      { t: 'p', x: 'NE-bilagan är blanketten där firmans resultat redovisas i din deklaration. Siffrorna kommer från bokslutet.' },
      { t: 'p', x: 'Bokix fyller i NE-bilagan som en **pdf**. Du kontrollerar den och för in siffrorna i Skatteverkets e-tjänst.' },
      { t: 'callout', kind: 'tips', title: 'Bokslutet kommer innan bilagan', x: 'NE-bilagan är bara så bra som bokslutet den bygger på. Har du en omsättning på högst 3 miljoner kr räcker ett förenklat årsbokslut (K1), se [Bokslut för småföretag](/blogg/bokslut-checklista) för hela checklistan innan du fyller i NE.' },

      { t: 'h2', x: 'Bra att veta' },
      { t: 'h3', x: 'Eget bankkonto för firman' },
      { t: 'p', x: 'Det är inget krav, men det gör bokföringen mycket enklare. Då hör allt på kontot till firman.' },
      { t: 'h3', x: 'Så bokförs ett eget uttag' },
      { t: 'p', x: 'Från företagskontot mot konto 2013, utan moms. Det är ingen kostnad och påverkar inte resultatet.' },
      { t: 'h3', x: 'När egenavgifterna betalas' },
      { t: 'p', x: 'Varje månad via F-skatten, utifrån din uppskattning. Sedan stäms det av i deklarationen.' },
    ],
    faq: [
      { q: 'Måste jag ha ett eget bankkonto för firman?', a: 'Det är inget lagkrav, men starkt rekommenderat. Ett separat konto gör det mycket enklare att hålla isär firmans transaktioner från din privata ekonomi.' },
      { q: 'Hur bokför jag eget uttag?', a: 'Som en överföring mot konto 2013 Övriga egna uttag. Det egna uttaget är inte en kostnad och beskattas inte i sig, det är firmans totala resultat som beskattas.' },
      { q: 'När betalar jag egenavgifter?', a: 'Preliminärt löpande via F-skatten under året, och slutligt avstämt mot det faktiska resultatet i din inkomstdeklaration. Aktuell procentsats finns i verktyget Egenavgifter.' },
      { q: 'Vad är NE-bilagan?', a: 'Blanketten där resultatet av din enskilda näringsverksamhet redovisas i din inkomstdeklaration. Den bygger på ditt förenklade årsbokslut, alltså din bokföring omflyttad till NE-bilagans rader.' },
      { q: 'Kan Bokix skicka in NE-bilagan åt mig?', a: 'Nej. Bokix förbereder NE-bilagan som en ifylld pdf utifrån din bokföring, men du för själv in uppgifterna i Skatteverkets e-tjänst eller på blanketten, det finns i dagsläget ingen SRU-fil för NE.' },
    ],
  },
];
