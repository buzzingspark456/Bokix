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
//
// Samma stil som bloggen sedan 2026-10-13: kort rubrik, en menings
// ingress, korta stycken, eget tecknat omslag (scripts/blog-art/nyhet-*).
//
// Lägg nya nyheter SIST i listan. /nyheter sorterar på datum, och vid samma
// datum visas den som står längst ner först (se NewsPage.jsx).
import { BLOG_POSTS } from './blog.js';

export const NEWS_POSTS = [
  {
    news: true,
    slug: 'agi-fil-och-arbetsgivaravgift-efter-alder',
    path: '/nyheter/agi-fil-och-arbetsgivaravgift-efter-alder',
    category: 'Lön',
    title: 'AGI-fil direkt från lönen',
    seoTitle: 'AGI-fil från lönekörningen, avgift efter ålder',
    seoDescription: 'Varje lönekörning i Bokix ger nu en AGI-fil att ladda upp hos Skatteverket, godkänd i deras testtjänst. Arbetsgivaravgiften väljs efter ålder.',
    excerpt: 'Godkänd i Skatteverkets testtjänst, och avgiften räknas efter ålder.',
    image: '/blog/nyhet-agi-fil.jpg',
    imageAlt: 'Tecknade lönebesked för tre anställda bredvid en fil märkt AGI',
    datePublished: '2026-09-25',
    dateModified: '2026-10-13',
    readTime: '~2 min läsning',
    body: [
      { t: 'p', x: 'Sedan den 24 september ger varje lönekörning i Bokix en **AGI-fil**. Du laddar upp den i Skatteverkets e-tjänst.' },
      { t: 'p', x: 'Förut fick du en pdf och fick föra över siffrorna själv.' },

      { t: 'h2', x: 'Provad hos Skatteverket först' },
      { t: 'p', x: 'Vi körde filen genom Skatteverkets testtjänst, för aktiebolag och enskild firma och för alla avgiftsgrupper. Den godkändes. Först då slogs den på i appen.' },

      { t: 'h2', x: 'Rätt avgift för varje anställd' },
      { t: 'p', x: 'Arbetsgivaravgiften beror på ålder. Bokix läser födelseåret i personnumret och väljer avgift för varje person:' },
      { t: 'table', caption: 'Så väljer Bokix arbetsgivaravgift', head: ['Den anställde', 'Avgift'], rows: [
        ['Född 1937 eller tidigare', 'Ingen arbetsgivaravgift'],
        ['67 år eller äldre vid årets början', 'Bara ålderspensionsavgift'],
        ['18–22 år vid årets början (april 2026 till september 2027)', 'Nedsatt avgift på lön upp till 25 000 kr i månaden'],
        ['Övriga', 'Full avgift'],
      ] },
      { t: 'p', x: 'Går personnumret inte att läsa används full avgift.' },
      { t: 'callout', kind: 'info', title: 'Du lämnar in själv', x: 'Bokix skickar ingenting till Skatteverket. Du laddar upp filen och signerar med BankID.' },

      { t: 'h2', x: 'Det här ingår i lönen' },
      { t: 'ul', x: [
        'Skatteavdrag enligt Skatteverkets skattetabeller',
        'Lönebesked som pdf till varje anställd',
        'Semesteravsättning och arbetsgivaravgifter',
        'AGI-fil till Skatteverket',
        'Betalfil till banken',
      ] },
      { t: 'p', x: 'Lön ingår i nivån med personal, 179 kr/mån. Se [Priser](/priser) eller prova [lönekalkylatorn](/verktyg/lonekalkylator).' },
    ],
  },
  {
    news: true,
    slug: 'bokforingen-sparas-i-sju-ar',
    path: '/nyheter/bokforingen-sparas-i-sju-ar',
    category: 'Trygghet',
    title: 'Bokföringen sparas i sju år',
    seoTitle: 'Bokföringen sparas i sju år, även om du slutar',
    seoDescription: 'Bokföringslagen kräver att räkenskaperna sparas i sju år. Bokix sparar dem även om du raderar företaget eller avslutar abonnemanget.',
    excerpt: 'Även om du raderar företaget eller slutar betala.',
    image: '/blog/nyhet-sjuarsarkiv.jpg',
    imageAlt: 'Tecknat kassaskåp med pärmar inuti och en lapp där det står 7 år',
    datePublished: '2026-09-25',
    dateModified: '2026-10-13',
    readTime: '~2 min läsning',
    body: [
      { t: 'p', x: 'Bokföringslagen säger att bokföringen ska sparas i sju år. Det gäller även om du byter program, lägger ned företaget eller slutar betala.' },
      { t: 'p', x: 'Sedan den 24 september ser Bokix till det i alla de fallen.' },

      { t: 'h2', x: 'Arkivet sparas innan något raderas' },
      { t: 'p', x: 'Tömmer eller tar du bort ett företag sparar Bokix först en kopia av bokföringen och underlagen. Går det inte stoppas raderingen.' },
      { t: 'p', x: 'Kopian ligger i en privat lagring inom EU. Du får ut den via bokixab@gmail.com.' },

      { t: 'h2', x: 'Bara det lagen kräver' },
      { t: 'p', x: 'Arkivet innehåller det som är bokfört: verifikationer, skickade fakturor, kvitton, löner, bankrader och deklarationer.' },
      { t: 'p', x: 'Utkast, offerter och lösenord sparas inte. Arkivet tas bort när de sju åren har gått.' },

      { t: 'h2', x: 'Slutat betala? Bokföringen är din' },
      { t: 'p', x: 'Loggar du in utan abonnemang kan du ändå ladda ned bokföringen som en SIE4-fil. Den kan alla svenska bokföringsprogram läsa. Läs mer i [Flytta bokföringen med SIE4](/blogg/sie4-flytta-bokforing).' },
      { t: 'callout', kind: 'tips', title: 'En kopia varje natt', x: 'Varje natt sparas dessutom en kopia av hela kontot i 14 dagar, om något skulle gå fel.' },
      { t: 'p', x: 'Läs också [Hur länge ska kvitton sparas?](/blogg/spara-kvitton-bokforingslagen) och [Säkerhet](/sakerhet).' },
    ],
  },
  {
    news: true,
    slug: 'kvittoavlasning-flera-momssatser-och-returer',
    path: '/nyheter/kvittoavlasning-flera-momssatser-och-returer',
    category: 'Kvitton',
    title: 'Bättre kvittoavläsning',
    seoTitle: 'Kvitton med flera momssatser, returer och kamera',
    seoDescription: 'Matkvitton med 12 och 25 % moms bokförs rätt, returer går åt rätt håll, osäkra datum märks och på telefonen är kameran ett tryck bort.',
    excerpt: 'Flera momssatser, returer och osäkra datum.',
    image: '/blog/nyhet-kvitton.jpg',
    imageAlt: 'Tecknat matkvitto med rader för 12 och 25 procents moms, och en telefon som fotar det',
    datePublished: '2026-09-25',
    dateModified: '2026-10-13',
    readTime: '~2 min läsning',
    body: [
      { t: 'p', x: 'Avläsningen har provats mot riktiga kvitton i 23 olika format, från matbutik och bensinmack till hotell, taxi och utländska molntjänster. Det här blev bättre.' },

      { t: 'h2', x: 'Flera momssatser på samma kvitto' },
      { t: 'p', x: 'Ett matkvitto har ofta både 12 % (mat) och 25 % (till exempel diskmedel). Nu känns båda igen, och kvittot bokförs med rätt moms.' },

      { t: 'h2', x: 'Returer' },
      { t: 'p', x: 'Lämnar du tillbaka en vara kryssar du i **Retur eller återbetalning**. Då bokförs allt åt andra hållet, momsen också.' },

      { t: 'h2', x: 'Osäkra datum märks' },
      { t: 'p', x: 'En avläsning kan blanda ihop 3 och 8. Bokix läser datumet två gånger. Kan det vara fel, eller är det över två år gammalt, märks det **Kontrollera**.' },
      { t: 'callout', kind: 'info', title: 'Förslag, inte gissningar', x: 'Samma sak gäller kontot. Det visas som ett förslag som du väljer att använda.' },

      { t: 'h2', x: 'Kameran direkt från menyn' },
      { t: 'p', x: 'På telefonen öppnar kvittoknappen i menyn kameran direkt.' },
      { t: 'p', x: 'Prova avläsningen utan konto i [Skanna kvitto](/verktyg/skanna-kvitto).' },
    ],
  },
  {
    news: true,
    slug: 'ta-betalt-med-kort-och-stripe',
    path: '/nyheter/ta-betalt-med-kort-och-stripe',
    category: 'Betalningar',
    title: 'Kortbetalning på fakturan',
    seoTitle: 'Stripe och Bokix: ta betalt med kort på fakturan',
    seoDescription: 'Låt kunderna betala fakturan med kort, Apple Pay eller Google Pay via Stripe. Bokix prickar av betalningen och hämtar Stripes avgifter och utbetalningar till bokföringen.',
    excerpt: 'Kunden betalar med kort via Stripe, och Bokix bokför.',
    image: '/blog/nyhet-stripe.jpg',
    imageAlt: 'Tecknad faktura med en knapp där det står Betala nu, ett betalkort och Stripes logga',
    datePublished: '2026-09-25',
    dateModified: '2026-10-17',
    readTime: '~2 min läsning',
    body: [
      { t: 'p', x: 'Nu kan dina kunder betala fakturan direkt med kort, Apple Pay eller Google Pay. Betalningen går via **Stripe**.' },
      { t: 'p', x: 'Kunden slipper leta upp OCR-nummer och bankgiro. Det tar några sekunder.' },

      { t: 'h2', x: 'Så fungerar det för kunden' },
      { t: 'p', x: 'Fakturan får en betallänk och en QR-kod. Kunden öppnar länken och betalar som i en vanlig webbutik.' },

      { t: 'h2', x: 'Avgiften bokförs åt dig' },
      { t: 'p', x: 'Stripe tar en liten avgift på varje betalning och betalar ut till banken några dagar senare. Bokix bokför varje steg:' },
      { t: 'steps', x: [
        { h: 'Kunden betalar', p: 'Fakturan blir betald. Pengarna ligger på Stripe-saldot, konto 1686, och kundfordran (1510) nollas.' },
        { h: 'Avgiften bokförs', p: 'Stripes avgift bokförs på konto 6570 Bankkostnader.' },
        { h: 'Pengarna kommer', p: 'När Stripe betalar ut flyttas beloppet från 1686 till banken (1930).' },
      ] },

      { t: 'h2', x: 'Du ser allt i Granskning' },
      { t: 'p', x: 'Stripe-transaktioner samlas under fliken **Stripe** i Granskning, även försäljning som inte går via en faktura, som en webbshop eller betallänk. Avgifter och utbetalningar bokför du med ett klick. Läs mer i [Så bokför du Stripe](/blogg/bokfora-stripe).' },
      { t: 'callout', kind: 'tips', title: 'Så kopplar du Stripe', x: 'Öppna Inställningar, gå till Betalningar och tryck på Anslut Stripe. Du kan använda ett befintligt Stripe-konto eller skapa ett nytt.' },
      { t: 'p', x: 'Läs mer under [Funktioner](/funktioner) och [Priser](/priser).' },
    ],
  },
  {
    news: true,
    slug: 'kassaforsaljning-och-dagsavslut-med-zettle',
    path: '/nyheter/kassaforsaljning-och-dagsavslut-med-zettle',
    category: 'Kassa',
    title: 'Zettle bokförs automatiskt',
    seoTitle: 'Zettle och Bokix: kassan bokförs automatiskt',
    seoDescription: 'Tar du betalt med Zettle? Bokix hämtar dagens försäljning och skapar färdiga dagsavslut med rätt moms och avgifter.',
    excerpt: 'Dagens försäljning blir ett färdigt dagsavslut.',
    image: '/blog/nyhet-zettle.jpg',
    imageAlt: 'Tecknad kortläsare, ett dagsavslut per momssats och Zettles logga',
    datePublished: '2026-09-25',
    dateModified: '2026-10-13',
    readTime: '~2 min läsning',
    body: [
      { t: 'p', x: 'Tar du betalt med Zettle i butiken, caféet eller salongen? Då kan Bokix hämta försäljningen åt dig.' },
      { t: 'p', x: 'Du slipper skriva in dagens kassa för hand.' },

      { t: 'h2', x: 'Så fungerar dagsavslutet' },
      { t: 'p', x: 'En gång per dygn hämtar Bokix gårdagens försäljning från Zettle och gör ett dagsavslut:' },
      { t: 'ul', x: [
        '**Kort:** all kortförsäljning summeras.',
        '**Kontant:** bokförs på kassan, konto 1910.',
        '**Avgifter:** Zettles avgift bokförs på konto 6570.',
      ] },

      { t: 'h2', x: 'Rätt moms per vara' },
      { t: 'p', x: 'Ett café kan sälja kaffe med 12 % moms och en tygpåse med 25 %. Bokix läser momsen per vara från Zettle och delar upp försäljningen:' },
      { t: 'table', caption: 'Så delas försäljningen upp', head: ['Moms', 'Försäljning', 'Utgående moms'], rows: [
        ['25 %', 'Konto 3001', 'Konto 2611'],
        ['12 %', 'Konto 3002', 'Konto 2621'],
        ['6 %', 'Konto 3003', 'Konto 2631'],
      ] },

      { t: 'h2', x: 'Ett klick varje morgon' },
      { t: 'p', x: 'Dagsavslutet hamnar under fliken **Zettle** i Granskning. Du ser försäljning, moms och avgift, och trycker på **Godkänn**.' },
      { t: 'callout', kind: 'info', title: 'Koppla från när du vill', x: 'Kopplingen går via Zettles eget API. Du kan koppla från den under Inställningar.' },
      { t: 'p', x: 'Läs mer under [Integrationer](/integrationer).' },
    ],
  },
  {
    news: true,
    slug: 'skicka-fakturor-fran-din-egen-gmail',
    path: '/nyheter/skicka-fakturor-fran-din-egen-gmail',
    category: 'Fakturering',
    title: 'Fakturor från din Gmail',
    seoTitle: 'Skicka fakturor från din egen Gmail',
    seoDescription: 'Koppla Gmail till Bokix så går fakturor, offerter och påminnelser från din egen adress. Svaren hamnar i din inkorg och Bokix kan inte läsa din e-post.',
    excerpt: 'Skicka från din egen adress. Bokix kan inte läsa din e-post.',
    image: '/blog/nyhet-gmail.jpg',
    imageAlt: 'Tecknat kuvert från din egen adress med en faktura som pdf, och Gmails logga',
    datePublished: '2026-09-28',
    dateModified: '2026-10-13',
    readTime: '~2 min läsning',
    body: [
      { t: 'p', x: 'Koppla ditt **Gmail-konto** så skickas fakturor, offerter och påminnelser från din egen adress.' },
      { t: 'p', x: 'Utan koppling skickas de från Bokix adress, med ditt företagsnamn som avsändare.' },

      { t: 'h2', x: 'Varför din egen adress är bättre' },
      { t: 'ul', x: [
        '**Kunden känner igen dig.** Fakturan kommer från adressen ni redan mejlar med.',
        '**Svaren kommer till dig.** De hamnar i din vanliga inkorg.',
        '**Allt finns i Skickat.** Med pdf:en bifogad.',
      ] },

      { t: 'h2', x: 'Så kopplar du Gmail' },
      { t: 'steps', x: [
        { h: 'Öppna Kopplingar', p: 'Gå till Inställningar och välj Kopplingar.' },
        { h: 'Tryck på Anslut', p: 'Välj ditt Google-konto och godkänn att Bokix får skicka e-post.' },
        { h: 'Skicka som vanligt', p: 'Nästa faktura går från din adress.' },
      ] },

      { t: 'h2', x: 'Bokix kan bara skicka' },
      { t: 'p', x: 'Bokix får en enda behörighet från Google: **att skicka e-post**. Bokix kan inte läsa, söka i eller radera din e-post.' },
      { t: 'ul', x: [
        'Nyckeln från Google sparas krypterad och visas aldrig i webbläsaren.',
        'Den används bara för det du själv skickar från Bokix.',
        'Den delas aldrig och används aldrig för reklam eller AI-träning.',
      ] },
      { t: 'p', x: 'Läs mer i [integritetspolicyn](/privacy).' },

      { t: 'h2', x: 'Fakturan kommer fram ändå' },
      { t: 'p', x: 'Slutar kopplingen fungera, till exempel efter ett byte av lösenord, skickas fakturan via Bokix adress i stället. Du kopplar om med ett klick.' },

      { t: 'h2', x: 'Mejl på egen domän' },
      { t: 'p', x: 'Har du en adress på ditt eget företags domän finns kortet **Egen e-postadress** bredvid Gmail. Där kopplar du den med ett app-lösenord.' },
      { t: 'callout', kind: 'tips', title: 'Koppla från när du vill', x: 'Under Inställningar → Kopplingar → Gmail trycker du på Hantera och kopplar från. Då raderas nyckeln.' },
      { t: 'p', x: 'Se hur det går till i videoguiden [Skicka en faktura](/guider/skicka-faktura).' },
    ],
  },
];

// Allt som får en egen artikelsida: bloggen och nyheterna. Routing,
// förrendering och sitemap läser den här listan.
export const ALL_ARTICLES = [...BLOG_POSTS, ...NEWS_POSTS];
