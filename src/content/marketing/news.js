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
];

// Allt som får en egen artikelsida: bloggen och nyheterna. Routing,
// förrendering och sitemap läser den här listan.
export const ALL_ARTICLES = [...BLOG_POSTS, ...NEWS_POSTS];
