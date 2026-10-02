// ── Textinnehåll för /priser (PricingPage.jsx) per språk. sv är samma
// text som redan stod hårdkodad i komponenten innan detta lades till
// (ordagrant extraherad, inte omskriven) — en förändring i sv.faq[i].a
// här är alltså en RIKTIG textändring av sidan, inte bara en refaktorering.
// en/no/dk/fi är äkta, varumärkesskrivna texter (inte maskinöversatta),
// skrivna för läsare som ska driva ett SVENSKT bolag men läser på sitt
// eget språk — sakinnehållet (svensk moms, SIE4, bolagsformer via
// organisationsnummer) är därför identiskt över alla fem språk, bara
// orden byts. KRÄVER granskning av en modersmålstalare innan lansering
// för no/dk/fi (se plan-dokumentet, jag är inte det).
export const PRICING_CONTENT = {
  sv: {
    meta: {
      title: 'Priser: från 129 kr/mån | Bokix',
      description: 'Två priser: 129 kr/mån utan anställda och 179 kr/mån med. Ingen moms tillkommer, inga dolda avgifter och inga funktioner att köpa till.',
    },
    hero: {
      title: 'Ett pris för din situation',
      subtitle: 'Samma bokföring och fakturering i båda, skillnaden är om du har personal på lönelistan. Inga tillägg att köpa till, ingen bindningstid på månadsplanen.',
    },
    interval: { monthly: 'Månadsvis', yearly: 'Årsplan', yearlyBadge: 'spara upp till 360 kr/år' },
    freeTrialSuffix: 'gratis i 30 dagar',
    yearlySavingsNote: (kr) => `Dras varje månad · du sparar ${kr} kr per år`,
    cta: 'Kom igång gratis',
    yearlyMinimumNote: (months) => `Gratis i 30 dagar · samma månadsbetalning som vanligt, bara lägre · minst ${months} månader`,
    monthlyNote: 'Gratis i 30 dagar · avsluta när som helst',
    vatNote: 'Priserna är i svenska kronor och ingen moms tillkommer — Bokix är inte momsregistrerat, så beloppet du ser är det som dras.',
    noHiddenFeesNote: 'Inga dolda avgifter och inga tillägg per kvitto eller skickad faktura — priset ovan är hela kostnaden, oavsett hur mycket du bokför.',
    schemaDescription: 'Bokföring, fakturering, lönehantering och momsredovisning för svenska företag i alla bolagsformer.',
    faqHeading: 'Vanliga frågor',
    faq: [
      { q: 'Vilken nivå ska jag välja?', a: 'Har du ingen anställd väljer du Utan personal. Så fort du har eller planerar att ha någon anställd, även deltid, behöver du löne­modulen som ingår i Med personal.' },
      { q: 'Kan jag byta nivå senare?', a: 'Ja. Anställer du någon senare uppgraderar du till Med personal när du behöver det, direkt i kontot.' },
      { q: 'Behöver jag ange kortuppgifter för att prova?', a: 'Ja, du lägger in dina betaluppgifter hos Stripe redan vid registreringen, men du debiteras ingenting under de första 30 dagarna. Avslutar du innan dess kostar det dig aldrig något.' },
      { q: 'Kan jag avsluta när som helst?', a: 'På månadsplanen ja — det finns varken uppsägningstid eller bindningstid, du avslutar när du vill. Årsplanen ger ett lägre månadspris mot att den gäller i minst tre månader, därefter avslutar du den lika fritt.' },
      { q: 'Tillkommer moms på priset?', a: 'Nej. Bokix är inte momsregistrerat, så priset du ser är hela beloppet som dras — ingen moms läggs på. Det betyder samtidigt att det inte finns någon ingående moms att dra av på abonnemanget i din egen bokföring.' },
      { q: 'Tillkommer avgifter per kvitto eller faktura?', a: 'Nej. Priset ovan är hela kostnaden oavsett hur många kvitton du skannar eller fakturor du skickar — inga styckpriser, inga tillägg som dyker upp senare.' },
      { q: 'Är jag inlåst om jag vill byta bort från Bokix?', a: 'Nej. Du exporterar hela din bokföring som en SIE4-fil eller en fullständig JSON-säkerhetskopia när du vill, direkt i Inställningar — inget att fråga oss om lov för. SIE4 är samma öppna format alla svenska bokföringsprogram läser.' },
      { q: 'Vilka bolagsformer stöds?', a: 'Bokix känner igen enskild firma, aktiebolag, handelsbolag/kommanditbolag och ekonomisk förening utifrån organisationsnumret, och bokför enligt rätt regler för respektive form.' },
      { q: 'Ingår support i priset?', a: 'Ja, support ingår i båda nivåerna. Du når oss på support@bokix.se.' },
    ],
  },

  en: {
    meta: {
      title: 'Pricing: from 129 kr/month | Bokix',
      description: 'Two clear prices depending on whether you have staff: 129 kr/month without employees, 179 kr/month with. No VAT added, no hidden fees, no add-ons to buy.',
    },
    hero: {
      title: 'One price for your situation',
      subtitle: 'The same bookkeeping and invoicing in both tiers — the only difference is whether you have staff on payroll. No add-ons to buy, no commitment on the monthly plan.',
    },
    interval: { monthly: 'Monthly', yearly: 'Annual plan', yearlyBadge: 'save up to 360 kr/year' },
    freeTrialSuffix: 'free for 30 days',
    yearlySavingsNote: (kr) => `Charged monthly · you save ${kr} kr a year`,
    cta: 'Get started free',
    yearlyMinimumNote: (months) => `Free for 30 days · same monthly charge, just lower · minimum ${months} months`,
    monthlyNote: 'Free for 30 days · cancel any time',
    vatNote: 'Prices are in Swedish kronor and no VAT is added — Bokix is not VAT-registered, so the amount you see is what gets charged.',
    noHiddenFeesNote: 'No hidden fees and no charge per scanned receipt or sent invoice — the price above is the entire cost, no matter how much you book.',
    schemaDescription: 'Bookkeeping, invoicing, payroll and VAT reporting for Swedish companies of every legal form.',
    faqHeading: 'Frequently asked questions',
    faq: [
      { q: 'Which tier should I choose?', a: 'No employees? Choose No employees. The moment you have — or plan to have — anyone on payroll, even part-time, you need the payroll module included in the With employees tier.' },
      { q: 'Can I switch tiers later?', a: 'Yes. If you take on staff later, you upgrade to With employees whenever you need to, right from your account.' },
      { q: 'Do I need to enter card details to try it?', a: 'Yes — you add your payment details with Stripe at sign-up, but you are not charged anything for the first 30 days. Cancel before then and it never costs you a thing.' },
      { q: 'Can I cancel any time?', a: 'On the monthly plan, yes — no notice period and no lock-in, cancel whenever you like. The annual plan gives a lower monthly price in exchange for a minimum three-month commitment, after which you can cancel just as freely.' },
      { q: 'Is VAT added to the price?', a: 'No. Bokix is not VAT-registered, so the price you see is the full amount charged — no VAT is added on top. That also means there is no input VAT to deduct on the subscription in your own bookkeeping.' },
      { q: 'Are there fees per receipt or invoice?', a: 'No. The price above is the entire cost no matter how many receipts you scan or invoices you send — no per-item pricing, no add-ons that show up later.' },
      { q: 'Am I locked in if I want to leave Bokix?', a: 'No. You export your entire bookkeeping as an SIE4 file or a full JSON backup whenever you like, right from Settings — nothing to ask our permission for. SIE4 is the same open format every Swedish bookkeeping program reads.' },
      { q: 'Which legal company forms are supported?', a: 'Bokix recognises sole trader (enskild firma), limited company (aktiebolag), trading partnership/limited partnership (handelsbolag/kommanditbolag) and economic association (ekonomisk förening) from the Swedish organisation number, and books according to the right rules for each.' },
      { q: 'Is support included in the price?', a: 'Yes, support is included in both tiers. Reach us at support@bokix.se.' },
    ],
  },

  no: {
    meta: {
      title: 'Priser: fra 129 kr/mnd | Bokix',
      description: 'To tydelige priser avhengig av om du har ansatte: 129 kr/mnd uten ansatte, 179 kr/mnd med. Ingen moms tilkommer, ingen skjulte avgifter, ingen tilleggsfunksjoner å kjøpe.',
    },
    hero: {
      title: 'Én pris for din situasjon',
      subtitle: 'Samme bokføring og fakturering i begge nivåer — forskjellen er om du har ansatte på lønningslisten. Ingen tillegg å kjøpe, ingen bindingstid på månedsplanen.',
    },
    interval: { monthly: 'Månedlig', yearly: 'Årsplan', yearlyBadge: 'spar opptil 360 kr/år' },
    freeTrialSuffix: 'gratis i 30 dager',
    yearlySavingsNote: (kr) => `Trekkes hver måned · du sparer ${kr} kr i året`,
    cta: 'Kom i gang gratis',
    yearlyMinimumNote: (months) => `Gratis i 30 dager · samme månedlige trekk som vanlig, bare lavere · minst ${months} måneder`,
    monthlyNote: 'Gratis i 30 dager · avslutt når som helst',
    vatNote: 'Prisene er i svenske kroner og ingen moms tilkommer — Bokix er ikke momsregistrert, så beløpet du ser er det som trekkes.',
    noHiddenFeesNote: 'Ingen skjulte avgifter og ingen tillegg per skannet kvittering eller sendt faktura — prisen over er hele kostnaden, uansett hvor mye du bokfører.',
    schemaDescription: 'Bokføring, fakturering, lønn og momsrapportering for svenske selskaper i alle selskapsformer.',
    faqHeading: 'Vanlige spørsmål',
    faq: [
      { q: 'Hvilket nivå bør jeg velge?', a: 'Har du ingen ansatte, velger du Uten ansatte. Så snart du har — eller planlegger å få — noen ansatt, selv deltid, trenger du lønnsmodulen som inngår i Med ansatte.' },
      { q: 'Kan jeg bytte nivå senere?', a: 'Ja. Ansetter du noen senere, oppgraderer du til Med ansatte når du trenger det, direkte i kontoen.' },
      { q: 'Må jeg oppgi kortopplysninger for å prøve?', a: 'Ja, du legger inn betalingsopplysningene dine hos Stripe allerede ved registrering, men du blir ikke belastet noe de første 30 dagene. Avslutter du før den tid, koster det deg aldri noe.' },
      { q: 'Kan jeg avslutte når som helst?', a: 'På månedsplanen ja — det er verken oppsigelsestid eller bindingstid, du avslutter når du vil. Årsplanen gir en lavere månedspris mot at den gjelder i minst tre måneder, deretter avslutter du den like fritt.' },
      { q: 'Tilkommer det moms på prisen?', a: 'Nei. Bokix er ikke momsregistrert, så prisen du ser er hele beløpet som trekkes — ingen moms legges på. Det betyr samtidig at det ikke finnes noen inngående moms å trekke fra på abonnementet i din egen bokføring.' },
      { q: 'Tilkommer det avgifter per kvittering eller faktura?', a: 'Nei. Prisen over er hele kostnaden uansett hvor mange kvitteringer du skanner eller fakturaer du sender — ingen stykkpriser, ingen tillegg som dukker opp senere.' },
      { q: 'Er jeg låst hvis jeg vil bytte bort fra Bokix?', a: 'Nei. Du eksporterer hele bokføringen din som en SIE4-fil eller en fullstendig JSON-sikkerhetskopi når du vil, direkte i Innstillinger — ingenting å be oss om lov til. SIE4 er det samme åpne formatet alle svenske bokføringsprogram leser.' },
      { q: 'Hvilke selskapsformer støttes?', a: 'Bokix kjenner igjen enkeltpersonforetak (enskild firma), aksjeselskap (aktiebolag), handelsselskap/kommandittselskap og økonomisk forening ut fra det svenske organisasjonsnummeret, og bokfører etter riktige regler for hver form.' },
      { q: 'Inngår support i prisen?', a: 'Ja, support inngår i begge nivåene. Du når oss på support@bokix.se.' },
    ],
  },

  dk: {
    meta: {
      title: 'Priser: fra 129 kr/md. | Bokix',
      description: 'To tydelige priser afhængigt af om du har ansatte: 129 kr/md. uden ansatte, 179 kr/md. med. Ingen moms tillægges, ingen skjulte gebyrer, ingen tilkøb.',
    },
    hero: {
      title: 'Én pris til din situation',
      subtitle: 'Samme bogføring og fakturering i begge niveauer — forskellen er, om du har ansatte på lønningslisten. Ingen tilkøb, ingen binding på månedsplanen.',
    },
    interval: { monthly: 'Månedligt', yearly: 'Årsplan', yearlyBadge: 'spar op til 360 kr/år' },
    freeTrialSuffix: 'gratis i 30 dage',
    yearlySavingsNote: (kr) => `Trækkes hver måned · du sparer ${kr} kr om året`,
    cta: 'Kom i gang gratis',
    yearlyMinimumNote: (months) => `Gratis i 30 dage · samme månedlige træk som normalt, bare lavere · mindst ${months} måneder`,
    monthlyNote: 'Gratis i 30 dage · opsig når som helst',
    vatNote: 'Priserne er i svenske kroner, og der tillægges ikke moms — Bokix er ikke momsregistreret, så beløbet du ser, er det, der trækkes.',
    noHiddenFeesNote: 'Ingen skjulte gebyrer og intet tillæg pr. scannet kvittering eller sendt faktura — prisen ovenfor er hele omkostningen, uanset hvor meget du bogfører.',
    schemaDescription: 'Bogføring, fakturering, lønhåndtering og momsindberetning for svenske virksomheder i alle selskabsformer.',
    faqHeading: 'Ofte stillede spørgsmål',
    faq: [
      { q: 'Hvilket niveau skal jeg vælge?', a: 'Har du ingen ansatte, vælger du Uden ansatte. Så snart du har — eller planlægger at få — nogen ansat, også deltid, skal du bruge lønmodulet, der indgår i Med ansatte.' },
      { q: 'Kan jeg skifte niveau senere?', a: 'Ja. Ansætter du nogen senere, opgraderer du til Med ansatte, når du har brug for det, direkte i kontoen.' },
      { q: 'Skal jeg angive kortoplysninger for at prøve?', a: 'Ja, du indtaster dine betalingsoplysninger hos Stripe allerede ved tilmelding, men du bliver ikke opkrævet noget de første 30 dage. Opsiger du inden da, koster det dig aldrig noget.' },
      { q: 'Kan jeg opsige når som helst?', a: 'På månedsplanen, ja — der er hverken opsigelsesvarsel eller binding, du opsiger når du vil. Årsplanen giver en lavere månedspris mod, at den gælder i mindst tre måneder, hvorefter du opsiger den lige så frit.' },
      { q: 'Tillægges der moms på prisen?', a: 'Nej. Bokix er ikke momsregistreret, så prisen du ser, er hele beløbet, der trækkes — der lægges ingen moms oveni. Det betyder samtidig, at der ikke er nogen indgående moms at trække fra på abonnementet i din egen bogføring.' },
      { q: 'Tillægges der gebyrer pr. kvittering eller faktura?', a: 'Nej. Prisen ovenfor er hele omkostningen, uanset hvor mange kvitteringer du scanner, eller hvor mange fakturaer du sender — ingen stykpriser, ingen tilkøb der dukker op senere.' },
      { q: 'Er jeg låst fast, hvis jeg vil skifte væk fra Bokix?', a: 'Nej. Du eksporterer hele din bogføring som en SIE4-fil eller en fuld JSON-sikkerhedskopi, når du vil, direkte i Indstillinger — intet at spørge os om lov til. SIE4 er det samme åbne format, alle svenske bogføringsprogrammer læser.' },
      { q: 'Hvilke selskabsformer understøttes?', a: 'Bokix genkender enkeltmandsvirksomhed (enskild firma), aktieselskab (aktiebolag), interessentskab/kommanditselskab og økonomisk forening ud fra det svenske organisationsnummer og bogfører efter de rigtige regler for hver form.' },
      { q: 'Er support inkluderet i prisen?', a: 'Ja, support er inkluderet i begge niveauer. Du når os på support@bokix.se.' },
    ],
  },

  fi: {
    meta: {
      title: 'Hinnat: alkaen 129 kr/kk | Bokix',
      description: 'Kaksi selkeää hintaa sen mukaan, onko sinulla henkilöstöä: 129 kr/kk ilman työntekijöitä, 179 kr/kk työntekijöiden kanssa. Ei arvonlisäveroa eikä piilokuluja.',
    },
    hero: {
      title: 'Yksi hinta tilanteeseesi',
      subtitle: 'Sama kirjanpito ja laskutus molemmissa tasoissa — ainoa ero on, onko sinulla henkilöstöä palkkalistalla. Ei lisäostoksia, ei sitoutumisaikaa kuukausisuunnitelmassa.',
    },
    interval: { monthly: 'Kuukausittain', yearly: 'Vuosisuunnitelma', yearlyBadge: 'säästä jopa 360 kr/vuosi' },
    freeTrialSuffix: 'ilmainen 30 päivää',
    yearlySavingsNote: (kr) => `Veloitetaan kuukausittain · säästät ${kr} kr vuodessa`,
    cta: 'Aloita ilmaiseksi',
    yearlyMinimumNote: (months) => `Ilmainen 30 päivää · sama kuukausiveloitus kuin tavallisesti, vain pienempi · vähintään ${months} kuukautta`,
    monthlyNote: 'Ilmainen 30 päivää · peruuta milloin tahansa',
    vatNote: 'Hinnat ovat Ruotsin kruunuissa, eikä arvonlisäveroa lisätä — Bokix ei ole alv-rekisterissä, joten näkemäsi summa on se, joka veloitetaan.',
    noHiddenFeesNote: 'Ei piilokuluja eikä maksua per skannattu kuitti tai lähetetty lasku — yllä oleva hinta on koko kustannus riippumatta siitä, kuinka paljon kirjaat.',
    schemaDescription: 'Kirjanpito, laskutus, palkanlaskenta ja alv-ilmoitukset ruotsalaisille yrityksille kaikissa yhtiömuodoissa.',
    faqHeading: 'Usein kysytyt kysymykset',
    faq: [
      { q: 'Kumman tason valita?', a: 'Jos sinulla ei ole työntekijöitä, valitse Ei työntekijöitä. Heti kun sinulla on — tai aiot saada — työntekijän, myös osa-aikaisen, tarvitset palkkamoduulin, joka sisältyy tasoon Työntekijöitä.' },
      { q: 'Voinko vaihtaa tasoa myöhemmin?', a: 'Kyllä. Jos palkkaat työntekijän myöhemmin, päivität tasoon Työntekijöitä tarvitessasi sitä, suoraan tililtäsi.' },
      { q: 'Pitääkö korttitiedot syöttää kokeillakseni?', a: 'Kyllä, syötät maksutietosi Stripeen jo rekisteröityessäsi, mutta sinulta ei veloiteta mitään ensimmäisten 30 päivän aikana. Jos peruutat sitä ennen, se ei maksa sinulle koskaan mitään.' },
      { q: 'Voinko peruuttaa milloin tahansa?', a: 'Kuukausisuunnitelmassa kyllä — ei irtisanomisaikaa eikä sitoutumista, peruutat milloin haluat. Vuosisuunnitelma antaa alemman kuukausihinnan vastineeksi vähintään kolmen kuukauden sitoutumisesta, minkä jälkeen peruutat yhtä vapaasti.' },
      { q: 'Lisätäänkö hintaan arvonlisävero?', a: 'Ei. Bokix ei ole alv-rekisterissä, joten näkemäsi hinta on koko veloitettava summa — päälle ei lisätä alv:ia. Tämä tarkoittaa myös, ettei tilauksesta ole vähennettävää ostoihin sisältyvää alv:ia omassa kirjanpidossasi.' },
      { q: 'Tuleeko maksuja per kuitti tai lasku?', a: 'Ei. Yllä oleva hinta on koko kustannus riippumatta siitä, kuinka monta kuittia skannaat tai laskua lähetät — ei kappalehintoja, ei myöhemmin ilmaantuvia lisämaksuja.' },
      { q: 'Olenko sidottu, jos haluan vaihtaa pois Bokixista?', a: 'Et. Voit viedä koko kirjanpitosi SIE4-tiedostona tai täytenä JSON-varmuuskopiona milloin haluat, suoraan Asetuksista — ei tarvitse kysyä lupaa meiltä. SIE4 on sama avoin muoto, jota kaikki ruotsalaiset kirjanpito-ohjelmat lukevat.' },
      { q: 'Mitkä yhtiömuodot tuetaan?', a: 'Bokix tunnistaa toiminimen (enskild firma), osakeyhtiön (aktiebolag), avoimen yhtiön/kommandiittiyhtiön (handelsbolag/kommanditbolag) ja taloudellisen yhdistyksen Ruotsin y-tunnuksen perusteella ja kirjaa kunkin muodon oikeiden sääntöjen mukaan.' },
      { q: 'Sisältyykö tuki hintaan?', a: 'Kyllä, tuki sisältyy molempiin tasoihin. Tavoitat meidät osoitteesta support@bokix.se.' },
    ],
  },
};
