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
    slug: 'enkel-bokforing',
    path: '/enkel-bokforing',
    title: 'Så gör Bokix bokföring enkelt',
    excerpt: 'Sex konkreta saker Bokix faktiskt gör så att bokföring inte kräver att du kan bokföring: OCR-läsning av kvitton, automatiska verifikationer, en granskningskö för det osäkra, bankimport som matchar sig själv, och moms/löner/bokslut inbyggt.',
    image: '/blog/enkel-bokforing-hero.jpg',
    imageAlt: 'För att bokföring ska vara enkelt — Bokix',
    datePublished: '2026-09-13',
    dateModified: '2026-09-13',
    readTime: '~4 min läsning',
  },
  // ── Artiklar med `body` renderas av BlogPostPage.jsx på /blogg/<slug> ──
  // Ett inlägg skrivs alltså HÄR, en gång, och får sida, listkort,
  // schema.org-data, sitemap-post och förrendering av sig själv (routes.js,
  // entry-server.jsx, AppRouter.jsx och prerender.mjs läser alla den här
  // listan). Enda manuella steget är en rewrite-rad i vercel.json.
  //
  // Blocktyper: h2, p, ul, ol. I text kan [länktext](/sökväg) användas.
  // Absolut regel, som på övriga marknadssidor: bara sådant som stämmer
  // med produkten (SwitchPage.jsx, UfPage.jsx, utils/ufMode.js) eller är
  // allmänt etablerad fakta — inga påhittade siffror eller löften.
  {
    slug: 'sie4-flytta-bokforing',
    path: '/blogg/sie4-flytta-bokforing',
    title: 'SIE4 förklarat: så flyttar du bokföringen till ett nytt program',
    excerpt: 'Vad SIE4 är, vad filen innehåller och hur du byter bokföringsprogram utan att tappa historiken. Fyra steg, och en checklista att gå igenom efteråt.',
    image: '/screenshots/bokix-bokforing-verifikationer.png',
    imageAlt: 'Skärmbild av Bokföring i Bokix: verifikationer med datum, beskrivning, belopp och status',
    datePublished: '2026-09-20',
    dateModified: '2026-09-20',
    readTime: '~5 min läsning',
    body: [
      { t: 'p', x: 'SIE är den svenska standarden för att flytta bokföring mellan program. Nästan alla svenska bokföringsprogram kan både exportera och läsa in formatet, och det är därför du kan byta program utan att skriva av något för hand. Här är vad du behöver veta innan du gör det.' },
      { t: 'h2', x: 'Vad är SIE?' },
      { t: 'p', x: 'SIE står för Standard Import Export. Det är ett filformat som branschen tagit fram just för att bokföringsdata ska gå att flytta mellan olika program och att lämna över till revisorn. Filen är vanlig text och innehåller bland annat din kontoplan och saldon, och i den fullständiga varianten även varje enskild verifikation.' },
      { t: 'h2', x: 'Vilken SIE-typ ska du välja?' },
      { t: 'p', x: 'Det finns fyra typer, och det är typ 4 du vill ha när du byter program:' },
      { t: 'ul', x: [
        'Typ 1 innehåller saldon per konto och räkenskapsår.',
        'Typ 2 lägger till saldon per period, alltså per månad.',
        'Typ 3 lägger till saldon per objekt, till exempel projekt eller kostnadsställe.',
        'Typ 4 innehåller kontoplan, ingående och utgående balanser samt varje verifikation med alla konteringsrader. Det är den som gör att historiken följer med i sin helhet.',
      ] },
      { t: 'h2', x: 'Så flyttar du bokföringen i fyra steg' },
      { t: 'ol', x: [
        'Exportera en SIE4-fil ur ditt nuvarande program. Välj typ 4 och de räkenskapsår du vill ta med. Exporten brukar ligga under en meny som heter något i stil med Export, Arkiv eller Bokföringsdata, beroende på program.',
        'Ladda upp filen i Bokix. Under Inställningar finns importen från andra bokföringsprogram. Guiden läser filen och visar vad den hittade: konton, verifikationer och ingående balanser.',
        'Granska kontomappningen. Konton som saknas i din kontoplan, eller som heter något annat i filen, flaggas var för sig. Ingenting skrivs in i bokföringen förrän du bekräftar i sista steget.',
        'Bokför vidare. Historiken ligger inne och du fortsätter löpande från den dag du bytte.',
      ] },
      { t: 'p', x: 'Vill du se var exporten brukar ligga i just ditt program finns det en guide här: [Byt bokföringsprogram till Bokix](/byt-bokforingsprogram).' },
      { t: 'h2', x: 'Kontrollera efter bytet' },
      { t: 'p', x: 'Lägg tio minuter på att stämma av innan du litar på den nya bokföringen:' },
      { t: 'ul', x: [
        'Jämför resultat- och balansräkning för det senaste avslutade räkenskapsåret i det gamla och det nya programmet. Summorna ska vara identiska.',
        'Kontrollera att ingående balanser för innevarande år stämmer med utgående balanser föregående år.',
        'Titta igenom verifikationslistan: antalet och numreringen ska se rimlig ut.',
        'Kom ihåg att en SIE-fil flyttar bokföringen, inte de enskilda fakturorna i ditt gamla program. Öppna kund- och leverantörsfakturor behöver du därför ofta stämma av eller lägga in separat.',
      ] },
      { t: 'h2', x: 'Spara originalet' },
      { t: 'p', x: 'Enligt bokföringslagen ska räkenskapsinformation, alltså verifikationer, bokföringen och årsredovisningen, bevaras i sju år efter utgången av det kalenderår då räkenskapsåret avslutades. Spara därför SIE-filen och gärna en pdf-kopia av bokföringen innan du säger upp det gamla programmet. Är du osäker på vad som gäller för just ditt företag, fråga din revisor.' },
      { t: 'h2', x: 'Ingen inlåsning åt andra hållet heller' },
      { t: 'p', x: 'Samma format fungerar åt båda hållen. I Bokix kan du när som helst exportera hela bokföringen som en SIE4-fil om du vill vidare, utan att fråga oss om lov. Läs mer om vilka filformat Bokix hanterar under [integrationer och filformat](/integrationer).' },
    ],
  },
  {
    slug: 'bokforing-uf-foretag',
    path: '/blogg/bokforing-uf-foretag',
    title: 'Bokföring för UF-företag: så håller ni ordning under UF-året',
    excerpt: 'Vad ett UF-företag behöver bokföra, vilka vanor som gör bokslutet enkelt och vilka delar av ett bokföringsprogram ni faktiskt kommer använda.',
    image: '/screenshots/bokix-oversikt-dashboard-uf-dark.png',
    imageAlt: 'Skärmbild av Bokix startsida för ett UF-konto med en kortare meny utan offerter, projekt och lön',
    datePublished: '2026-09-20',
    dateModified: '2026-09-20',
    readTime: '~4 min läsning',
    body: [
      { t: 'p', x: 'Ett UF-företag drivs under ett läsår, men bokföringen ska ändå vara i ordning från första kvittot till sista bokslutet. Här är hur ni gör det utan att det tar över hela UF-året.' },
      { t: 'h2', x: 'Vad behöver ett UF-företag bokföra?' },
      { t: 'p', x: 'Allt som rör pengar i företaget: försäljning, inköp, kostnader och betalningar. Varje händelse ska ha ett underlag, alltså något som visar vad som hänt. Det kan vara en faktura, ett kvitto eller en rad på kontoutdraget. Det som inte har ett underlag kan ni inte bokföra på ett ordentligt sätt, så det är underlagen ni ska vara noga med redan från början.' },
      { t: 'p', x: 'Ung Företagsamhet har egna riktlinjer och material för bokföring och bokslut. Följ alltid dem, och fråga er UF-rådgivare om något är oklart. Det här är en allmän guide, inte en ersättning för dem.' },
      { t: 'h2', x: 'Fem vanor som gör bokslutet enkelt' },
      { t: 'ol', x: [
        'Spara varje kvitto. Fota det direkt och lägg upp det, i stället för att låta en hög växa i väskan.',
        'Bokför löpande. En gång i veckan eller efter varje mässa är bättre än allt på en gång i maj.',
        'Skriv fakturan när affären är klar och håll ordning på vem som betalat. Skicka påminnelse när förfallodatumet passerat.',
        'Stäm av mot banken. Gå igenom kontoutdraget och se att varje rad har en motsvarighet i bokföringen.',
        'Kolla resultatet under året. Ser siffrorna märkliga ut är det enklare att rätta i oktober än i april.',
      ] },
      { t: 'h2', x: 'Det här kan ni göra i Bokix' },
      { t: 'p', x: 'Bokix har ett eget UF-konto som bara innehåller de delar ett UF-företag använder:' },
      { t: 'ul', x: [
        'Fakturor: skicka på mejl och håll koll på vem som betalat.',
        'Kvitton: fota och lägg upp, så läser Bokix av datum, belopp och moms.',
        'Bokföring: BAS-kontoplanen används automatiskt, så ni behöver inte veta vilka konton som finns.',
        'Bank: läs in kontoutdraget så matchas raderna mot era fakturor.',
        'Granskning: fångar det som ser fel ut i stället för att gissa i tysthet.',
        'Rapporter och årsbokslut: resultat och balans, och ett sätt att stänga året när ni är klara.',
      ] },
      { t: 'p', x: 'Menyn är kortare än i ett vanligt företag. Offerter, projekt och lön finns inte, eftersom ett UF-företag normalt inte har anställda och säljer direkt. Ni skriver fakturan när affären är klar.' },
      { t: 'h2', x: 'Vad kostar det?' },
      { t: 'p', x: 'UF-kontot är gratis i tre månader. Ni behöver inget organisationsnummer och lämnar inga betaluppgifter. Upp till fem fakturor per dygn ryms, vilket räcker gott för ett UF-företag. Alla villkor står på sidan [Bokix för UF-företag](/uf).' },
      { t: 'p', x: 'Bokix är ett fristående bokföringsprogram och drivs inte av, och är inte i samarbete med, Ung Företagsamhet.' },
    ],
  },
];
