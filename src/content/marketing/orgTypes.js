// ── Bokföringsprogram per bolagsform ───────────────────────────────────
// En landningssida per bolagsform (/bokforingsprogram-enskild-firma osv.),
// renderad av OrgTypePage.jsx. Varje sida svarar på en egen sökning
// ("bokföringsprogram för aktiebolag") och visar Google att sajten handlar
// om bokföringsprogram. Samma idé som Lumion och Bokio.
//
// Bara sådant Bokix faktiskt gör (se bokixFacts.js och Taxes.jsx):
//  - NE-bilagan finns bara för enskild firma, med förslag ur bokföringen.
//  - INK2 (med SRU-fil) för aktiebolag och ekonomisk förening.
//  - Handels- och kommanditbolag: ingen INK2. Bilagorna till INK4 (INK4R,
//    INK4S och INK4DU per delägare) som SRU-fil; delägarna deklarerar sin
//    andel själva (N3A). Själva INK4 fylls i Skatteverkets e-tjänst.
//  - Årsredovisning enligt K2 för aktiebolag och ekonomisk förening, som PDF
//    att skriva under (föreningen med medlemsinsatser och föreningsstämma).
//    Bokix lämnar inte in något till Bolagsverket eller Skatteverket.
//  - Ideell förening och stiftelse: bokföring, moms, lön och årsbokslut.
//    Deklarationen (INK3) fyller Bokix inte i, och det står på sidan.

const PRICE = '129 kr/mån utan anställda och 179 kr/mån med anställda. Ingen moms tillkommer och allt ingår.';

