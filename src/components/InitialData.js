// Demo data – 6 months of transactions, invoices, expenses, contacts

export const DEMO_COMPANY = {
  id: "company_1",
  name: "Nordström Konsult AB",
  orgNr: "559123-4567",
  vatNr: "SE559123456701",
  address: "Storgatan 15, 111 23 Stockholm",
  email: "info@nordstromkonsult.se",
  phone: "08-123 456 78",
  fSkatt: "Innehar F-skattsedel",
  bankgiro: "123-4567",
  plusgiro: "",
  iban: "SE45 5000 0000 0581 6170 0149",
  bic: "ESSESESS",
  defaultVat: 25,
  fiscalYear: "2026-01-01",
};

export const INITIAL_CONTACTS = [
  {
    id: "cust_1",
    type: "customer",
    customerNumber: "1001",
    name: "TechStar AB",
    orgNr: "556789-0123",
    vatNr: "SE556789012301",
    address: "Vasagatan 10, 111 20 Stockholm",
    email: "fakturor@techstar.se",
    phone: "08-765 432 10",
  },
  {
    id: "cust_2",
    type: "customer",
    customerNumber: "1002",
    name: "GreenLeaf Sweden AB",
    orgNr: "559876-5432",
    vatNr: "SE559876543201",
    address: "Kungsgatan 44, 411 15 Göteborg",
    email: "ekonomi@greenleaf.se",
    phone: "031-111 222 33",
  },
  {
    id: "cust_3",
    type: "customer",
    customerNumber: "1003",
    name: "Anna Bergström Enskild Firma",
    orgNr: "830101-1234",
    vatNr: "",
    address: "Björkvägen 7, 752 36 Uppsala",
    email: "anna@bergstrom.se",
    phone: "070-123 45 67",
  },
  {
    id: "sup_1",
    type: "supplier",
    name: "OfficeDepot Sverige AB",
    orgNr: "556012-3456",
    vatNr: "SE556012345601",
    address: "Industrivägen 22, 171 48 Solna",
    email: "order@officedepot.se",
    phone: "08-550 123 00",
  },
  {
    id: "sup_2",
    type: "supplier",
    name: "Fastighets AB Storgatan",
    orgNr: "556234-5678",
    vatNr: "SE556234567801",
    address: "Storgatan 15, 111 23 Stockholm",
    email: "hyra@fastighetsstorgatan.se",
    phone: "08-333 444 55",
  },
  {
    id: "sup_3",
    type: "supplier",
    name: "Telia Sverige AB",
    orgNr: "556430-0142",
    vatNr: "SE556430014201",
    address: "Stureplan 8, 103 60 Stockholm",
    email: "faktura@telia.se",
    phone: "020-755 755",
  },
];

