import { t } from '../i18n';
// Rapportlistan. Åtta rapporter sedan 2026-10-31: flera av de tidigare visade
// samma siffror i annan form. Nyckeltal ligger i Företagsöversikten, månad,
// kvartal och år i Resultaträkningen (välj period), momsen under Moms och
// skatt, och Arbetsblad + Förändring av eget kapital som Bokslutsunderlag.
//
// Lönerapporter är villkorad (`requires: 'payroll'`) — visas bara om företaget
// faktiskt har bokförda lönekörningar, annars en rapport som permanent bara
// säger "inget att visa".
//
// `id` måste vara stabilt — används både som routing-nyckel (vilken vy
// ReportDetail.jsx ska rendera) och som nyckel i company.reportLastOpened
// (senast öppnad-tidsstämpeln, se Reports.jsx).
export const REPORT_SECTIONS = [
  {
    id: 'main',
    label: t('ui.rapp_de_viktigaste'),
    reports: [
      { id: 'overview', name: t('ui.foretagsoversikt'), description: t('ui.rapp_oversikt_beskrivning') },
      { id: 'result', name: t('ui.resultatrakning'), description: t('ui.intakter_minus_kostnader_for_vald_period') },
      { id: 'balance', name: t('ui.balansrakning'), description: t('ui.tillgangar_skulder_och_eget_kapital_vid_perioden') },
      { id: 'cashflow', name: t('ui.kassaflodesanalys'), description: t('ui.likviditetens_forandring_under_perioden') },
      { id: 'invoices', name: t('ui.fakturarapporter'), description: t('ui.fakturerat_betalt_och_utestaende_per_kund_2') },
      { id: 'payroll', name: t('ui.lonerapporter'), description: t('ui.bruttolon_skatt_och_arbetsgivaravgifter_per_anst_2'), requires: 'payroll' },
    ],
  },
  {
    id: 'closing',
    label: t('ui.rapp_bokslut_underlag'),
    reports: [
      { id: 'ledger', name: t('ui.huvudbok'), description: t('ui.saldo_och_alla_transaktioner_per_konto') },
      { id: 'closing', name: t('ui.rapp_bokslutsunderlag'), description: t('ui.rapp_bokslutsunderlag_beskrivning') },
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
 * nu — `hasPayrollData` styr om Lönerapporter visas alls. En sektion utan
 * några synliga rapporter kvar tas bort helt, inte en tom rubrikrad. */
export function visibleReportSections({ hasPayrollData, hiddenReportIds = [] }) {
  return REPORT_SECTIONS
    .map(section => ({
      ...section,
      // `hiddenReportIds` är UF-lägets bortval (UF_HIDDEN_REPORT_IDS i
      // utils/ufMode.js) — en lista utifrån, inte ett UF-villkor inbakat
      // här: den här filen ska förbli en ren rapportkatalog utan att veta
      // något om bolagsformer eller konton.
      reports: section.reports.filter(r =>
        (r.requires !== 'payroll' || hasPayrollData) && !hiddenReportIds.includes(r.id)
      ),
    }))
    .filter(section => section.reports.length > 0);
}
