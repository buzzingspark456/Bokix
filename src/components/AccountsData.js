// BAS 2023 – Standardkontoplan för svenska företag
// ~92 vanliga konton som täcker de mest förekommande affärshändelserna.
//
// Källa: kontonummer/benämningar här är de mest ubikvitära BAS-kontona —
// samma nummer+namn återkommer identiskt i i stort sett alla fritt
// tillgängliga svenska kontoplansöversikter (bokföringskurser, gratis
// PDF-sammanställningar, bokföringsprogrammens egna publika
// kontoplansreferenser). Det är INTE bas.se:s fullständiga, betalda
// 1 283-kontokatalog (som även har SRU-koder, motkonton/relaterade
// konton och K2/K3-flaggor per konto) — den kräver licens från BAS-
// intressenternas Förening och har inte kopierats hit.
//
// Medvetet tunt/utelämnat i den här listan, eftersom exakt nummer+namn
// inte kunde verifieras med tillräcklig säkerhet utan den betalda källan:
// EU-handel/export-momskonton (31xx/30xx-undergrupper), avsättningar för
// pension (22xx), koncern-/intressebolagsspecifika konton utöver de mest
// grundläggande, samt de flesta branschspecifika klass 4-konton. Komplettera
// vid behov snarare än att lita blint på en gissning här.
export const DEFAULT_ACCOUNTS = [
  // ═══════════════════════════════════════════
  // KLASS 1 – TILLGÅNGAR
  // ═══════════════════════════════════════════
  { code: "1010", name: "Utvecklingsutgifter", type: "tillgang" },
  { code: "1020", name: "Koncessioner m.m.", type: "tillgang" },
  { code: "1030", name: "Patent", type: "tillgang" },
  { code: "1040", name: "Licenser", type: "tillgang" },
  { code: "1050", name: "Varumärken", type: "tillgang" },
  { code: "1070", name: "Goodwill", type: "tillgang" },
  { code: "1110", name: "Byggnader", type: "tillgang" },
  { code: "1130", name: "Mark", type: "tillgang" },
  { code: "1210", name: "Maskiner och andra tekniska anläggningar", type: "tillgang" },
  { code: "1220", name: "Inventarier och verktyg", type: "tillgang" },
  { code: "1240", name: "Bilar och andra transportmedel", type: "tillgang" },
  { code: "1250", name: "Datorer", type: "tillgang" },
  { code: "1290", name: "Övriga materiella anläggningstillgångar", type: "tillgang" },
  { code: "1310", name: "Andelar i koncernföretag", type: "tillgang" },
  { code: "1350", name: "Andra långfristiga värdepappersinnehav", type: "tillgang" },
  { code: "1410", name: "Lager av råvaror", type: "tillgang" },
  { code: "1460", name: "Handelsvaror", type: "tillgang" },
  { code: "1510", name: "Kundfordringar", type: "tillgang" },
  { code: "1580", name: "Övriga kortfristiga fordringar", type: "tillgang" },
  { code: "1630", name: "Skattekonto", type: "tillgang" },
  { code: "1650", name: "Momsfordran", type: "tillgang" },
  { code: "1680", name: "Andra kortfristiga fordringar", type: "tillgang" },
  { code: "1710", name: "Förutbetalda hyreskostnader", type: "tillgang" },
  { code: "1730", name: "Förutbetalda försäkringspremier", type: "tillgang" },
  { code: "1790", name: "Övriga förutbetalda kostnader och upplupna intäkter", type: "tillgang" },
  { code: "1910", name: "Kassa", type: "tillgang" },
  { code: "1920", name: "PlusGiro", type: "tillgang" },
  { code: "1930", name: "Företagskonto / Bank", type: "tillgang" },
  { code: "1940", name: "Placeringskonto", type: "tillgang" },

  // ═══════════════════════════════════════════
  // KLASS 2 – EGET KAPITAL & SKULDER
  // ═══════════════════════════════════════════
  { code: "2010", name: "Eget kapital", type: "skuld_kapital" },
  { code: "2013", name: "Egna uttag", type: "skuld_kapital" },
  { code: "2018", name: "Egna insättningar", type: "skuld_kapital" },
  { code: "2081", name: "Aktiekapital", type: "skuld_kapital" },
  { code: "2091", name: "Balanserad vinst eller förlust", type: "skuld_kapital" },
  { code: "2099", name: "Årets resultat", type: "skuld_kapital" },
  { code: "2150", name: "Ackumulerade överavskrivningar", type: "skuld_kapital" },
  { code: "2350", name: "Andra långfristiga skulder till kreditinstitut", type: "skuld_kapital" },
  { code: "2390", name: "Övriga långfristiga skulder", type: "skuld_kapital" },
  { code: "2440", name: "Leverantörsskulder", type: "skuld_kapital" },
  { code: "2510", name: "Skatteskulder", type: "skuld_kapital" },
  { code: "2611", name: "Utgående moms, 25%", type: "skuld_kapital" },
  { code: "2612", name: "Utgående moms, 12%", type: "skuld_kapital" },
  { code: "2613", name: "Utgående moms, 6%", type: "skuld_kapital" },
  { code: "2641", name: "Ingående moms", type: "skuld_kapital" },
  { code: "2650", name: "Redovisningskonto för moms", type: "skuld_kapital" },
  { code: "2710", name: "Personalskatt", type: "skuld_kapital" },
  { code: "2731", name: "Arbetsgivaravgifter", type: "skuld_kapital" },
  { code: "2890", name: "Övriga kortfristiga skulder", type: "skuld_kapital" },
  { code: "2910", name: "Upplupna löner", type: "skuld_kapital" },
  { code: "2920", name: "Upplupna semesterlöner", type: "skuld_kapital" },
  { code: "2940", name: "Upplupna lagstadgade sociala avgifter", type: "skuld_kapital" },
  { code: "2990", name: "Övriga upplupna kostnader och förutbetalda intäkter", type: "skuld_kapital" },

  // ═══════════════════════════════════════════
  // KLASS 3 – INTÄKTER
  // ═══════════════════════════════════════════
  { code: "3001", name: "Försäljning, 25% moms", type: "intakt" },
  { code: "3002", name: "Försäljning, 12% moms", type: "intakt" },
  { code: "3003", name: "Försäljning, 6% moms", type: "intakt" },
  { code: "3004", name: "Försäljning, momsfritt", type: "intakt" },
  { code: "3590", name: "Övriga sidointäkter", type: "intakt" },
  { code: "3740", name: "Öres- och kronutjämning", type: "intakt" },
  { code: "3910", name: "Hyres- och arrendeintäkter", type: "intakt" },
  { code: "3990", name: "Övriga rörelseintäkter", type: "intakt" },

  // ═══════════════════════════════════════════
  // KLASS 4–8 – KOSTNADER (samt finansiella poster, se filkommentaren
  // ovan — appens egen fyrfältsindelning i Accounts.jsx grupperar klass
  // 4 till 8 som en enda "kostnad"-bucket, så även ränteintäkten 8310
  // hamnar här trots att den bokföringsmässigt är en intäkt)
  // ═══════════════════════════════════════════
  { code: "4000", name: "Inköp av varor", type: "kostnad" },
  { code: "4010", name: "Inköp av material", type: "kostnad" },
  { code: "5010", name: "Lokalhyra", type: "kostnad" },
  { code: "5020", name: "El för belysning", type: "kostnad" },
  { code: "5060", name: "Städning och renhållning", type: "kostnad" },
  { code: "5090", name: "Övriga lokalkostnader", type: "kostnad" },
  { code: "5410", name: "Förbrukningsinventarier", type: "kostnad" },
  { code: "5420", name: "Programvaror", type: "kostnad" },
  { code: "5460", name: "Förbrukningsmaterial", type: "kostnad" },
  { code: "5611", name: "Personbilskostnader", type: "kostnad" },
  { code: "6110", name: "Kontorsmaterial", type: "kostnad" },
  { code: "6150", name: "Trycksaker", type: "kostnad" },
  { code: "6211", name: "Telefon", type: "kostnad" },
  { code: "6212", name: "Mobiltelefon", type: "kostnad" },
  { code: "6230", name: "Datakommunikation", type: "kostnad" },
  { code: "6250", name: "Postbefordran", type: "kostnad" },
  { code: "6310", name: "Företagsförsäkring", type: "kostnad" },
  { code: "6530", name: "Redovisningstjänster", type: "kostnad" },
  { code: "6540", name: "IT-tjänster", type: "kostnad" },
  { code: "6550", name: "Konsultarvoden", type: "kostnad" },
  { code: "6570", name: "Bankkostnader", type: "kostnad" },
  { code: "6590", name: "Övriga administrationskostnader", type: "kostnad" },
  { code: "6900", name: "Övriga externa kostnader", type: "kostnad" },
  { code: "7010", name: "Löner till anställda", type: "kostnad" },
  { code: "7210", name: "Löner till tjänstemän", type: "kostnad" },
  { code: "7290", name: "Förändring av semesterlöneskuld", type: "kostnad" },
  { code: "7510", name: "Arbetsgivaravgifter", type: "kostnad" },
  { code: "7519", name: "Sociala avgifter för semester- och löneskulder", type: "kostnad" },
  { code: "7699", name: "Övriga personalkostnader", type: "kostnad" },
  { code: "8310", name: "Ränteintäkter från omsättningstillgångar", type: "kostnad" },
  { code: "8400", name: "Räntekostnader", type: "kostnad" },
];

// Map VAT rate to the correct utgående moms account
export const VAT_ACCOUNTS = {
  25: "2611",
  12: "2612",
  6: "2613",
  0: null,
};

// Map VAT rate to the correct revenue account
export const REVENUE_ACCOUNTS = {
  25: "3001",
  12: "3002",
  6: "3003",
  0: "3004",
};
