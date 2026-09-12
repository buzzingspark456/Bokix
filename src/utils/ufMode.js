// ─────────────────────────────────────────────────────────────────────────
// UF-läget — Bokix för ett UF-företag
// ─────────────────────────────────────────────────────────────────────────
// Ett UF-företag (Ung Företagsamhet) är inte ett litet aktiebolag. Det är
// några gymnasieelever som driver ett företag under ETT läsår, säljer en
// produkt eller tjänst, och ska lämna en enkel årsredovisning när året är
// slut. De har nästan aldrig anställda, sällan ett eget organisations-
// nummer, och aldrig ett behov av projektredovisning eller offerter.
//
// Att ge dem hela Bokix vore därför inte generöst utan förvirrande: tolv
// menypunkter där sju aldrig ska användas gör det svårare att hitta de fem
// som faktiskt gäller. Den här filen är EN källa för vad UF-läget är —
// vilka sidor som finns, vilka som är avstängda och varför, hur många
// fakturor som får skapas per dygn och hur länge kontot är gratis.
// Konsumeras av App.jsx (menyn + den spärrade sidan), Invoices.jsx
// (fakturaspärren), Reports/Taxes (bortfiltrerade avsnitt), Settings,
// Auth.jsx (registreringen) och marknadssidan /uf.
//
// ── VAD SPÄRRARNA HÄR ÄR OCH INTE ÄR ────────────────────────────────────
// Allt i den här filen körs i webbläsaren. Det är produktlogik — vad
// gränssnittet visar och tillåter — inte en säkerhetsgräns. Någon som
// öppnar devtools kan kringgå både fakturataket och den avstängda
// menypunkten, precis som de redan kan kringgå betalspärren (se
// FREE_ACCOUNT_EMAILS-kommentaren i App.jsx: prenumerationsstatus styr
// ingen server-side-behörighet i dagsläget heller). Taket finns för att
// hålla ett gratiskonto rimligt, inte för att stoppa en angripare. Ska
// det bli en riktig gräns måste den flyttas till api/ och kontrolleras
// vid skrivning — skriv inte om kommentaren här och låtsas att den redan
// är det.
// ─────────────────────────────────────────────────────────────────────────

/** Hur länge ett UF-konto är gratis, i månader, räknat från registreringen. */
export const UF_FREE_MONTHS = 3;

/** Fakturor per dygn. Ett UF-företag som säljer på en mässa skriver några
 * fakturor i veckan — fem om dagen är rundligt tilltaget för ett verkligt
 * behov och lågt nog att kontot inte kan användas som en gratis
 * faktureringsmotor för något helt annat. Dygnet är kalenderdygn i
 * användarens egen tidszon (se ufInvoiceQuota) — inte en rullande
 * 24-timmarsperiod, eftersom "fem om dagen" är det som står i
 * gränssnittet och det är så en människa räknar. */
export const UF_INVOICE_LIMIT_PER_DAY = 5;

/**
 * Sidorna ett UF-företag har i menyn, i samma ordning som huvudmenyn i
 * App.jsx. Id:na är exakt de som tabAliases/resolveTab där använder — en
 * sida som inte står här och inte heller i UF_BLOCKED_PAGES nedan är helt
 * enkelt inte påtänkt för UF än, och App.jsx behandlar den då som
 * blockerad (se ufPageState) i stället för att smyga in den.
 *
 * 'settings' står med för att UF-företaget måste kunna byta lösenord,
 * lägga in sitt namn och se sin gratisperiod — Inställningar visar i sin
 * tur färre flikar i UF-läget, se ufSettingsSections nedan.
 */
export const UF_NAV_IDS = [
  'dashboard',
  'contacts',
  'invoices',
  'expenses',
  'review',
  'verifications',
  'bank',
  'reports',
  'taxes',
  'settings',
];

/**
 * Sidnamnen, exakt som de står i sidomenyn (App.jsx).
 *
 * Bor här, inte i komponenterna, eftersom TRE ytor visar samma lista:
 * appens spärrsida (UfLockedPage), "det här ingår"-listan på /uf, och
 * sidomenyn själv. Tre kopior hade glidit isär första gången en sida
 * bytte rubrik.
 */
