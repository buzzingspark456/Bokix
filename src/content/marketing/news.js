// ── Nyheter från Bokix (/nyheter) ───────────────────────────────────────
// Samma format som BLOG_POSTS i blog.js (se blocktyperna där) och samma
// sidmall, BlogPostPage.jsx, som känner igen en nyhet på `news: true` och
// byter brödsmulor, schema (NewsArticle) och "Fler nyheter". En nyhet bor
// på /nyheter/<slug>; routing, förrendering och sitemap läser ALL_ARTICLES
// nedan, så enda manuella steget är en rewrite-rad i vercel.json.
//
// Samma regel som i bloggen, och strängare: en nyhet beskriver något som
// faktiskt har hänt i produkten, med datum. Inga påhittade kunder, citat,
// siffror eller pressomnämnanden.
import { BLOG_POSTS } from './blog.js';

export const NEWS_POSTS = [
  {
    news: true,
    slug: 'agi-fil-och-arbetsgivaravgift-efter-alder',
    path: '/nyheter/agi-fil-och-arbetsgivaravgift-efter-alder',
    category: 'Lön',
    title: 'Lönekörningen ger nu en AGI-fil, och arbetsgivaravgiften räknas efter ålder',
    excerpt: 'Varje lönekörning i Bokix ger nu en AGI-fil att ladda upp hos Skatteverket. Filen är provad och godkänd i Skatteverkets testtjänst, och arbetsgivaravgiften väljs efter varje anställds ålder.',
    image: '/blog/nyhet-agi-fil.jpg',
    imageAlt: 'Illustration: en lönekörning med tre anställda och olika arbetsgivaravgifter blir en AGI-fil som laddas upp hos Skatteverket',
    datePublished: '2026-09-25',
    dateModified: '2026-09-25',
    readTime: '~2 min läsning',
    tldr: [
      'Lönekörningen ger en AGI-fil i stället för bara en sammanställning att föra över för hand.',
      'Filen är provad i Skatteverkets testtjänst, för aktiebolag och enskild firma och alla avgiftsgrupper.',
      'Arbetsgivaravgiften väljs per anställd utifrån födelseåret i personnumret.',
    ],
    body: [
      { t: 'p', x: 'Sedan den 24 september ger varje lönekörning i Bokix en **AGI-fil**, arbetsgivardeklarationen på individnivå, som du laddar upp direkt i Skatteverkets e-tjänst. Tidigare fick du en sammanställning som pdf och fick föra över siffrorna själv.' },

      { t: 'h2', x: 'Provad hos Skatteverket innan den släpptes' },
      { t: 'p', x: 'Filen fanns färdig redan i september, men den var avstängd tills den hade provats på riktigt. Vi körde den genom Skatteverkets testtjänst för arbetsgivardeklarationer, för både aktiebolag och enskild firma och för alla avgiftsgrupper. Den godkändes, och först då slogs den på i appen.' },

      { t: 'h2', x: 'Rätt avgift för varje anställd' },
      { t: 'p', x: 'Arbetsgivaravgiften är inte densamma för alla. Bokix läser födelseåret ur personnumret och väljer avgift per person i nya lönekörningar:' },
      { t: 'table', caption: 'Så väljer Bokix arbetsgivaravgift', head: ['Den anställde', 'Avgift'], rows: [
        ['Född 1937 eller tidigare', 'Ingen arbetsgivaravgift'],
        ['67 år eller äldre vid årets början', 'Bara ålderspensionsavgift'],
        ['18–22 år vid årets början (april 2026 till september 2027)', 'Nedsatt avgift på lön upp till 25 000 kr i månaden'],
        ['Övriga', 'Full avgift'],
      ] },
      { t: 'p', x: 'Saknas ett läsbart personnummer används full avgift, precis som tidigare.' },
      { t: 'callout', kind: 'info', title: 'Du lämnar in, inte vi', x: 'Bokix skickar ingenting till Skatteverket. Du laddar ned filen, laddar upp den i e-tjänsten och signerar själv med BankID.' },

      { t: 'h2', x: 'Det här ingår i lönen' },
      { t: 'ul', x: [
        'Skatteavdrag enligt Skatteverkets skattetabeller',
        'Lönebesked som pdf per anställd',
        'Semesteravsättning och arbetsgivaravgifter',
        'AGI-fil att ladda upp hos Skatteverket',
        'Betalfil till banken',
      ] },
      { t: 'p', x: 'Lön ingår i nivån med personal, 179 kr/mån. Se [Priser](/priser), eller räkna på en lön med [lönekalkylatorn](/verktyg/lonekalkylator).' },
    ],
  },
  {
    news: true,
    slug: 'bokforingen-sparas-i-sju-ar',
    path: '/nyheter/bokforingen-sparas-i-sju-ar',
    category: 'Trygghet',
    title: 'Din bokföring sparas i sju år, även om du slutar använda Bokix',
    excerpt: 'Bokföringslagen kräver att räkenskaperna sparas i sju år. Nu håller Bokix det även när ett företag raderas i appen eller abonnemanget avslutas, och den som slutat betala kan alltid ladda ned sin bokföring.',
    image: '/blog/nyhet-sjuarsarkiv.jpg',
    imageAlt: 'Illustration: ett företag raderas i appen, en arkivkopia av bokföringen sparas först och finns kvar i sju år',
    datePublished: '2026-09-25',
    dateModified: '2026-09-25',
    readTime: '~2 min läsning',
    tldr: [
      'Innan ett företag töms eller raderas sparar Bokix en arkivkopia. Misslyckas den stoppas raderingen.',
      'Arkivet innehåller det bokförda, det lagen kräver, och ligger i privat lagring inom EU.',
      'Den som slutat betala blir aldrig utelåst: bokföringen går att ladda ned som SIE4 utan att betala.',
    ],
    body: [
      { t: 'p', x: 'Bokföringslagen säger att räkenskaperna ska sparas i sju år. Det gäller även om du byter program, lägger ned företaget eller bara slutar betala. Sedan den 24 september håller Bokix det löftet i alla de fallen.' },

      { t: 'h2', x: 'Arkivet sparas innan något raderas' },
      { t: 'p', x: 'När du tömmer ett företag eller tar bort det sparar Bokix först en arkivkopia av bokföringen och underlagen. Går arkiveringen inte igenom stoppas raderingen, så att ingenting försvinner av misstag.' },
      { t: 'p', x: 'Arkivet ligger i en privat lagring inom EU som bara Bokix kan läsa. Du begär ut det via support@bokix.se.' },

      { t: 'h2', x: 'Bara det lagen kräver' },
      { t: 'p', x: 'Arkivet innehåller det som är bokfört: verifikationer, skickade fakturor, bokförda kvitton och löner, matchade bankrader och deklarationer, med de konton och kontakter de använder. Utkast, offerter och lösenord till andra tjänster sparas inte. Arkivet komprimeras och tas bort när sjuårstiden har gått ut.' },

      { t: 'h2', x: 'Slutat betala? Bokföringen är fortfarande din' },
      { t: 'p', x: 'Loggar du in utan aktivt abonnemang står det "Din bokföring finns kvar", och du kan ladda ned den direkt som SIE4-fil, utan att betala först. SIE4 läses av alla svenska bokföringsprogram och av din revisor. Så fungerar formatet: [SIE4 förklarat](/blogg/sie4-flytta-bokforing).' },
      { t: 'callout', kind: 'tips', title: 'Dessutom en kopia varje natt', x: 'Utöver arkivet tas en kopia av hela kontot varje natt och sparas i 14 dagar, som skydd om något skulle gå fel.' },
      { t: 'p', x: 'Vad lagen kräver av dig som företagare, och varför papperskvittot får slängas när det är fotat, står i [Spara kvitton: vad krävs och hur länge](/blogg/spara-kvitton-bokforingslagen). Mer om hur din data skyddas finns på [Säkerhet](/sakerhet).' },
    ],
  },
  {
    news: true,
    slug: 'kvittoavlasning-flera-momssatser-och-returer',
    path: '/nyheter/kvittoavlasning-flera-momssatser-och-returer',
    category: 'Kvitton',
    title: 'Kvitton med flera momssatser, returer och kameran ett tryck bort',
    excerpt: 'Kvittoflödet i Bokix har fått en rad förbättringar: matkvitton med både 12 och 25 % moms bokförs rätt, returer går åt rätt håll, osäkra datum märks och på telefonen är kameran ett tryck bort.',
    image: '/blog/nyhet-kvitton.jpg',
    imageAlt: 'Illustration: ett matkvitto med både 12 och 25 procents moms läses av Bokix, som känner igen båda satserna',
    datePublished: '2026-09-25',
    dateModified: '2026-09-25',
    readTime: '~2 min läsning',
    tldr: [
      'Kvitton med flera momssatser känns igen och bokförs med rätt momsbelopp.',
      'Returer och återbetalningar bokförs åt andra hållet med en kryssruta.',
      'Ett datum som kan vara felläst märks Kontrollera i stället för att fyllas i tyst.',
    ],
    body: [
      { t: 'p', x: 'Att fota ett kvitto och få det bokfört är kärnan i Bokix. Den senaste veckan har avläsningen provats mot riktiga butikskvitton och 23 olika kvittoformat, från matbutik och drivmedel till hotell, taxi och utländska molntjänster. Det här är vad som blev bättre.' },

      { t: 'h2', x: 'Flera momssatser på samma kvitto' },
      { t: 'p', x: 'Det vanligaste matkvittot har både 12 % (mat) och 25 % (till exempel diskmedel). Tidigare kunde Bokix varna för att momsen inte stämde, fast siffrorna gick ihop. Nu känns flera satser igen, både i momstabeller och på separata momsrader, och kvittot bokförs med rätt momsbelopp.' },

      { t: 'h2', x: 'Returer och återbetalningar' },
      { t: 'p', x: 'Lämnar du tillbaka en vara kryssar du i **Retur eller återbetalning**. Beloppet skrivs som på kvittot, och bokföringen, momsen inräknad, går åt andra hållet.' },

      { t: 'h2', x: 'Osäkra datum märks' },
      { t: 'p', x: 'En avläsning kan förväxla siffror, till exempel 3 och 8. Bokix läser nu datumet en andra gång och jämför. Kan det vara fel, eller är det äldre än två år, märks det **Kontrollera** i stället för att fyllas i tyst.' },
      { t: 'callout', kind: 'info', title: 'Förslag, inte gissningar', x: 'Samma princip gäller kontot: ett konto från en regel visas som ett förslag med en Använd-knapp, inte ifyllt i förväg. Du ser alltid vad som är avläst och vad du behöver titta på.' },

      { t: 'h2', x: 'Kameran direkt från menyn' },
      { t: 'p', x: 'På telefonen tar kvittoknappen mitt i bottenmenyn dig direkt till kameran eller bildbiblioteket, utan omvägar. Välj bilden, så öppnas kvittot och du kan läsa av det.' },
      { t: 'p', x: 'Vill du se avläsningen utan att skapa konto kan du prova den gratis: [Skanna kvitto](/verktyg/skanna-kvitto).' },
    ],
  },
  {
    news: true,
    slug: 'ta-betalt-med-kort-och-stripe',
    path: '/nyheter/ta-betalt-med-kort-och-stripe',
    category: 'Betalningar',
    title: 'Bokix + Stripe: Ta betalt med kort på fakturan',
    excerpt: 'Låt dina kunder betala fakturor direkt med kort, Apple Pay och Google Pay via Stripe. Bokix prickar av betalningen och bokför automatiskt intäkt, moms och transaktionsavgifter.',
    image: '/blog/nyhet-stripe.jpg',
    imageAlt: 'Illustration: Bokix och Stripe i samarbete för kortbetalningar och automatisk bokföring',
    datePublished: '2026-09-25',
    dateModified: '2026-09-25',
    readTime: '~3 min läsning',
    tldr: [
      'Kunder kan betala fakturan direkt med betalkort, Apple Pay eller Google Pay via en säker betallänk och QR-kod.',
      'Bokix bokför automatiskt: fakturan prickas av, momsen landar rätt och transaktionsavgiften hamnar på konto 6570.',
      'Anslut ditt konto på under två minuter under Inställningar, utan krångliga inlösenavtal eller bindningstider.',
    ],
    body: [
      { t: 'p', x: 'Sena fakturabetalningar är ett av de vanligaste irritationsmomenten för småföretagare. När en kund måste logga in på sin internetbank, leta upp OCR-nummer, ange bankgironummer och kontrollera beloppet blir fakturan ofta liggande till helgen – eller glöms bort helt. Med kopplingen mellan **Bokix och Stripe** kan dina kunder nu betala direkt på sekunder med Visa, Mastercard, Apple Pay eller Google Pay.' },

      { t: 'h2', x: 'Betala snabbare och slipp jaga förfallna fakturor' },
      { t: 'p', x: 'När du skickar en faktura från Bokix med Stripe aktiverat inkluderas en smidig länk och en QR-kod. Kunden öppnar länken på sin telefon eller dator och slutför köpet på samma sätt som i vilken modern webbutik som helst.' },
      { t: 'ul', x: [
        '**Tre gånger snabbare betalning.** Fakturor med direkt betallänk betalas i snitt tre gånger snabbare än traditionella bankgirofakturor.',
        '**Apple Pay & Google Pay.** Kunden godkänner betalningen med Face ID eller Touch ID direkt i mobilen utan att behöva plocka fram plånboken.',
        '**Smidigt för utländska kunder.** Säljer du till kunder i Norden, Europa eller USA slipper de krångliga internationella IBAN- och banköverföringar.',
      ] },

      { t: 'h2', x: 'Automatisk bokföring av kortavgiften – slipp manuella differenser' },
      { t: 'p', x: 'Den stora huvudvärken med kortbetalningar brukar annars vara bokföringen: Stripe drar en liten transaktionsavgift vid varje köp. Det betyder att om du fakturerar 10 000 kr betalar kunden 10 000 kr, men beloppet som överförs till ditt bankkonto är något lägre. I traditionella bokföringsprogram tvingas du räkna ut mellanskillnaden själv och skapa separata manuella verifikationer för att inte få differens i avstämningen.' },
      { t: 'p', x: 'Bokix tar hand om hela kedjan helt automatiskt:' },
      { t: 'steps', x: [
        { h: 'Kunden betalar', p: 'Fakturan flaggas omedelbart som betald i Bokix och kundfordran (konto 1510) nollställs.' },
        { h: 'Avgiften bokförs', p: 'Stripes transaktionsavgift bokförs automatiskt som en finansiell kostnad på konto 6570 (Bank- och kortavgifter).' },
        { h: 'Utbetalningen prickas av', p: 'Nettobeloppet läggs på avräkningskontot (1580) och matchas direkt mot företagskontot (1930) när pengarna landar på din bank.' },
      ] },

      { t: 'h2', x: 'Full kontroll i Granskning' },
      { t: 'p', x: 'Inkommande Stripe-betalningar samlas under fliken **Stripe** i Granskning. Där ser du vad kunden betalat, exakt vad avgiften var och hur verifikationen ser ut. Ett klick räcker för att godkänna, och allting är spårbart.' },
      { t: 'callout', kind: 'tips', title: 'Kom igång på två minuter', x: 'Öppna Inställningar i Bokix, scrolla till Betalningar och klicka på "Anslut Stripe". Följ instruktionerna för att koppla ditt befintliga konto eller skapa ett nytt kostnadsfritt. Inga startavgifter eller fasta månadskostnader tillkommer.' },

      { t: 'p', x: 'Vill du veta mer om hur Bokix förenklar faktureringen för ditt företag? Läs mer på [Funktioner](/funktioner) eller jämför paket på [Priser](/priser).' },
    ],
  },
  {
    news: true,
    slug: 'kassaforsaljning-och-dagsavslut-med-zettle',
    path: '/nyheter/kassaforsaljning-och-dagsavslut-med-zettle',
    category: 'Kassa & Butik',
    title: 'Bokix + Zettle: Automatisk butiksbokföring',
    excerpt: 'Tar du betalt med Zettle i butiken, caféet eller salongen? Nu hämtar Bokix dagens försäljning automatiskt och skapar färdiga dagsavslut med rätt momssatser och avgifter.',
    image: '/blog/nyhet-zettle.jpg',
    imageAlt: 'Illustration: Bokix och Zettle by PayPal i samarbete för automatisk kassa- och kortförsäljning',
    datePublished: '2026-09-25',
    dateModified: '2026-09-25',
    readTime: '~3 min läsning',
    tldr: [
      'Dagens kortbetalningar och försäljning hämtas automatiskt från Zettle till Bokix varje natt.',
      'Flera momssatser (25 %, 12 % och 6 %) delas upp korrekt på separata konton utan manuell huvudräkning.',
      'Dagsavslutet landar färdigt i Granskning där du godkänner det på några sekunder.',
    ],
    body: [
      { t: 'p', x: 'För företag med fysisk försäljning – som butiker, frisörsalonger, caféer, food trucks och hantverkare – är Zettle by PayPal (tidigare iZettle) ett av Sveriges mest populära kassasystem. Men att stå kvar efter stängning, skriva ut dagsrapporter, slå på miniräknare och mata in dagens försäljning rad för rad i bokföringen är varken roligt eller tidseffektivt.' },
      { t: 'p', x: 'Med den nya kopplingen mellan **Bokix och Zettle** sköts dagsavsluten med automatik direkt från kassan till bokföringen.' },

      { t: 'h2', x: 'Hur automatiskt dagsavslut fungerar' },
      { t: 'p', x: 'När du har kopplat ihop ditt Zettle-konto hämtar Bokix gårdagens försäljning en gång per dygn. Systemet sammanställer en komplett verifikation för dagens kassa:' },
      { t: 'ul', x: [
        '**Kortförsäljning:** All kortomsättning summeras och stäms av.',
        '**Kontantförsäljning:** Har kunden betalat kontant bokförs det mot företagets handkassa (konto 1910).',
        '**Inlösenavgifter:** Zettles transaktionsavgift dras och bokförs automatiskt på konto 6570.',
        '**Dricks och avrundning:** Hanteras automatiskt enligt god redovisningssed.',
      ] },

      { t: 'h2', x: 'Rätt moms på mat, prylar och tjänster' },
      { t: 'p', x: 'Att hålla reda på olika momssatser är en av de vanligaste orsakerna till fel i momsdeklarationen. Säljer ett café en kaffe med bulle (12 % moms) och en tygpåse (25 % moms), eller säljer en frisör en klippning (25 %) och en tidning (6 %), måste varje del redovisas på rätt momskonto hos Skatteverket.' },
      { t: 'p', x: 'Bokix läser artikel- och momsspecifikationen direkt från Zettle och fördelar omsättningen på rätt konton:' },
      { t: 'table', caption: 'Så delas momsen upp automatiskt', head: ['Momssats', 'Försäljningskonto', 'Utgående moms'], rows: [
        ['25 % (Tjänster och varor)', 'Konto 3001', 'Konto 2611 (Utgående moms 25 %)'],
        ['12 % (Livsmedel och restaurang)', 'Konto 3002', 'Konto 2621 (Utgående moms 12 %)'],
        ['6 % (Böcker, tidskrifter, kultur)', 'Konto 3003', 'Konto 2631 (Utgående moms 6 %)'],
      ] },

      { t: 'h2', x: 'Ett klick i Granskning varje morgon' },
      { t: 'p', x: 'I stället för att gissa eller binda upp bokföringen i förväg hamnar dagsavslutet under fliken **Zettle** i Granskning. Du ser gårdagens totala omsättning, momsbeloppen och Zettle-avgiften tydligt uppställda. Klicka på **Godkänn**, så är gårdagens bokföring avslutad och klar.' },
      { t: 'callout', kind: 'info', title: 'Säker och godkänd koppling', x: 'Kopplingen använder Zettles officiella och säkra API. Du kan när som helst koppla bort tjänsten under Inställningar om du önskar.' },

      { t: 'p', x: 'Vill du prova hur smidigt det är att driva butik och café med Bokix? Skapa ett konto och anslut Zettle under Inställningar, eller läs mer om våra integrationer på [Integrationer](/integrationer).' },
    ],
  },
];

// Allt som får en egen artikelsida: bloggen och nyheterna. Routing,
// förrendering och sitemap läser den här listan.
export const ALL_ARTICLES = [...BLOG_POSTS, ...NEWS_POSTS];

