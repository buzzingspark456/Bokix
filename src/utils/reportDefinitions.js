// Rapport och analys — rapportportalen. 14-rapporters-specen begränsad till
// de rapporter Bokix faktiskt har täckande data för idag (Sida 14c,
// uppföljning): Kund-/leverantörsreskontra som EGEN rapport, Budget,
// Prognostisering och Trendanalys byggs INTE här — inget underlag för dem
// än, och tomma rapporter är värre än inga alls. Lönerapporter är
// villkorad (`requires: 'payroll'`) — visas bara om företaget faktiskt har
// bokförda lönekörningar, annars en rapport som permanent bara säger
// "inget att visa".
//
// `id` måste vara stabilt — används både som routing-nyckel (vilken vy
// ReportDetail.jsx ska rendera) och som nyckel i company.reportLastOpened
// (senast öppnad-tidsstämpeln, se Reports.jsx).
export const REPORT_SECTIONS = [
  {
    id: 'overview',
    label: 'Översikt',
    reports: [
      // Kundönskemål: en visuell "allt på en gång"-sida, jämförbar med
      // Fortnox/Vismas företagsöversikter — bygger uteslutande på samma
      // riktiga, redan beräknade tal som Nyckeltal/Resultaträkning/
      // Årsrapport, bara i fler och delvis nya diagramformer (ringdiagram,
      // gradientfyllda trendlinjer, rankad kostnadslista) — se
      // ReportDetail.jsx:s OverviewReport.
      { id: 'overview', name: 'Företagsöversikt', description: 'Omsättning, marginaler, kostnadsfördelning och kassaflöde i en visuell överblick.' },
    ],
  },
  {
    id: 'ongoing',
    label: 'Löpande',
    reports: [
      { id: 'result', name: 'Resultaträkning', description: 'Intäkter minus kostnader för vald period.' },
      { id: 'balance', name: 'Balansräkning', description: 'Tillgångar, skulder och eget kapital vid periodens slut.' },
      { id: 'cashflow', name: 'Kassaflödesanalys', description: 'Likviditetens förändring under perioden.' },
      { id: 'keyfigures', name: 'Nyckeltal', description: 'Vinstmarginal, kassalikviditet och soliditet.' },
    ],
  },
  {
    id: 'tax',
    label: 'Skatt & moms',
    reports: [
      { id: 'vat', name: 'Momsrapport', description: 'Underlag till momsdeklarationen, ruta för ruta.' },
    ],
  },
  {
    id: 'ledgers',
    label: 'Huvudböcker',
    reports: [
      { id: 'ledger', name: 'Huvudbok', description: 'Saldo och alla transaktioner per konto.' },
    ],
  },
  {
    id: 'sales',
    label: 'Försäljning',
    reports: [
      { id: 'invoices', name: 'Fakturarapporter', description: 'Fakturerat, betalt och utestående per kund.' },
    ],
  },
  {
    id: 'payroll',
    label: 'Lön & personal',
    reports: [
      { id: 'payroll', name: 'Lönerapporter', description: 'Bruttolön, skatt och arbetsgivaravgifter per anställd.', requires: 'payroll' },
    ],
  },
  {
    id: 'summary',
    label: 'Sammanställningar',
    reports: [
      { id: 'annual', name: 'Årsrapport', description: 'Hela räkenskapsåret sammanställt, med nyckeltal och en kort analys.' },
      { id: 'quarterly', name: 'Kvartalsrapport', description: 'Kvartal för kvartal, med moms, arbetsgivaravgifter och utveckling.' },
      { id: 'monthly', name: 'Månadsrapport', description: 'Senaste månaden mot de tolv föregående, med avvikelser markerade.' },
    ],
  },
];

/** Platta ut till en enda lista — för uppslagning av namn/beskrivning
 * givet ett reportId, utan att varje anropare behöver känna till
 * sektionsstrukturen. */
export const ALL_REPORTS = REPORT_SECTIONS.flatMap(s => s.reports);

export function getReportMeta(reportId) {
  return ALL_REPORTS.find(r => r.id === reportId) || null;
}

/** Sektioner filtrerade efter vilka rapporter som faktiskt ska synas just
 * nu — `hasPayrollData` styr om Lön & personal-sektionen visas alls
 * (spec: "hoppa över sektioner som inte passar"). En sektion utan några
 * synliga rapporter kvar tas bort helt, inte en tom rubrikrad. */
export function visibleReportSections({ hasPayrollData }) {
  return REPORT_SECTIONS
    .map(section => ({
      ...section,
      reports: section.reports.filter(r => r.requires !== 'payroll' || hasPayrollData),
    }))
    .filter(section => section.reports.length > 0);
}
