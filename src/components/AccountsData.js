// BAS 2023 – Standardkontoplan för svenska företag
// ~34 vanliga konton som täcker de mest förekommande affärshändelserna

export const DEFAULT_ACCOUNTS = [
  // ═══════════════════════════════════════════
  // KLASS 1 – TILLGÅNGAR
  // ═══════════════════════════════════════════
  { code: "1010", name: "Utvecklingsutgifter", type: "tillgang" },
  { code: "1220", name: "Inventarier och verktyg", type: "tillgang" },
  { code: "1510", name: "Kundfordringar", type: "tillgang" },
  { code: "1580", name: "Övriga kortfristiga fordringar", type: "tillgang" },
  { code: "1630", name: "Skattekonto", type: "tillgang" },
  { code: "1910", name: "Kassa", type: "tillgang" },
  { code: "1930", name: "Företagskonto / Bank", type: "tillgang" },
  { code: "1940", name: "Placeringskonto", type: "tillgang" },

  // ═══════════════════════════════════════════
  // KLASS 2 – EGET KAPITAL & SKULDER
  // ═══════════════════════════════════════════
  { code: "2010", name: "Eget kapital", type: "skuld_kapital" },
  { code: "2013", name: "Egna uttag", type: "skuld_kapital" },
  { code: "2018", name: "Egna insättningar", type: "skuld_kapital" },
  { code: "2099", name: "Årets resultat", type: "skuld_kapital" },
  { code: "2440", name: "Leverantörsskulder", type: "skuld_kapital" },
  { code: "2510", name: "Skatteskulder", type: "skuld_kapital" },
  { code: "2611", name: "Utgående moms, 25%", type: "skuld_kapital" },
  { code: "2612", name: "Utgående moms, 12%", type: "skuld_kapital" },
  { code: "2613", name: "Utgående moms, 6%", type: "skuld_kapital" },
  { code: "2641", name: "Ingående moms", type: "skuld_kapital" },
  { code: "2650", name: "Redovisningskonto för moms", type: "skuld_kapital" },
  { code: "2710", name: "Personalskatt", type: "skuld_kapital" },
  { code: "2731", name: "Arbetsgivaravgifter", type: "skuld_kapital" },
  { code: "2920", name: "Upplupna semesterlöner", type: "skuld_kapital" },
  { code: "2940", name: "Upplupna lagstadgade sociala avgifter", type: "skuld_kapital" },

  // ═══════════════════════════════════════════
  // KLASS 3 – INTÄKTER
  // ═══════════════════════════════════════════
  { code: "3001", name: "Försäljning, 25% moms", type: "intakt" },
  { code: "3002", name: "Försäljning, 12% moms", type: "intakt" },
  { code: "3003", name: "Försäljning, 6% moms", type: "intakt" },
  { code: "3004", name: "Försäljning, momsfritt", type: "intakt" },
  { code: "3590", name: "Övriga sidointäkter", type: "intakt" },
  { code: "3740", name: "Öres- och kronutjämning", type: "intakt" },

  // ═══════════════════════════════════════════
  // KLASS 4–7 – KOSTNADER
  // ═══════════════════════════════════════════
  { code: "4000", name: "Inköp av varor", type: "kostnad" },
  { code: "4010", name: "Inköp av material", type: "kostnad" },
  { code: "5010", name: "Lokalhyra", type: "kostnad" },
  { code: "5410", name: "Förbrukningsinventarier", type: "kostnad" },
  { code: "5460", name: "Förbrukningsmaterial", type: "kostnad" },
  { code: "6110", name: "Kontorsmaterial", type: "kostnad" },
  { code: "6212", name: "Mobiltelefon", type: "kostnad" },
  { code: "6310", name: "Företagsförsäkring", type: "kostnad" },
  { code: "6570", name: "Bankkostnader", type: "kostnad" },
  { code: "6900", name: "Övriga externa kostnader", type: "kostnad" },
  { code: "7010", name: "Löner till anställda", type: "kostnad" },
  { code: "7210", name: "Löner till tjänstemän", type: "kostnad" },
  { code: "7290", name: "Förändring av semesterlöneskuld", type: "kostnad" },
  { code: "7510", name: "Arbetsgivaravgifter", type: "kostnad" },
  { code: "7519", name: "Sociala avgifter för semester- och löneskulder", type: "kostnad" },
  { code: "7699", name: "Övriga personalkostnader", type: "kostnad" },
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
