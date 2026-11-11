// Hjälpcentret (2026-11-11): en kort text per funktion, visad i Hjälp och
// support (HelpDrawer.jsx). Varje text har steg som matchar knapparnas namn i
// appen och en knapp som öppnar rätt sida (`tab`, samma id som menyn och
// handleNavTabChange i App.jsx använder; `action` = en global åtgärd, t.ex.
// ny faktura). `link` = en sida på bokix.se i stället för en appsida.
// Håll texterna sanna: står det något här ska det finnas i appen.

export const HELP_CATEGORIES = [
  { id: 'start', label: 'Kom igång' },
  { id: 'in', label: 'Pengar in' },
  { id: 'out', label: 'Pengar ut och lön' },
  { id: 'books', label: 'Bokföring, moms och bokslut' },
  { id: 'move', label: 'Flytta och exportera' },
  { id: 'account', label: 'Konto och inställningar' },
];

export const HELP_ARTICLES = [
  {
    id: 'kvitto', category: 'start', tab: 'expenses', open: 'Öppna Kvitton',
    title: 'Lägg in ett kvitto',
    summary: 'Fota kvittot, så läser Bokix av beloppet och bokför det.',
    steps: [
      'Öppna Kvitton i menyn.',
      'Dra in kvittot eller klicka på Ladda upp kvitton (bild eller PDF). I mobilen kan du fota det direkt.',
      'Bokix läser av belopp, datum och moms och föreslår ett konto.',
      'Kontrollera och spara. Är Bokix osäker på kontot står det Kontrollera, och då väljer du själv.',
    ],
    keywords: 'utgift kostnad foto bild pdf moms konto',
  },
  {
    id: 'faktura', category: 'start', tab: 'invoices', action: { type: 'new_invoice' }, open: 'Skapa en faktura',
    title: 'Skapa och skicka en faktura',
    summary: 'Fakturan bokförs av sig själv när du skickar den.',
    steps: [
      'Öppna Kundfakturor och välj Ny faktura.',
      'Välj kund, eller lägg till en ny.',
      'Lägg till rader med vad du sålt och priset. Moms och summa räknas ut åt dig.',
      'Välj Skicka faktura för att mejla den, eller ladda ner PDF:en.',
    ],
    keywords: 'faktura kund skicka pdf ocr betalning',
  },
  {
    id: 'bankgiro', category: 'start', tab: 'company', open: 'Öppna Företag och profil',
    title: 'Bankgiro och betalningsuppgifter',
    summary: 'Uppgifterna som står på dina fakturor, så att kunderna kan betala.',
    steps: [
      'Öppna Inställningar och välj Företag och profil.',
      'Fyll i bankgiro, plusgiro eller IBAN.',
      'Uppgifterna kommer med på alla nya fakturor.',
    ],
    keywords: 'bankgiro plusgiro iban konto betalning faktura',
  },
  {
    id: 'kund', category: 'in', tab: 'contacts', open: 'Öppna Kunder',
    title: 'Lägg till en kund',
    summary: 'Skriv namnet, så hämtar Bokix organisationsnummer och adress.',
    steps: [
      'Öppna Kunder och välj Ny kund.',
      'Skriv företagets namn eller organisationsnummer.',
      'Välj rätt företag i listan. Adressen fylls i av sig själv.',
      'Har du många kunder kan du läsa in dem från en CSV-fil med Importera.',
    ],
    keywords: 'kund kontakt adress organisationsnummer csv import',
  },
  {
    id: 'offert', category: 'in', tab: 'quotes', open: 'Öppna Offerter',
    title: 'Skicka en offert',
    summary: 'När kunden säger ja blir offerten en faktura med ett klick.',
    steps: [
      'Öppna Offerter och välj Ny offert.',
      'Välj kund och lägg till rader, som på en faktura.',
      'Skicka offerten.',
      'När kunden accepterat väljer du Konvertera till faktura.',
    ],
    keywords: 'offert anbud kund accepterad',
  },
  {
    id: 'leverantorsfaktura', category: 'out', tab: 'supplier_invoices', open: 'Öppna Leverantörsfakturor',
    title: 'Registrera en leverantörsfaktura',
    summary: 'Fakturor du ska betala, så att du ser vad som förfaller.',
    steps: [
      'Öppna Leverantörsfakturor och välj Ny leverantörsfaktura.',
      'Ladda upp fakturan eller fyll i belopp, datum och förfallodag.',
      'Spara. Den syns under Utestående på startsidan tills den är betald.',
      'Välj Markera som betald när pengarna gått iväg.',
    ],
    keywords: 'leverantör räkning betala förfallodag',
  },
  {
    id: 'lon', category: 'out', tab: 'payroll', open: 'Öppna Anställda och lön',
    title: 'Kör lön',
    summary: 'Lägg in den anställda en gång, sedan tar lönekörningen några minuter.',
    steps: [
      'Öppna Anställda och lön och välj Ny anställd.',
      'Välj Hämta skattetabeller, så dras rätt skatt.',
      'Välj Ny lönekörning och följ stegen.',
      'Lönebesked och arbetsgivardeklaration (AGI) tas fram ur lönekörningen. AGI-filen laddar du upp hos Skatteverket.',
    ],
    keywords: 'lön anställd skatt agi arbetsgivardeklaration lönebesked',
    plan: 'payroll',
  },
  {
    id: 'bank', category: 'books', tab: 'bank', open: 'Öppna Bank',
    title: 'Läs in bankens kontoutdrag',
    summary: 'Ladda upp en fil från banken, så matchar Bokix betalningarna.',
    steps: [
      'Exportera kontoutdraget ur internetbanken som CSV eller Excel.',
      'Öppna Bank och välj Importera kontoutdrag.',
      'Kontrollera att kolumnerna för datum, text och belopp stämmer.',
      'Raderna läses in, och Bokix föreslår vad varje betalning hör till.',
    ],
    keywords: 'bank kontoutdrag csv excel import betalning matcha',
  },
  {
    id: 'moms', category: 'books', tab: 'taxes_vat', open: 'Öppna Moms',
    title: 'Momsdeklarationen',
    summary: 'Rutorna räknas ut från det du bokfört.',
    steps: [
      'Öppna Skatt och bokslut och välj Moms.',
      'Välj period. Rutorna är redan ifyllda utifrån bokföringen.',
      'Ladda ner filen och lämna den hos Skatteverket.',
      'Markera deklarationen som inlämnad, så försvinner påminnelsen.',
    ],
    keywords: 'moms deklaration skatteverket ruta kvartal',
  },
  {
    id: 'bokslut', category: 'books', tab: 'taxes_yearend', open: 'Öppna Bokslut',
    title: 'Bokslut och att låsa året',
    summary: 'Följ stegen när räkenskapsåret är slut.',
    steps: [
      'Öppna Skatt och bokslut och välj Bokslut.',
      'Gå igenom stegen ett i taget.',
      'Välj Lås räkenskapsåret när allt stämmer. Då går det inte att ändra i det året längre.',
    ],
    keywords: 'bokslut räkenskapsår lås årsredovisning inkomstdeklaration',
  },
  {
    id: 'verifikation', category: 'books', tab: 'verifications', open: 'Öppna Bokföring',
    title: 'Bokför något för hand',
    summary: 'För det som inte är ett kvitto eller en faktura.',
    steps: [
      'Öppna Bokföring och välj Ny verifikation.',
      'Skriv vad det gäller, datum och belopp.',
      'Välj konton. Bokix visar om det inte går jämnt ut.',
      'Spara. Verifikationen får nästa nummer i serien.',
    ],
    keywords: 'verifikation bokföring manuell konto debet kredit',
  },
  {
    id: 'rapporter', category: 'books', tab: 'reports', open: 'Öppna Rapporter',
    title: 'Resultat och balans',
    summary: 'Rapporterna räknas fram ur din bokföring.',
    steps: [
      'Öppna Rapporter.',
      'Välj rapport, till exempel Resultaträkning eller Balansräkning.',
      'Välj period längst upp. Du kan skriva ut eller ladda ner rapporten.',
    ],
    keywords: 'rapport resultaträkning balansräkning huvudbok kassaflöde',
  },
  {
    id: 'sie-import', category: 'move', tab: 'settings_advanced', open: 'Öppna Import och export',
    title: 'Flytta bokföringen hit från ett annat program',
    summary: 'Med en SIE4-fil följer kontoplan, verifikationer och ingående balanser med.',
    steps: [
      'Exportera en SIE4-fil ur programmet du använde förut.',
      'Öppna Inställningar och välj Import och export.',
      'Välj Flytta hit bokföringen och välj filen.',
      'Granska konton och verifikationer. Inget sparas förrän du bekräftar.',
    ],
    keywords: 'sie sie4 flytta byta fortnox visma bokio import',
  },
  {
    id: 'export', category: 'move', tab: 'settings_advanced', open: 'Öppna Import och export',
    title: 'Exportera bokföringen',
    summary: 'Din bokföring är din. Ta ut den när du vill.',
    steps: [
      'Öppna Inställningar och välj Import och export.',
      'Välj Ladda ner SIE4. Filen läses av alla svenska bokföringsprogram och av din revisor.',
    ],
    keywords: 'export sie sie4 säkerhetskopia ladda ner',
  },
  {
    id: 'anvandare', category: 'account', tab: 'settings_users', open: 'Öppna Användare',
    title: 'Bjud in revisor eller kollega',
    summary: 'Ge någon annan tillgång till företaget.',
    steps: [
      'Öppna Inställningar och välj Användare.',
      'Välj Bjud in användare och skriv personens e-post.',
      'Välj vad personen ska få se och göra.',
      'Personen får ett mejl med en länk. En inbjuden betalar ingenting.',
    ],
    keywords: 'användare revisor kollega bjud in behörighet',
  },
  {
    id: 'prenumeration', category: 'account', tab: 'settings_subscription', open: 'Öppna Prenumeration',
    title: 'Byt nivå eller avsluta',
    summary: 'Utan personal eller Med personal, och ingen bindningstid på månadsplanen.',
    steps: [
      'Öppna Inställningar och välj Prenumeration.',
      'Där ser du nivå, pris och nästa dragning.',
      'Byt nivå om du anställer någon, eller avsluta. Bokföringen sparas i sju år även efter att du avslutat.',
    ],
    keywords: 'prenumeration pris nivå avsluta säga upp betalning kort',
  },
  {
    id: 'logotyp', category: 'account', tab: 'settings_invoice', open: 'Öppna Fakturor',
    title: 'Logotyp och utseende på fakturan',
    summary: 'Din logga på fakturor och offerter.',
    steps: [
      'Öppna Inställningar och välj Fakturor.',
      'Ladda upp din logotyp och välj storlek.',
      'Välj om företagsnamnet ska stå bredvid loggan.',
    ],
    keywords: 'logotyp logga faktura mall utseende',
  },
  {
    id: 'face-id', category: 'account', tab: 'settings_security', open: 'Öppna Säkerhet',
    title: 'Logga in med Face ID',
    summary: 'Logga in med ansiktet eller fingret i stället för lösenord.',
    steps: [
      'Öppna Inställningar och välj Säkerhet.',
      'Lägg till Face ID eller fingeravtryck. Det görs en gång per enhet.',
      'Nästa gång väljer du Face ID eller fingeravtryck på inloggningssidan. Lösenordet fungerar fortfarande.',
    ],
    keywords: 'face id touch id passkey inloggning lösenord säkerhet',
  },
  {
    id: 'hemskarm', category: 'account', link: '/lagg-till-pa-hemskarmen', open: 'Visa hur',
    title: 'Bokix på mobilens hemskärm',
    summary: 'Öppna Bokix som en app, så fotar du kvittot direkt när du handlar.',
    steps: [
      'Öppna bokix.se i mobilen.',
      'iPhone: tryck på dela-knappen och välj Lägg till på hemskärmen. Android: välj Installera i menyn.',
      'Bokix ligger nu som en ikon bland dina appar.',
    ],
    keywords: 'mobil app hemskärm iphone android installera',
  },
];

