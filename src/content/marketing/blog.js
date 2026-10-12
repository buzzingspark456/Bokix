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
    seoTitle: 'Enkel bokföring: från kvitto till moms',
    seoDescription: 'Så sköter Bokix jobbet mellan kvitto och moms: kvitton läses av, fakturor bokförs och det osäkra hamnar i Granskning. Du behöver inte kunna bokföring.',
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
      { t: 'p', x: 'Har du anställda räknar lönekörningen skatteavdrag enligt Skatteverkets skattetabeller, ger lönebesked som pdf per anställd, beräknar semesteravsättning och arbetsgivaravgifter efter varje anställds ålder, och ger en AGI-fil att ladda upp hos Skatteverket samt en betalfil till banken. Lön ingår i nivån med personal.' },
      { t: 'h3', x: 'Bokslut' },
      { t: 'p', x: 'Ett bokslutsflöde stämmer av och låser räkenskapsåret. För aktiebolag förbereds också inkomstdeklaration 2 med räkenskapsschema (INK2R) och SRU-filer.' },
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
    seoTitle: 'SIE4: så flyttar du bokföringen till nytt program',
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
    seoTitle: 'Bokföring för UF-företag: så gör ni under året',
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
  {
    slug: 'moms-deklaration-steg-for-steg',
    path: '/blogg/moms-deklaration-steg-for-steg',
    category: 'Moms',
    title: 'Momsdeklaration steg för steg: så gör du, datum och rutor',
    seoTitle: 'Momsdeklaration steg för steg: datum och rutor',
    seoDescription: 'Vem som ska redovisa moms och hur ofta, datumen för 2026, vilka rutor beloppen hamnar i och en checklista i fyra steg.',
    excerpt: 'Vem som ska redovisa moms och hur ofta, exakt vilka datum som gäller 2026, vilka rutor beloppen hamnar i och en checklista i fyra steg — så att deklarationen är rätt och i tid varje gång.',
    image: '/blog/moms-deklaration-hero.jpg',
    imageAlt: 'Illustration: kvitton och fakturor från kvartalet blir en momsdeklaration med rutorna 05, 10, 48 och 49 ifyllda, redo att laddas upp hos Skatteverket',
    datePublished: '2026-09-22',
    dateModified: '2026-09-22',
    readTime: '~7 min läsning',
    tldr: [
      'De flesta mindre företag redovisar moms kvartalsvis. Förfallodagen är den 12:e i andra månaden efter kvartalet, utom när den månaden är januari eller augusti — då är det den 17:e.',
      'Deklarationen är utgående moms minus ingående moms, ruta för ruta enligt SKV 4700. Betalningen ska vara hos Skatteverket samma dag som deklarationen.',
      'Fyra steg varje gång: kontrollera att allt är bokfört, granska rutorna, låt momsen bokföras, och lämna in. Ingenting skickas automatiskt — du signerar alltid själv.',
    ],
    body: [
      { t: 'p', x: 'Momsdeklarationen känns ofta krångligare än den är, mest för att den bara dyker upp några gånger om året och för att rutnumren inte säger något i sig själva. I grunden är det en enkel uträkning: moms du tagit ut av dina kunder, minus moms du själv betalat till dina leverantörer. Den här artikeln går igenom vem som ska redovisa, exakt vilka datum som gäller, vilka rutor som fylls i och hur du gör det steg för steg.' },
      { t: 'diagram', id: 'moms-steps', caption: 'Samma fyra steg varje kvartal. Bokix håller reda på datumen och räknar ut rutorna, men signaturen är alltid din.' },

      { t: 'h2', x: 'Vem ska redovisa moms, och hur ofta?' },
      { t: 'p', x: 'De flesta som säljer momspliktiga varor eller tjänster i Sverige ska registrera sig för moms och lämna en momsdeklaration. Hur ofta beror på företagets omsättning, och det är Skatteverket som beslutar vilken period just ditt företag har — beslutet står i ditt registreringsbevis.' },
      { t: 'table', caption: 'Redovisningsperioder', head: ['Period', 'Kräver', 'Deklareras'], rows: [
        ['Årsvis', 'Beskattningsbar omsättning på högst 1 miljon kr, vanligast bland enskilda firmor', 'I samma deklaration som inkomstskatten'],
        ['Kvartalsvis', 'Beskattningsbar omsättning på högst 40 miljoner kr — vanligast för aktiebolag och enskilda firmor', 'Fyra gånger per år, en period i taget'],
        ['Månadsvis', 'Krävs över 40 miljoner kr i omsättning, eller väljs själv av ett mindre företag', 'Tolv gånger per år'],
      ] },
      { t: 'callout', kind: 'info', title: 'Osäker på din period?', x: 'Perioden står i beslutet du fick när du momsregistrerade dig, och syns även i Skatteverkets e-tjänst. Den här artikeln fokuserar på kvartalsvis redovisning, eftersom det är vanligast bland Bokix kunder.' },

      { t: 'h2', x: 'När ska deklarationen vara inne?' },
      { t: 'p', x: 'Vid kvartalsvis redovisning ska både deklarationen och betalningen vara hos Skatteverket senast **den 12:e i andra månaden efter kvartalets slut**. Undantaget är när den månaden är januari eller augusti — Skatteverkets egna uppehåll kring jul och sommar flyttar då gränsen till **den 17:e** i stället. Landar datumet på en helg flyttas det till nästa vardag.' },
      { t: 'table', caption: 'Kvartalsvisa deadlines 2026 (helgframflyttning inräknad)', head: ['Period', 'Avser', 'Senast'], rows: [
        ['Kvartal 1', 'Januari–mars', '12 maj 2026'],
        ['Kvartal 2', 'April–juni', '17 augusti 2026'],
        ['Kvartal 3', 'Juli–september', '12 november 2026'],
        ['Kvartal 4', 'Oktober–december', '12 februari 2027'],
      ] },
      { t: 'p', x: 'Vill du se nästa deadline räknat på dagens datum, för din egen redovisningsperiod, finns ett gratis verktyg: [Momsdatum](/verktyg/momsdatum).' },
      { t: 'callout', kind: 'warn', title: 'För sent inlämnad eller betald', x: 'Missar du datumet riskerar du en förseningsavgift, och en obetald moms räntebeläggs. Är du osäker på om du hinner, lämna en så korrekt deklaration du kan i tid hellre än en perfekt en för sent — du kan begära omprövning i efterhand om något visar sig fel.' },

      { t: 'h2', x: 'Vad räknas in i deklarationen?' },
      { t: 'p', x: 'Deklarationen ställer upp din **utgående moms** (den du tagit ut av dina kunder) mot din **ingående moms** (den du själv betalat på inköp till verksamheten). Mellanskillnaden är vad du ska betala, eller få tillbaka.' },
      { t: 'table', caption: 'De vanligaste rutorna (SKV 4700)', head: ['Ruta', 'Vad den visar'], rows: [
        ['05', 'Momspliktig försäljning för perioden, exklusive moms'],
        ['10 / 11 / 12', 'Utgående moms på försäljningen: 25 %, 12 % respektive 6 %'],
        ['48', 'Ingående moms du har rätt att dra av på periodens inköp'],
        ['49', '**Moms att betala eller få tillbaka** — 10+11+12 minus 48'],
      ] },
      { t: 'p', x: 'Köper du tjänster från utlandet kan omvänd skattskyldighet göra att du själv ska redovisa både köparens och säljarens del av momsen, i egna rutor (21, 22 och 30–32). Det är ett eget ämne för sig — märker du att ett kvitto eller en faktura är från ett utländskt företag utan svensk moms, kontrollera hur den ska bokföras innan perioden stängs.' },

      { t: 'h2', x: 'Så gör du i fyra steg' },
      { t: 'steps', x: [
        { h: '1. Kontrollera att allt är bokfört', p: 'Gå igenom att kvartalets kvitton, fakturor och kontoutdrag faktiskt kommit in i bokföringen. Ligger något kvar i Granskning ska det avgöras innan deklarationen sammanställs — annars saknas det i uträkningen.' },
        { h: '2. Granska rutorna', p: 'Bokix räknar ihop utgående och ingående moms ur verifikationerna och sammanställer dem ruta för ruta. Stäm av att beloppen ser rimliga ut mot vad du minns av kvartalet, särskilt om något ovanligt hänt: en stor engångsförsäljning, ett dyrare inköp eller en tjänst köpt från utlandet.' },
        { h: '3. Låt momsen bokföras', p: 'När du är klar bokförs momsskulden (eller momsfordran, om du ska få tillbaka) automatiskt mot rätt konto, så att bokföringen och deklarationen stämmer mot varandra.' },
        { h: '4. Lämna in hos Skatteverket', p: 'Ladda upp filen i Skatteverkets e-tjänst, eller fyll i rutorna för hand efter pdf:en om du föredrar det. Du loggar in och signerar med BankID hos Skatteverket — det är alltid du som lämnar in, aldrig Bokix.' },
      ] },
      { t: 'callout', kind: 'tips', title: 'Se hela flödet innan du börjar', x: 'Så här ser momsflödet ut i Bokix, från bokförda verifikationer till en färdig deklaration: sidan [Skatt och bokslut](/funktioner) visar Översikten där kvartalets status samlas, och du markerar själv en period som inlämnad när du gjort det hos Skatteverket.' },

      { t: 'h2', x: 'Vanliga frågor om hur momsen räknas' },
      { t: 'h3', x: 'Vad händer om jag har mer ingående än utgående moms?' },
      { t: 'p', x: 'Då blir ruta 49 negativ: du har betalat mer moms på inköp än du tagit ut på försäljning, och får mellanskillnaden tillbaka från Skatteverket i stället för att betala in.' },
      { t: 'h3', x: 'Kan jag ändra en deklaration jag redan lämnat in?' },
      { t: 'p', x: 'Ja, det heter att begära omprövning och görs hos Skatteverket, inte i Bokix. Rätta först bokföringen om felet satt sig där, så att nästa period blir korrekt.' },
      { t: 'h3', x: 'Redovisar jag moms månadsvis eller kvartalsvis?' },
      { t: 'p', x: 'Det avgörs av Skatteverket utifrån din omsättning, inte av vad du väljer i Bokix. Perioden står i ditt registreringsbevis, och Bokix följer den perioden när deklarationen sammanställs.' },

      { t: 'h2', x: 'Ingen gissning, ingen automatisk inlämning' },
      { t: 'p', x: 'Två saker håller ihop hela det här flödet. Rutorna räknas ur din faktiska bokföring, aldrig ur en uppskattning — är något osäkert hamnar det i Granskning innan det når deklarationen. Och ingenting skickas till Skatteverket åt dig: du kontrollerar, laddar upp eller fyller i, och signerar själv med BankID. Bokix förbereder, du lämnar in.' },
    ],
    faq: [
      { q: 'Vem ska lämna momsdeklaration?', a: 'De flesta som säljer momspliktiga varor eller tjänster i Sverige och är momsregistrerade. Hur ofta du ska deklarera, månadsvis, kvartalsvis eller årsvis, beslutar Skatteverket utifrån din omsättning.' },
      { q: 'När ska momsdeklarationen vara inne 2026?', a: 'Vid kvartalsvis redovisning: kvartal 1 senast 12 maj, kvartal 2 senast 17 augusti, kvartal 3 senast 12 november och kvartal 4 senast 12 februari 2027. Landar datumet på en helg flyttas det till nästa vardag.' },
      { q: 'Varför är förfallodagen den 17:e i augusti och januari, men den 12:e annars?', a: 'Skatteverkets egna uppehåll kring sommaren och nyåret flyttar fram gränsen just de månaderna. Alla andra månader gäller den 12:e.' },
      { q: 'Vilka rutor är viktigast i momsdeklarationen?', a: 'Ruta 05 visar den momspliktiga försäljningen, 10–12 den utgående momsen per skattesats, 48 den ingående momsen du får dra av, och 49 mellanskillnaden — det du ska betala eller få tillbaka.' },
      { q: 'Bokför och skickar Bokix momsen automatiskt?', a: 'Bokix sammanställer deklarationen ur din bokföring och bokför momsskulden eller -fordran, men skickar aldrig in något hos Skatteverket åt dig. Du laddar upp filen eller fyller i uppgifterna och signerar alltid själv med BankID.' },
      { q: 'Vad händer om jag missar deadlinen?', a: 'En försenad deklaration kan ge en förseningsavgift, och en försenad betalning räntebeläggs. Lämna in så snart du kan även om du är sen, i stället för att vänta till en senare period.' },
    ],
  },
  {
    slug: 'spara-kvitton-bokforingslagen',
    path: '/blogg/spara-kvitton-bokforingslagen',
    category: 'Underlag',
    title: 'Spara kvitton: vad du måste spara och hur länge',
    seoDescription: 'Vilka underlag bokföringslagen kräver, hur länge de ska sparas och när du får slänga papperskvittot efter att ha fotat det.',
    excerpt: 'Vilka underlag bokföringslagen kräver, hur länge de ska sparas, och sedan lagändringen 2024: när du får slänga pappersoriginalet direkt efter ett foto eller en skanning.',
    image: '/blog/spara-kvitton-hero.jpg',
    imageAlt: 'Illustration: ett kvitto fotas och sparas digitalt i sju år, medan pappersoriginalet kan slängas direkt',
    datePublished: '2026-09-23',
    dateModified: '2026-09-23',
    readTime: '~5 min läsning',
    tldr: [
      'Varje bokförd händelse ska ha en verifikation, alltså ett underlag som visar vad som hänt — ett kvitto, en faktura eller en rad på kontoutdraget.',
      'Räkenskapsinformation ska enligt bokföringslagen sparas i sju år, räknat från utgången av det kalenderår räkenskapsåret avslutades.',
      'Sedan en lagändring 1 juli 2024 får du slänga pappersoriginalet direkt efter att du fotat eller skannat det, så länge kopian är hel, läsbar och oförändrad.',
    ],
    body: [
      { t: 'p', x: 'Kvittohögen är för de flesta det mest konkreta med bokföring: ett fysiskt bevis som ska sparas, men ingen är riktigt säker på hur länge eller om originalet måste finnas kvar. Här är vad som faktiskt gäller, kort och konkret.' },
      { t: 'diagram', id: 'receipt-archive', caption: 'Kvittot fotas, kopian sparas i sju år, och sedan 2024 behöver du inte spara papperet också.' },

      { t: 'h2', x: 'Vad är en verifikation, och vad ska den visa?' },
      { t: 'p', x: 'Varje händelse som bokförs, en försäljning, ett inköp eller en betalning, ska ha en **verifikation**: ett underlag som visar att händelsen faktiskt skett. Det kan vara ett kvitto, en faktura eller en rad på kontoutdraget. En verifikation ska gå att koppla till händelsen den avser och innehålla vad som hänt, när det hände och hur mycket det gällde.' },
      { t: 'callout', kind: 'info', title: 'Ingen verifikation, ingen bokföring', x: 'En händelse utan underlag går inte att bokföra korrekt. Sakna du kvittot, notera i alla fall vad köpet gällde och när, så att du har något att utgå från — men leta efter underlaget i första hand, till exempel som kvitto på mejl eller i en app.' },

      { t: 'h2', x: 'Hur länge ska du spara det?' },
      { t: 'p', x: 'Enligt bokföringslagen (7 kap.) ska räkenskapsinformation, alltså verifikationer, bokföringen och årsredovisningen, sparas i **sju år** efter utgången av det kalenderår då räkenskapsåret avslutades. Ett räkenskapsår som slutar 31 december 2026 ska alltså sparas till och med 2033.' },
      { t: 'p', x: 'Sjuårsregeln gäller oavsett om underlaget är i papper eller digitalt. Det som skiljer är vad som gäller för själva pappersoriginalet.' },

      { t: 'h2', x: 'Får du slänga originalet efter att ha fotat det?' },
      { t: 'p', x: 'Ja, sedan en lagändring som trädde i kraft **1 juli 2024**. Innan dess fanns strängare krav på när ett pappersoriginal fick kastas. Nu gäller i stället två villkor, oavsett hur gammalt underlaget är:' },
      { t: 'ul', x: [
        '**Informationen är överförd till en annan form** — ett foto, en skanning eller ett digitalt kvitto.',
        '**Överföringen får inte riskera att informationen ändras eller går förlorad.** Bilden ska vara hel, läsbar och stämma med originalet.',
      ] },
      { t: 'p', x: 'Ett vanligt mobilfoto duger, så länge det är komplett och går att läsa. Är kvittot redan digitalt, ett kvitto på mejl eller i en app, räknas det digitala kvittot som originalet, och det finns inget pappersoriginal att ta ställning till.' },
      { t: 'callout', kind: 'tips', title: 'Fota direkt, inte i efterhand', x: 'Kvitton från kassaremsa bleknar ofta inom några månader. Fota eller ladda upp kvittot samma dag du får det, innan det blir oläsligt. Med [Skanna kvitto](/verktyg/skanna-kvitto) kan du testa hur avläsningen fungerar utan att skapa konto.' },

      { t: 'h2', x: 'Bygg en vana, inte en kvittohög' },
      { t: 'p', x: 'Den enklaste lösningen är att aldrig samla på hög. Fota kvittot direkt när du får det, innan det hamnar i fickan och glöms bort. I Bokix blir ett fotat kvitto automatiskt avläst med datum, belopp och moms som förslag, sparat i sju år utan att du behöver hålla reda på det själv.' },
      { t: 'p', x: 'Har du redan en hög med gamla kvitton? Gå igenom dem i omgångar, fota det som fortfarande går att läsa, och notera för hand det som redan är oläsligt.' },

      { t: 'h2', x: 'Om ett kvitto saknas helt' },
      { t: 'p', x: 'Det händer. Be leverantören om ett kvittokopia eller en kopia av fakturan, många butiker och tjänster kan skicka en digital kopia i efterhand. Går det inte, notera vad köpet gällde, datum och belopp så gott du kan, och bokför med den informationen — en ofullständig anteckning är bättre än ingenting, men sikta på att aldrig hamna där genom att fota direkt.' },
    ],
    faq: [
      { q: 'Kan jag slänga originalet efter att jag skannat eller fotat det?', a: 'Ja, sedan en lagändring 1 juli 2024. Villkoren är att informationen är överförd till en annan form (foto, skanning, digitalt kvitto) och att överföringen inte riskerar att ändra eller förlora informationen — bilden ska vara hel och läsbar.' },
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
    title: 'Bokslut för småföretag: checklista i nio steg',
    seoDescription: 'Nio steg från sista bokföringen till ett låst räkenskapsår: avstämning, avskrivningar, periodiseringar och tidsgränserna för bokslut och årsredovisning.',
    excerpt: 'De nio stegen från sista löpande bokföringen till ett låst räkenskapsår: avstämning, avskrivningar, periodiseringar och vad som händer efteråt — med tidsgränserna för förenklat årsbokslut och aktiebolagets årsredovisning.',
    image: '/blog/bokslut-checklista-hero.jpg',
    imageAlt: 'Illustration: löpande bokförda händelser blir en nio-stegs checklista för bokslut och sedan en årsredovisning till Bolagsverket inom sju månader',
    datePublished: '2026-09-24',
    dateModified: '2026-09-24',
    readTime: '~6 min läsning',
    tldr: [
      'Bokslutet stämmer av året: banken, avskrivningar, periodiseringar och lager, innan resultatet beräknas och räkenskapsåret låses.',
      'Enskild firma med en omsättning på högst 3 miljoner kr kan använda förenklat årsbokslut (K1). Aktiebolag gör alltid en fullständig årsredovisning.',
      'Aktiebolagets årsredovisning ska vara hos Bolagsverket senast sju månader efter räkenskapsårets slut, annars väntar förseningsavgifter.',
    ],
    body: [
      { t: 'p', x: 'Bokslutet är inte ett eget bokföringssystem, det är en avstämning av det du redan bokfört under året, plus några poster som bara hör hemma i slutet: avskrivningar, periodiseringar och årets resultat. Gör du det i rätt ordning är det en checklista att beta av, inte ett mysterium.' },

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
      { t: 'p', x: 'En anläggningstillgång, till exempel en dator eller en maskin, kostnadsförs inte hela beloppet direkt. I stället fördelas kostnaden över tillgångens beräknade livslängd, en bit varje år. Den årliga biten är avskrivningen.' },
      { t: 'h3', x: 'Periodisering' },
      { t: 'p', x: 'En kostnad eller intäkt ska bokföras det år den faktiskt hör till, inte nödvändigtvis det år fakturan kom. Betalar du en försäkring i december som gäller hela nästa år, hör den kostnaden till nästa år och periodiseras dit.' },

      { t: 'h2', x: 'Förenklat årsbokslut eller fullständig årsredovisning?' },
      { t: 'p', x: 'Vilken typ av bokslut som krävs beror på bolagsform och storlek.' },
      { t: 'table', caption: 'Vilket bokslut passar', head: ['Bolagsform', 'Kräver', 'Klart senast'], rows: [
        ['Enskild firma, omsättning normalt högst 3 miljoner kr', 'Förenklat årsbokslut (K1)', '30 juni året efter, som underlag till NE-bilagan'],
        ['Enskild firma, större omsättning', 'Fullständigt årsbokslut', 'Inför deklarationen'],
        ['Aktiebolag (alla storlekar)', 'Fullständig årsredovisning (K2 eller K3)', 'Senast 7 månader efter räkenskapsårets slut, hos Bolagsverket'],
      ] },
      { t: 'p', x: 'Ett förenklat årsbokslut lämnas inte in till Skatteverket, det sparas tillsammans med bokföringen och ligger till grund för NE-bilagan i din deklaration. En överskriden omsättningsgräns ett enstaka år tvingar dig inte automatiskt över till fullständigt bokslut, det är vad som **normalt** gäller som räknas.' },
      { t: 'callout', kind: 'warn', title: 'Aktiebolagets deadline är sträng', x: 'Missar ett aktiebolag 7-månadersgränsen till Bolagsverket väntar förseningsavgifter, och fortsätter dröjsmålet kan Bolagsverket besluta om tvångslikvidation. Bolagsstämman ska hållas senast 6 månader efter räkenskapsårets slut, så att årsredovisningen hinner lämnas in inom den sjunde.' },

      { t: 'h2', x: 'Vad händer efter bokslutet?' },
      { t: 'p', x: 'För en enskild firma används det förenklade årsbokslutet som grund för NE-bilagan i din inkomstdeklaration. För ett aktiebolag skickas årsredovisningen till Bolagsverket, och bolaget lämnar dessutom inkomstdeklaration 2 till Skatteverket med räkenskapsschema (INK2R) och skattemässiga justeringar (INK2S).' },
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
    title: 'Lön eller utdelning: så tar du ut pengar ur ditt aktiebolag',
    seoTitle: 'Lön eller utdelning i aktiebolag: så väljer du',
    seoDescription: 'Två sätt att ta ut pengar ur ett fåmansföretag, med olika skatt och olika följder för pension och sjukpenning. Principerna, förklarade enkelt.',
    excerpt: 'Två vägar att ta pengar ur ett fåmansföretag, med olika skatt, olika krav och olika följder för pension och sjukpenning. Principerna förklarade, utan gissade belopp — beloppen räknar du fram i verktygen.',
    image: '/blog/lon-eller-utdelning-hero.jpg',
    imageAlt: 'Illustration: två vägar för pengar ur ett aktiebolag, lön respektive utdelning, med olika villkor för vardera',
    datePublished: '2026-09-25',
    dateModified: '2026-09-25',
    readTime: '~6 min läsning',
    tldr: [
      'Lön kostar bolaget arbetsgivaravgifter men ger dig pensionsgrundande och sjukpenninggrundande inkomst, direkt beskattad varje månad.',
      'Utdelning beslutas på bolagsstämman, kräver utdelningsbara medel i bolaget och beskattas olika inom och utanför gränsbeloppet — men ger ingen pensionsrätt.',
      'Reglerna (särskilt 3:12) och beloppen ändras år till år. Den här artikeln förklarar principerna, inte siffrorna — räkna på ditt eget läge i verktygen.',
    ],
    body: [
      { t: 'p', x: 'Äger du ett aktiebolag är lön och utdelning de två sätten att få ut pengar för egen del. De fungerar helt olika: olika skatt, olika krav och olika följd för din pension. Den här artikeln går igenom principerna. Exakta belopp (skiktgränser, gränsbelopp, procentsatser) ändras varje år, så de räknar du fram i verktygen i stället för att lita på ett tal i en text som blir gammal.' },
      { t: 'diagram', id: 'pay-or-dividend', caption: 'Samma bolag, två olika vägar ut. Ingenting hindrar dig från att kombinera dem.' },
      { t: 'callout', kind: 'warn', title: 'Inte personlig skatterådgivning', x: 'Reglerna kring ägarbeskattning i fåmansföretag (de så kallade 3:12-reglerna) är detaljerade och ändras återkommande. Den här artikeln beskriver hur det fungerar i stort. Rådgör med en revisor eller skatterådgivare inför beslut som gäller stora belopp eller ett enskilt räkenskapsår.' },

      { t: 'h2', x: 'Lön: enklare, och den ger pensionsrätt' },
      { t: 'p', x: 'Lön bokförs varje månad som en vanlig lönekostnad. Bolaget betalar bruttolönen plus arbetsgivaravgifter, och du beskattas för lönen direkt som inkomst av tjänst, enligt din preliminärskatt.' },
      { t: 'p', x: 'Fördelen med lön är att den ger **pensionsgrundande och sjukpenninggrundande inkomst**. Tar du aldrig ut lön ur ditt bolag byggs ingen allmän pension eller sjukpenninggrundande inkomst upp från den verksamheten.' },

      { t: 'h2', x: 'Utdelning: kräver ett beslut och utdelningsbara medel' },
      { t: 'p', x: 'Utdelning beslutas på bolagsstämman, normalt en gång per år i samband med att årsredovisningen fastställs, och kräver att bolaget faktiskt har **utdelningsbara medel**, det vill säga fritt eget kapital efter att lagstadgade reserver räknats bort.' },
      { t: 'p', x: 'Skatten på utdelning skiljer sig beroende på om den ryms inom ditt **gränsbelopp** eller inte. Gränsbeloppet räknas fram per ägare och år enligt 3:12-reglerna, och just den uträkningen är den del av regelverket som ändras oftast. Utdelning ger ingen pensions- eller sjukpenninggrundande inkomst.' },
      { t: 'callout', kind: 'tips', title: 'Räkna på ditt eget läge', x: 'Gränsbelopp, skiktgränser och arbetsgivaravgifter ändras år till år. Räkna fram aktuella belopp i [Utdelning](/verktyg/utdelning) och [Lönekalkylator](/verktyg/lonekalkylator) i stället för att utgå från förra årets siffror.' },

      { t: 'h2', x: 'Kan du ta både lön och utdelning?' },
      { t: 'p', x: 'Ja, de utesluter inte varandra. Många ägare av fåmansföretag tar en lön som täcker ett rimligt löneuttag, delvis för att kvalificera för ett högre gränsbelopp, och kompletterar med utdelning. Vad som är rätt balans beror på bolagets resultat, ditt behov av pensionsgrundande inkomst och din totala skattesituation, och är precis den typen av fråga en revisor kan hjälpa till att räkna på för ditt specifika bolag.' },

      { t: 'h2', x: 'Så syns det i bokföringen' },
      { t: 'p', x: 'En lönekörning bokförs som lönekostnad, skatteavdrag och arbetsgivaravgifter, med utbetalningen till dig som en separat rad. En beslutad utdelning bokförs som en skuld till dig som ägare fram till att den betalas ut, och minskar bolagets fria egna kapital.' },
      { t: 'p', x: 'I Bokix hanteras båda flödena under Skatt och bokslut: lönekörningen ger lönebesked, skatteavdrag enligt Skatteverkets skattetabeller och en betalfil till banken, medan utdelningsflödet hjälper dig hålla koll på beslut och gränsbelopp. Läs mer om vad som ingår i [Skatt och bokslut](/funktioner).' },
    ],
    faq: [
      { q: 'Kan jag ta både lön och utdelning?', a: 'Ja. Många ägare av fåmansföretag kombinerar ett löneuttag med utdelning. Vad som är rätt balans beror på bolagets resultat och din egen situation — rådgör med en revisor för ditt specifika läge.' },
      { q: 'Måste jag ha lön för att ta utdelning?', a: 'Nej, det finns ingen generell plikt att ta lön för att få ta utdelning. Löneuttag kan däremot påverka hur stort ditt gränsbelopp blir enligt 3:12-reglerna, beroende på vilken beräkningsmodell som används.' },
      { q: 'Vad är gränsbelopp?', a: 'Den del av utdelningen som beskattas till den lägre skattesatsen för kvalificerade andelar i ett fåmansföretag. Det räknas fram per ägare och år och ändras med reglerna — se [Utdelning](/verktyg/utdelning) för aktuell uträkning.' },
      { q: 'Ger utdelning pensionsrätt?', a: 'Nej. Bara lön räknas som pensionsgrundande och sjukpenninggrundande inkomst. Tar du enbart utdelning byggs ingen allmän pension upp från den inkomsten.' },
      { q: 'Ändras reglerna ofta?', a: 'Ja, särskilt 3:12-reglerna och de belopp som styr gränsbeloppet ändras återkommande. Den här artikeln beskriver principerna — räkna fram aktuella belopp i verktygen eller fråga en rådgivare inför ett enskilt beslut.' },
    ],
  },
  {
    slug: 'enskild-firma-bokforing-ne',
    path: '/blogg/enskild-firma-bokforing-ne',
    category: 'Enskild firma',
    title: 'Enskild firma: bokföring, egenavgifter och NE-bilagan förklarade',
    seoTitle: 'Enskild firma: bokföring, egenavgifter, NE-bilaga',
    seoDescription: 'Så bokför du eget uttag och egen insättning, vad egenavgifter är och hur NE-bilagan hänger ihop med bokföringen i en enskild firma.',
    excerpt: 'Vad som skiljer en enskild firma från ett aktiebolag, hur eget uttag och egen insättning bokförs, vad egenavgifter är och hur NE-bilagan hänger ihop med din bokföring.',
    image: '/blog/enskild-firma-ne-hero.jpg',
    imageAlt: 'Illustration: pengarna i en enskild firma, från kundfaktura via eget uttag till NE-bilagan i deklarationen',
    datePublished: '2026-09-26',
    dateModified: '2026-09-26',
    readTime: '~6 min läsning',
    tldr: [
      'I en enskild firma är du och firman samma person juridiskt. Det finns ingen lön till dig själv, bara eget uttag och egen insättning.',
      'Du betalar egenavgifter i stället för arbetsgivaravgifter, och skatt på det som blir kvar efter kostnaderna, inte på det du tar ut.',
      'NE-bilagan byggs på din bokföring och lämnas med din inkomstdeklaration. Bokix förbereder den som pdf, men den lämnas i Skatteverkets e-tjänst eller på blankett, inte som SRU-fil.',
    ],
    body: [
      { t: 'p', x: 'En enskild firma är den enklaste bolagsformen att starta, och också den som skiljer sig mest från ett aktiebolag rent bokföringsmässigt: det finns ingen gräns mellan din privata ekonomi och firmans, bara en bokföringsmässig uppdelning av samma pengar.' },
      { t: 'diagram', id: 'enskild-firma-flow', caption: 'Firman och du är samma person. Pengarna rör sig mellan er, men beskattas hos dig en gång om året.' },

      { t: 'h2', x: 'Firman och du är juridiskt samma person' },
      { t: 'p', x: 'Till skillnad från ett aktiebolag är en enskild firma inte en egen juridisk person. Du driver verksamheten i eget namn, och du är personligt ansvarig för firmans avtal och skulder. Bokföringsmässigt hålls firmans pengar och din privata ekonomi ändå isär, via **eget uttag** och **egen insättning**, så att det går att se vad som är firmans resultat.' },

      { t: 'h2', x: 'Eget uttag och egen insättning' },
      { t: 'p', x: 'Tar du ut pengar ur firman för privat bruk är det ett **eget uttag**, inte en lön. Det bokförs mot konto **2013 Övriga egna uttag** och beskattas inte i sig, eftersom firman och du är samma skattesubjekt: det som beskattas är firmans överskott, oavsett hur mycket du faktiskt tagit ut under året.' },
      { t: 'p', x: 'Sätter du in privata pengar i firman, till exempel för att täcka en utgift eller skjuta till kapital, bokförs det som en **egen insättning** mot konto **2018 Övriga egna insättningar**.' },
      { t: 'callout', kind: 'info', title: 'Inget lönebesked, ingen preliminärskatt på uttaget', x: 'Ett eget uttag ger dig ingen lönespecifikation och drar ingen skatt vid uttaget. Skatten på firmans resultat betalas i stället som preliminärskatt och stäms av i deklarationen.' },

      { t: 'h2', x: 'Egenavgifter i stället för arbetsgivaravgifter' },
      { t: 'p', x: 'Ett aktiebolag betalar arbetsgivaravgifter på anställdas löner. I en enskild firma betalar du i stället **egenavgifter** på ditt eget överskott, en avgift som ungefär motsvarar arbetsgivaravgifter men beräknas på annat sätt och har egna regler för till exempel unga och äldre företagare. Har du F-skatt sköts den preliminära inbetalningen löpande, och den slutliga avstämningen sker i deklarationen.' },
      { t: 'p', x: 'Exakt procentsats ändras år till år och beror på din ålder, så räkna fram din egen i [Egenavgifter](/verktyg/egenavgifter) i stället för att utgå från ett gammalt tal.' },

      { t: 'h2', x: 'NE-bilagan: bokföringen blir en deklarationsblankett' },
      { t: 'p', x: 'NE-bilagan är den blankett där resultatet av din näringsverksamhet redovisas i din privata inkomstdeklaration. Den byggs på ditt förenklade årsbokslut, alltså samma siffror som redan finns i bokföringen, omflyttade till NE-bilagans egna rader.' },
      { t: 'p', x: 'I Bokix förbereds NE-bilagan som en ifylld **pdf** utifrån din bokföring, som du kontrollerar och för in i Skatteverkets e-tjänst eller på blanketten. Till skillnad från ett aktiebolags INK2R finns i dagsläget ingen SRU-fil för NE, så uppgifterna skrivs eller klistras in för hand i deklarationen.' },
      { t: 'callout', kind: 'tips', title: 'Bokslutet kommer innan bilagan', x: 'NE-bilagan är bara så bra som bokslutet den bygger på. Har du en omsättning på högst 3 miljoner kr räcker ett förenklat årsbokslut (K1) — se [Bokslut för småföretag](/blogg/bokslut-checklista) för hela checklistan innan du fyller i NE.' },

      { t: 'h2', x: 'Vanliga frågor i vardagen' },
      { t: 'h3', x: 'Måste jag ha ett eget bankkonto för firman?' },
      { t: 'p', x: 'Det finns inget lagkrav på ett separat konto för en enskild firma, men det gör bokföringen betydligt enklare: varje transaktion på kontot hör då till firman, i stället för att behöva sorteras ut ur ditt privata konto.' },
      { t: 'h3', x: 'Hur bokför jag ett eget uttag?' },
      { t: 'p', x: 'Som en överföring från företagskontot mot konto 2013, utan moms och utan att det påverkar resultaträkningen. Det är en flytt av redan beskattat (eller ännu inte beskattat, det avgörs i deklarationen) kapital, inte en kostnad.' },
      { t: 'h3', x: 'När betalar jag egenavgifter?' },
      { t: 'p', x: 'Preliminärt löpande under året via F-skatten, baserat på en uppskattning du lämnat till Skatteverket, och sedan slutligt avstämt mot det faktiska resultatet i din inkomstdeklaration.' },
    ],
    faq: [
      { q: 'Måste jag ha ett eget bankkonto för firman?', a: 'Det är inget lagkrav, men starkt rekommenderat. Ett separat konto gör det mycket enklare att hålla isär firmans transaktioner från din privata ekonomi.' },
      { q: 'Hur bokför jag eget uttag?', a: 'Som en överföring mot konto 2013 Övriga egna uttag. Det egna uttaget är inte en kostnad och beskattas inte i sig — det är firmans totala resultat som beskattas.' },
      { q: 'När betalar jag egenavgifter?', a: 'Preliminärt löpande via F-skatten under året, och slutligt avstämt mot det faktiska resultatet i din inkomstdeklaration. Aktuell procentsats finns i verktyget Egenavgifter.' },
      { q: 'Vad är NE-bilagan?', a: 'Blanketten där resultatet av din enskilda näringsverksamhet redovisas i din inkomstdeklaration. Den bygger på ditt förenklade årsbokslut, alltså din bokföring omflyttad till NE-bilagans rader.' },
      { q: 'Kan Bokix skicka in NE-bilagan åt mig?', a: 'Nej. Bokix förbereder NE-bilagan som en ifylld pdf utifrån din bokföring, men du för själv in uppgifterna i Skatteverkets e-tjänst eller på blanketten — det finns i dagsläget ingen SRU-fil för NE.' },
    ],
  },
];