export const INITIAL_INVOICES = [
  {
    id: "inv_1",
    invoiceNumber: "1001",
    customerId: "cust_1",
    date: "2026-01-10",
    deliveryDate: "2026-01-10",
    dueDate: "2026-02-09",
    ocr: "3046123456",
    currency: "SEK",
    status: "paid",
    paidDate: "2026-02-05",
    rows: [
      { description: "Konsulttjänster januari", qty: 40, unitPrice: 950, vatRate: 25 },
    ],
  },
  {
    id: "inv_2",
    invoiceNumber: "1002",
    customerId: "cust_2",
    date: "2026-02-15",
    deliveryDate: "2026-02-20",
    dueDate: "2026-03-17",
    ocr: "3046123457",
    currency: "SEK",
    status: "paid",
    paidDate: "2026-03-10",
    rows: [
      { description: "Webbdesign projekt", qty: 1, unitPrice: 25000, vatRate: 25 },
      { description: "Hosting 3 månader", qty: 3, unitPrice: 500, vatRate: 25 },
    ],
  },
  {
    id: "inv_3",
    invoiceNumber: "1003",
    customerId: "cust_1",
    date: "2026-03-20",
    deliveryDate: "2026-03-20",
    dueDate: "2026-04-19",
    ocr: "3046123458",
    currency: "SEK",
    status: "paid",
    paidDate: "2026-04-15",
    rows: [
      { description: "Konsulttjänster mars", qty: 60, unitPrice: 950, vatRate: 25 },
    ],
  },
  {
    id: "inv_4",
    invoiceNumber: "1004",
    customerId: "cust_3",
    date: "2026-04-05",
    deliveryDate: "2026-04-06",
    dueDate: "2026-05-05",
    ocr: "3046123459",
    currency: "SEK",
    status: "paid",
    paidDate: "2026-05-02",
    rows: [
      { description: "Logotyp design", qty: 1, unitPrice: 8000, vatRate: 25 },
    ],
  },
  {
    id: "inv_5",
    invoiceNumber: "1005",
    customerId: "cust_2",
    date: "2026-05-12",
    deliveryDate: "2026-05-15",
    dueDate: "2026-06-11",
    ocr: "3046123460",
    currency: "SEK",
    status: "paid",
    paidDate: "2026-06-08",
    rows: [
      { description: "SEO-optimering", qty: 1, unitPrice: 15000, vatRate: 25 },
      { description: "Innehållsproduktion", qty: 5, unitPrice: 2000, vatRate: 25 },
    ],
  },
  {
    id: "inv_6",
    invoiceNumber: "1006",
    customerId: "cust_1",
    date: "2026-06-01",
    deliveryDate: "2026-06-01",
    dueDate: "2026-07-01",
    ocr: "3046123461",
    currency: "SEK",
    status: "sent",
    paidDate: null,
    rows: [
      { description: "Konsulttjänster juni", qty: 80, unitPrice: 950, vatRate: 25 },
    ],
  },
  {
    id: "inv_7",
    invoiceNumber: "1007",
    customerId: "cust_3",
    date: "2026-06-20",
    deliveryDate: "2026-06-20",
    dueDate: "2026-07-20",
    ocr: "3046123462",
    currency: "SEK",
    status: "draft",
    paidDate: null,
    rows: [
      { description: "Visitkort design", qty: 1, unitPrice: 3500, vatRate: 25 },
      { description: "Brevpapper design", qty: 1, unitPrice: 2500, vatRate: 25 },
    ],
  },
];

export const INITIAL_EXPENSES = [
  { id: "exp_1", date: "2026-01-28", description: "Lokalhyra januari", amount: 6250, netAmount: 5000, vatAmount: 1250, vatRate: 25, costAccount: "5010", supplierId: "sup_2" },
  { id: "exp_2", date: "2026-01-30", description: "Kontorsmaterial", amount: 1875, netAmount: 1500, vatAmount: 375, vatRate: 25, costAccount: "6110", supplierId: "sup_1" },
  { id: "exp_3", date: "2026-02-25", description: "Lokalhyra februari", amount: 6250, netAmount: 5000, vatAmount: 1250, vatRate: 25, costAccount: "5010", supplierId: "sup_2" },
  { id: "exp_4", date: "2026-02-28", description: "Mobilabonnemang feb", amount: 499, netAmount: 399.20, vatAmount: 99.80, vatRate: 25, costAccount: "6212", supplierId: "sup_3" },
  { id: "exp_5", date: "2026-03-25", description: "Lokalhyra mars", amount: 6250, netAmount: 5000, vatAmount: 1250, vatRate: 25, costAccount: "5010", supplierId: "sup_2" },
  { id: "exp_6", date: "2026-03-31", description: "Företagsförsäkring Q1", amount: 3750, netAmount: 3000, vatAmount: 750, vatRate: 25, costAccount: "6310", supplierId: null },
  { id: "exp_7", date: "2026-04-25", description: "Lokalhyra april", amount: 6250, netAmount: 5000, vatAmount: 1250, vatRate: 25, costAccount: "5010", supplierId: "sup_2" },
  { id: "exp_8", date: "2026-04-30", description: "Mobilabonnemang apr", amount: 499, netAmount: 399.20, vatAmount: 99.80, vatRate: 25, costAccount: "6212", supplierId: "sup_3" },
  { id: "exp_9", date: "2026-05-25", description: "Lokalhyra maj", amount: 6250, netAmount: 5000, vatAmount: 1250, vatRate: 25, costAccount: "5010", supplierId: "sup_2" },
  { id: "exp_10", date: "2026-05-28", description: "Nytt tangentbord + mus", amount: 1499, netAmount: 1199.20, vatAmount: 299.80, vatRate: 25, costAccount: "5410", supplierId: "sup_1" },
  { id: "exp_11", date: "2026-06-25", description: "Lokalhyra juni", amount: 6250, netAmount: 5000, vatAmount: 1250, vatRate: 25, costAccount: "5010", supplierId: "sup_2" },
  { id: "exp_12", date: "2026-06-30", description: "Bankkostnader Q2", amount: 300, netAmount: 300, vatAmount: 0, vatRate: 0, costAccount: "6570", supplierId: null },
];