export const UF_NAV_LABELS = {
  dashboard: 'Startsida',
  contacts: 'Kunder',
  invoices: 'Fakturering',
  expenses: 'Kvitton',
  review: 'Granskning',
  verifications: 'Bokföring',
  bank: 'Bank',
  reports: 'Rapport och analys',
  taxes: 'Skatt och bokslut',
  settings: 'Inställningar',
};

/**
 * De avstängda sidorna, med en förklaring och en väg vidare.
 *
 * Varför en förklaring i stället för att bara ta bort dem: menyn döljer
 * dem redan, men länkar finns kvar på andra ställen — URL-hashen någon
 * bokmärkt, produktrundturen, en genväg från en annan sida. Landar man
 * ändå här ska det stå VARFÖR och VAD man gör i stället, aldrig en tom
 * sida eller en krasch.
 *
 * `instead` pekar på ett riktigt tab-id i appen (resolveTab i App.jsx).
 */
export const UF_BLOCKED_PAGES = {
  quotes: {
    label: 'Offerter',
    body: 'Offerter hör hemma i företag som lämnar prisförslag innan jobbet börjar. Ett UF-företag säljer direkt — skriv fakturan när affären är klar.',
    instead: { tab: 'invoices', label: 'Gå till Fakturering' },
  },
  projects: {
    label: 'Projekt och tid',
    body: 'Projektredovisning och tidrapportering är till för att fördela nedlagda timmar på uppdrag och fakturera dem. Under ett UF-år räcker fakturan och bokföringen.',
    instead: { tab: 'invoices', label: 'Gå till Fakturering' },
  },
  payroll: {
    label: 'Anställda och lön',
    body: 'Ett UF-företag har inga anställda — ni som driver det är delägare, inte personal. Därför finns ingen lönekörning, inga arbetsgivaravgifter och inga kontrolluppgifter här.',
    instead: { tab: 'verifications', label: 'Gå till Bokföring' },
  },
};

/** Är det här ett UF-företag? Ett enda ställe att fråga, så villkoret
 * aldrig skrivs som `company.isUf === true` på ett ställe och
 * `!!company?.isUf` på ett annat. */
export function isUfCompany(company) {
  return Boolean(company && company.isUf);
}

/**
 * Vad gäller för en sida i UF-läget?
 *
 *   'open'     sidan finns och fungerar
 *   'blocked'  sidan finns i appen men inte för UF — visa förklaringen
 *
 * Icke-UF-företag får alltid 'open': hela den här filen ska vara ett
 * no-op för alla andra.
 */
export function ufPageState(company, tabId) {
  if (!isUfCompany(company)) return 'open';
  return UF_NAV_IDS.includes(tabId) ? 'open' : 'blocked';
}

/** Förklaringen för en spärrad sida, eller null om sidan inte har någon
 * skriven (då visas en generell text, se UfLockedPage.jsx). */
export function ufBlockedPage(tabId) {
  return UF_BLOCKED_PAGES[tabId] || null;
}

/** Lokalt datum som YYYY-MM-DD. Medvetet lokal tid, inte UTC: "fem
 * fakturor idag" ska rulla över vid midnatt där användaren sitter, inte
 * klockan 01:00 svensk sommartid. */
function localDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * När skapades fakturan? `createdAt` sätts av handleAddInvoice (App.jsx),
 * men fakturor som skapades innan det fältet fanns saknar det — då läses
 * tidsstämpeln ur id:t i stället (`inv_<ms>_<slump>`, samma format sedan
 * första versionen). Går ingetdera att läsa returneras null, och raden
 * räknas inte mot dagens tak: hellre en faktura för lite räknad än en
 * spärr som slår till på fel dag av ett datumfel.
 */
