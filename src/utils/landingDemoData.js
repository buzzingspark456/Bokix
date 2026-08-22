// ── Landningssidans "Så ser det ut"-sektion (LandingPage.jsx → DemoWorkspace.jsx)
// matar de FAKTISKA komponenterna (Dashboard, Invoices, Contacts, Expenses,
// Projects, ReviewQueue, Verifications, Payroll, Taxes, Reports — samma
// komponenter inloggade användare ser) med det här datasetet, istället för
// att efterlikna dem i egen handskriven JSX. Kan aldrig tyst bli inaktuellt
// mot en framtida ändring i de riktiga komponenterna, eftersom det bokstavligen
// är samma komponenter.
//
// `createDemoSeed()` är en FABRIK (inte ett statiskt objekt) — DemoWorkspace
// anropar den en gång vid mount och lägger resultatet i lokalt React-state.
// Allt som händer i demon (skapa faktura, betala kvitto, bokföra lön, …)
// muterar bara det lokala state:et, exakt samma mönster som App.jsx:s
// handlers använder mot sitt "riktiga" state — ingen Supabase, ingen
// backend, återställs så fort sidan laddas om.
//
// Datat är internt konsekvent (fakturor/kvitton bokförs med exakt samma
// formel som App.jsx:s handleAddInvoice/handleAddExpense använder, se
// bookInvoice/bookExpense nedan) men uttryckligen exempeldata, aldrig
// påstått vara en riktig kunds bokföring — "Exempeldata"-badgen i
// DemoWorkspace.jsx gör det tydligt.

import { DEFAULT_ACCOUNTS, VAT_ACCOUNTS, REVENUE_ACCOUNTS } from '../components/AccountsData';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthsAgo = (n, day = 15) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setDate(Math.min(day, 28));
  return iso(d);
};
const daysFromToday = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

// ── Bokföringshjälpare — exakt samma formel som App.jsx:s handleAddInvoice/
// handleAddExpense (se App.jsx). Exporteras så DemoWorkspace.jsx kan
// återanvända EXAKT samma formel både för startdatat här och för en riktig
// ny faktura/kvitto som skapas live i demon — en enda plats att hålla
// bokföringslogiken i synk med App.jsx:s originalversion. ──
export function bookInvoice(inv) {
  let totalNet = 0;
  const vatByRate = {};
  inv.rows.forEach(r => {
    const lineNet = r.qty * r.unitPrice;
    const lineVat = lineNet * (r.vatRate / 100);
    totalNet += lineNet;
    vatByRate[r.vatRate] = (vatByRate[r.vatRate] || 0) + lineVat;
  });
  const totalGross = totalNet + Object.values(vatByRate).reduce((s, v) => s + v, 0);
  const rows = [{ account: '1510', debet: Math.round(totalGross), kredit: 0 }];
  inv.rows.forEach(r => {
    const lineNet = r.qty * r.unitPrice;
    const revAcc = REVENUE_ACCOUNTS[r.vatRate] || '3001';
    const existing = rows.find(x => x.account === revAcc && x.kredit > 0);
    if (existing) existing.kredit += Math.round(lineNet);
    else rows.push({ account: revAcc, debet: 0, kredit: Math.round(lineNet) });
  });
  Object.entries(vatByRate).forEach(([rate, amount]) => {
    const vatAcc = VAT_ACCOUNTS[parseInt(rate, 10)];
    if (vatAcc && amount > 0) rows.push({ account: vatAcc, debet: 0, kredit: Math.round(amount) });
  });
  return { date: inv.date, description: `Faktura ${inv.invoiceNumber}`, source: 'invoice', sourceId: inv.id, rows };
}

function bookInvoicePayment(inv) {
  const amount = Math.round(inv.paidAmount);
  return {
    date: inv.paidDate,
    description: `Betalning faktura ${inv.invoiceNumber}`,
    source: 'invoice_payment',
    sourceId: inv.id,
    rows: [
      { account: '1930', debet: amount, kredit: 0 },
      { account: '1510', debet: 0, kredit: amount },
    ],
  };
}