// Vilka texter som hör till en sida i appen (för "Den här sidan" i panelen).
const TAB_GROUPS = {
  expenses: ['kvitto'],
  invoices: ['faktura', 'bankgiro', 'logotyp'],
  quotes: ['offert'],
  contacts: ['kund'],
  supplier_invoices: ['leverantorsfaktura'],
  payroll: ['lon'],
  bank: ['bank'],
  taxes: ['moms', 'bokslut'],
  verifications: ['verifikation'],
  reports: ['rapporter'],
  settings: ['anvandare', 'prenumeration', 'sie-import', 'export', 'face-id'],
  dashboard: ['kvitto', 'faktura', 'sie-import'],
};

export function articlesForTab(tab) {
  const ids = TAB_GROUPS[tab] || [];
  return ids.map(id => HELP_ARTICLES.find(a => a.id === id)).filter(Boolean);
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Enkel sökning: alla ord i frågan ska finnas i titel, sammanfattning, steg eller nyckelord. */
export function searchArticles(query, articles = HELP_ARTICLES) {
  const words = norm(query).split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return [];
  return articles
    .map(a => {
      const title = norm(a.title);
      const body = norm([a.summary, a.keywords, ...(a.steps || [])].join(' '));
      if (!words.every(w => title.includes(w) || body.includes(w))) return null;
      const score = words.reduce((n, w) => n + (title.includes(w) ? 3 : 1), 0);
      return { a, score };
    })
    .filter(Boolean)
    .sort((x, y) => y.score - x.score)
    .map(x => x.a);
}
