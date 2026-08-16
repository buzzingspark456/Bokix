// ── Landningssidans "Så ser det ut"-sektion (LandingPage.jsx) matar den
// FAKTISKA Dashboard.jsx-komponenten — samma komponent inloggade
// användare ser — med det här datasetet, istället för att efterlikna den
// i egen handskriven JSX. Ingen risk att marknadssidan tyst blir
// inaktuell mot en framtida Dashboard-ändring, eftersom det är exakt
// samma komponent. Dashboard.jsx är rent presentationell (inga
// Supabase-anrop, ingen useEffect, bara props in) — bekräftat innan det
// här byggdes, så det är säkert att montera med påhittade props utan
// inloggning eller backend.
//
// Datat är internt konsekvent (balanserade verifikationsrader, rimliga
// konton) men uttryckligen exempeldata, aldrig påstått vara en riktig
// kunds bokföring — samma "Exempeldata"-badge som redan fanns på den
// gamla handbyggda mockupen visas fortfarande, se LandingPage.jsx.

const YEAR = new Date().getFullYear();
const pad = (n) => String(n).padStart(2, '0');

// Lätt variation månad för månad så stapeldiagrammet ser ut som riktiga
// siffror, inte en platt, konstlat jämn trend.
const MONTHLY = [
  { month: 1, revenue: 68000, cost: 41000, costLabel: 'Kontorshyra januari', costAccount: '6110' },
  { month: 2, revenue: 74000, cost: 52000, costLabel: 'Programvarulicenser', costAccount: '6212' },
  { month: 3, revenue: 81000, cost: 47000, costLabel: 'Redovisningstjänst', costAccount: '6540' },
  { month: 4, revenue: 69000, cost: 61000, costLabel: 'Kontorshyra april', costAccount: '6110' },
  { month: 5, revenue: 92000, cost: 55000, costLabel: 'Marknadsföring', costAccount: '5910' },
  { month: 6, revenue: 88000, cost: 49000, costLabel: 'Programvarulicenser', costAccount: '6212' },
  { month: 7, revenue: 95000, cost: 58000, costLabel: 'Kontorshyra juli', costAccount: '6110' },
  { month: 8, revenue: 101000, cost: 63000, costLabel: 'Redovisningstjänst', costAccount: '6540' },
];

// 25% moms baklänges ur ett bruttobelopp: moms = brutto × 0.2.
const vatOf = (gross) => Math.round(gross * 0.2);

function buildVerifications() {
  const out = [];
  MONTHLY.forEach(({ month, revenue, cost, costLabel, costAccount }) => {
    const date = `${YEAR}-${pad(month)}-15`;
    const revVat = vatOf(revenue);
    out.push({
      id: `demo_rev_${month}`,
      date,
      description: `Kundfaktura #${1000 + month}`,
      source: 'invoice',
      sourceId: `demo_inv_${month}`,
      rows: [
        { account: '1510', debet: revenue, kredit: 0 },
        { account: '3001', debet: 0, kredit: revenue - revVat },
        { account: '2611', debet: 0, kredit: revVat },
      ],
    });
    const costVat = vatOf(cost);
    out.push({
      id: `demo_cost_${month}`,
      date,
      description: costLabel,
      source: 'expense',
      sourceId: `demo_exp_${month}`,
      rows: [
        { account: costAccount, debet: cost - costVat, kredit: 0 },
        { account: '2641', debet: costVat, kredit: 0 },
        { account: '1930', debet: 0, kredit: cost },
      ],
    });
  });
  return out;
}

export const DEMO_DASHBOARD_PROPS = {
  company: { name: 'Nordström Konsult AB', vatPeriod: 'quarterly' },
  verifications: buildVerifications(),
  // Betalda/skickade, inga förfallna — en städad, "det här är hur det ska
  // se ut"-demo snarare än en lista problem, eftersom det uttryckligen är
  // exempeldata och inte en riktig kunds situation.
  invoices: [
    { id: 'demo_inv_8', status: 'paid', dueDate: `${YEAR}-${pad(8)}-30`, paidAmount: 101000, rows: [{ qty: 1, unitPrice: 80800, vatRate: 25 }] },
    { id: 'demo_inv_7', status: 'sent', dueDate: `${YEAR}-${pad(9)}-15`, paidAmount: 0, rows: [{ qty: 1, unitPrice: 76000, vatRate: 25 }] },
    { id: 'demo_inv_6', status: 'paid', dueDate: `${YEAR}-${pad(8)}-05`, paidAmount: 88000, rows: [{ qty: 1, unitPrice: 70400, vatRate: 25 }] },
  ],
  expenses: [
    { id: 'demo_exp_8', costAccount: '6110' },
    { id: 'demo_exp_7', costAccount: '6212' },
  ],
  contacts: [
    { id: 'demo_c1', type: 'customer', name: 'Almbring Bygg AB' },
    { id: 'demo_c2', type: 'customer', name: 'Sjöstrand Design' },
    { id: 'demo_c3', type: 'supplier', name: 'Kontorsmax AB' },
  ],
  payrollRuns: [],
  vatPeriods: {},
  profileIncomplete: false,
};