export function invoiceCreatedAt(invoice) {
  if (!invoice) return null;
  if (invoice.createdAt) {
    const parsed = new Date(invoice.createdAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const match = /^inv_(\d{10,})_/.exec(String(invoice.id || ''));
  if (match) {
    const parsed = new Date(Number(match[1]));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * Hur mycket av dygnets fakturatak som är förbrukat.
 *
 * Räknar på NÄR fakturan skapades, aldrig på fakturadatumet: fakturadatum
 * är ett fält användaren själv skriver i, och ett tak som går att nolla
 * genom att datera fakturan till förra veckan är inget tak.
 *
 * Returnerar alltid ett obegränsat läge för icke-UF-företag, så
 * anropsstället kan använda samma kod för alla.
 */
export function ufInvoiceQuota(company, invoices = [], now = new Date()) {
  if (!isUfCompany(company)) {
    return { limited: false, limit: Infinity, used: 0, remaining: Infinity, reached: false };
  }
  const today = localDayKey(now);
  const used = (invoices || []).reduce((count, inv) => {
    const created = invoiceCreatedAt(inv);
    return created && localDayKey(created) === today ? count + 1 : count;
  }, 0);
  const remaining = Math.max(0, UF_INVOICE_LIMIT_PER_DAY - used);
  return {
    limited: true,
    limit: UF_INVOICE_LIMIT_PER_DAY,
    used,
    remaining,
    reached: remaining === 0,
  };
}

/**
 * Gratisperioden: när tar den slut och hur många dagar är kvar?
 *
 * `startedAt` är registreringstidpunkten (user_metadata.uf_started_at,
 * speglad på företaget som company.ufStartedAt). Saknas den — ett konto
 * skapat innan UF-läget fanns, eller metadata som inte kom med — räknas
 * perioden som pågående utan slutdatum i stället för utgången. Att låsa
 * ute någon på grund av ett saknat fält vore fel väg att fela.
 *
 * Slutdatumet räknas i hela månader från startdagen (samma dag i månaden
 * N månader senare), inte 90 dagar: "tre månader gratis" ska betyda det
 * en människa menar med tre månader.
 */
export function ufFreePeriod(startedAt, now = new Date()) {
  const start = startedAt ? new Date(startedAt) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return { known: false, endsAt: null, daysLeft: null, expired: false };
  }
  const endsAt = new Date(start.getTime());
  endsAt.setMonth(endsAt.getMonth() + UF_FREE_MONTHS);
  // Dagar kvar räknas mellan kalenderdagar, inte i millisekunder: annars
  // visas "0 dagar kvar" redan under sista dygnet.
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysLeft = Math.round((startOfDay(endsAt) - startOfDay(now)) / 86400000);
  return { known: true, endsAt, daysLeft, expired: daysLeft < 0 };
}

/**
 * Inställningsflikar i UF-läget.
 *
 * Bort: 'users' (att bjuda in fler konton hör till ett betalande företag —
 * UF-gruppen delar ett konto under läsåret) och det som rör lön. Kvar:
 * profil, företag, fakturainställningar, integrationer, utseende, data
 * och prenumeration — den sista för att gratisperioden ska gå att se, se
 * Settings.jsx:s UF-gren.
 */
export function ufSettingsSections(company, sections) {
  if (!isUfCompany(company)) return sections;
  const hidden = ['users'];
  return sections.filter(s => !hidden.includes(s.id));
}

/**
 * Rapporter som inte är relevanta för ett UF-företag.
 *
 * Lönerapporter faller redan bort av sig själva (de kräver lönedata som
 * aldrig kan finnas utan lönemodulen), men momsrapporten står kvar
 * MEDVETET: ett UF-företag som säljer över gränsen för momsplikt ska
 * kunna se sitt underlag. Att gissa att "UF = aldrig moms" vore ett
 * påstående om skatteregler vi inte kan garantera för varje UF-företag.
 */
export const UF_HIDDEN_REPORT_IDS = ['payroll'];

/**
 * Flikarna i Skatt och bokslut som gäller ett UF-företag.
 *
 * Kvar: Viktiga datum, Moms (se resonemanget ovan) och Årsbokslut — det
 * sista är hela poängen, ett UF-år avslutas med en årsredovisning.
 * Bort: Kontrolluppgifter (förutsätter anställda) och
 * Inkomstdeklaration/INK2 (förutsätter aktiebolag). Båda hade visat
 * tomma blanketter som inte hör till bolagsformen.
 */
export const UF_TAX_SECTION_IDS = ['dates', 'vat', 'yearend'];