export const ORG_TYPE_PAGES = [
  {
    slug: 'enskild-firma',
    video: { title: 'Så fungerar Bokix för enskild firma', description: 'Ett kvitto läses av och bokförs, och NE-bilagan fylls i med förslag ur bokföringen.', date: '2026-10-17' },
    path: '/bokforingsprogram-enskild-firma',
    short: 'Enskild firma',
    seoTitle: 'Bokföringsprogram för enskild firma, från 129 kr/mån | Bokix',
    seoDescription: 'Bokix är ett enkelt bokföringsprogram för enskild firma. Kvitton, fakturor, moms och NE-bilaga i ett verktyg. 30 dagar gratis, sedan 129 kr/mån.',
    eyebrow: 'Bokföringsprogram för enskild firma',
    title: 'Bokföringsprogram för enskild firma',
    lead: 'Fota kvittot och skicka fakturan. När året är slut får du förslag till NE-bilagan.',
    highlights: ['Kvitton läses av från ett foto', 'Fakturor med egen logga', 'Momsdeklaration som fil', 'Förslag till NE-bilagan'],
    included: [
      'Löpande bokföring i ett enkelt läge, där du väljer vad som hänt i stället för konton.',
      'Kvitton läses av från ett foto: datum, belopp och moms, även flera momssatser på samma kvitto.',
      'Fakturor och offerter med din logga, ROT- och RUT-avdrag och kortbetalning via Stripe.',
      'Momsdeklarationen räknas fram per månad, kvartal eller år, som fil att lämna in hos Skatteverket.',
      'NE-bilagan med förslag på beloppen ur bokföringen, som du stämmer av och lämnar in själv.',
      'Egna uttag och insättningar bokförs rätt mot eget kapital, utan att du behöver veta kontonumren.',
    ],
    steps: [
      { title: 'Skapa kontot med organisationsnumret', body: 'Bokix hämtar företagets uppgifter och väljer räkenskapsår och momsperiod åt dig. Det tar några minuter.' },
      { title: 'Lägg in kvitton och fakturor löpande', body: 'Fota kvittot eller skicka fakturan från Bokix. Det som är osäkert hamnar i Granskning i stället för att gissas.' },
      { title: 'Deklarera moms och gör bokslutet', body: 'Momsen och NE-bilagan räknas fram ur bokföringen. Du laddar ned filerna och lämnar in hos Skatteverket med BankID.' },
    ],
    facts: [
      { title: "Du och firman är samma person", body: "En enskild firma är ingen egen juridisk person. Överskottet beskattas hos dig som inkomst av näringsverksamhet, och det redovisas på NE-bilagan i din egen deklaration." },
      { title: "Egenavgifter i stället för arbetsgivaravgift", body: "Du betalar egenavgifter på överskottet, inte arbetsgivaravgift på en lön. Räkna på vad som blir kvar i egenavgiftskalkylatorn." },
      { title: "Förenklat årsbokslut räcker oftast", body: "Är omsättningen normalt högst 3 miljoner kr räcker ett förenklat årsbokslut. Det sparas med bokföringen och är underlaget för NE-bilagan." },
    ],
    faq: [
      { q: 'Behöver jag ett bokföringsprogram för enskild firma?', a: 'Alla enskilda firmor är bokföringsskyldiga. Ett bokföringsprogram är inget krav, men det gör jobbet mycket enklare: momsen och NE-bilagan räknas fram ur det du redan bokfört, och kvitton och fakturor sparas på samma ställe.' },
      { q: 'Fyller Bokix i NE-bilagan?', a: 'Bokix ger förslag på beloppen i NE-bilagan utifrån bokföringen. Du stämmer av dem och lämnar in själv hos Skatteverket. Bokix skickar aldrig in något åt dig.' },
      { q: 'Vad kostar Bokix för en enskild firma?', a: PRICE + ' De första 30 dagarna är gratis och det finns ingen bindningstid på månadsplanen.' },
      { q: 'Kan jag räkna ut mina egenavgifter?', a: 'Ja, med den fria egenavgiftskalkylatorn på bokix.se/verktyg/egenavgifter kan du se vad som blir kvar efter egenavgifter och skatt.' },
    ],
    related: [
      { label: 'Enskild firma: bokföring, egenavgifter och NE-bilaga', to: '/blogg/enskild-firma-bokforing-ne' },
      { label: 'Egenavgiftskalkylator', to: '/verktyg/egenavgifter' },
    ],
  },
  {
    slug: 'aktiebolag',
    video: { title: 'Så fungerar Bokix för aktiebolag', description: 'Resultaträkningen blir INK2 och en årsredovisning enligt K2 som styrelsen skriver under.', date: '2026-10-17' },
    path: '/bokforingsprogram-aktiebolag',
    short: 'Aktiebolag',
    seoTitle: 'Bokföringsprogram för aktiebolag, från 129 kr/mån | Bokix',
    seoDescription: 'Bokix är ett enkelt bokföringsprogram för aktiebolag. Fakturor, moms, lön, INK2 och årsredovisning enligt K2 i ett verktyg. 30 dagar gratis.',
    eyebrow: 'Bokföringsprogram för aktiebolag',
    title: 'Bokföringsprogram för aktiebolag',
    lead: 'Fakturor, lön och moms under året. INK2 och årsredovisning när året är slut.',
    highlights: ['Lön med AGI-fil', 'INK2 med SRU-fil', 'Årsredovisning enligt K2', 'Utdelning bokförd rätt'],
    included: [
      'Löpande bokföring med BAS-kontoplanen, med ett enkelt läge för dig som inte kan debet och kredit.',
      'Kund- och leverantörsfakturor, offerter och kortbetalning på fakturan via Stripe.',
      'Lön med skattetabeller, arbetsgivaravgift efter ålder, lönebesked, AGI-fil och betalfil till banken.',
      'Momsdeklarationen per månad, kvartal eller år, som fil att lämna in hos Skatteverket.',
      'Bokslut och INK2 med SRU-fil till inkomstdeklarationen.',
      'Årsredovisning enligt K2 som PDF att skriva under, och utdelning som bokförs mot rätt konton.',
    ],
    steps: [
      { title: 'Skapa kontot med organisationsnumret', body: 'Bokix hämtar bolagets uppgifter från Bolagsverket och väljer räkenskapsår och momsperiod åt dig.' },
      { title: 'Bokför löpande under året', body: 'Kvitton läses av, fakturor bokförs när de skickas och betalas, och lönen bokförs när du kört den.' },
      { title: 'Gör bokslut och årsredovisning', body: 'Bokix räknar fram INK2 och årsredovisningen. Du granskar, skriver under och lämnar in själv.' },
    ],
    facts: [
      { title: "Bolaget är en egen juridisk person", body: "Aktiebolaget betalar bolagsskatt och lämnar en egen inkomstdeklaration, INK2. Du tar ut pengar som lön eller utdelning." },
      { title: "Årsredovisning inom sju månader", body: "Årsredovisningen ska vara hos Bolagsverket senast sju månader efter räkenskapsårets slut. Bolagsstämman hålls senast sex månader efter." },
      { title: "Utdelning beslutas på stämman", body: "Utdelningen beslutas på bolagsstämman och bokförs som en skuld tills den betalas ut. Hur mycket som beskattas som kapital avgörs av gränsbeloppet enligt 3:12." },
    ],
    faq: [
      { q: 'Vilket bokföringsprogram passar ett litet aktiebolag?', a: 'Ett som klarar hela året: fakturor, moms, lön och bokslut med INK2 och årsredovisning. Bokix har allt det i samma pris, utan tillägg per funktion.' },
      { q: 'Gör Bokix årsredovisningen?', a: 'Ja, för aktiebolag enligt K2. Du får en PDF att skriva under. Bokix lämnar inte in den till Bolagsverket, det gör du själv.' },
      { q: 'Vad kostar Bokix för ett aktiebolag?', a: PRICE + ' Med årsplan 109 respektive 149 kr/mån. De första 30 dagarna är gratis.' },
      { q: 'Kan jag räkna på lön eller utdelning?', a: 'Ja. Utdelningskalkylatorn räknar gränsbeloppet enligt 3:12-reglerna, och i Bokix bokförs beslutad utdelning mot rätt konton.' },
    ],
    related: [
      { label: 'Lön eller utdelning i aktiebolag: så väljer du', to: '/blogg/lon-eller-utdelning-ab' },
      { label: 'Utdelningskalkylator 2026', to: '/verktyg/utdelning' },
    ],
  },
  {
    slug: 'handelsbolag',
    video: { title: 'Så fungerar Bokix för handelsbolag', description: 'Årets resultat delas på delägarna, och var och en får sin bilaga INK4DU.', date: '2026-10-17' },
    path: '/bokforingsprogram-handelsbolag',
    short: 'Handelsbolag och KB',
    seoTitle: 'Bokföringsprogram för handelsbolag och KB | Bokix',
    seoDescription: 'Bokix är ett enkelt bokföringsprogram för handelsbolag och kommanditbolag. Fakturor, moms, lön och INK4 med delägaruppgifter i ett verktyg. 30 dagar gratis.',
    eyebrow: 'Bokföringsprogram för handelsbolag',
    title: 'Bokföringsprogram för handelsbolag',
    lead: 'Bokföringen för hela bolaget, och underlaget till varje delägares deklaration.',
    highlights: ['Tre användare ingår', 'INK4 som SRU-fil', 'Bokslut per delägare', 'Lön med AGI-fil'],
    included: [
      'Löpande bokföring med BAS-kontoplanen, med ett enkelt läge utan debet och kredit.',
      'Kvitton läses av från ett foto, och fakturor och offerter skickas från Bokix.',
      'Momsdeklarationen per månad, kvartal eller år, som fil att lämna in hos Skatteverket.',
      'Lön med skattetabeller, lönebesked, AGI-fil och betalfil till banken.',
      'Bokslut där årets resultat förs över till delägarnas kapitalkonton.',
      'Bilagorna till inkomstdeklaration 4 som SRU-fil: räkenskapsschema (INK4R), skattemässiga justeringar (INK4S) och delägaruppgifter (INK4DU) för varje delägare.',
      'Upp till tre personer i samma bokföring, till exempel båda delägarna och er revisor.',
    ],
    steps: [
      { title: 'Skapa kontot med organisationsnumret', body: 'Bokix känner igen att det är ett handels- eller kommanditbolag och anpassar skatt och bokslut efter det.' },
      { title: 'Bjud in delägaren', body: 'Ni kan arbeta i samma bokföring samtidigt. Tre användare ingår i priset.' },
      { title: 'Gör bokslut och INK4', body: 'Resultatet fördelas på delägarna. Bokix tar fram bilagorna till INK4 som fil, och varje delägare deklarerar sin andel i sin egen deklaration.' },
    ],
    facts: [
      { title: "Bolaget betalar ingen inkomstskatt", body: "Ett handelsbolag beskattas inte självt. Årets resultat delas på delägarna, som var och en beskattas för sin andel i sin egen deklaration." },
      { title: "Varje delägare har ett eget kapitalkonto", body: "Insättningar, uttag och andel av resultatet bokförs per delägare. Vid bokslutet förs årets resultat över till delägarnas kapitalkonton." },
      { title: "Kommanditbolag har två sorters delägare", body: "I ett kommanditbolag finns minst en komplementär med obegränsat ansvar och minst en kommanditdelägare med begränsat ansvar." },
    ],
    faq: [
      { q: 'Lämnar ett handelsbolag INK2?', a: 'Nej. Ett handels- eller kommanditbolag betalar ingen egen bolagsskatt och lämnar inkomstdeklaration 4 (INK4) i stället. Resultatet fördelas på delägarna, som deklarerar sin andel i sin egen deklaration.' },
      { q: 'Gör Bokix INK4?', a: 'Bokix tar fram bilagorna till INK4 som SRU-fil: räkenskapsschemat (INK4R), de skattemässiga justeringarna (INK4S) och delägaruppgifterna (INK4DU) med varje delägares andel, tillskott och uttag. Själva INK4 fyller du i Skatteverkets e-tjänst, där du också laddar upp filen.' },
      { q: 'Kan båda delägarna använda Bokix?', a: 'Ja. Upp till tre personer kan arbeta i samma bokföring, och det ingår i priset.' },
      { q: 'Vad kostar Bokix för ett handelsbolag?', a: PRICE + ' De första 30 dagarna är gratis.' },
      { q: 'Kan jag ta med bokföringen från ett annat program?', a: 'Ja. Exportera en SIE4-fil ur ditt nuvarande program och läs in den i Bokix, så följer konton, verifikationer och ingående balanser med.' },
    ],
    related: [
      { label: 'Byt bokföringsprogram med en SIE4-fil', to: '/byt-bokforingsprogram' },
      { label: 'Bokslut för småföretag: checklista', to: '/blogg/bokslut-checklista' },
    ],
  },
  {
    slug: 'ekonomisk-forening',
    video: { title: 'Så fungerar Bokix för ekonomisk förening', description: 'Kassör, ordförande och revisor arbetar i samma bokföring, revisorn granskar och INK2 och årsredovisningen blir klara.', date: '2026-10-17' },
    path: '/bokforingsprogram-ekonomisk-forening',
    short: 'Ekonomisk förening',
    seoTitle: 'Bokföringsprogram för ekonomisk förening | Bokix',
    seoDescription: 'Bokix är ett enkelt bokföringsprogram för ekonomiska föreningar. Fakturor, moms, lön, INK2 och årsredovisning enligt K2 i ett verktyg. 30 dagar gratis.',
    eyebrow: 'Bokföringsprogram för ekonomisk förening',
    title: 'Bokföringsprogram för ekonomisk förening',
    lead: 'Kassör, styrelse och revisor i samma bokföring, ända fram till årsredovisningen.',
    highlights: ['Tre användare ingår', 'INK2 med SRU-fil', 'Årsredovisning enligt K2', 'Rapporter till styrelsen'],
    included: [
      'Löpande bokföring med BAS-kontoplanen, med ett enkelt läge utan debet och kredit.',
      'Fakturor och offerter, och kvitton som läses av från ett foto.',
      'Momsdeklarationen per månad, kvartal eller år, som fil att lämna in hos Skatteverket.',
      'Lön med skattetabeller, lönebesked, AGI-fil och betalfil till banken.',
      'Bokslut och INK2 med SRU-fil till inkomstdeklarationen.',
      'Årsredovisning enligt K2 som PDF att skriva under, med medlemsinsatser och förslag till föreningsstämman.',
      'Resultat- och balansräkning och nyckeltal att visa styrelsen och på stämman.',
    ],
    steps: [
      { title: 'Skapa kontot med organisationsnumret', body: 'Bokix hämtar föreningens uppgifter och väljer räkenskapsår och momsperiod åt dig.' },
      { title: 'Bjud in kassören eller revisorn', body: 'Upp till tre personer kan arbeta i samma bokföring.' },
      { title: 'Gör bokslut, INK2 och årsredovisning', body: 'Bokix räknar fram INK2 och årsredovisningen ur bokföringen. Styrelsen skriver under och föreningsstämman fastställer den.' },
    ],
    facts: [
      { title: "Föreningsstämman beslutar", body: "Medlemmarna fastställer resultat- och balansräkningen på föreningsstämman och beslutar om hur överskottet ska användas." },
      { title: "Föreningen ska ha en revisor", body: "En ekonomisk förening ska ha minst en revisor. Revisorn kan bjudas in i Bokix och granska samma bokföring som kassören." },
      { title: "Beskattas som ett aktiebolag", body: "En ekonomisk förening betalar inkomstskatt och lämnar INK2, precis som ett aktiebolag." },
    ],
    faq: [
      { q: 'Passar Bokix en ekonomisk förening?', a: 'Ja. Den löpande bokföringen, moms, lön, bokslut med INK2 och årsredovisning enligt K2 finns i Bokix. Årsredovisningen använder föreningens egna poster, som medlemsinsatser, och föreningsstämman i stället för årsstämma.' },
      { q: 'Måste föreningen skicka årsredovisningen till Bolagsverket?', a: 'Det beror på föreningens storlek, till exempel antal anställda och tillgångarnas värde. Kolla vad som gäller för er på bolagsverket.se. Bokix gör årsredovisningen, men skickar inte in den åt er.' },
      { q: 'Kan flera i styrelsen använda Bokix?', a: 'Ja. Upp till tre personer kan arbeta i samma bokföring, och det ingår i priset.' },
      { q: 'Vad kostar Bokix för en ekonomisk förening?', a: PRICE + ' De första 30 dagarna är gratis.' },
      { q: 'Fungerar Bokix för en ideell förening?', a: 'Ja, för bokföring, moms, lön och årsbokslut. Deklarationen (INK3) fyller Bokix inte i. Läs mer på sidan för ideella föreningar: bokix.se/bokforingsprogram-ideell-forening.' },
    ],
    related: [
      { label: 'Momsdeklaration steg för steg', to: '/blogg/moms-deklaration-steg-for-steg' },
      { label: 'Bokslut för småföretag: checklista', to: '/blogg/bokslut-checklista' },
    ],
  },
];

