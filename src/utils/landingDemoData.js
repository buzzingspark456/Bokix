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

  // ── Fakturor — historik hela räkenskapsåret (betalda), en förfallen och en som
  // inte förfallit än (fyller på "Att göra idag"), plus ett utkast. ──
  const invoiceSeeds = [
    { n: 8, customerId: 'demo_c2', desc: 'Webbdesign', unitPrice: 48000 },
    { n: 7, customerId: 'demo_c1', desc: 'Konsulttimmar', unitPrice: 55000 },
    { n: 6, customerId: 'demo_c1', desc: 'Konsulttimmar', unitPrice: 61000 },
    { n: 5, customerId: 'demo_c2', desc: 'Webbdesign', unitPrice: 66000 },
    { n: 4, customerId: 'demo_c1', desc: 'Konsulttimmar', unitPrice: 72000 },
    { n: 3, customerId: 'demo_c2', desc: 'Varumärkespaket', unitPrice: 79000 },
    { n: 2, customerId: 'demo_c1', desc: 'Konsulttimmar', unitPrice: 86000 },
    { n: 1, customerId: 'demo_c2', desc: 'Webbunderhåll, kvartal', unitPrice: 58000 },
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
    id: 'demo_inv_overdue', type: 'invoice', invoiceNumber: '1009', customerId: 'demo_c1',
    date: daysFromToday(-30), dueDate: daysFromToday(-6), status: 'sent', paidAmount: 0,
    ourRef: '', theirRef: '', ourOrderNr: '', internalNote: '',
    rows: [{ description: 'Konsulttimmar', qty: 1, unitPrice: 38000, vatRate: 25 }],
  });
  // Skickad, förfaller om några dagar — inte brådskande än.
  invoices.push({
    id: 'demo_inv_upcoming', type: 'invoice', invoiceNumber: '1010', customerId: 'demo_c2',
    date: daysFromToday(-3), dueDate: daysFromToday(27), status: 'sent', paidAmount: 0,
    ourRef: '', theirRef: '', ourOrderNr: '', internalNote: '',
    rows: [{ description: 'Webbdesign, fas 2', qty: 1, unitPrice: 55200, vatRate: 25 }],
  });
  // Betald, tidigare i innevarande månad. Bugkritiskt för Startsidans
  // "Intäkter vs Utgifter"-graf: månadsserierna byggs ur verifikationerna
  // (buildResultSeries), och utan en bokförd post i den PÅGÅENDE månaden
  // stod den sista stapeln tom — det såg ut som att Bokix slutat räkna,
  // inte som exempeldata som råkade sluta i förrgår. Utkastet nedan
  // bokförs aldrig och räknas alltså inte.
  invoices.push({
    id: 'demo_inv_current', type: 'invoice', invoiceNumber: '1011', customerId: 'demo_c5',
    date: daysFromToday(-5), dueDate: daysFromToday(25), status: 'paid',
    paidAmount: Math.round(58000 * 1.25), paidDate: daysFromToday(-2),
    ourRef: '', theirRef: '', ourOrderNr: '', internalNote: '',
    rows: [{ description: 'Konsulttimmar', qty: 1, unitPrice: 58000, vatRate: 25 }],
  });
  // Utkast — inte skickad, visar utkastsbadgen och att den inte bokförs.
  invoices.push({
    id: 'demo_inv_draft', type: 'invoice', invoiceNumber: '1012', customerId: 'demo_c1',
    date: daysFromToday(0), dueDate: daysFromToday(30), status: 'draft', paidAmount: 0,
    ourRef: '', theirRef: '', ourOrderNr: '', internalNote: '',
    rows: [{ description: 'Konsulttimmar, september', qty: 1, unitPrice: 60000, vatRate: 25 }],
  });

  // ── Kvitton/utgifter — historik hela räkenskapsåret (bokförda), plus ett obehandlat
  // kvitto (fyller Granskning) och en obetald leverantörsfaktura. ──
  const expenseSeeds = [
    { n: 8, desc: 'Lokalhyra', amount: 30000, account: '5010' },
    { n: 7, desc: 'Redovisningstjänst', amount: 32000, account: '6540' },
    { n: 6, desc: 'Lokalhyra', amount: 34000, account: '5010' },
    { n: 5, desc: 'Programvarulicenser', amount: 36000, account: '5420' },
    { n: 4, desc: 'Redovisningstjänst', amount: 38000, account: '6540' },
    { n: 3, desc: 'Lokalhyra', amount: 40000, account: '5010' },
    // Kontot måste finnas i seedens kontoplan (se accounts nedan, där 5910
    // läggs till) — annars faller kostnaden ur både grafen och rapporterna,
    // vilket är precis vad som hände när juli stod utan kostnadsstapel.
    { n: 2, desc: 'Annonsering', amount: 42000, account: '5910' },
    { n: 1, desc: 'Programvarulicenser', amount: 40000, account: '6212' },
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
  // Bokförd kostnad i innevarande månad, av samma skäl som fakturan ovan:
  // grafens kostnadsstapel ska inte heller vara tom för pågående månad.
  expenses.push({
    id: 'demo_exp_current', type: 'receipt', date: daysFromToday(-4),
    description: 'Lokalhyra', supplier: 'Hyresvärden Fastighets AB', amount: 45000,
    netAmount: 36000, vatAmount: 9000, vatRate: 25, costAccount: '5010',
    receiptUrl: '', receiptType: '', uploadedBy: null,
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
  // Bugkritiskt: kommentaren här hävdade tidigare att id/number tilldelas av
  // "DemoWorkspace:s handleAddVerification-motsvarighet vid seedning" — men
  // något sådant seedningssteg finns inte, DemoWorkspace skickar `seed.
  // verifications` rakt igenom oförändrad. Resultatet: varje verifikation
  // saknade `id` helt, vilket React-nyckeln i Verifications.jsx (`key={v.id}`,
  // nu ListTable.jsx: `rowKey={v => v.id}`) tyst föll tillbaka på `undefined`
  // för — exakt den klassen bugg (instabil/saknad nyckel istället för ett
  // riktigt fält) som redan flaggats för Kundlistan/Anställda-listan.
  // Sorterat kronologiskt och numrerat i samma A001-format som
  // getNextNumber('A') i Verifications.jsx genererar på riktigt.
  // ── Tidrapportering (Projekt → Tid) ────────────────────────────────
  // Kundönskemål: demon ska visa projektdelen på riktigt, inte två tomma
  // projektrader. Timmarna ligger på de två senaste veckorna (veckogrid:en
  // visar innevarande vecka) och fördelas mellan de två projekten, så både
  // veckovyn, projektens "nedlagd tid" och Rapporter-fliken har innehåll.
  // personId utelämnas medvetet — Projects.jsx tolkar det som SELF_PERSON_ID
  // ("Jag"), samma som en egen inloggad användares egna rader.
  const timeEntrySeeds = [
    [0, 'demo_p1', 4, 'Projektmöte'],
    [0, 'demo_p2', 3, 'Skisser'],
    [-1, 'demo_p1', 6, 'Möte och planering'],
    [-1, 'demo_p2', 2.5, 'Bildmaterial'],
    [-2, 'demo_p1', 7.5, 'Flyttlogistik'],
    [-3, 'demo_p2', 5, 'Designutkast'],
    [-4, 'demo_p2', 8, 'Formgivning'],
    [-5, 'demo_p1', 4, 'Avstämning med kund'],
    [-8, 'demo_p2', 7, 'Logotypvarianter'],
    [-9, 'demo_p1', 6.5, 'Offertunderlag'],
    [-10, 'demo_p2', 3.5, 'Korrektur'],
    [-11, 'demo_p1', 8, 'Projektledning'],
    [-12, 'demo_p2', 6, 'Presentation'],
  ];
  const timeEntries = timeEntrySeeds.map(([days, projectId, hours, description], i) => ({
    id: `demo_time_${i + 1}`, date: daysFromToday(days), projectId, hours, description,
  }));


  // ── Lönekörningar, bokförda ────────────────────────────────────────
  // Tre månader (företaget anställde i somras), inte en enda post: en
  // ensam lönekörning gjorde sin månad dubbelt så dyr som grannmånaderna
  // och bröt den jämnt stigande kurvan i Startsidans graf. Tre i rad läser
  // i stället som en rekrytering, och kostnaderna fortsätter växa månad
  // för månad.
  //
  // Två syften utöver kurvan: bankraden 'Lön Johanna Ek' ovan ska ha en
  // motsvarighet i bokföringen (nettot nedan är exakt bankradens belopp),
  // och Kostnadsfördelningen (ring/paj/staplar i Företagsöversikten) får
  // en Personal-kategori. Utan den fanns i princip bara 'Övriga externa
  // kostnader' och ringen blev en enfärgad cirkel.
  const payrollGross = 18000;
  const payrollTax = 3800;
  const payrollFees = Math.round(payrollGross * 0.3142);
  const payrollNet = payrollGross - payrollTax;
  for (const payDate of [monthsAgo(2, 25), monthsAgo(1, 25), daysFromToday(-4)]) {
    verifications.push({
      date: payDate,
      description: 'Lön Johanna Ek',
      source: 'payroll', sourceId: `demo_payroll_${payDate}`,
      rows: [
        { account: '7010', debet: payrollGross, kredit: 0 },
        { account: '7510', debet: payrollFees, kredit: 0 },
        { account: '2710', debet: 0, kredit: payrollTax },
        { account: '2731', debet: 0, kredit: payrollFees },
        { account: '1930', debet: 0, kredit: payrollNet },
      ],
    });
  }

  verifications.sort((a, b) => a.date.localeCompare(b.date));
  verifications.forEach((v, i) => {
    v.id = `demo_ver_${i + 1}`;
    v.number = `A${String(i + 1).padStart(3, '0')}`;
  });

  // ── Banktransaktioner (Bank-fliken) ────────────────────────────────
  // Kundönskemål: demon ska visa bankdelen också, inte bara fakturor och
  // bokföring. Ett litet kontoutdrag med alla fyra tillstånden Bank.jsx
  // känner till, så flikräknarna (Alla/Omatchade/Matchade/Bokförda) faktiskt
  // har innehåll och radexpansionen går att öppna på en riktig omatchad rad:
  //   booked    — redan bokförd, t.ex. en fakturabetalning som stämts av
  //   matched   — kopplad till en post men inte bokförd än
  //   unmatched — väntar på matchning, det är DE raderna man klickar på
  // Beloppen speglar poster som faktiskt finns i datat ovan (fakturor 1005/
  // 1006, leverantörsfakturan KM-3381, lönen), så en besökare som jämför
  // Bank mot Fakturering/Bokföring ser samma siffror på båda ställena.
  // Raderna som motsvarar fakturabetalningar HÄRLEDS ur fakturorna ovan
  // (belopp, datum, nummer, kundnamn) i stället för att skrivas av för hand:
  // en besökare som jämför Bank mot Fakturering ska se exakt samma siffror,
  // och handskrivna kopior slutar stämma i samma sekund någon justerar ett
  // fakturabelopp här ovanför.
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const bankPaid = paidInvoices.slice(-2).reverse(); // senast betalda först
  const customerName = (inv) => contacts.find(c => c.id === inv.customerId)?.name || 'Kund';
  const bankInvoiceRow = (inv, i) => ({
    id: `demo_bt_inv_${i + 1}`, date: inv.paidDate, description: customerName(inv),
    reference: `Faktura ${inv.invoiceNumber}`, amount: Math.round(inv.paidAmount), status: 'booked',
    matchedType: 'invoice', matchedId: inv.id, importBatchId: 'demo_batch_1',
  });

  const bankTransactions = [
    ...bankPaid.map(bankInvoiceRow),
   {
      id: 'demo_bt_2', date: daysFromToday(-6), description: 'Kortköp CIRCLE K',
      reference: '', amount: -890, status: 'unmatched', importBatchId: 'demo_batch_1',
    },
    {
      id: 'demo_bt_3', date: daysFromToday(-9), description: 'Kontorsmax AB',
      reference: 'KM-3381', amount: -4250, status: 'matched',
      matchedType: 'supplier_invoice', matchedId: 'demo_exp_supplier1', importBatchId: 'demo_batch_1',
    },
   {
      id: 'demo_bt_5', date: daysFromToday(-14), description: 'Stripe Payments Europe',
      reference: 'Utbetalning', amount: 24300, status: 'unmatched', importBatchId: 'demo_batch_1',
    },
    {
      id: 'demo_bt_6', date: daysFromToday(-18), description: 'Lön Johanna Ek',
      reference: 'Löneutbetalning', amount: -29800, status: 'booked', importBatchId: 'demo_batch_1',
    },
    {
      id: 'demo_bt_7', date: daysFromToday(-21), description: 'Hyresvärden Fastighets AB',
      reference: 'Lokalhyra', amount: -43000, status: 'booked', importBatchId: 'demo_batch_1',
    },
    {
      id: 'demo_bt_8', date: daysFromToday(-24), description: 'Swish inbetalning',
      reference: '', amount: 1250, status: 'ignored', importBatchId: 'demo_batch_1',
    },
  ];

  // ── Stripe-underlag för Granskning (public.stripe_ledger_events) ────
  // Kundönskemål: Stripe ska synas i Granskning i demon. Riktiga
  // ReviewQueue renderar Stripe-fliken ur den här formen (se
  // StripeLedgerCard där) — i den inloggade appen hämtas raderna från
  // Supabase, i demon skickas de in som en prop i stället (se
  // `demoStripeItems` i ReviewQueue.jsx). Tre rader = de tre fall kortet
  // faktiskt kan hantera olika:
  //   transfer med plattformsavgift → "bokför avgiften mot 6570"
  //   payout                        → "jämför mot bankkontoutdraget"
  //   charge utan matchad faktura   → "välj momssats och intäktskonto"
  const stripeLedgerEvents = [
    {
      id: 'demo_stripe_1', type: 'transfer', currency: 'sek',
      amount: 137500, platform_fee_amount: 340, matched_invoice_id: '1006',
      created_at_stripe: `${daysFromToday(-3)}T09:12:00Z`, reviewed_at: null,
    },
    {
      id: 'demo_stripe_2', type: 'payout', currency: 'sek',
      amount: 24300, platform_fee_amount: 0, matched_invoice_id: null,
      created_at_stripe: `${daysFromToday(-14)}T04:30:00Z`, reviewed_at: null,
    },
    {
      id: 'demo_stripe_3', type: 'charge', currency: 'sek',
      amount: 2490, platform_fee_amount: 0, matched_invoice_id: null,
      created_at_stripe: `${daysFromToday(-5)}T16:47:00Z`, reviewed_at: null,
    },
  ];

  // ── Offerter — egen flik i appen (Quotes.jsx), saknades helt i demon
  // trots att den finns i riktiga sidomenyn. Tre stycken i tre olika
  // lägen (skickad, accepterad, utkast) så statusfärgerna och
  // 'Skapa faktura av offert'-flödet syns.
  const quotes = [
    {
      id: 'demo_q1', type: 'quote', invoiceNumber: 'O-1003', customerId: 'demo_c6',
      date: daysFromToday(-6), dueDate: daysFromToday(24), status: 'sent',
      ourRef: '', theirRef: '', internalNote: '',
      rows: [{ description: 'Konsultuppdrag, hösten', qty: 1, unitPrice: 96000, vatRate: 25 }],
    },
    {
      id: 'demo_q2', type: 'quote', invoiceNumber: 'O-1002', customerId: 'demo_c5',
      date: daysFromToday(-19), dueDate: daysFromToday(11), status: 'accepted',
      ourRef: '', theirRef: '', internalNote: '',
      rows: [{ description: 'Webbplats, etapp 1', qty: 1, unitPrice: 64000, vatRate: 25 }],
    },
    {
      id: 'demo_q3', type: 'quote', invoiceNumber: 'O-1004', customerId: 'demo_c4',
      date: daysFromToday(-1), dueDate: daysFromToday(29), status: 'draft',
      ourRef: '', theirRef: '', internalNote: '',
      rows: [{ description: 'Löpande redovisning, kvartal', qty: 1, unitPrice: 28500, vatRate: 25 }],
    },
  ];

  // Projekten använder samma fältnamn som Projects.jsx faktiskt läser:
  // `customerId` (inte contactId — kundnamnet blev annars 'Okänd kund'),
  // `budgetHours` och `timeSpent`. timeSpent hålls i synk med
  // tidrapporterna nedan: appen räknar upp fältet när man loggar tid, så
  // ett seedat projekt måste komma med summan redan ifylld, annars visar
  // listan 0 av 0 h trots att timmarna finns.
  const projects = [
    {
      id: 'demo_p1', projectNumber: '1001', name: 'Kontorsflytt', customerId: 'demo_c1',
      status: 'active', hourlyRate: 950, budgetHours: 60, timeSpent: 0, budget: 0,
      department: '', color: '#0b6329', description: '', notes: '',
    },
    {
      id: 'demo_p2', projectNumber: '1002', name: 'Varumärkespaket', customerId: 'demo_c2',
      status: 'active', hourlyRate: 900, budgetHours: 45, timeSpent: 0, budget: 0,
      department: '', color: '#0ea5e9', description: '', notes: '',
    },
  ];
  // Håll projektens timSumma i synk med raderna ovan — samma fält appen
  // själv skriver när man loggar tid (Projects.jsx: setProjects → timeSpent).
  for (const p of projects) {
    p.timeSpent = timeEntries.filter(t => t.projectId === p.id).reduce((sum, t) => sum + t.hours, 0);
  }

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
      bankgiro: '789-0123', plusgiro: '', iban: 'SE4550000000058398257466', bic: 'SWEDSESS',
      // Satt (uppdiktat id) enbart för att Granskningens Stripe-flik ska ha
      // något att visa i demon — inget riktigt Stripe-konto anropas någonstans.
      stripeAccountId: 'acct_demo_exempel',
      emailDomain: '', resendDomainId: '', emailDomainStatus: '', emailDomainRecords: [],
      defaultVat: 25, fiscalYear: `${YEAR}-01-01`, vatPeriod: 'quarterly', chartPlan: 'bas2025',
    },
    // Standardkontoplanen plus ett annonseringskonto (5910). Kontot finns
    // inte i DEFAULT_ACCOUNTS, men i BAS — och en riktig användare lägger
    // själv till konton hen behöver. Det ger Kostnadsfördelningen en
    // Marknadsföring-kategori (5900–5999) att visa vid sidan av Lokal,
    // Personal och Övriga externa kostnader.
    accounts: [...DEFAULT_ACCOUNTS.map(a => ({ ...a })), { code: '5910', name: 'Annonsering', type: 'kostnad' }],
    verifications,
    invoices,
    expenses,
    contacts,
    projects,
    quotes,
    timeEntries,
    bankTransactions,
    stripeLedgerEvents,
    employees,
    payrollRuns: [],
    vatPeriods: {},
    // Granskningens Historik-flik — tre redan hanterade poster, så fliken
    // visar hur den ser ut när man faktiskt jobbat i kön (och att appen
    // sparar VEM som konterade vad, inte bara att det blev gjort).
    reviewHistory: [
      {
        id: 'demo_rh_1', title: 'Kvitto Circle K', amount: 645, account: '5611',
        accountName: 'Drivmedel personbilar', resolvedBy: 'Du', resolvedAt: `${daysFromToday(-6)}T08:41:00Z`,
        method: 'suggestion',
      },
      {
        id: 'demo_rh_2', title: 'Kvitto Kontorsmax AB', amount: 1890, account: '6110',
        accountName: 'Kontorsmaterial', resolvedBy: 'Du', resolvedAt: `${daysFromToday(-13)}T15:02:00Z`,
        method: 'manual',
      },
      {
        id: 'demo_rh_3', title: 'Kvitto Circle K tankning', amount: 1245, account: '5611',
        accountName: 'Personbilskostnader', resolvedBy: 'Du', resolvedAt: `${daysFromToday(-20)}T11:18:00Z`,
        method: 'bulk',
      },
    ],
    verificationTemplates: [],
  };
}
