// ── Delningsbild per sida (og:image) ────────────────────────────────────
// Varje marknadssida får en egen bild som visas när länken delas och kan
// visas i sökresultat. Bilderna ritas av scripts/render-og-images.mjs till
// public/og/<namn>.jpg och används av PageMeta (utils/seo.jsx) när sidan
// inte skickar en egen bild. Blogg, nyheter och videoguider har redan
// egna bilder och står inte här.
//
// Kör om skriptet när en rubrik eller punkt ändras här.

export const OG_PAGES = {
  '/': { file: 'startsida', eyebrow: 'Bokföringsprogram för småföretag', title: 'Bokföring, fakturor, lön och moms i ett verktyg', items: ['Kvitton läses av från ett foto', 'Moms och bokslut ur bokföringen', 'Allt ingår, från 129 kr/mån'] },
  '/funktioner': { file: 'funktioner', eyebrow: 'Funktioner', title: 'Allt från kvitto till bokslut', items: ['Bokföring utan debet och kredit', 'Fakturor med egen logga', 'Lön med AGI-fil', 'Bokslut och årsredovisning'] },
  '/priser': { file: 'priser', eyebrow: 'Priser', title: 'Ett pris, allt ingår', items: ['129 kr/mån utan anställda', '179 kr/mån med anställda', 'Ingen moms tillkommer', '30 dagar gratis'] },
  '/om-oss': { file: 'om-oss', eyebrow: 'Om Bokix', title: 'Svenskt bokföringsprogram för småföretag', items: ['Byggt i Sverige', 'Data lagras inom EU', 'Support som ingår i priset'] },
  '/kontakt': { file: 'kontakt', eyebrow: 'Kontakt', title: 'Frågor om Bokix? Hör av dig', items: ['support@bokix.se', 'Boka en genomgång på 25 minuter', 'Svar från dem som bygger Bokix'] },
  '/boka-genomgang': { file: 'boka-genomgang', eyebrow: 'Boka en genomgång', title: 'Osäker på om Bokix passar dig?', items: ['25 minuter', 'Kostnadsfritt', 'Inget att förbereda'] },
  '/byt-bokforingsprogram': { file: 'byt-bokforingsprogram', eyebrow: 'Byt bokföringsprogram', title: 'Ta med dig hela bokföringen', items: ['Exportera en SIE4-fil', 'Läs in den i Bokix', 'Konton och verifikationer följer med'] },
  '/koppla-bank': { file: 'koppla-bank', eyebrow: 'Bank', title: 'Banken in i bokföringen', items: ['Läs in kontoutdraget som fil', 'Betalningar matchas mot fakturor', 'Det osäkra hamnar i Granskning'] },
  '/uf': { file: 'uf', eyebrow: 'UF-företag', title: 'Bokföring för UF-företag', items: ['Gratis under UF-året', 'Enkelt läge utan debet och kredit', 'Kvitton läses av från ett foto'] },
  '/integrationer': { file: 'integrationer', eyebrow: 'Integrationer', title: 'Kopplat till tjänsterna du redan använder', items: ['Stripe för kortbetalning', 'Zettle för kassan', 'Gmail för fakturor', 'SIE4 in och ut'] },
  '/sakerhet': { file: 'sakerhet', eyebrow: 'Säkerhet', title: 'Så skyddar vi din bokföring', items: ['Data lagras inom EU', 'Tvåfaktorsinloggning', 'Sparas i sju år', 'Kopia varje natt'] },
  '/lon': { file: 'lon', eyebrow: 'Löneprogram', title: 'Lönekörning steg för steg', items: ['Skattetabeller och arbetsgivaravgift', 'Lönebesked till de anställda', 'AGI-fil till Skatteverket', 'Betalfil till banken'] },
  '/ordlista': { file: 'ordlista', eyebrow: 'Bokföringsordlista', title: 'Bokföringens ord, förklarade enkelt', items: ['Debet och kredit', 'Moms och periodisering', 'K2, K3 och bokslut'] },
  '/bokix-i-korthet': { file: 'bokix-i-korthet', eyebrow: 'Bokix i korthet', title: 'Fakta, pris och funktioner', items: ['För svenska småföretag', 'Från 129 kr/mån, allt ingår', 'Ingen bindningstid'] },
  '/lagg-till-pa-hemskarmen': { file: 'hemskarmen', eyebrow: 'Bokix på mobilen', title: 'Lägg Bokix på hemskärmen', items: ['iPhone och Android', 'Öppnas som en app', 'Inget att ladda ned'] },
  '/vanliga-fragor': { file: 'vanliga-fragor', eyebrow: 'Vanliga frågor', title: 'Svar på det mesta om Bokix', items: ['Pris och provperiod', 'Bolagsformer', 'Flytta bokföringen hit'] },
  '/verktyg': { file: 'verktyg', eyebrow: 'Gratis verktyg', title: 'Räkna på moms, lön och skatt', items: ['Momskalkylator', 'Lönekalkylator', 'ROT och RUT', 'Utdelning enligt 3:12'] },
  '/verktyg/skanna-kvitto': { file: 'skanna-kvitto', eyebrow: 'Gratis verktyg', title: 'Skanna kvitto', items: ['Datum, belopp och moms', 'Läses av i webbläsaren', 'Gratis, utan konto'] },
  '/verktyg/momskalkylator': { file: 'momskalkylator', eyebrow: 'Gratis verktyg', title: 'Momskalkylator', items: ['Räkna moms framlänges', 'Och baklänges', '25, 12 och 6 procent'] },
  '/verktyg/lonekalkylator': { file: 'lonekalkylator', eyebrow: 'Gratis verktyg', title: 'Vad kostar en anställd?', items: ['Lön efter skatt', 'Arbetsgivaravgift', 'Total kostnad för företaget'] },
  '/verktyg/egenavgifter': { file: 'egenavgifter', eyebrow: 'Gratis verktyg', title: 'Egenavgifter i enskild firma', items: ['Räkna ut egenavgifterna', 'Se vad som blir kvar', 'Efter skatt'] },
  '/verktyg/rot-rut': { file: 'rot-rut', eyebrow: 'Gratis verktyg', title: 'ROT- och RUT-kalkylator', items: ['Räkna ut avdraget', 'Vad kunden betalar', 'Vad som begärs från Skatteverket'] },
  '/verktyg/drojsmalsranta': { file: 'drojsmalsranta', eyebrow: 'Gratis verktyg', title: 'Dröjsmålsränta på en sen faktura', items: ['Referensränta plus 8 procentenheter', 'Räknat per dag', 'Gratis, utan konto'] },
  '/verktyg/utdelning': { file: 'utdelning', eyebrow: 'Gratis verktyg', title: 'Utdelningskalkylator 2026', items: ['Gränsbelopp enligt 3:12', 'Förenklingsregeln', 'Skatt på utdelningen'] },
  '/verktyg/momsdatum': { file: 'momsdatum', eyebrow: 'Gratis verktyg', title: 'När ska jag deklarera moms?', items: ['Momsdatum för 2026', 'Månad, kvartal eller år', 'Påminnelse i kalendern'] },
  '/verktyg/arsredovisning': { file: 'arsredovisning', eyebrow: 'Gratis verktyg', title: 'Sista dag för årsredovisningen', items: ['Räkna ut din deadline', 'Utifrån räkenskapsåret', 'Sju månader efter årets slut'] },
  '/bokforingsprogram-enskild-firma': { file: 'bokforingsprogram-enskild-firma', eyebrow: 'Bokföringsprogram för enskild firma', title: 'Bokföring för enskild firma, utan krångel', items: ['Kvitton läses av från ett foto', 'Momsdeklaration som fil', 'Förslag till NE-bilagan'] },
  '/bokforingsprogram-aktiebolag': { file: 'bokforingsprogram-aktiebolag', eyebrow: 'Bokföringsprogram för aktiebolag', title: 'Från kvitto till årsredovisning', items: ['Lön med AGI-fil', 'INK2 med SRU-fil', 'Årsredovisning enligt K2'] },
  '/bokforingsprogram-handelsbolag': { file: 'bokforingsprogram-handelsbolag', eyebrow: 'Bokföringsprogram för handelsbolag', title: 'Bokföring för handelsbolag och KB', items: ['Tre användare ingår', 'INK4 som SRU-fil', 'Bokslut per delägare'] },
  '/bokforingsprogram-ekonomisk-forening': { file: 'bokforingsprogram-ekonomisk-forening', eyebrow: 'Bokföringsprogram för ekonomisk förening', title: 'Bokföring för ekonomisk förening', items: ['Tre användare ingår', 'INK2 med SRU-fil', 'Årsredovisning enligt K2'] },
};

export const ogImageFor = (path) => (OG_PAGES[path] ? `/og/${OG_PAGES[path].file}.jpg` : null);
