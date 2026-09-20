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
    category: 'Så funkar Bokix',
    title: 'Så gör Bokix bokföring enkelt: från kvitto till moms',
    excerpt: 'Hur Bokix tar hand om jobbet mellan kvittot och deklarationen: kvitton som läser sig själva, fakturor som bokförs, kontoutdrag som matchas och en granskningskö för allt som är osäkert. Utan att du behöver kunna bokföring.',
    image: '/blog/enkel-bokforing.jpg',
    imageAlt: 'Illustration: ett kvitto läses av Bokix som föreslår datum, belopp, moms och konto, och blir bokfört eller hamnar i granskning',
    datePublished: '2026-09-13',
    dateModified: '2026-09-20',
    readTime: '~8 min läsning',
    tldr: [
      'Bokix gör grovjobbet: läser av kvitton, bokför fakturor, matchar betalningar och kontoutdrag och förbereder momsen.',
      'Det som är osäkert gissas aldrig fram i tysthet. Det hamnar i Granskning, med anledningen utskriven, och du avgör det.',
      'Moms ingår i båda prisnivåerna, lön i nivån med personal, och hela bokföringen går alltid att exportera som SIE4.',
    ],
    body: [
      { t: 'p', x: 'De flesta som startar företag är bra på det de faktiskt gör, inte på dubbel bokföring, kontoplaner eller momsrutor. Ändå är bokföring i grunden bara en lång rad små händelser: ett kvitto, en faktura, en betalning. Varje händelse ska bli en verifikation med rätt konto och rätt moms. Det är där tiden går, och där det blir fel.' },
      { t: 'p', x: 'Bokix bygger på en enda regel: **det du inte kan gör vi åt dig, och det som är osäkert gissas aldrig fram i tysthet.** Den här artikeln går igenom hur det fungerar i praktiken, från första kvittot till momsdeklarationen.' },

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
      { t: 'p', x: 'Att sitta med en kvittohög och knappa in datum och belopp är det som gör bokföring tråkig. Så här ser det ut i Bokix:' },
      { t: 'steps', x: [
        { h: 'Fota eller ladda upp', p: 'Ta en bild med mobilen, eller ladda upp en bild eller pdf. Texten läses direkt i webbläsaren.' },
        { h: 'Bokix föreslår', p: 'Datum, belopp och momssats fylls i. Känner Bokix igen handlaren, till exempel en bensinmack, en matbutik eller ett molntjänstabonnemang, föreslås även rätt bokföringskonto.' },
        { h: 'Du kontrollerar', p: 'Varje avläst fält har en liten markering, och den försvinner så fort du ändrar fältet själv. Det du ser är alltid ett förslag, aldrig ett påstående.' },
      ] },
      { t: 'callout', kind: 'tips', title: 'Varför ett förslag och inte en automatik?', x: 'En avläsning kan ha fel: en fläck, ett vikt hörn eller en handlare som skriver ut momsen på ett ovanligt sätt. Genom att alltid visa avläsningen som något du kan ändra fångar du felet innan det hamnar i bokföringen. Vill du se hur avläsningen fungerar utan att skapa konto kan du prova det gratis: [Skanna kvitto](/verktyg/skanna-kvitto).' },

      { t: 'h2', x: 'Fakturor: skriv, skicka, bocka av' },
      { t: 'p', x: 'Kund- och leverantörsfakturor ligger i samma flöde. Du väljer bland fyra fakturamallar (Klassisk, Kraftfull, Minimal och Rutnät) och lägger till din egen logotyp och accentfärg, så att fakturan ser ut som ditt företag och inte som en mall.' },
      { t: 'ul', x: [
        '**Kortbetalning på fakturan.** Kunden kan betala direkt på fakturan via Stripe. Betalningen matchas mot rätt faktura och blir en färdig verifikation, utan att du behöver stämma av något i efterhand.',
        '**Påminnelser.** När en faktura passerat förfallodatum skickas en betalningspåminnelse automatiskt.',
        '**ROT och RUT.** Avdraget räknas på arbetskostnaden och visas både på fakturan och i underlaget till Skatteverket.',
        '**Leverantörsfakturor.** De registreras snabbt och bokförs automatiskt när du valt konto.',
        '**Din avsändare.** Fakturan kan skickas från din egen e-postdomän i stället för en delad avsändaradress.',
      ] },

      { t: 'h2', x: 'Granskning: det osäkra stannar hos dig' },
      { t: 'p', x: 'Det här är den viktigaste delen. Det är lätt att bygga ett program som bokför allt automatiskt. Det svåra är att veta när det inte ska göra det. En Swish-betalning utan tydlig avsändare, ett suddigt kvitto eller en summa som inte går ihop är just de fallen där en gissning blir dyr.' },
      { t: 'diagram', id: 'review-queue', caption: 'Så kan Granskning se ut. Varje rad har en tydlig anledning till att Bokix stannade.' },
      { t: 'p', x: 'I stället för att bokföra fel i tysthet hamnar sådana poster i Granskning. Där står anledningen utskriven, och du bokför posten själv med underlaget framför dig. Bokix föreslår konto ur dina egna tidigare bokföringar men bestämmer inget åt dig. Du upptäcker inte felet tre månader senare, utan samma dag.' },
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
      { t: 'p', x: 'Har du anställda räknar lönekörningen skatteavdrag enligt Skatteverkets skattetabeller, ger lönebesked som pdf per anställd, beräknar semesteravsättning och arbetsgivaravgifter och ger en AGI-sammanställning samt en betalfil till banken. Lön ingår i nivån med personal.' },
      { t: 'h3', x: 'Bokslut' },
      { t: 'p', x: 'Ett bokslutsflöde stämmer av och låser räkenskapsåret. För aktiebolag förbereds också inkomstdeklaration 2 med räkenskapsschema (INK2R), skattemässiga justeringar (INK2S) och SRU-filer.' },
      { t: 'callout', kind: 'tips', title: 'Aldrig skickat utan din signatur', x: 'Allt som ska in hos Skatteverket förbereds åt dig, men skickas aldrig automatiskt. Du kontrollerar och lämnar in själv.' },

      { t: 'h2', x: 'För vilka passar Bokix?' },
      { t: 'p', x: 'Bokix känner av rätt bolagsform utifrån ditt organisationsnummer när du skapar konto: enskild firma, aktiebolag, handelsbolag och kommanditbolag, ekonomisk förening samt ideell förening och stiftelse. Du kan ha flera företag under samma konto och upp till tre användare.' },
      { t: 'p', x: 'Är du med i Ung Företagsamhet finns ett eget UF-konto med en kortare meny, gratis i tre månader. Läs mer i [Bokföring för UF-företag](/blogg/bokforing-uf-foretag) eller på sidan [Bokix för UF-företag](/uf).' },

      { t: 'h2', x: 'Ingen inlåsning' },
      { t: 'p', x: 'Vill du någon gång gå vidare till ett annat system går hela bokföringen att exportera som en SIE4-fil. Det är branschstandarden som svenska bokföringsprogram och redovisningskonsulter använder för att flytta data, och du behöver inte fråga oss om lov. Så fungerar formatet: [SIE4 förklarat](/blogg/sie4-flytta-bokforing). Kommer du från ett annat program finns en guide här: [Byt bokföringsprogram till Bokix](/byt-bokforingsprogram).' },

      { t: 'h2', x: 'Vad kostar det?' },
      { t: 'p', x: 'Två priser, beroende på om du har personal: **129 kr/mån** utan anställda och **179 kr/mån** med. Obegränsat med kund- och leverantörsfakturor, fyra fakturamallar, löpande bokföring och kortbetalningar via Stripe ingår i båda, och det finns ingen bindningstid på månadsplanen. Bokix är inte momsregistrerat, så priserna är slutbelopp.' },
      { t: 'p', x: 'De första 30 dagarna är gratis. Du lägger in betaluppgifter hos Stripe när du skapar konto men debiteras ingenting, och avslutar du innan dess har det inte kostat dig något. Alla detaljer finns på sidan [Priser](/priser).' },
    ],
    faq: [
      { q: 'Behöver jag kunna bokföring sedan innan?', a: 'Nej. Verifikationer skapas automatiskt utifrån dina kvitton och fakturor. Det enda som kräver din uppmärksamhet hamnar i Granskning, med tydlig anledning till varför. Resten sköts av Bokix.' },
      { q: 'Hur läser Bokix av mina kvitton?', a: 'Fota kvittot eller ladda upp en bild eller pdf. Bokix läser texten direkt i webbläsaren och föreslår datum, belopp och momssats, och ett bokföringskonto när handlaren känns igen. Det du ser är alltid ett förslag som du kan ändra.' },
      { q: 'Vad händer med det Bokix är osäker på?', a: 'Det bokförs inte i tysthet. Det hamnar i Granskning med anledningen utskriven, till exempel en betalning utan tydlig avsändare eller ett kvitto som inte gick att läsa fullt ut, och du avgör hur det ska bokföras.' },
      { q: 'Kan jag koppla banken till Bokix?', a: 'Du exporterar kontoutdraget som en fil ur din internetbank och läser in det i Bokix. Raderna matchas mot dina obetalda kund- och leverantörsfakturor. Du behöver aldrig lämna ut några bankuppgifter eller inloggningar.' },
      { q: 'Ingår moms och lön i priset?', a: 'Ja. Momsdeklarationen ingår i båda prisnivåerna. Lönekörning med skatteavdrag, AGI-sammanställning och betalfil ingår i nivån med personal, 179 kr/mån. Inget av det är ett separat tillägg.' },
      { q: 'Kan jag ta med mig bokföringen om jag vill byta senare?', a: 'Ja. Din bokföring går att exportera som SIE4-fil, standardformatet svenska bokföringsprogram och redovisningskonsulter använder. Din data är aldrig inlåst.' },
    ],
  },
  // ── Artiklar med `body` renderas av BlogPostPage.jsx på /blogg/<slug> ──
  // Ett inlägg skrivs alltså HÄR, en gång, och får sida, listkort,
  // schema.org-data, sitemap-post och förrendering av sig själv (routes.js,
  // entry-server.jsx, AppRouter.jsx och prerender.mjs läser alla den här
  // listan). Enda manuella steget är en rewrite-rad i vercel.json.
  //
  // Fält utöver de vanliga: category (etikett), tldr (kort svar, lista),
  // faq ([{ q, a }], blir både synlig FAQ och FAQPage-schema).
  //
  // Blocktyper (t):
  //   h2 (får ankare och hamnar i innehållsförteckningen), h3, p, ul, ol,
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
    title: 'SIE4 förklarat: så flyttar du bokföringen till ett nytt program',
    excerpt: 'Vad SIE4 är, hur filen ser ut inuti och hur du exporterar, läser in och kontrollerar din bokföring när du byter bokföringsprogram, utan att tappa historiken.',
    image: '/blog/sie4-hero.jpg',
    imageAlt: 'Illustration: bokföring flyttas från Fortnox, Spiris, Bokio och Björn Lundén via en SIE4-fil till Bokix',
    datePublished: '2026-09-20',
    dateModified: '2026-09-20',
    readTime: '~7 min läsning',
    tldr: [
      'SIE4 är den svenska standardfilen för att flytta hela bokföringen mellan program: kontoplan, ingående balanser och varje verifikation.',
      'Exportera SIE typ 4 ur det gamla programmet, läs in filen i det nya, granska kontomappningen och stäm av resultat- och balansräkningen.',
      'Spara originalfilen. Räkenskapsinformation ska bevaras i sju år.',
    ],
    body: [
      { t: 'p', x: 'Att byta bokföringsprogram betyder inte att du behöver skriva in något på nytt. Nästan alla svenska bokföringsprogram kan både skapa och läsa in samma filformat, SIE, och det är därför ett byte tar en eftermiddag i stället för en vecka. Här går vi igenom vad filen är, hur den ser ut inuti, hur du gör bytet steg för steg och hur du kontrollerar att allt kom med.' },

      { t: 'h2', x: 'Vad är SIE?' },
      { t: 'p', x: 'SIE står för **Standard Import Export**. Det är ett filformat som den svenska branschen tagit fram just för att bokföringsdata ska gå att flytta mellan olika program och lämnas över till revisorn. Filen är oberoende av vilket program som skrev den, så en fil från Fortnox går att läsa in i Bokix, och tvärtom.' },
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
      { t: 'p', x: 'Två saker att lägga märke till. För det första står debet som positivt belopp och kredit som negativt, och **varje verifikation summerar till noll**. Det är själva grundregeln i dubbel bokföring. För det andra ligger balanskonton i #IB och #UB, medan resultatkonton ligger i #RES.' },
      { t: 'diagram', id: 'sie-balance', caption: 'Samma kontroll gör du efter bytet: ingående balans plus årets verifikationer ska ge utgående balans.' },
      { t: 'callout', kind: 'warn', title: 'Ser å, ä och ö konstiga ut?', x: 'SIE-filer sparas traditionellt i teckentabellen PC8. Öppnar du filen i ett program som antar en annan tabell blir å, ä och ö fel. Det är bara visningen som blir fel, inte filen, och programmet som läser in den känner igen #FORMAT-raden. Spara alltså inte om filen från ett textprogram.' },

      { t: 'h2', x: 'Steg 1: exportera SIE4 ur ditt nuvarande program' },
      { t: 'p', x: 'Välj **SIE typ 4** och de räkenskapsår du vill ta med. Exakt var exporten ligger skiljer sig mellan programmen, och leverantörerna flyttar runt sina menyer, så se det här som riktning och inte som en exakt vägbeskrivning:' },
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
      { t: 'p', x: 'Lägg tio minuter på att stämma av innan du litar på den nya bokföringen och säger upp det gamla programmet:' },
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
      { t: 'p', x: 'Enligt bokföringslagen ska räkenskapsinformation, alltså verifikationer, bokföringen och årsredovisningen, bevaras i sju år efter utgången av det kalenderår då räkenskapsåret avslutades. Spara därför SIE-filen och gärna en pdf-kopia av bokföringen innan du säger upp det gamla programmet. Är du osäker på vad som gäller för just ditt företag, fråga din revisor.' },

      { t: 'h2', x: 'Ingen inlåsning åt andra hållet heller' },
      { t: 'p', x: 'Samma format fungerar åt båda hållen. I Bokix kan du när som helst exportera hela bokföringen som en SIE4-fil om du vill vidare, utan att fråga oss om lov. Läs mer om vilka filformat Bokix hanterar under [integrationer och filformat](/integrationer).' },
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
    category: 'UF-företag',
    title: 'Bokföring för UF-företag: så håller ni ordning under UF-året',
    excerpt: 'Vad ett UF-företag behöver bokföra, en checklista för underlag, fem vanor som gör bokslutet enkelt och de vanligaste misstagen. Med exempel från ett UF-år.',
    image: '/blog/uf-hero.jpg',
    imageAlt: 'Illustration: bokföring under UF-året med en tidslinje från start till bokslut och exempel på bokförda händelser i Bokix',
    datePublished: '2026-09-20',
    dateModified: '2026-09-20',
    readTime: '~6 min läsning',
    tldr: [
      'Bokför allt som rör pengar i företaget och spara ett underlag för varje händelse: faktura, kvitto eller en rad på kontoutdraget.',
      'Bokför löpande, till exempel en gång i veckan, i stället för allt på en gång i maj.',
      'Bokix har ett eget UF-konto med bara de delar ett UF-företag använder. Det är gratis i tre månader och kräver inget organisationsnummer.',
    ],
    body: [
      { t: 'p', x: 'Ett UF-företag drivs under ett läsår, men bokföringen ska ändå vara i ordning från första kvittot till sista bokslutet. Det som gör skillnad är inte att kunna mycket om bokföring, utan att ha en vana: att aldrig låta något ligga. Här är hur ni gör det utan att det tar över hela UF-året.' },
      { t: 'diagram', id: 'uf-year', caption: 'UF-året i fyra faser. Bokföringen följer med hela vägen, den är inget som görs först i slutet.' },

      { t: 'h2', x: 'Vad behöver ett UF-företag bokföra?' },
      { t: 'p', x: 'Allt som rör pengar i företaget: försäljning, inköp, kostnader och betalningar. Varje händelse ska ha ett **underlag**, alltså något som visar vad som hänt. Det kan vara en faktura, ett kvitto eller en rad på kontoutdraget. En händelse utan underlag går inte att bokföra ordentligt, så det är underlagen ni ska vara noga med redan från början.' },
      { t: 'callout', kind: 'info', title: 'Följ alltid UF:s egna riktlinjer', logo: '/logos/uf-logo.svg', logoAlt: 'Ung Företagsamhet', x: 'Ung Företagsamhet har egna riktlinjer och material för bokföring och bokslut. Följ alltid dem och fråga er UF-rådgivare om något är oklart. Den här artikeln är en allmän guide, inte en ersättning. Bokix är ett fristående bokföringsprogram och drivs inte av, och är inte i samarbete med, Ung Företagsamhet.' },

      { t: 'h2', x: 'Vanliga händelser i ett UF-företag' },
      { t: 'p', x: 'De flesta UF-företag har samma handfull händelser hela året. Så här kan underlag och att-tänka-på se ut för dem:' },
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
];
