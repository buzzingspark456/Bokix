import { t } from '../i18n';
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
    label: t('ui.oversikt'),
    reports: [
      // Kundönskemål: en visuell "allt på en gång"-sida, jämförbar med
      // Fortnox/Vismas företagsöversikter — bygger uteslutande på samma
      // riktiga, redan beräknade tal som Nyckeltal/Resultaträkning/
      // Årsrapport, bara i fler och delvis nya diagramformer (ringdiagram,
      // gradientfyllda trendlinjer, rankad kostnadslista) — se
      // ReportDetail.jsx:s OverviewReport.
      { id: 'overview', name: t('ui.foretagsoversikt'), description: t('ui.omsattning_marginaler_kostnadsfordelning_och_kas') },
    ],
  },
  {
    id: 'ongoing',
    label: t('ui.lopande'),
    reports: [
      { id: 'result', name: t('ui.resultatrakning'), description: t('ui.intakter_minus_kostnader_for_vald_period') },
      { id: 'balance', name: t('ui.balansrakning'), description: t('ui.tillgangar_skulder_och_eget_kapital_vid_perioden') },
      { id: 'cashflow', name: t('ui.kassaflodesanalys'), description: t('ui.likviditetens_forandring_under_perioden') },
      { id: 'keyfigures', name: t('ui.nyckeltal'), description: t('ui.vinstmarginal_kassalikviditet_och_soliditet') },
    ],
  },
  {
    id: 'closing',
    label: t('ui.bokslut'),
    reports: [
      // Arbetsbladet binder ihop råbalans, bokslutsjusteringar (avskrivningar,
      // periodiseringar, lagerjustering) och de två slutrapporterna i en
      // enda överblick — se utils/worksheet.js.
      { id: 'worksheet', name: t('ui.arbetsblad'), description: t('ui.rabalans_bokslutsjusteringar_och_slutliga_result') },
      { id: 'equity', name: t('ui.forandring_av_eget_kapital'), description: t('ui.ingaende_och_utgaende_eget_kapital_med_insattnin') },
    ],
  },
  {
    id: 'tax',
    label: t('ui.skatt_moms'),
    reports: [
      { id: 'vat', name: t('ui.momsrapport'), description: t('ui.underlag_till_momsdeklarationen_ruta_for_ruta') },
    ],
  },
  {
    id: 'ledgers',
    label: t('ui.huvudbocker'),
    reports: [
      { id: 'ledger', name: t('ui.huvudbok'), description: t('ui.saldo_och_alla_transaktioner_per_konto') },
    ],
  },
  {
    id: 'sales',
    label: t('ui.forsaljning'),
    reports: [
      { id: 'invoices', name: t('ui.fakturarapporter'), description: t('ui.fakturerat_betalt_och_utestaende_per_kund_2') },
    ],
  },
  {
    id: 'payroll',
    label: t('ui.lon_personal'),
    reports: [
      { id: 'payroll', name: t('ui.lonerapporter'), description: t('ui.bruttolon_skatt_och_arbetsgivaravgifter_per_anst_2'), requires: 'payroll' },
    ],
  },
  {
    id: 'summary',
    label: t('ui.sammanstallningar'),
    reports: [
      { id: 'annual', name: t('ui.arsrapport'), description: t('ui.hela_rakenskapsaret_sammanstallt_med_nyckeltal_o') },
      { id: 'quarterly', name: t('ui.kvartalsrapport'), description: t('ui.kvartal_for_kvartal_med_moms_arbetsgivaravgifter') },
      { id: 'monthly', name: t('ui.manadsrapport'), description: t('ui.senaste_manaden_mot_de_tolv_foregaende_med_avvik') },
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