export function bookExpense(exp) {
  const rows = [{ account: exp.costAccount, debet: Math.round(exp.netAmount), kredit: 0 }];
  if (exp.vatAmount > 0) rows.push({ account: '2641', debet: Math.round(exp.vatAmount), kredit: 0 });
  rows.push({ account: '1930', debet: 0, kredit: Math.round(exp.amount) });
  return { date: exp.date, description: exp.description, source: 'expense', sourceId: exp.id, rows };
}

export function createDemoSeed() {
  const YEAR = new Date().getFullYear();

  const contacts = [
    {
      id: 'demo_c1', type: 'customer', customerType: 'se_company', name: 'Almbring Bygg AB',
      customerNumber: '1001', contactPerson: 'Erik Almbring', email: 'erik@almbringbygg.se',
      phone: '070-123 45 67', address: 'Kungsgatan 12', postalCode: '111 22', city: 'Stockholm',
      country: 'Sverige', orgNr: '556234-5678', vatNumber: '', paymentTerms: 30, invoiceLanguage: 'sv',
      notes: '', active: true,
    },
    {
      id: 'demo_c2', type: 'customer', customerType: 'se_company', name: 'Sjöstrand Design',
      customerNumber: '1002', contactPerson: 'Maria Sjöstrand', email: 'maria@sjostranddesign.se',
      phone: '073-987 65 43', address: 'Vasagatan 4', postalCode: '411 24', city: 'Göteborg',
      country: 'Sverige', orgNr: '556890-1234', vatNumber: '', paymentTerms: 30, invoiceLanguage: 'sv',
      notes: '', active: true,
    },
    // demo_c4–c6: kundlistan hade bara 2 kunder mot fakturerings-/utgifts-
    // sidornas 6+ rader — kundfeedback: gjorde bara Kunder-sidan (och bara
    // den) se konstigt tom ut, en liten tabell som flöt i ett stort tomt
    // sidbakgrunds-område. Ingen egen CSS-bugg (samma flex:1-mönster som
    // alla andra sidor, se Contacts.jsx) — bara för lite exempeldata.
    // Refereras inte av några fakturor/kvitton/projekt, så de påverkar
    // aldrig Startsidans belopp, bara gör kundlistan lika fylld som
    // resten av demot.
    {
      id: 'demo_c4', type: 'customer', customerType: 'se_company', name: 'Norrqvist Redovisning AB',
      customerNumber: '1003', contactPerson: 'Johan Norrqvist', email: 'johan@norrqvistredovisning.se',
      phone: '070-234 56 78', address: 'Drottninggatan 22', postalCode: '702 10', city: 'Örebro',
      country: 'Sverige', orgNr: '556112-3344', vatNumber: '', paymentTerms: 30, invoiceLanguage: 'sv',
      notes: '', active: true,
    },
    {
      id: 'demo_c5', type: 'customer', customerType: 'se_company', name: 'Lindgren Fastigheter AB',
      customerNumber: '1004', contactPerson: 'Anna Lindgren', email: 'anna@lindgrenfastigheter.se',
      phone: '072-345 67 89', address: 'Storgatan 15', postalCode: '211 34', city: 'Malmö',
      country: 'Sverige', orgNr: '556778-9012', vatNumber: '', paymentTerms: 20, invoiceLanguage: 'sv',
      notes: '', active: true,
    },
    {
      id: 'demo_c6', type: 'customer', customerType: 'se_company', name: 'Ekström Konsult AB',
      customerNumber: '1005', contactPerson: 'Peter Ekström', email: 'peter@ekstromkonsult.se',
      phone: '076-456 78 90', address: 'Karlavägen 6', postalCode: '114 31', city: 'Stockholm',
      country: 'Sverige', orgNr: '556334-5566', vatNumber: '', paymentTerms: 30, invoiceLanguage: 'sv',
      notes: '', active: true,
    },
    {
      id: 'demo_c3', type: 'supplier', supplierType: 'se_company', name: 'Kontorsmax AB',
      contactPerson: 'Kundtjänst', email: 'faktura@kontorsmax.se', phone: '08-555 12 34',
      address: 'Industrivägen 8', postalCode: '171 48', city: 'Solna', country: 'Sverige',
      orgNr: '556456-7890', vatNumber: '',
      bankgiro: '123-4567', plusgiro: '', clearingNumber: '', accountNumber: '', iban: '', swift: '',
      showMorePayment: false, defaultAccount: '6110', defaultCurrency: 'SEK', notes: '', active: true,
    },
    {
      id: 'demo_c7', type: 'supplier', supplierType: 'se_company', name: 'Nordisk Kontorsservice AB',
      contactPerson: 'Kundtjänst', email: 'faktura@nordiskkontorsservice.se', phone: '08-444 21 09',
      address: 'Lagervägen 3', postalCode: '162 29', city: 'Vällingby', country: 'Sverige',
      orgNr: '556223-4455', vatNumber: '',
      bankgiro: '234-5678', plusgiro: '', clearingNumber: '', accountNumber: '', iban: '', swift: '',
      showMorePayment: false, defaultAccount: '6110', defaultCurrency: 'SEK', notes: '', active: true,
    },
  ];

  // ── Fakturor — 6 månaders historik (betalda), en förfallen och en som
  // inte förfallit än (fyller på "Att göra idag"), plus ett utkast. ──
  const invoiceSeeds = [
    { n: 6, customerId: 'demo_c1', desc: 'Konsulttimmar', unitPrice: 74000 },
    { n: 5, customerId: 'demo_c2', desc: 'Webbdesign', unitPrice: 64800 },
    { n: 4, customerId: 'demo_c1', desc: 'Konsulttimmar', unitPrice: 81000 },
    { n: 3, customerId: 'demo_c2', desc: 'Varumärkespaket', unitPrice: 70400 },
    { n: 2, customerId: 'demo_c1', desc: 'Konsulttimmar', unitPrice: 92000 },
    { n: 1, customerId: 'demo_c2', desc: 'Webbunderhåll, kvartal', unitPrice: 88000 },
  ];
  const invoices = invoiceSeeds.map((s, i) => {
    const date = monthsAgo(s.n);
    return {
      id: `demo_inv_${i + 1}`,
      type: 'invoice',
      invoiceNumber: String(1001 + i),
      customerId: s.customerId,
      date,
      dueDate: daysFromToday(-(s.n * 30 - 30)),
      status: 'paid',
      paidAmount: Math.round(s.unitPrice * 1.25),
      paidDate: daysFromToday(-(s.n * 30 - 35)),
      ourRef: '', theirRef: '', ourOrderNr: '', internalNote: '',
      rows: [{ description: s.desc, qty: 1, unitPrice: s.unitPrice, vatRate: 25 }],
    };
  });
  // Förfallen — visar den röda "förfallit"-flaggan i Dashboard/Fakturering på riktigt.
  invoices.push({
    id: 'demo_inv_overdue', type: 'invoice', invoiceNumber: '1007', customerId: 'demo_c1',
    date: daysFromToday(-36), dueDate: daysFromToday(-6), status: 'sent', paidAmount: 0,
    ourRef: '', theirRef: '', ourOrderNr: '', internalNote: '',
    rows: [{ description: 'Konsulttimmar', qty: 1, unitPrice: 46400, vatRate: 25 }],
  });
  // Skickad, förfaller om några dagar — inte brådskande än.
  invoices.push({
    id: 'demo_inv_upcoming', type: 'invoice', invoiceNumber: '1008', customerId: 'demo_c2',
    date: daysFromToday(-9), dueDate: daysFromToday(21), status: 'sent', paidAmount: 0,
    ourRef: '', theirRef: '', ourOrderNr: '', internalNote: '',
    rows: [{ description: 'Webbdesign, fas 2', qty: 1, unitPrice: 55200, vatRate: 25 }],
  });
  // Utkast — inte skickad, visar utkastsbadgen och att den inte bokförs.
  invoices.push({
    id: 'demo_inv_draft', type: 'invoice', invoiceNumber: '1009', customerId: 'demo_c1',
    date: daysFromToday(0), dueDate: daysFromToday(30), status: 'draft', paidAmount: 0,
    ourRef: '', theirRef: '', ourOrderNr: '', internalNote: '',
    rows: [{ description: 'Konsulttimmar, september', qty: 1, unitPrice: 60000, vatRate: 25 }],
  });

  // ── Kvitton/utgifter — 6 månaders historik (bokförda), plus ett obehandlat
  // kvitto (fyller Granskning) och en obetald leverantörsfaktura. ──
  const expenseSeeds = [
    { n: 6, desc: 'Kontorshyra', amount: 41000, account: '6110' },
    { n: 5, desc: 'Programvarulicenser', amount: 52000, account: '6212' },
    { n: 4, desc: 'Redovisningstjänst', amount: 47000, account: '6540' },
    { n: 3, desc: 'Kontorshyra', amount: 61000, account: '6110' },
    { n: 2, desc: 'Marknadsföring', amount: 55000, account: '5910' },
    { n: 1, desc: 'Programvarulicenser', amount: 49000, account: '6212' },
  ];
  const expenses = expenseSeeds.map((s, i) => {
    const vatAmount = Math.round(s.amount * 0.2);
    return {
      id: `demo_exp_${i + 1}`, type: 'receipt', date: monthsAgo(s.n),
      description: s.desc, supplier: s.desc, amount: s.amount,
      netAmount: s.amount - vatAmount, vatAmount, vatRate: 25, costAccount: s.account,
      receiptUrl: '', receiptType: '', uploadedBy: null,
    };
  });
  // Obehandlat — inget konto valt än, dyker upp i Granskning.
  expenses.push({
    id: 'demo_exp_unhandled', type: 'receipt', date: daysFromToday(-2),
    description: '', supplier: 'Circle K', amount: 890, netAmount: 712, vatAmount: 178, vatRate: 25,
    costAccount: '', receiptUrl: '', receiptType: '', uploadedBy: null,
  });
  // Obetald leverantörsfaktura — bokförd (skuld mot 2440), inte reglerad än.
  expenses.push({
    id: 'demo_exp_supplier1', type: 'supplier_invoice', invoiceNumber: 'KM-3381',
    date: daysFromToday(-11), dueDate: daysFromToday(19), description: 'Kontorsmaterial',
    supplier: 'Kontorsmax AB', supplierId: 'demo_c3', status: 'unpaid',
    amount: 4250, netAmount: 3400, vatAmount: 850, vatRate: 25, costAccount: '6110',
  });

  const verifications = [
    ...invoices.filter(i => i.type === 'invoice' && i.status !== 'draft').map(bookInvoice),
    ...invoices.filter(i => i.status === 'paid').map(bookInvoicePayment),
    ...expenses.filter(e => e.type === 'receipt' && e.costAccount).map(bookExpense),
  ];
  // Leverantörsfaktura bokas separat (skuld, inte direkt kostnad+bank).
  const supplierInv = expenses.find(e => e.id === 'demo_exp_supplier1');
  if (supplierInv) {
    verifications.push({
      date: supplierInv.date, description: `Leverantörsfaktura ${supplierInv.invoiceNumber}`,
      source: 'supplier_invoice', sourceId: supplierInv.id,
      rows: [
        { account: supplierInv.costAccount, debet: Math.round(supplierInv.netAmount), kredit: 0 },
        { account: '2641', debet: Math.round(supplierInv.vatAmount), kredit: 0 },
        { account: '2440', debet: 0, kredit: Math.round(supplierInv.amount) },
      ],
    });
  }
  // id/number tilldelas av DemoWorkspace:s handleAddVerification-motsvarighet
  // vid seedning (samma mönster som App.jsx), inte hårdkodat här.

  const projects = [
    { id: 'demo_p1', name: 'Kontorsflytt', contactId: 'demo_c1', status: 'active', hourlyRate: 950, budget: 0, notes: '' },
    { id: 'demo_p2', name: 'Varumärkespaket', contactId: 'demo_c2', status: 'active', hourlyRate: 900, budget: 0, notes: '' },
  ];

  const employees = [
    {
      id: 'demo_e1', firstName: 'Johanna', lastName: 'Ek', ssn: '199003011234',
      email: 'johanna@nordstromkonsult.se', phone: '070-234 56 78',
      address: 'Ringvägen 2', postalCode: '118 26', city: 'Stockholm',
      employmentType: 'anstalld', startDate: monthsAgo(18, 1), endDate: '',
      employmentRate: 100, hoursPerWeek: 40, daysPerWeek: 5,
      salaryForm: 'manadslon', monthlySalary: '38500', hourlyRate: '',
      taxForm: 'a_skatt', secondaryIncome: false,
      municipality: 'Stockholm', taxTableMode: 'manual', taxTable: { tabellnr: '33', kolumn: 1, year: YEAR },
      vacationRule: 'procentregeln', vacationDays: 25,
      costCenter: '', projectId: '',
      // Strukturellt giltiga (mod-97) men uppdiktade — se company.iban ovan.
      clearingNumber: '8398', accountNumber: '2574667', iban: 'SE1850000000058398257467', bic: 'HANDSESS', active: true,
    },
    {
      id: 'demo_e2', firstName: 'Oskar', lastName: 'Lind', ssn: '198711052345',
      email: 'oskar@nordstromkonsult.se', phone: '073-345 67 89',
      address: 'Bergsgatan 9', postalCode: '112 23', city: 'Stockholm',
      employmentType: 'anstalld', startDate: monthsAgo(30, 1), endDate: '',
      employmentRate: 100, hoursPerWeek: 40, daysPerWeek: 5,
      salaryForm: 'manadslon', monthlySalary: '42000', hourlyRate: '',
      taxForm: 'a_skatt', secondaryIncome: false,
      municipality: 'Stockholm', taxTableMode: 'manual', taxTable: { tabellnr: '33', kolumn: 1, year: YEAR },
      vacationRule: 'procentregeln', vacationDays: 25,
      costCenter: '', projectId: '',
      clearingNumber: '8398', accountNumber: '2574668', iban: 'SE8850000000058398257468', bic: 'NDEASESS', active: true,
    },
  ];

  return {
    company: {
      id: 'demo_company', name: 'Exempel AB', orgNr: '556677-8899', vatNr: 'SE556677889901',
      address: 'Storgatan 12', postalCode: '111 51', city: 'Stockholm', email: 'info@exempel.se',
      phone: '08-123 456 78', logoUrl: '', fSkatt: 'Innehar F-skattsedel',
      // Strukturellt giltig (mod-97-kontrollerad) men uppdiktad IBAN/BIC —
      // gör att lönekörningens "Ladda ner betalfil" (ISO 20022) faktiskt
      // går att testa i demon utan att fastna på "IBAN saknas".
      bankgiro: '789-0123', plusgiro: '', iban: 'SE4550000000058398257466', bic: 'SWEDSESS', stripeAccountId: '',
      emailDomain: '', resendDomainId: '', emailDomainStatus: '', emailDomainRecords: [],
      defaultVat: 25, fiscalYear: `${YEAR}-01-01`, vatPeriod: 'quarterly', chartPlan: 'bas2025',
    },
    accounts: DEFAULT_ACCOUNTS.map(a => ({ ...a })),
    verifications,
    invoices,
    expenses,
    contacts,
    projects,
    timeEntries: [],
    employees,
    payrollRuns: [],
    vatPeriods: {},
    reviewHistory: [],
    verificationTemplates: [],
  };
}