ORG_TYPE_PAGES.push({
  slug: 'ideell-forening',
  video: { title: 'Så fungerar Bokix för ideell förening', description: 'Föreningens år räknas fram ur bokföringen, revisorn granskar och årsbokslutet är klart till årsmötet.', date: '2026-10-17' },
  path: '/bokforingsprogram-ideell-forening',
  short: 'Ideell förening',
  seoTitle: 'Bokföringsprogram för ideell förening och stiftelse | Bokix',
  seoDescription: 'Bokix är ett enkelt bokföringsprogram för ideella föreningar och stiftelser. Kvitton, fakturor, moms, lön och årsbokslut i ett verktyg. 30 dagar gratis.',
  eyebrow: 'Bokföringsprogram för ideell förening',
  title: 'Bokföringsprogram för ideell förening',
  lead: 'Kassören bokför, styrelsen ser hur det går och revisorn granskar samma bokföring.',
  highlights: ['Tre användare ingår', 'Enkelt läge utan debet och kredit', 'Med eller utan moms', 'Årsbokslut'],
  included: [
    'Löpande bokföring med BAS-kontoplanen, med ett enkelt läge där du väljer vad som hänt i stället för konton.',
    'Kvitton läses av från ett foto, och underlaget sparas med verifikationen i sju år.',
    'Fakturor för medlemsavgifter, sponsring och uthyrning, med kortbetalning via Stripe om ni vill.',
    'Momsdeklaration om föreningen är momsregistrerad. Är den inte det bokförs allt utan moms.',
    'Lön till anställda med skattetabeller, lönebesked, AGI-fil och betalfil till banken.',
    'Årsbokslut med resultat- och balansräkning att visa styrelsen och på årsmötet.',
  ],
  steps: [
    { title: 'Skapa kontot med organisationsnumret', body: 'Bokix känner igen att det är en ideell förening eller stiftelse och väljer räkenskapsår åt dig.' },
    { title: 'Bjud in kassören eller revisorn', body: 'Upp till tre personer kan arbeta i samma bokföring.' },
    { title: 'Gör årsbokslutet', body: 'Resultat- och balansräkningen räknas fram ur bokföringen. Deklarationen lämnar ni själva hos Skatteverket.' },
  ],
  facts: [
    { title: 'Alla föreningar behöver inte bokföra', body: 'En ideell förening är bokföringsskyldig om den bedriver näringsverksamhet eller har tillgångar på mer än 1,5 miljoner kr. Många bokför ändå, för att ha ordning inför årsmötet.' },
    { title: 'Förenklat årsbokslut räcker ofta', body: 'Är nettoomsättningen normalt högst 3 miljoner kr får föreningen göra ett förenklat årsbokslut.' },
    { title: 'Deklarationen heter INK3', body: 'Ideella föreningar och stiftelser lämnar Inkomstdeklaration 3. Bokix fyller inte i den, men bokföringen och bokslutet är underlaget ni behöver.' },
  ],
  faq: [
    { q: 'Passar Bokix en ideell förening?', a: 'Ja, för den löpande bokföringen, fakturor, moms, lön och årsbokslutet. Det Bokix inte gör är inkomstdeklarationen (INK3), som ni lämnar själva.' },
    { q: 'Vår förening är inte momsregistrerad. Fungerar det?', a: 'Ja. Du väljer det när kontot skapas, och då bokförs kvitton och fakturor utan moms.' },
    { q: 'Kan kassören och revisorn använda samma konto?', a: 'Ja. Upp till tre personer kan arbeta i samma bokföring, och det ingår i priset.' },
    { q: 'Fungerar Bokix för en stiftelse?', a: 'Ja, på samma sätt som för en ideell förening: bokföring, moms, lön och årsbokslut. Deklarationen lämnar stiftelsen själv.' },
    { q: 'Vad kostar Bokix för en ideell förening?', a: PRICE + ' De första 30 dagarna är gratis.' },
  ],
  related: [
    { label: 'Bokslut för småföretag: checklista', to: '/blogg/bokslut-checklista' },
    { label: 'Momsdeklaration steg för steg', to: '/blogg/moms-deklaration-steg-for-steg' },
  ],
});

export const ORG_TYPE_BY_PATH = Object.fromEntries(ORG_TYPE_PAGES.map(p => [p.path, p]));
