// Delad källa för varje guides FAQ — samma anledning som comparisonData.js:
// scripts/prerender.mjs (ren Node, ingen JSX-transform) importerar den här
// filen direkt för att bygga FAQPage-JSON-LD, och varje Guide*.jsx-fil
// importerar SAMMA array för att rendera frågorna på sidan. En enda källa,
// aldrig två listor som kan glida isär.
export const GUIDE_FAQ = {
  'enskild-firma-bokforing': [
    { q: 'Måste jag bokföra som enskild firma även om jag inte tjänar mycket?', a: 'Ja. Bokföringsskyldigheten gäller från första kronan i omsättning, oavsett hur liten verksamheten är — det finns ingen omsättningsgräns under vilken du slipper bokföra.' },
    { q: 'Hur länge måste jag spara bokföringen?', a: 'Räkenskapsinformation ska sparas i minst 7 år efter utgången av det kalenderår då räkenskapsåret avslutades, enligt bokföringslagen.' },
    { q: 'Behöver jag momsregistrera mig direkt?', a: 'Nej, om din omsättning väntas ligga på 120 000 kr eller lägre per år kan du välja att inte momsregistrera dig. Överstiger eller väntas den överstiga gränsen ska du momsregistrera dig hos Skatteverket.' },
  ],
  momsdeklaration: [
    { q: 'Vilka momssatser finns i Sverige?', a: '25 % är standardsatsen och gäller de flesta varor och tjänster. 12 % gäller bland annat livsmedel, restaurangbesök och hotell. 6 % gäller bland annat böcker, tidningar, persontransport och biljetter till kultur- och idrottsevenemang.' },
    { q: 'Vad händer om jag deklarerar moms för sent?', a: 'Skatteverket tar ut en förseningsavgift, och om skatten betalas för sent tillkommer kostnadsränta. Lämna hellre en deklaration med uppskattade siffror i tid och rätta senare, än att missa deadline helt.' },
    { q: 'Kan jag få tillbaka moms jag betalat på inköp?', a: 'Ja — ingående moms på inköp till verksamheten dras av mot den utgående moms du tagit ut på din försäljning. Är den ingående momsen högre än den utgående får du mellanskillnaden tillbaka.' },
  ],
  'fakturering-vad-kravs': [
    { q: 'Måste jag ha ett godkänt fakturaprogram?', a: 'Nej, det finns inget krav på ett visst certifierat program för att skicka fakturor — kravet är att fakturan innehåller rätt uppgifter och att den bokförs korrekt. Ett fakturaprogram gör det bara enklare att få rätt varje gång.' },
    { q: 'Hur länge har en kund på sig att betala?', a: 'Betalningsvillkoren bestäms i grunden av avtalet mellan er — vanligast är 10, 20 eller 30 dagar netto. Mot konsumenter gäller viss reglering i räntelagen; mot andra företag är villkoren fria så länge de avtalats.' },
    { q: 'Kan jag ta ut dröjsmålsränta om en kund betalar för sent?', a: 'Ja, om det avtalats eller enligt räntelagens regler efter att betalningen förfallit och en påminnelse skickats. Många väljer att skriva ut räntesatsen redan på fakturan så villkoret är tydligt från början.' },
  ],
  'valja-bokforingsprogram': [
    { q: 'Är det billigaste bokföringsprogrammet alltid bäst?', a: 'Nej — jämför alltid vad som faktiskt ingår i priset, inte bara grundpriset. Ett billigt grundpris som kräver flera betalda tillägg (lön, bokslut, fler verifikat) kan landa dyrare i praktiken än ett något högre allt-i-ett-pris.' },
    { q: 'Behöver jag betala för lönehantering separat?', a: 'Det beror helt på leverantören. Hos flera stora program är lönekörning en egen betald modul ovanpå grundpriset. Kontrollera alltid om lön ingår innan du jämför två program rakt av på grundpris.' },
    { q: 'Kan jag byta bokföringsprogram mitt i året?', a: 'Tekniskt går det när som helst, men det är enklast vid ett årsskifte eller kvartalsskifte. De flesta program har idag ingen sömlös automatisk import av ett annat programs fullständiga historik — räkna med att exportera din gamla bokföring för arkivering och starta löpande bokföring i det nya systemet från bytesdagen.' },
  ],
};
