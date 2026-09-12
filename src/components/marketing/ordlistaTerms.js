// ── Bokföringsordlistan (/ordlista) ─────────────────────────────────────
// Ren data, skild från sidkomponenten av samma skäl som pricingTiers.js
// och toolsConfig.js: listan kommer växa, och den ska gå att utöka utan
// att röra layoutkoden.
//
// Skrivregler för varje post (viktigare än de låter — det är de som gör
// ordlistan till något värt att länka till, i stället för ännu en tunn
// SEO-sida):
//   1. Första meningen ska räcka. Den som bara läser en rad ska ha svaret.
//   2. Förklara på svenska, inte på revisorska. "Verifikation" får inte
//      förklaras med "bokföringsorder", för det är samma okända ord igen.
//   3. Ingen säljtext. `bokix` används bara där produkten faktiskt gör
//      något konkret med begreppet, och då som en kort sista mening.
//   4. `tool` pekar på ett av de fria verktygen (toolsConfig.js) när ett
//      sådant faktiskt räknar på begreppet — det är den interna länkningen
//      som gör att ordlistan lyfter verktygssidorna, inte tvärtom.
export const TERMS = [
  {
    term: '3:12-reglerna',
    def: 'Reglerna som styr hur utdelning och kapitalvinst beskattas för dig som äger och arbetar i ett fåmansföretag. De avgör hur mycket du kan ta ut till 20 procents skatt i stället för som lön. Från och med 2026 gäller en enda regel: ett grundbelopp på fyra inkomstbasbelopp plus ett lönebaserat utrymme.',
    tool: '/verktyg/utdelning',
  },
  {
    term: 'Aktiebolag (AB)',
    def: 'En egen juridisk person, skild från dig som ägare. Bolaget äger sina tillgångar, ansvarar för sina skulder och betalar bolagsskatt på vinsten. Kräver aktiekapital, årsredovisning till Bolagsverket och att du tar ut lön eller utdelning för att få ut pengar ur bolaget.',
  },
  {
    term: 'Anläggningstillgång',
    def: 'Något företaget köpt för att använda under flera år, till exempel en maskin, en bil eller en dator av större värde. Kostnaden tas inte direkt utan fördelas över tillgångens livslängd genom avskrivning.',
  },
  {
    term: 'Arbetsgivaravgift',
    def: 'Den avgift du som arbetsgivare betalar ovanpå den anställdas bruttolön. Standardsatsen är 31,42 procent och betalas in tillsammans med den anställdas preliminärskatt varje månad. Den dras inte från lönen — den är en kostnad utöver.',
    tool: '/verktyg/lonekalkylator',
  },
  {
    term: 'AGI (arbetsgivardeklaration på individnivå)',
    def: 'Den månatliga rapporten till Skatteverket där du redovisar utbetald lön, avdragen skatt och arbetsgivaravgifter per anställd. Ersatte de gamla årliga kontrolluppgifterna för löner och lämnas senast den 12:e månaden efter utbetalningen.',
  },
  {
    term: 'Avdragsgill',
    def: 'En kostnad som får dras av i verksamheten och därmed sänker det skattemässiga resultatet. Kostnaden måste vara till nytta för verksamheten — privata utgifter är aldrig avdragsgilla, även om de betalas från företagskontot.',
  },
  {
    term: 'Avskrivning',
    def: 'Att fördela kostnaden för en anläggningstillgång över de år den används, i stället för att ta hela beloppet direkt. En dator för 30 000 kr med tre års livslängd skrivs av med 10 000 kr per år.',
  },
  {
    term: 'Avstämning',
    def: 'Att kontrollera att bokföringen stämmer mot verkligheten: att banksaldot i bokföringen är samma som på kontoutdraget, att kundfordringarna motsvarar obetalda fakturor, och så vidare. Görs normalt varje månad och är det som gör att bokslutet inte blir en obehaglig överraskning.',
  },
  {
    term: 'Balansräkning',
    def: 'En ögonblicksbild av vad företaget äger och är skyldigt en viss dag. Tillgångar på ena sidan, skulder och eget kapital på den andra — och de två sidorna är alltid lika stora.',
  },
  {
    term: 'BAS-kontoplan',
    def: 'Den standardiserade kontoplan nästan alla svenska företag bokför enligt. Kontonumret säger vad posten är: 1000-serien är tillgångar, 2000-serien skulder och eget kapital, 3000-serien intäkter, 4000–7000 kostnader.',
  },
  {
    term: 'Bokföringsskyldighet',
    def: 'Skyldigheten enligt bokföringslagen att löpande bokföra alla affärshändelser och spara underlagen. Den gäller alla företag, oavsett storlek och bolagsform — även en enskild firma utan omsättning.',
  },
  {
    term: 'Bokslut',
    def: 'Sammanställningen av räkenskapsåret: periodiseringar, avskrivningar och avstämningar görs klart, resultatet fastställs och räkenskapsåret låses. Ett aktiebolag lämnar dessutom en årsredovisning till Bolagsverket.',
  },
  {
    term: 'Bruttolön',
    def: 'Lönen före skatt, alltså det belopp som står i anställningsavtalet. Från bruttolönen dras preliminärskatt, och ovanpå den betalar arbetsgivaren arbetsgivaravgift.',
    tool: '/verktyg/lonekalkylator',
  },
  {
    term: 'Debet och kredit',
    def: 'De två sidorna varje bokföringspost har. Debet ökar tillgångar och kostnader, kredit ökar skulder, eget kapital och intäkter. Summan av debet och kredit måste alltid vara lika stor i en verifikation — det är själva kontrollmekanismen i dubbel bokföring.',
  },
  {
    term: 'Dröjsmålsränta',
    def: 'Ränta du har rätt att kräva när en kund betalar för sent. Enligt räntelagen är den Riksbankens referensränta plus åtta procentenheter, räknat per dag från förfallodagen. Rätten gäller även om inget står på fakturan.',
    tool: '/verktyg/drojsmalsranta',
  },
  {
    term: 'Egenavgifter',
    def: 'Motsvarigheten till arbetsgivaravgifter för dig som driver enskild firma eller är delägare i handelsbolag. Betalas på verksamhetens överskott efter ett schablonavdrag, inte på det du tar ut.',
    tool: '/verktyg/egenavgifter',
  },
  {
    term: 'Eget kapital',
    def: 'Skillnaden mellan vad företaget äger och vad det är skyldigt — alltså ägarnas andel av företaget. I en enskild firma ökar det med insättningar och vinst, och minskar med uttag och förlust.',
  },
  {
    term: 'Eget uttag',
    def: 'När du som driver enskild firma tar ut pengar eller varor ur verksamheten för privat bruk. Det är ingen kostnad och ingen lön, utan en minskning av det egna kapitalet — och det påverkar därför inte resultatet.',
  },
  {
    term: 'Ekonomisk förening',
    def: 'En företagsform där medlemmarna deltar i verksamheten och delar på nyttan, till exempel en kooperativ butik eller en bostadsrättsförening. Egen juridisk person med krav på stadgar, styrelse och årsredovisning.',
  },
  {
    term: 'Enskild firma',
    def: 'Den enklaste företagsformen: du och företaget är samma juridiska person. Du ansvarar personligen för skulderna, betalar egenavgifter och skatt på överskottet, och behöver inget aktiekapital för att starta.',
  },
  {
    term: 'Faktureringsmetoden',
    def: 'Att bokföra en faktura när den skickas eller tas emot, och sedan betalningen som en separat händelse. Ger en mer rättvisande bild löpande än kontantmetoden, och är obligatorisk för större företag.',
  },
  {
    term: 'F-skatt',
    def: 'Ett godkännande från Skatteverket som visar att du själv betalar skatt och sociala avgifter på dina inkomster. Utan F-skatt måste den som anlitar dig göra skatteavdrag och betala arbetsgivaravgifter, vilket i praktiken gör det svårt att fakturera företag.',
  },
  {
    term: 'Fåmansföretag',
    def: 'Förenklat ett aktiebolag där fyra eller färre delägare tillsammans äger mer än hälften av rösterna. Är du dessutom verksam i betydande omfattning i bolaget är dina aktier kvalificerade, och då gäller 3:12-reglerna för din utdelning.',
    tool: '/verktyg/utdelning',
  },
  {
    term: 'Förmånsbeskattning',
    def: 'När en anställd får något annat än pengar av arbetsgivaren — tjänstebil, fri kost, friskvård utöver skattefri nivå — och värdet beskattas som lön. Förmånen läggs till underlaget för både skatteavdrag och arbetsgivaravgifter.',
  },
  {
    term: 'Grundbok och huvudbok',
    def: 'Två vyer av samma bokföring. Grundboken visar affärshändelserna i den ordning de inträffade, huvudboken visar dem sorterade per konto. Bokföringslagen kräver båda — i ett bokföringsprogram skapas de automatiskt ur samma verifikationer.',
  },
  {
    term: 'Gränsbelopp',
    def: 'Den utdelning du som delägare i ett fåmansföretag får ta ut till 20 procents skatt under ett år. Det består av ett grundbelopp på fyra inkomstbasbelopp (322 400 kr för 2026), fördelat efter ägarandel, plus hälften av din andel av föregående års löner efter ett avdrag på åtta inkomstbasbelopp. Det du inte använder sparas till kommande år.',
    tool: '/verktyg/utdelning',
  },
  {
    term: 'Handelsbolag',
    def: 'Ett företag som ägs av två eller flera personer som ansvarar solidariskt för bolagets skulder. Bolaget är en juridisk person, men beskattningen sker hos delägarna på deras andel av resultatet.',
  },
  {
    term: 'Ingående moms',
    def: 'Momsen på det du köper in. Den är normalt avdragsgill: du får tillbaka den från Skatteverket genom att dra av den i momsdeklarationen, förutsatt att inköpet hör till verksamheten.',
    tool: '/verktyg/momskalkylator',
  },
  {
    term: 'Kassaregister',
    def: 'Ett certifierat kassaregister krävs om du säljer mot kontant betalning eller kort till privatpersoner över en viss årlig omsättning. Registret måste vara anmält till Skatteverket och kunden ska alltid erbjudas ett kvitto.',
  },
  {
    term: 'Kontantmetoden',
    def: 'Att bokföra fakturor först när de betalas, med en samlad genomgång av obetalda fakturor vid bokslutet. Får användas av mindre företag och är enklare, men visar inte hur mycket du har utestående under året.',
  },
  {
    term: 'Kontering',
    def: 'Att bestämma vilka konton en affärshändelse ska bokföras på, och med vilka belopp i debet respektive kredit. Det är det moment ett bokföringsprogram automatiserar — och det som måste bli rätt för att allt annat ska bli rätt.',
  },
  {
    term: 'Kontrolluppgift (KU)',
    def: 'En årlig uppgift till Skatteverket om utbetalningar som inte redovisas via AGI, till exempel utdelning eller ränta. Lämnas i januari året efter.',
  },
  {
    term: 'Kundfordran',
    def: 'Pengar du har rätt att få in men ännu inte fått — alltså skickade fakturor som inte är betalda. Bokförs som en tillgång tills betalningen kommer.',
  },
  {
    term: 'K10 (blankett)',
    def: 'Bilagan till din privata inkomstdeklaration där du redovisar utdelning och försäljning av aktier i ditt fåmansföretag, och räknar fram årets gränsbelopp. Lämna den varje år även om du inte tagit någon utdelning — annars tappar du det sparade utdelningsutrymmet.',
    tool: '/verktyg/utdelning',
  },
  {
    term: 'K2 och K3',
    def: 'Två regelverk för hur årsredovisningen upprättas. K2 är förenklat med fasta schabloner och passar de flesta mindre aktiebolag. K3 är mer detaljerat, tillåter fler bedömningar och krävs för större företag.',
  },
  {
    term: 'Leverantörsskuld',
    def: 'Fakturor du fått men ännu inte betalat. Bokförs som en kortfristig skuld från det att fakturan tas emot till det att den betalas.',
  },
  {
    term: 'Likviditet',
    def: 'Företagets förmåga att betala det som förfaller närmaste tiden. Ett lönsamt företag kan ha usel likviditet om kunderna betalar sent — resultat och kassa är två olika saker.',
  },
  {
    term: 'Milersättning',
    def: 'Skattefri ersättning för resor i tjänsten med egen bil, upp till Skatteverkets schablonbelopp per mil. Överstigande belopp behandlas som lön. Kräver en körjournal med datum, sträcka och syfte.',
  },
  {
    term: 'Moms (mervärdesskatt)',
    def: 'En skatt på konsumtion som företaget tar ut av kunden och betalar vidare till Skatteverket. De svenska satserna är 25, 12 och 6 procent. Momsen är aldrig företagets pengar — den passerar bara igenom.',
    tool: '/verktyg/momskalkylator',
  },
  {
    term: 'Momsdeklaration',
    def: 'Redovisningen till Skatteverket av utgående moms på din försäljning minus ingående moms på dina inköp. Lämnas varje månad, kvartal eller år beroende på omsättning, och betalningen ska vara framme samma dag som deklarationen.',
  },
  {
    term: 'Nettolön',
    def: 'Det som betalas ut till den anställdas konto: bruttolönen minus preliminärskatt och eventuella nettoavdrag.',
    tool: '/verktyg/lonekalkylator',
  },
  {
    term: 'Omvänd byggmoms',
    def: 'En regel inom byggsektorn där köparen, inte säljaren, redovisar momsen. Gäller mellan byggföretag och innebär att du fakturerar utan moms med en hänvisning till regeln på fakturan.',
  },
  {
    term: 'Periodisering',
    def: 'Att bokföra en intäkt eller kostnad i den period den hör hemma, inte när betalningen sker. En årsförsäkring betald i december men som gäller nästa år periodiseras till nästa år — annars blir båda årens resultat missvisande.',
  },
  {
    term: 'Periodiseringsfond',
    def: 'Möjligheten att skjuta upp beskattningen av en del av vinsten till senare år. Ett sätt att jämna ut skatten mellan bra och dåliga år. Avsättningen ska återföras senast efter sex år.',
  },
  {
    term: 'Preliminärskatt',
    def: 'Skatt som betalas löpande under året i stället för i efterhand. Företag betalar debiterad preliminärskatt varje månad utifrån en uppskattad vinst — blir uppskattningen fel justeras det i slutskatten året efter.',
  },
  {
    term: 'Representation',
    def: 'Kostnader för måltider och aktiviteter med kunder eller anställda. Avdragsrätten är starkt begränsad: momsen får dras av på ett begränsat underlag per person, medan själva måltidskostnaden normalt inte är avdragsgill alls.',
  },
  {
    term: 'Resultaträkning',
    def: 'Sammanställningen av intäkter minus kostnader under en period. Visar om verksamheten gick med vinst eller förlust — till skillnad från balansräkningen, som visar läget en viss dag.',
  },
  {
    term: 'ROT- och RUT-avdrag',
    def: 'Skattereduktion för privatpersoner på arbetskostnaden vid renovering (ROT) respektive hushållsnära tjänster (RUT). Du drar av det direkt på fakturan och begär resten från Skatteverket. Material ger aldrig avdrag.',
    tool: '/verktyg/rot-rut',
  },
  {
    term: 'Räkenskapsår',
    def: 'Den tolvmånadersperiod bokföringen och bokslutet avser. Kalenderår är vanligast, men aktiebolag kan välja brutet räkenskapsår. Det första året får vara kortare eller längre, dock högst arton månader.',
  },
  {
    term: 'Semesteravsättning',
    def: 'Den semesterlön en anställd tjänar in varje månad men får ut senare. Enligt procentregeln avsätts minst tolv procent av bruttolönen, och avsättningen bär arbetsgivaravgifter precis som lön.',
    tool: '/verktyg/lonekalkylator',
  },
  {
    term: 'SIE-fil',
    def: 'Det svenska standardformatet för att flytta bokföring mellan program. En SIE4-fil innehåller kontoplan, verifikationer och saldon, och gör att du kan byta bokföringsprogram eller lämna över till en revisor utan att något skrivs in på nytt.',
  },
  {
    term: 'Skattekonto',
    def: 'Ditt företags konto hos Skatteverket där moms, arbetsgivaravgifter, avdragen skatt och preliminärskatt bokas in och betalas. Ett underskott på kontot ger kostnadsränta, och betalningen ska vara bokförd hos Skatteverket på förfallodagen — inte skickad då.',
  },
  {
    term: 'Traktamente',
    def: 'Skattefri ersättning för ökade levnadskostnader vid tjänsteresa med övernattning utanför den vanliga verksamhetsorten. Skatteverket fastställer schablonbelopp per hel och halv dag, och belopp därutöver beskattas som lön.',
  },
  {
    term: 'Utdelning',
    def: 'Pengar som ett aktiebolag delar ut till sina ägare av vinsten. Beslutas på bolagsstämman och får bara tas ur fritt eget kapital enligt senast fastställda balansräkning. Inom gränsbeloppet beskattas den med 20 procent, därutöver som tjänsteinkomst — och till skillnad från lön ger den varken pension eller sjukpenning.',
    tool: '/verktyg/utdelning',
  },
  {
    term: 'Utgående moms',
    def: 'Momsen du lägger på din försäljning och som du är skyldig att betala vidare till Skatteverket. Bokförs som en skuld, aldrig som en intäkt.',
    tool: '/verktyg/momskalkylator',
  },
  {
    term: 'Verifikation',
    def: 'Underlaget för en bokförd affärshändelse: kvittot, fakturan eller kontoutdraget, tillsammans med uppgift om datum, belopp och motpart. Varje post i bokföringen måste ha en verifikation, och den ska sparas till och med det sjunde året efter utgången av det kalenderår då räkenskapsåret avslutades.',
  },
  {
    term: 'Årsredovisning',
    def: 'Den offentliga sammanställningen av räkenskapsåret som aktiebolag och större företag lämnar till Bolagsverket. Innehåller förvaltningsberättelse, resultaträkning, balansräkning och noter, och ska vara inne inom sju månader efter räkenskapsårets slut.',
  },
];
