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
      title: 'Priser: bokföringsprogram från 129 kr/mån | Bokix',
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
    vatNote: 'Priserna är i svenska kronor och ingen moms tillkommer, Bokix är inte momsregistrerat, så beloppet du ser är det som dras.',
    noHiddenFeesNote: 'Inga dolda avgifter och inga tillägg per kvitto eller skickad faktura, priset ovan är hela kostnaden, oavsett hur mycket du bokför.',
    schemaDescription: 'Bokföring, fakturering, lönehantering och momsredovisning för svenska företag i alla bolagsformer.',
    faqHeading: 'Vanliga frågor',
    faq: [
      { q: 'Vilken nivå ska jag välja?', a: 'Har du ingen anställd väljer du Utan personal. Så fort du har eller planerar att ha någon anställd, även deltid, behöver du löne­modulen som ingår i Med personal.' },
      { q: 'Kan jag byta nivå senare?', a: 'Ja. Anställer du någon senare uppgraderar du till Med personal när du behöver det, direkt i kontot.' },
      { q: 'Behöver jag ange kortuppgifter för att prova?', a: 'Ja, du lägger in dina betaluppgifter hos Stripe redan vid registreringen, men du debiteras ingenting under de första 30 dagarna. Avslutar du innan dess kostar det dig aldrig något.' },
      { q: 'Kan jag avsluta när som helst?', a: 'På månadsplanen ja, det finns varken uppsägningstid eller bindningstid, du avslutar när du vill. Årsplanen ger ett lägre månadspris mot att den gäller i minst tre månader, därefter avslutar du den lika fritt.' },
      { q: 'Tillkommer avgifter per kvitto eller faktura?', a: 'Nej. Priset ovan är hela kostnaden oavsett hur många kvitton du skannar eller fakturor du skickar, inga styckpriser, inga tillägg som dyker upp senare.' },
      { q: 'Är jag inlåst om jag vill byta bort från Bokix?', a: 'Nej. Du exporterar hela din bokföring som en SIE4-fil eller en fullständig JSON-säkerhetskopia när du vill, direkt i Inställningar, inget att fråga oss om lov för. SIE4 är samma öppna format alla svenska bokföringsprogram läser.' },
      { q: 'Vilka bolagsformer stöds?', a: 'Bokix känner igen enskild firma, aktiebolag, handelsbolag/kommanditbolag och ekonomisk förening utifrån organisationsnumret, och bokför enligt rätt regler för respektive form.' },
      { q: 'Ingår support i priset?', a: 'Ja, support ingår i båda nivåerna. Du når oss på support@bokix.se.' },
    ],
  },
};