// Helper to generate verifications from invoices and expenses
export function generateVerificationsFromData(invoices, expenses) {
  const verifications = [];
  let vNum = 1;

  // V1: Opening capital
  verifications.push({
    id: Date.now() + vNum,
    number: `V${vNum}`,
    date: "2026-01-02",
    description: "Ägarens insättning (startkapital)",
    source: "manual",
    rows: [
      { account: "1930", debet: 100000, kredit: 0 },
      { account: "2018", debet: 0, kredit: 100000 },
    ],
  });
  vNum++;

  // Generate invoice verifications
  invoices.forEach((inv) => {
    // Calculate totals
    let totalNet = 0;
    let totalVat = 0;
    inv.rows.forEach((r) => {
      const lineNet = r.qty * r.unitPrice;
      const lineVat = lineNet * (r.vatRate / 100);
      totalNet += lineNet;
      totalVat += lineVat;
    });
    const totalGross = totalNet + totalVat;

    // Determine VAT account
    const vatRate = inv.rows[0]?.vatRate || 25;
    const vatAccount = vatRate === 25 ? "2611" : vatRate === 12 ? "2612" : vatRate === 6 ? "2613" : null;
    const revenueAccount = vatRate === 25 ? "3001" : vatRate === 12 ? "3002" : vatRate === 6 ? "3003" : "3004";

    // Invoice booking: Debet 1510, Kredit 3001 + Kredit 2611
    const invoiceRows = [
      { account: "1510", debet: Math.round(totalGross), kredit: 0 },
      { account: revenueAccount, debet: 0, kredit: Math.round(totalNet) },
    ];
    if (vatAccount && totalVat > 0) {
      invoiceRows.push({ account: vatAccount, debet: 0, kredit: Math.round(totalVat) });
    }

    verifications.push({
      id: Date.now() + vNum,
      number: `V${vNum}`,
      date: inv.date,
      description: `Faktura ${inv.invoiceNumber}`,
      source: "invoice",
      sourceId: inv.id,
      rows: invoiceRows,
    });
    vNum++;

    // Payment booking if paid: Debet 1930, Kredit 1510
    if (inv.status === "paid" && inv.paidDate) {
      verifications.push({
        id: Date.now() + vNum,
        number: `V${vNum}`,
        date: inv.paidDate,
        description: `Betalning faktura ${inv.invoiceNumber}`,
        source: "invoice_payment",
        sourceId: inv.id,
        rows: [
          { account: "1930", debet: Math.round(totalGross), kredit: 0 },
          { account: "1510", debet: 0, kredit: Math.round(totalGross) },
        ],
      });
      vNum++;
    }
  });

  // Generate expense verifications
  expenses.forEach((exp) => {
    const rows = [
      { account: exp.costAccount, debet: Math.round(exp.netAmount), kredit: 0 },
    ];
    if (exp.vatAmount > 0) {
      rows.push({ account: "2641", debet: Math.round(exp.vatAmount), kredit: 0 });
    }
    rows.push({ account: "1930", debet: 0, kredit: Math.round(exp.amount) });

    verifications.push({
      id: Date.now() + vNum,
      number: `V${vNum}`,
      date: exp.date,
      description: exp.description,
      source: "expense",
      sourceId: exp.id,
      rows,
    });
    vNum++;
  });

  // Sort by date
  verifications.sort((a, b) => a.date.localeCompare(b.date));

  // Re-number after sort
  verifications.forEach((v, i) => {
    v.number = `V${i + 1}`;
  });

  return verifications;
}
