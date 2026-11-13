import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Printer, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Percent, Scale, Wallet, Loader2, AlertTriangle, CheckCircle2, Download } from '../icons';
import { computeJournal, computeReceivables, computePayables, AGE_BUCKETS } from '../../utils/reportLedgers';
import { exportVerificationsToExcel, verificationsInRange, downloadXlsx } from '../../utils/excelExport';
import {
  formatSEK, formatPct, fmtDate, fmtMonthYear, toISO, formatDelta,
  EmptyState, ReportSection, DataTable,
  CostBreakdownDonut, CostRankingList,
  formatSharePct,
  ChartTypeToggle, TREND_CHART_TYPES, FLOW_CHART_TYPES, SHARE_CHART_TYPES, KeyFigureGauge,
  ReportDisplayProvider, useReportDisplay, DisplaySettingsMenu,
  CHART_H_MAIN, CHART_H_SIDE,
  ReportSheet, SheetPanel, InlineLegend, StatTile, MarginLinesChart, MARGIN_SERIES,
  PeriodPicker, PeriodHeading, OVERVIEW_PERIODS, RevenueExpenseChart, CashflowComparisonChart,
  ResultPaceChart, ResultWaterfallChart, BalanceTrendChart, StatementTable, statementChange,
} from './ReportUI';
import {
  sumFlowByType, buildResultPace, buildResultSeries, buildMarginSeries, buildCashflowSeries, computeResultStatement, computeBalanceStatement, computeBalanceTrend, computeMonthDeviation, buildResultWaterfall,
  computeLedger, computeInvoiceReport, computeKeyFigures, fiscalYearBounds, isClosingEntry, computeCashflowStatement,
  groupCostsByCategory, groupCostsByAccount, overviewPeriodBounds, companyFiscalYearSetting,
} from '../../utils/reportCalculations';
import { computeVatPeriod } from '../../utils/vatCalculation';
import { computeWorksheet, groupWorksheetRows } from '../../utils/worksheet';
import { computeEquityStatement } from '../../utils/equity';
import { getReportMeta } from '../../utils/reportDefinitions';
import { computeEmployeePayroll } from '../../utils/payrollCalculation';
import { neededTaxTableKeysForYear } from '../../utils/kuExport';
import { preloadSkattetabell } from '../../utils/skattetabell';
import { t } from '../../i18n';
import { numberFormat } from '../../utils/intlCache';

// Procent går genom ReportUI:s formatPct (svensk decimalkomma + hårt
// mellanslag) — samma format i varje panel, se dess kommentar.
const fmtPct = (v) => formatPct(v);

// `.sheet-grid` (index.css) ritar cellernas MELLANRUM som linjer (grid-
// behållaren har `background: var(--border)` och `gap: 1px` — se den
// filens kommentar). Varje egen cell behöver därför sin egen
// `background: var(--bg-card)` för att TÄCKA sin egen yta och bara lämna
// den 1px-breda linjen mellan sig och grannen synlig. Modulnivå (inte en
// lokal konstant per rapportfunktion) sedan fler rapporter än
// OverviewReport nu delar samma sheet-grid-mönster.
const cellBg = { background: 'var(--bg-card)' };

/** Genererar en kort, faktabaserad sammanfattning för Årsrapporten utifrån
 * redan beräknade, riktiga tal — INTE ett fritextfält användaren förväntas
 * fylla i själv (Sida 14c, uttryckligt krav). Rena mall-meningar med
 * verkliga siffror insatta, aldrig en påhittad slutsats. */
function buildAnnualSummary({ omsattning, prevOmsattning, resultat, prevResultat, vinstmarginal, soliditet }) {
  const sentences = [];
  if (prevOmsattning) {
    const pct = ((omsattning - prevOmsattning) / Math.abs(prevOmsattning)) * 100;
    sentences.push(t(pct >= 0 ? 'ui.sum_oms_okade' : 'ui.sum_oms_minskade', { pct: formatPct(Math.abs(pct), 0), from: formatSEK(prevOmsattning), to: formatSEK(omsattning) }));
  } else if (omsattning) {
    sentences.push(t('ui.sum_oms_ingen_jmf', { v: formatSEK(omsattning) }));
  }
  if (prevResultat) {
    const pct = ((resultat - prevResultat) / Math.abs(prevResultat)) * 100;
    sentences.push(t(pct >= 0 ? 'ui.sum_res_okade' : 'ui.sum_res_minskade', { pct: formatPct(Math.abs(pct), 0), from: formatSEK(prevResultat), to: formatSEK(resultat) }));
  } else {
    sentences.push(t(resultat >= 0 ? 'ui.sum_res_positivt' : 'ui.sum_res_underskott', { v: formatSEK(resultat) }));
  }
  if (vinstmarginal != null) {
    sentences.push(t('ui.sum_vinstmarginal', { v: formatPct(vinstmarginal) }));
  }
  if (soliditet != null) {
    sentences.push(t('ui.sum_soliditet', { v: formatPct(soliditet) }));
  }
  return sentences.join(' ');
}

/** Preload av skattetabeller för alla år som förekommer i `payrollRuns` —
 * samma bugkritiska förutsättning som Taxes.jsx:s KU-sammanställning
 * (neededTaxTableKeysForYear/preloadSkattetabell): utan detta faller varje
 * anställds skatteavdrag tyst tillbaka till 0 kr istället för att kasta
 * ett synligt fel. Här generaliserad till EN ELLER FLERA år (kvartals-/
 * månadsrapporter kan spänna över ett årsskifte), inte bara ett enda. */
function usePayrollPreload(payrollRuns) {
  const [ready, setReady] = useState(false);
  const years = useMemo(() => {
    const set = new Set((payrollRuns || []).map(r => (r.period || '').slice(0, 4)).filter(Boolean));
    return [...set];
  }, [payrollRuns]);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const keys = new Set();
    years.forEach(y => neededTaxTableKeysForYear(payrollRuns, y).forEach(k => keys.add(k)));
    Promise.all([...keys].map(key => {
      const [year, tabellnr] = key.split(':');
      return preloadSkattetabell(year, tabellnr);
    }))
      .then(() => { if (!cancelled) setReady(true); })
      .catch(err => {
        console.error('Kunde inte läsa in skattetabeller för lönerapporten:', err);
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, [payrollRuns, years]);
  return ready;
}

/** Aggregerar bokförda lönekörningar inom [start, end] per anställd —
 * bruttolön, avdragen skatt och arbetsgivaravgifter. `run.period` är
 * "YYYY-MM", vilket sorterar korrekt som ren strängjämförelse mot
 * periodgränsernas YYYY-MM-prefix. */
function aggregatePayroll(payrollRuns, start, end) {
  const startKey = toISO(start).slice(0, 7);
  const endKey = toISO(end).slice(0, 7);
  const runs = (payrollRuns || []).filter(r =>
    r.completedSteps?.includes('booked') && r.period >= startKey && r.period <= endKey
  );
  const byEmployee = new Map();
  for (const run of runs) {
    for (const row of run.rows || []) {
      const computed = computeEmployeePayroll(row.employeeSnapshot, row);
      const key = row.employeeId;
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          employeeId: key,
          name: `${row.employeeSnapshot.firstName || ''} ${row.employeeSnapshot.lastName || ''}`.trim() || t('ui.okand_stor'),
          gross: 0, tax: 0, employerFee: 0, runCount: 0,
        });
      }
      const e = byEmployee.get(key);
      e.gross += computed.gross;
      e.tax += computed.tax;
      e.employerFee += computed.employerFee;
      e.runCount += 1;
    }
  }
  const rows = [...byEmployee.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  const totals = rows.reduce((acc, r) => ({
    gross: acc.gross + r.gross, tax: acc.tax + r.tax, employerFee: acc.employerFee + r.employerFee,
  }), { gross: 0, tax: 0, employerFee: 0 });
  return { rows, totals, runCount: runs.length };
}

// Företagsöversikten har en egen period och struntar i sidans periodval.
const OWN_PERIOD_REPORTS = ['overview'];

/** `display` är företagets sparade presentationsval (färger + enhet, se
 * utils/chartPalette.js) och `onDisplayChange` sparar en ändring. Båda
 * kommer från Reports.jsx, som äger företagsposten — detaljvyn läser och
 * skickar vidare, den äger ingenting själv. */
export default function ReportDetail({
  reportId, bounds, verifications, accounts, invoices, expenses = [], payrollRuns, contacts, company,
  isMobile, onBack, display, onDisplayChange, periodControl,
}) {
  const meta = getReportMeta(reportId);
  const { start, end, prevStart, prevEnd } = bounds;
  // Reskontran gäller en dag (periodens slut), inte en period.
  const openItems = reportId === 'receivables' || reportId === 'payables';
  const periodLabel = openItems ? t('rpt.per_datum', { date: toISO(end) }) : `${bounds.label} · ${fmtMonthYear(start)}–${fmtMonthYear(end)}`;
  const [excelBusy, setExcelBusy] = useState(false);
  // Excel: grundbok och huvudbok ger bokföringens rader för perioden,
  // reskontran sina öppna poster.
  const excelExport = (reportId === 'journal' || reportId === 'ledger')
    ? () => exportVerificationsToExcel(verificationsInRange(verifications, { from: toISO(start), to: toISO(end) }), { accounts, contacts, invoices, expenses })
    : openItems ? () => {
      const r = reportId === 'receivables' ? computeReceivables(invoices, contacts, end, verifications) : computePayables(expenses, contacts, end, verifications);
      const items = r.parties.flatMap(p => p.items);
      const asDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
      const sheet = {
        name: reportId === 'receivables' ? 'Kundreskontra' : 'Leverantörsreskontra',
        columns: [
          { key: 'number', label: 'Faktura', width: 12 }, { key: 'partyName', label: reportId === 'receivables' ? 'Kund' : 'Leverantör', width: 28 },
          { key: 'date', label: 'Fakturadatum', width: 12, type: 'date' }, { key: 'dueDate', label: 'Förfallodag', width: 12, type: 'date' },
          { key: 'daysOverdue', label: 'Dagar sen', width: 10 }, { key: 'open', label: 'Belopp', width: 14, type: 'amount' },
        ],
        rows: items.map(i => ({ ...i, date: asDate(i.date), dueDate: asDate(i.dueDate) })),
      };
      return downloadXlsx(`${reportId === 'receivables' ? 'kundreskontra' : 'leverantorsreskontra'}_${r.asOf}.xlsx`, [sheet]);
    } : null;
  const runExcel = async () => { setExcelBusy(true); try { await excelExport(); } catch (e) { console.error(e); } finally { setExcelBusy(false); } };

  return (
    <ReportDisplayProvider colors={display?.colors} unit={display?.unit}>
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 20px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 600, padding: 0, marginBottom: '10px' }}>
          <ChevronLeft size={14} /> {t('ui.alla_rapporter')}
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{meta?.name || t('ui.rapport')}</h1>
            {/* Företagsöversikten (reportId === 'overview') har en EGEN,
                oberoende periodväljare (PeriodHeading/PeriodPicker, se
                OverviewReport nedan) — den här raden byggs av sidans
                GEMENSAMMA period (listvyns eget filter i Reports.jsx), som
                Företagsöversikten aldrig använt för sina egna beräkningar.
                Att visa båda samtidigt gav en synlig motsägelse (rubriken
                påstod t.ex. hela räkenskapsåret medan grafen, satt till
                "Denna månad", visade något helt annat) — döljs därför bara
                här, Företagsöversikten visar sin egen, korrekta rad istället. */}
            {!OWN_PERIOD_REPORTS.includes(reportId) && <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{periodLabel}</p>}
          </div>
          {/* Knappen var tidigare permanent inaktiv med texten "Ladda ner
              (kommer snart)" — en död knapp överst på sidan, på den yta
              kundfeedbacken beskrev som appens bästa ("men gör hela
              analyssidan riktigt bra"). En rapport man inte kan få ut ur
              programmet är inte klar, så den gör nu något på riktigt:
              webbläsarens utskrift, som också är vägen till en PDF ("Spara
              som PDF" finns i varje utskriftsdialog på alla plattformar).
              Utskriftsreglerna i index.css (@media print, .report-scroll,
              .no-print) fäller bort sidomeny och knappar och låter hela
              rapporten flöda över flera sidor i stället för att klippas i
              sin scrollruta. Det är också varför det INTE är en egen
              PDF-generator: en riktig export ska visa exakt det man ser,
              och den koden finns redan i webbläsaren. */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {!OWN_PERIOD_REPORTS.includes(reportId) && periodControl}
          {onDisplayChange && (
            <DisplaySettingsMenu
              colors={display?.colors} unit={display?.unit}
              onChange={onDisplayChange}
            />
          )}
          {excelExport && (
            <button type="button" onClick={runExcel} disabled={excelBusy} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', cursor: excelBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              <Download size={14} /> {t('rpt.excel')}
            </button>
          )}
          <button
            onClick={() => window.print()}
            title={t('ui.oppnar_webblasarens_utskrift_valj_spara_som_pdf')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
          >
            <Printer size={14} /> {t('ui.skriv_ut_pdf')}
          </button>
          </div>
        </div>
      </div>

      <div className="report-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {reportId === 'overview' && <OverviewReport {...{ verifications, accounts, company, isMobile }} />}
        {reportId === 'result' && <ResultReport {...{ verifications, accounts, bounds, isMobile, payrollRuns, company }} />}
        {reportId === 'balance' && <BalanceReport {...{ verifications, accounts, bounds, isMobile }} />}
        {reportId === 'cashflow' && <CashflowReport {...{ verifications, accounts, start, end, prevStart, prevEnd, isMobile }} />}
        {reportId === 'closing' && <ClosingReport {...{ verifications, accounts, start, end }} />}
        {reportId === 'ledger' && <LedgerReport {...{ verifications, accounts, start, end }} />}
        {reportId === 'journal' && <JournalReport {...{ verifications, accounts, start, end }} />}
        {openItems && <OpenItemsReport kind={reportId} {...{ invoices, expenses, contacts, verifications, end }} />}
        {reportId === 'invoices' && <InvoiceReport {...{ invoices, contacts, start, end }} />}
        {reportId === 'payroll' && <PayrollReport {...{ payrollRuns, start, end }} />}
      </div>
    </div>
    </ReportDisplayProvider>
  );
}

// ── 0. Företagsöversikt ─────────────────────────────────────────────────
// Kundönskemål (jämförde med Fortnox/Vismas företagsöversikter): en
// visuell "allt på en gång"-sida med FLER och FINARE diagramformer än
// resten av rapportportalen. Ingen ny beräkningslogik — bara nya sätt att
// visa exakt samma riktiga, redan beräknade tal som Nyckeltal/
// Resultaträkning/Årsrapport redan använder, plus två beräkningsfunktioner
// (groupCostsByCategory/groupCostsByAccount i reportCalculations.js) och
// en färdig komponent (CostBreakdownDonut i ReportUI.jsx) som redan fanns
// men aldrig kopplades in någonstans i appen förrän nu.
// Ignorerar (som Årsrapport/Kvartalsrapport ovan) sidans egen periodväljare
// — en översikt är per definition hela innevarande räkenskapsår hittills.
// Sida 56, kundgenomgång ("redo the entire analytics from the beginning,
// ta bort Staplar/Linje/Yta" — jämfört med blocks.tremor.so/blocks/
// line-charts och /bar-charts): den gamla versionen visade bara
// NETTOresultatet som en enda stapel per månad, var alltid låst till hela
// räkenskapsåret, OCH lät besökaren växla varje korts graftyp fritt
// (Stapel/Linje/Yta) — ingen riktig Tremor-block gör det, varje block
// committar till EN form. Ombyggd i fyra delar:
//   1. En sidnivå-periodväljare (PeriodPicker) — "denna månad" / "senaste tre
//      månaderna" / "räkenskapsåret" (overviewPeriodBounds i
//      reportCalculations.js), som styr datumintervall OCH bucket-storlek
//      (dag/månad) för samtliga diagram på sidan, inte bara ett.
//   2. Huvuddiagrammet är Intäkter OCH Utgifter som två egna, grupperade
//      staplar (RevenueExpenseChart, en riktig port av Tremors BarChart —
//      se tremor/BarChart.jsx), lagt i en 2/3-diagram + 1/3-sammanfattning-
//      layout rakt av från Tremors "ETF performance comparison"-block
//      (chart-compositions) — en ChartSummaryList bredvid grafen, inte en
//      rad ovanpå den.
//   3. Kassaflödet är en egen CashflowComparisonChart — Tremors "month to
//      date"-mönster (line-charts, "Line Chart 4"): den valda perioden mot
//      samma period föregående år som två linjer på samma axel, inget
//      graftvalsval kvar.
//   4. Marginalutveckling har ETT fast format (gradientfylld yta) istället
//      för ett Yta/Linje-val — en ren procentserie läses bäst som en trend,
//      inte som något besökaren ska behöva välja form för varje gång.
// OVERVIEW_PERIODS (fem flikar) flyttad till ReportUI.jsx, se dess egen
// kommentar — Dashboard.jsx:s "Intäkter vs Utgifter"-widget (kundönskemål:
// "ska vara på startsidan också") delar nu EXAKT samma flikuppsättning,
// inte en lokal, potentiellt avvikande kopia.
function OverviewReport({ verifications, accounts, company, isMobile }) {
  const [periodId, setPeriodId] = useState('year');
  // Ett formval per panel, lokalt i vyn: det är ett sätt att TITTA på
  // siffrorna, inte en inställning som ska överleva sidbytet. Förvalen är
  // de former respektive data faktiskt läses bäst i — staplar när två
  // serier jämförs period för period, ring för andelar, linje för en kvot
  // över tid, yta för en nivå som ackumuleras.
  const [revenueChart, setRevenueChart] = useState('bar');
  const [costChart, setCostChart] = useState('donut');
  const [marginChart, setMarginChart] = useState('line');
  const [cashChart, setCashChart] = useState('area');
  // Färger och beloppsenhet kommer från företagets val (ReportDisplayProvider
  // i skalet ovan), inte från modulkonstanter — samma källa som diagrammen
  // själva läser, så bricka, legend och kurva aldrig kan visa olika färg för
  // samma serie.
  const { palette, amount } = useReportDisplay();
  // Diagramhöjd efter skärm: en 340px hög graf på en telefon fyller nästan
  // hela vyn och tvingar fram en skrollning per panel. `isMobile` kommer
  // från samma viewport-hook som resten av appen (useIsMobileViewport).
  const mainH = isMobile ? 240 : CHART_H_MAIN;
  const sideH = isMobile ? 210 : CHART_H_SIDE;

  const bounds = useMemo(() => overviewPeriodBounds(periodId, { fiscalYearStart: companyFiscalYearSetting(company), verifications }), [periodId, company?.fiscalYear, verifications]);
  const { start, end, prevStart, prevEnd, granularity, label: periodLabel, hasComparison } = bounds;

  const k = useMemo(() => computeKeyFigures(verifications, accounts, start, end), [verifications, accounts, start, end]);
  const prevK = useMemo(() => computeKeyFigures(verifications, accounts, prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const series = useMemo(() => buildResultSeries(verifications, accounts, start, end, granularity), [verifications, accounts, start, end, granularity]);
  const marginSeries = useMemo(() => buildMarginSeries(verifications, accounts, start, end, granularity), [verifications, accounts, start, end, granularity]);

  // Marginaltrappan har tre steg — men alla tre bär bara information om
  // företaget faktiskt HAR kostnader i varje lager. Ett tjänsteföretag utan
  // varukostnader (klass 4) får bruttomarginal = 100 % varje månad: en platt
  // linje i diagrammets tak som aldrig säger något. Har man inga finansiella
  // poster (klass 8) blir vinstmarginalen identisk med rörelsemarginalen och
  // ritas exakt ovanpå den — legenden lovar tre serier, ytan visar två, och
  // den dolda ser bara "borta" ut. Därför visas bara de lager som skiljer sig
  // åt; `layersNote` säger rakt ut varför de andra saknas.
  const visibleMargins = useMemo(() => {
    const pts = marginSeries.filter(d => d.rorelse != null);
    if (!pts.length) return { series: MARGIN_SERIES, note: null };
    const near = (a, b) => Math.abs(a - b) < 0.05;
    const identical = (key) => pts.every(p => p[key] != null && near(p[key], p.rorelse));
    const alwaysFull = (key) => pts.every(p => p[key] != null && near(p[key], 100));
    const dropped = [];
    const series = MARGIN_SERIES.filter((s) => {
      if (s.key === 'rorelse') return true;
      if (alwaysFull(s.key) || identical(s.key)) { dropped.push(s.key); return false; }
      return true;
    });
    const note = !dropped.length ? null
      : dropped.length === 2
        ? t('ui.inga_varukostnader_eller_finansiella_poster_i_pe')
        : dropped[0] === 'brutto'
          ? t('ui.inga_varukostnader_i_perioden_bruttomarginalen_l')
          : t('ui.inga_finansiella_poster_i_perioden_vinstmarginal');
    return { series, note };
  }, [marginSeries]);

  const cashPoints = useMemo(() => buildCashflowSeries(verifications, accounts, start, end, granularity), [verifications, accounts, start, end, granularity]);
  const prevCashPoints = useMemo(() => buildCashflowSeries(verifications, accounts, prevStart, prevEnd, granularity), [verifications, accounts, prevStart, prevEnd, granularity]);
  const costCategories = useMemo(() => groupCostsByCategory(verifications, accounts, start, end), [verifications, accounts, start, end]);
  const costAccounts = useMemo(() => groupCostsByAccount(verifications, accounts, start, end), [verifications, accounts, start, end]);

  // Rubrikraden (PeriodHeading + PeriodPicker) — alltid samma, oavsett om
  // perioden faktiskt har någon bokföring eller inte (se `hasActivity`
  // nedan): en besökare måste kunna SE vilket datumspann en tom period
  // faktiskt täcker, och kunna byta till en flik som har data, utan att
  // rubrikraden försvinner i tomt-läget.
  const periodHeader = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
      <PeriodHeading label={periodLabel} start={start} end={end} />
      <PeriodPicker value={periodId} onChange={setPeriodId} options={OVERVIEW_PERIODS} />
    </div>
  );
  const hasActivity = series.some(m => m.intakt !== 0 || m.kostnad !== 0);

  if (!hasActivity) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {periodHeader}
        <ReportSection><EmptyState text={t('ui.ingen_bokford_data_annu_for', { v0: periodLabel.toLowerCase() })} /></ReportSection>
      </div>
    );
  }

  const revenueExpenseData = series.map(m => ({ label: m.label, Intäkter: m.intakt, Utgifter: m.kostnad }));
  // Fältnamnen är själva periodetiketten ("Denna månad" osv) snarare än ett
  // fast "Saldo" — CashflowComparisonChart's legend (Tremors "Line Chart 4":
  // currentMonth/lastMonth) ska alltid namnge VILKEN period som visas, inte
  // ett generiskt ord som inte längre stämmer när fliken byts. Ingen
  // "Föregående år"-serie alls när !hasComparison ("Sedan start") — se
  // CashflowComparisonChart's kommentar i ReportUI.jsx.
  const cashChartData = cashPoints.map((p, i) => ({
    label: fmtDate(p.date), [periodLabel]: p.balance,
    ...(hasComparison ? { [t('ui.foregaende_ar_stor')]: prevCashPoints[i] ? prevCashPoints[i].balance : null } : {}),
  }));
  // `comparable` — inte bara "har perioden en jämförelseperiod?" (hasComparison)
  // utan "finns det FAKTISKT något bokfört i den?". Buggrapport från riktig
  // data: ett bolag utan fjolårshistorik fick raden "Ingen data förra året"
  // upprepad FEM gånger på samma skärm (två nyckeltalskort + tre rader i
  // sammanfattningslistan) — samma icke-besked, om och om igen, i utrymme som
  // skulle burit siffror. Saknas underlaget helt låtsas sidan inte att den
  // jämför: inga delta-rader, ingen "jämfört med"-undertext.
  const comparable = hasComparison && (prevK.omsattning !== 0 || prevK.kostnader !== 0);
  const omsDelta = comparable ? formatDelta(k.omsattning, prevK.omsattning) : null;
  const kostDelta = comparable ? formatDelta(k.kostnader, prevK.kostnader, true) : null;
  const resDelta = comparable ? formatDelta(k.resultat, prevK.resultat) : null;
  const comparisonNote = comparable ? t('ui.jamfort_med_samma_period_foregaende_ar') : null;
  // Kassaflödeskortets rubriktal: saldot vid periodens SISTA punkt, inte en
  // summa — ett ackumulerat saldo summeras inte, det avläses.
  const currentCash = cashPoints.length ? cashPoints[cashPoints.length - 1].balance : 0;

  // Kundens Figma-utkast, implementerat: INGA kort. Hela översikten är ett
  // vitt ark (ReportSheet) där panelerna skiljs åt av hårfina linjer i stället
  // för av ramar, skuggor och luft. Linjerna ritas inte per panel utan av
  // rutnätet självt: behållaren har `background: var(--border)` och `gap: 1px`,
  // så springorna MELLAN cellerna är linjerna. Det gör att de aldrig
  // dubbleras, aldrig hamnar på en ytterkant, och — viktigast — att de
  // fortfarande blir vågräta avdelare när `.form-row-stack` staplar allt till
  // en kolumn på mobil. Ett `borderLeft` per panel hade blivit ett hängande
  // streck i mobilvyn.
  // Rutnätet och spannen ligger i index.css (`.sheet-grid` / `.sheet-span-*`),
  // inte som inline-stilar — se kommentaren där: ett inline `grid-column:
  // span N` går inte att nollställa i en mediefråga, och ett spann som är
  // bredare än rutnätets enda kolumn skapar då implicita kolumner i stället
  // för att stapla. Det gjorde hela arket obrytbart på mobil.
  // Kostnadernas största kategori — utkastets "varav personal 44 %" är ingen
  // fast text utan den faktiskt största posten, uträknad ur samma
  // kostnadsfördelning som ringen bredvid visar.
  const topCost = [...costCategories.categories].sort((a, b) => b.amount - a.amount)[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {periodHeader}

      <ReportSheet>
        <div className="sheet-grid">
          {/* Nyckeltalsbandet — fyra brickor, som i utkastet. Vinstmarginal och
              soliditet har inga egna brickor längre utan ligger som kontexttext
              under det tal de faktiskt hör ihop med (marginalen under
              resultatet, soliditeten under kassalikviditeten). Fyra tal att
              läsa i stället för fem, utan att något mått försvann. */}
          <div className="sheet-span-3" style={cellBg}>
            <StatTile
              label={t('ui.omsattning')} value={amount.value(k.omsattning)} icon={TrendingUp} tone={palette.income}
              delta={omsDelta} context={omsDelta?.context}
            />
          </div>
          <div className="sheet-span-3" style={cellBg}>
            <StatTile
              label={t('ui.resultat')} value={amount.value(k.resultat)} icon={k.resultat >= 0 ? TrendingUp : TrendingDown}
              tone={k.resultat >= 0 ? palette.profit : palette.loss}
              accent={k.resultat >= 0 ? palette.profit : palette.loss}
              delta={resDelta}
              context={k.vinstmarginal != null ? `marginal ${fmtPct(k.vinstmarginal)}` : resDelta?.context}
            />
          </div>
          <div className="sheet-span-3" style={cellBg}>
            <StatTile
              label={t('ui.kassalikviditet')} value={fmtPct(k.kassalikviditet)} icon={Wallet} tone={palette.cash}
              context={k.soliditet != null ? `soliditet ${fmtPct(k.soliditet)}` : 'saknar underlag'}
            />
          </div>
          <div className="sheet-span-3" style={cellBg}>
            <StatTile
              label={t('ui.kostnader')} value={amount.value(k.kostnader)} icon={Scale} tone={palette.cost}
              delta={kostDelta}
              context={topCost ? `varav ${topCost.name.toLowerCase()} ${formatSharePct(topCost.amount, costCategories.total)}` : kostDelta?.context}
            />
          </div>

          <div className="sheet-span-7" style={cellBg}>
            <SheetPanel
              title={t('ui.intakter_vs_utgifter')}
              subtitle={comparisonNote}
              /* Kombi ritar en tredje serie (resultatet) — legenden måste
                 följa med, annars står en grön linje i diagrammet utan att
                 något säger vad den är. */
              legend={<InlineLegend items={[
                { label: t('ui.intakter'), color: palette.income },
                { label: t('ui.utgifter'), color: palette.cost },
                ...(revenueChart === 'combo' ? [{ label: t('ui.resultat'), color: palette.profit }] : []),
              ]} />}
              controls={<ChartTypeToggle value={revenueChart} onChange={setRevenueChart} options={TREND_CHART_TYPES} />}
            >
              <RevenueExpenseChart data={revenueExpenseData} isMobile={isMobile} granularity={granularity} height={mainH} variant={revenueChart} />
            </SheetPanel>
          </div>
          <div className="sheet-span-5" style={cellBg}>
            <SheetPanel
              title={t('ui.kostnadsfordelning')}
              controls={costCategories.categories.length > 0
                ? <ChartTypeToggle value={costChart} onChange={setCostChart} options={SHARE_CHART_TYPES} />
                : null}
            >
              {costCategories.categories.length === 0
                ? <EmptyState text={t('ui.inga_bokforda_kostnader_annu')} />
                : <CostBreakdownDonut categories={costCategories.categories} total={costCategories.total} variant={costChart} />}
            </SheetPanel>
          </div>

          <div className="sheet-span-7" style={cellBg}>
            <SheetPanel
              title={t('ui.marginalanalys')}
              subtitle={visibleMargins.series.length > 1
                ? t('ui.andel_av_omsattningen_som_ar_kvar_efter_varje_ko')
                : t('ui.andel_av_omsattningen_som_ar_kvar_efter_rorelsen', { label: visibleMargins.series[0].label })}
              /* En ensam serie behöver ingen legend; underrubriken namnger den. */
              legend={visibleMargins.series.length > 1
                ? <InlineLegend items={visibleMargins.series.map(s => ({ label: s.label.replace('marginal', ''), color: palette.marginTones[MARGIN_SERIES.findIndex(m => m.key === s.key)] || palette.profit }))} />
                : null}
              controls={<ChartTypeToggle value={marginChart} onChange={setMarginChart} options={FLOW_CHART_TYPES} />}
            >
              <MarginLinesChart data={marginSeries} series={visibleMargins.series} isMobile={isMobile} height={sideH} variant={marginChart} />
              {visibleMargins.note && (
                <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {visibleMargins.note}
                </p>
              )}
            </SheetPanel>
          </div>
          <div className="sheet-span-5" style={cellBg}>
            <SheetPanel
              title={t('ui.kassaflode')}
              subtitle={t('ui.likvida_medel_per_period_vid_periodens_slut', { v0: amount.value(currentCash) })}
              controls={<ChartTypeToggle value={cashChart} onChange={setCashChart} options={FLOW_CHART_TYPES} />}
            >
              <CashflowComparisonChart
                data={cashChartData} currentLabel={periodLabel}
                previousLabel={comparable ? t('ui.foregaende_ar_stor') : null}
                height={sideH} variant={cashChart}
              />
            </SheetPanel>
          </div>

          <div className="sheet-span-7" style={cellBg}>
            <SheetPanel title={t('ui.storsta_kostnadskontona')} subtitle={t('ui.de_fem_konton_som_drar_mest_i_perioden')}>
              {costAccounts.rows.length === 0
                ? <EmptyState text={t('ui.inga_bokforda_kostnader_annu')} />
                : <CostRankingList rows={costAccounts.rows} total={costAccounts.total} />}
            </SheetPanel>
          </div>
          {/* Nyckeltalen får en egen panel i stället för att bara ligga som
              kontexttext under brickorna högst upp: tre procenttal som
              ringar visar direkt vilket av dem som ligger lågt, vilket en
              rad text aldrig gör. Samma tal som brickorna, ingen ny
              beräkning — se computeKeyFigures. */}
          <div className="sheet-span-5" style={cellBg}>
            <SheetPanel title={t('ui.nyckeltal')} subtitle={t('ui.tre_fristaende_matt_pa_hur_foretaget_star_inte_t_2')}>
              <KeyFigureGauge
                figures={[
                  { label: t('ui.vinstmarginal'), value: k.vinstmarginal, display: fmtPct(k.vinstmarginal), color: palette.profit, help: t('ui.andel_av_omsattningen_som_blir_kvar') },
                  { label: t('ui.kassalikviditet'), value: k.kassalikviditet, display: fmtPct(k.kassalikviditet), color: palette.cash, help: t('ui.omsattningstillgangar_mot_kortfristiga_skulder') },
                  { label: t('ui.soliditet'), value: k.soliditet, display: fmtPct(k.soliditet), color: palette.neutral, help: t('ui.eget_kapital_i_forhallande_till_balansomslutning') },
                ]}
              />
            </SheetPanel>
          </div>

          {/* Som Oxceed: varje tal med samma period i fjol och förändringen bredvid. */}
          <div className="sheet-span-12" style={cellBg}>
            <SheetPanel title={t('ui.rapp_nyckeltal_i_siffror')}>
              <DataTable
                columns={[
                  { key: 'label', label: t('ui.post') },
                  { key: 'value', label: t('ui.rapp_perioden'), align: 'right', emphasize: true },
                  ...(comparable ? [
                    { key: 'prev', label: t('ui.foregaende_ar_stor'), align: 'right' },
                    { key: 'change', label: t('ui.rapp_forandring'), align: 'right' },
                  ] : []),
                ]}
                rows={keyFigureRows(k, prevK)}
                rowKey={r => r.label}
              />
            </SheetPanel>
          </div>
        </div>
      </ReportSheet>
    </div>
  );
}

// Kronor jämförs i procent, procenttal i procentenheter: "+12 %" om en
// soliditet på 30 % hade läst som 42 % fast den är 33,6 %.
function keyFigureRows(k, prev) {
  const money = (label, key) => ({ label, value: formatSEK(k[key]), prev: formatSEK(prev[key]), change: statementChange(k[key], prev[key]) });
  const share = (label, key) => {
    const diff = k[key] != null && prev[key] != null ? k[key] - prev[key] : null;
    return {
      label, value: fmtPct(k[key]), prev: fmtPct(prev[key]),
      change: diff == null ? '—' : t('ui.rapp_procentenheter', { v: `${diff >= 0 ? '+' : '−'}${formatPct(Math.abs(diff)).replace(/\s*%$/, '')}` }),
    };
  };
  return [
    money(t('ui.omsattning'), 'omsattning'),
    money(t('ui.kostnader'), 'kostnader'),
    money(t('ui.resultat'), 'resultat'),
    share(t('ui.vinstmarginal'), 'vinstmarginal'),
    share(t('ui.soliditet'), 'soliditet'),
    share(t('ui.kassalikviditet'), 'kassalikviditet'),
    money(t('ui.eget_kapital'), 'egetKapital'),
    money(t('ui.kassa_och_bank'), 'kassaOchBank'),
    money(t('ui.kundfordringar'), 'kundfordringar'),
    money(t('ui.totala_tillgangar'), 'totalaTillgangar'),
    money(t('ui.kortfristiga_skulder_konto_2400'), 'kortfristigaSkulder'),
  ];
}

// ── 1. Resultaträkning ──────────────────────────────────────────────────
// Kundönskemål ("alla rapporter ska se ut som Företagsöversikten" — se
// skärmdumpen kundfeedbacken skickade av just OverviewReport): samma
// ReportSheet/sheet-grid/SheetPanel/StatTile-språk som Översikten redan
// bygger på, inte den äldre, enklare ReportSection+TabHeadline-stommen.
// Återanvänder Översiktens EGNA, redan byggda diagramkomponenter
// (RevenueExpenseChart m.fl.) — ingen ny visualisering uppfanns, bara
// samma byggstenar applicerade på en enda rapport i stället för alla sex
// på en gång.
// Saldorörelserna per konto, för att kunna fälla ut ett konto i uppställningen.
// Raderna ska summera till beloppet på kontots rad. Resultaträkningen räknar
// inte bokslutsverifikationen, och balanskontons saldo börjar med ingående saldo.
function useAccountLedger(verifications, accounts, start, end, { balance = false } = {}) {
  return useMemo(() => {
    const source = balance ? verifications : verifications.filter(v => !isClosingEntry(v));
    return new Map(computeLedger(source, accounts, start, end).accounts.map((a) => {
      if (!balance || Math.abs(a.openingBalance) <= 0.5) return [a.code, a.rows];
      const opening = { verificationId: 'ingaende', description: t('ui.rapp_ingaende_saldo'), debet: Math.max(a.openingBalance, 0), kredit: Math.max(-a.openingBalance, 0) };
      return [a.code, [opening, ...a.rows]];
    }));
  }, [verifications, accounts, start, end, balance]);
}

function ResultReport({ verifications, accounts, bounds, isMobile, payrollRuns, company }) {
  const { palette, amount } = useReportDisplay();
  const { start, end } = bounds;
  // Samma siffror på flera sätt, som i de svenska programmen: varje period
  // för sig, samlat genom perioden, steg för steg till resultatet, eller som tabell.
  const [view, setView] = useState('period');
  const [detail, setDetail] = useState('accounts');

  const statement = useMemo(() => computeResultStatement(verifications, accounts, bounds), [verifications, accounts, bounds]);
  const pace = useMemo(() => buildResultPace(verifications, accounts, bounds), [verifications, accounts, bounds]);
  // En enda stapel säger ingenting: en månad delas per dag, längre perioder per månad.
  const granularity = (end - start) / 86400000 <= 31 ? 'day' : 'month';
  const series = useMemo(() => buildResultSeries(verifications, accounts, start, end, granularity), [verifications, accounts, start, end, granularity]);
  const ledger = useAccountLedger(verifications, accounts, start, end);
  const keyFigures = useMemo(() => computeKeyFigures(verifications, accounts, start, end), [verifications, accounts, start, end]);
  const deviation = useMemo(() => computeMonthDeviation(verifications, accounts), [verifications, accounts]);

  if (!pace.hasActivity) return <ReportSheet><EmptyState text={t('ui.ingen_bokford_data_annu_for_denna_period')} /></ReportSheet>;

  const { omsattning, kostnader, resultat, prevOmsattning, prevKostnader, prevResultat } = statement;
  const marginal = omsattning ? (resultat / omsattning) * 100 : null;
  const compare = statement.hasComparison;
  const deltaFor = (cur, prev, invert) => (compare ? formatDelta(cur, prev, invert) : null);
  const chartData = series.map(m => ({ label: m.label, title: m.title, Intäkter: m.intakt, Utgifter: m.kostnad }));
  const resultColor = resultat >= 0 ? palette.profit : palette.loss;
  const summary = buildAnnualSummary({ omsattning, prevOmsattning, resultat, prevResultat, vinstmarginal: keyFigures.vinstmarginal, soliditet: keyFigures.soliditet });

  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-12" style={cellBg}>
          {/* Texten talar om räkenskapsåret och stämmer bara för den perioden. */}
          {bounds.isFiscalYear && <p style={{ margin: 0, padding: '18px 28px 0', fontSize: '14px', lineHeight: 1.65, color: 'var(--text-main)' }}>{summary}</p>}
          {deviation && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px 28px 0', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t('ui.markant_avvikelse_30_mot_de_tolv_foregaende_mana')} {deviation.label} {t('ui.vart_en_extra_koll_men_inte_nodvandigtvis_fel')}</span>
            </div>
          )}
          <div style={{ height: '18px' }} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label={t('ui.omsattning')} value={amount.value(omsattning)} icon={TrendingUp} tone={palette.income} delta={deltaFor(omsattning, prevOmsattning)} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label={t('ui.kostnader')} value={amount.value(kostnader)} icon={Scale} tone={palette.cost} delta={deltaFor(kostnader, prevKostnader, true)} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile
            label={t('ui.resultat')} value={amount.value(resultat)} icon={resultat >= 0 ? TrendingUp : TrendingDown}
            tone={resultColor} accent={resultColor} delta={deltaFor(resultat, prevResultat)}
          />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label={t('ui.marginal')} value={marginal != null ? fmtPct(marginal) : '—'} icon={Percent} tone={palette.neutral} context={t('ui.rapp_andel_av_omsattningen')} />
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title={t('ui.rapp_utveckling')}
            legend={view === 'period'
              ? <InlineLegend items={[{ label: t('ui.intakter'), color: palette.income }, { label: t('ui.kostnader'), color: palette.costBar }]} />
              : view === 'total'
                ? <InlineLegend items={[
                  { label: t('ui.resultat'), color: resultColor },
                  ...(compare ? [{ label: t('ui.foregaende_ar_stor'), color: 'var(--text-muted)' }] : []),
                ]} />
                : null}
            controls={(
              <ChartTypeToggle
                value={view} onChange={setView}
                options={[
                  { id: 'period', label: granularity === 'day' ? t('ui.rapp_per_dag') : t('ui.rapp_per_manad') },
                  { id: 'total', label: t('ui.rapp_ackumulerat') },
                  { id: 'steps', label: t('ui.rapp_steg_for_steg') },
                  { id: 'table', label: t('ui.rapp_tabell') },
                ]}
              />
            )}
          >
            {view === 'period' && <RevenueExpenseChart data={chartData} isMobile={isMobile} height={isMobile ? 240 : 300} variant="diverging" />}
            {view === 'total' && <ResultPaceChart data={pace.points} height={isMobile ? 240 : 300} />}
            {view === 'steps' && <ResultWaterfallChart data={buildResultWaterfall(statement.items)} isMobile={isMobile} />}
            {view === 'table' && (
              <DataTable
                columns={[
                  { key: 'label', label: t('ui.period') },
                  { key: 'intakt', label: t('ui.intakter'), align: 'right', render: r => formatSEK(r.intakt) },
                  { key: 'kostnad', label: t('ui.kostnader'), align: 'right', render: r => formatSEK(r.kostnad) },
                  { key: 'resultat', label: t('ui.resultat'), align: 'right', emphasize: true, render: r => formatSEK(r.intakt - r.kostnad) },
                ]}
                rows={series}
                rowKey={r => r.title}
                footer={[t('ui.summa'), formatSEK(omsattning), formatSEK(kostnader), formatSEK(resultat)]}
              />
            )}
          </SheetPanel>
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title={t('ui.resultatrakning')}
            controls={(
              <ChartTypeToggle
                value={detail} onChange={setDetail}
                options={[{ id: 'accounts', label: t('ui.rapp_konton') }, { id: 'summary', label: t('ui.rapp_sammanfattning') }]}
              />
            )}
          >
            <StatementTable items={statement.items} showPrev={compare} showAccounts={detail === 'accounts'} ledger={ledger} />
          </SheetPanel>
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <QuarterPanel {...{ verifications, accounts, payrollRuns, company }} />
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 2. Balansräkning ────────────────────────────────────────────────────
function BalanceReport({ verifications, accounts, bounds, isMobile }) {
  const { palette, amount } = useReportDisplay();
  const { start, end, prevEnd } = bounds;
  const [detail, setDetail] = useState('accounts');
  const balance = useMemo(() => computeBalanceStatement(verifications, accounts, end, prevEnd), [verifications, accounts, end, prevEnd]);
  const trend = useMemo(() => computeBalanceTrend(verifications, accounts, start, end), [verifications, accounts, start, end]);
  const ledger = useAccountLedger(verifications, accounts, start, end, { balance: true });
  if (balance.isEmpty) return <ReportSheet><EmptyState text={t('ui.inga_bokforda_tillgangs_eller_skuldsaldon_annu')} /></ReportSheet>;

  // Balansräkningens grundekvation: tillgångar = eget kapital + skulder,
  // alltid. Årets resultat är redan medräknat, så en skillnad här betyder att
  // något är fel i bokföringen, till exempel en obalanserad verifikation.
  const balanced = Math.abs(balance.totalAssets - balance.totalEquityAndLiabilities) < 1;
  const compare = balance.hasComparison;
  const deltaFor = (cur, prev, invert) => (compare ? formatDelta(cur, prev, invert) : null);
  const solidity = balance.totalAssets ? (balance.equity / balance.totalAssets) * 100 : null;

  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label={t('ui.tillgangar')} value={amount.value(balance.totalAssets)} icon={Wallet} tone={palette.income} delta={deltaFor(balance.totalAssets, balance.prevTotalAssets)} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label={t('ui.eget_kapital')} value={amount.value(balance.equity)} icon={Scale} tone={palette.profit} delta={deltaFor(balance.equity, balance.prevEquity)} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label={t('ui.skulder')} value={amount.value(balance.debts)} icon={Scale} tone={palette.neutral} delta={deltaFor(balance.debts, balance.prevDebts, true)} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile
            label={t('ui.soliditet')} value={solidity != null ? fmtPct(solidity) : '—'} icon={Percent} tone={palette.neutral}
            context={balanced ? t('ui.balanserar_mot_tillgangarna') : t('ui.stammer_inte_mot_tillgangarna')}
            accent={balanced ? undefined : 'var(--status-red-text)'}
          />
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title={t('ui.rapp_utveckling')}
            legend={<InlineLegend items={[{ label: t('ui.eget_kapital'), color: palette.profit }, { label: t('ui.skulder'), color: palette.muted }]} />}
          >
            <BalanceTrendChart data={trend} height={isMobile ? 220 : 260} />
          </SheetPanel>
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title={t('ui.balansrakning')} subtitle={t('ui.per', { v0: fmtDate(end) })}
            controls={(
              <ChartTypeToggle
                value={detail} onChange={setDetail}
                options={[{ id: 'accounts', label: t('ui.rapp_konton') }, { id: 'summary', label: t('ui.rapp_sammanfattning') }]}
              />
            )}
          >
            <StatementTable items={balance.items} showPrev={compare} showAccounts={detail === 'accounts'} ledger={ledger} />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 3. Kassaflödesanalys ───────────────────────────────────────────────
// Som Resultaträkningen: nyckeltal, utvecklingen på kassa och bank, och
// uppställningen (computeCashflowStatement) med varje konto att fälla ut.
function CashflowReport({ verifications, accounts, start, end, prevStart, prevEnd }) {
  const { palette, amount } = useReportDisplay();
  const [chartType, setChartType] = useState('area');
  const [detail, setDetail] = useState('summary');
  const bounds = useMemo(() => ({ start, end, prevStart, prevEnd }), [start, end, prevStart, prevEnd]);
  const statement = useMemo(() => computeCashflowStatement(verifications, accounts, bounds), [verifications, accounts, bounds]);
  const points = useMemo(() => buildCashflowSeries(verifications, accounts, start, end), [verifications, accounts, start, end]);
  const prevPoints = useMemo(() => buildCashflowSeries(verifications, accounts, prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const ledger = useAccountLedger(verifications, accounts, start, end);
  const hasActivity = points.some(p => p.balance !== 0) || prevPoints.some(p => p.balance !== 0) || statement.flow !== 0;
  const comparable = prevPoints.some(p => p.balance !== 0);
  const chartData = points.map((p, i) => ({
    label: fmtDate(p.date), 'Vald period': p.balance,
    ...(comparable ? { [t('ui.foregaende_ar_stor')]: prevPoints[i] ? prevPoints[i].balance : null } : {}),
  }));

  if (!hasActivity) return <ReportSheet><EmptyState text={t('ui.ingen_kassaflodesdata_for_denna_period')} /></ReportSheet>;

  const tone = (v) => (v >= 0 ? palette.profit : palette.loss);
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label={t('ui.kf_lopande_verksamhet')} value={amount.value(statement.operating)} icon={statement.operating >= 0 ? TrendingUp : TrendingDown} tone={tone(statement.operating)} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label={t('ui.kf_investeringar')} value={amount.value(statement.investing)} icon={Scale} tone={palette.neutral} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label={t('ui.kf_finansiering')} value={amount.value(statement.financing)} icon={Scale} tone={palette.neutral} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile
            label={t('ui.kf_likvida_medel_slut')} value={amount.value(statement.closingCash)} icon={Wallet} tone={palette.cash}
            context={statement.balanced ? t('ui.kf_stammer_mot_bank') : t('ui.kf_stammer_inte_mot_bank')}
            accent={statement.balanced ? undefined : 'var(--status-red-text)'}
          />
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title={t('ui.kassaflode')} subtitle={t('ui.ackumulerat_saldo_genom_perioden_konto_1900_1999')}
            controls={<ChartTypeToggle value={chartType} onChange={setChartType} options={FLOW_CHART_TYPES} />}
          >
            <CashflowComparisonChart
              data={chartData} currentLabel={t('ui.vald_period')} previousLabel={comparable ? t('ui.foregaende_ar_stor') : null}
              height={CHART_H_MAIN} variant={chartType}
            />
          </SheetPanel>
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title={t('ui.kassaflodesanalys')}
            controls={(
              <ChartTypeToggle
                value={detail} onChange={setDetail}
                options={[{ id: 'summary', label: t('ui.rapp_sammanfattning') }, { id: 'accounts', label: t('ui.rapp_konton') }]}
              />
            )}
          >
            <StatementTable items={statement.items} showPrev={statement.hasComparison} showAccounts={detail === 'accounts'} ledger={ledger} />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 6. Huvudbok ─────────────────────────────────────────────────────────
function LedgerReport({ verifications, accounts, start, end }) {
  const ledger = useMemo(() => computeLedger(verifications, accounts, start, end), [verifications, accounts, start, end]);
  if (ledger.accounts.length === 0) return <ReportSheet><EmptyState text={t('ui.inga_bokforda_transaktioner_for_denna_period')} /></ReportSheet>;
  // En panel per konto, i samma sheet-grid som resten av rapporterna —
  // ingen naturlig nyckeltalsrad här (antalet konton varierar fritt), så
  // arket är bara staplade full-bredd-paneler i stället för ett rutnät.
  return (
    <ReportSheet>
      <div className="sheet-grid">
        {ledger.accounts.map(acc => (
          <div key={acc.code} className="sheet-span-12" style={cellBg}>
            <SheetPanel title={`${acc.code} — ${acc.name}`} subtitle={t('ui.ingaende_saldo_utgaende_saldo', { v0: formatSEK(acc.openingBalance), v1: formatSEK(acc.closingBalance) })}>
              {acc.rows.length === 0 ? (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{t('ui.ingen_aktivitet_under_perioden_saldot_ar_oforand')}</div>
              ) : (
                <DataTable
                  columns={[
                    { key: 'date', label: t('ui.datum'), width: '100px', render: r => fmtDate(r.date) },
                    { key: 'description', label: t('ui.beskrivning') },
                    { key: 'debet', label: t('ui.debet'), align: 'right', render: r => r.debet ? formatSEK(r.debet) : '' },
                    { key: 'kredit', label: t('ui.kredit'), align: 'right', render: r => r.kredit ? formatSEK(r.kredit) : '' },
                    { key: 'runningBalance', label: t('ui.saldo'), align: 'right', emphasize: true, render: r => formatSEK(r.runningBalance) },
                  ]}
                  rows={acc.rows}
                  rowKey={(r, i) => `${r.verificationId}_${i}`}
                />
              )}
            </SheetPanel>
          </div>
        ))}
      </div>
    </ReportSheet>
  );
}

// ── Arbetsblad ──────────────────────────────────────────────────────────
// Från råbalansen till resultat- och balansräkningen, konto för konto. Grupperat
// som rapporterna med en delsumma per grupp. Justeringskolumnerna visas bara när
// det finns justeringar: utan dem är de bara samma siffror en gång till.
const wsNum = (v) => (v ? numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(v) : '');
const WS_GROUPS = [
  { key: 'raw', label: t('ui.rabalans') },
  { key: 'adjustments', label: t('ui.justeringar') },
  { key: 'adjusted', label: t('ui.justerad_rabalans') },
  { key: 'income', label: t('ui.resultatrakning') },
  { key: 'balance', label: t('ui.balansrakning') },
];
const WS_GROUP_LABELS = {
  assets: t('ui.tillgangar'),
  equityAndLiabilities: t('ui.eget_kapital_och_skulder'),
  income: t('ui.intakter'),
  costs: t('ui.kostnader'),
};

function WorksheetReport({ verifications, accounts, start, end }) {
  const { palette, amount } = useReportDisplay();
  const ws = useMemo(() => computeWorksheet(verifications, accounts, toISO(start), toISO(end)), [verifications, accounts, start, end]);
  if (ws.rows.length === 0) return <ReportSheet><EmptyState text={t('ui.inga_bokforda_transaktioner_for_denna_period')} /></ReportSheet>;

  const columns = ws.hasAdjustments ? WS_GROUPS : WS_GROUPS.filter(g => g.key !== 'adjustments' && g.key !== 'adjusted');
  const groups = groupWorksheetRows(ws.rows);
  const resultLabel = ws.yearResult >= 0 ? t('ui.arets_vinst') : t('ui.arets_forlust');
  const inBalance = ws.rawInBalance && ws.balanceInBalance;
  const flagged = new Set(ws.negativeReceivables.map(r => r.code));
  const toSides = (v) => (v >= 0 ? { debet: 0, kredit: v } : { debet: -v, kredit: 0 });

  const pair = (key, side) => (
    <React.Fragment key={key}>
      <td className="ws-first">{wsNum(side?.debet)}</td>
      <td>{wsNum(side?.kredit)}</td>
    </React.Fragment>
  );
  const resultRow = (key, label, cells) => (
    <tr key={key} className="ws-result">
      <td>{label}</td>
      {columns.map(c => pair(c.key, cells[c.key]))}
    </tr>
  );

  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={resultLabel} value={amount.value(Math.abs(ws.yearResult))} icon={ws.yearResult >= 0 ? TrendingUp : TrendingDown} tone={ws.yearResult >= 0 ? palette.profit : palette.loss} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile
            label={t('ui.justeringar')} value={ws.hasAdjustments ? amount.value(ws.adjustmentsTotal) : '0 kr'} icon={Scale} tone={palette.neutral}
            context={ws.hasAdjustments ? t('ui.rapp_justeringar_finns') : t('ui.rapp_inga_justeringar')}
          />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile
            label={t('ui.kontroll')} value={inBalance ? t('ui.stammer') : t('ui.stammer_inte')} icon={Scale} tone={inBalance ? palette.profit : palette.loss}
            context={inBalance ? t('ui.dk_gar_ihop') : t('ui.dk_gar_inte_ihop')}
            accent={inBalance ? undefined : 'var(--status-red-text)'}
          />
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title={t('ui.arbetsblad')} subtitle={t('ui.rapp_arbetsblad_forklaring')}>
            {ws.negativeReceivables.map(r => (
              <div key={r.code} className="ws-note">
                <AlertTriangle size={15} aria-hidden="true" />
                <span>{t('ui.rapp_kundfordringar_kredit', { konto: `${r.code} ${r.name}`, belopp: formatSEK(r.amount) })}</span>
              </div>
            ))}
            <div className="ws-scroll">
              <table className="ws-table" style={{ minWidth: ws.hasAdjustments ? '980px' : '680px' }}>
                <thead>
                  <tr>
                    <th rowSpan={2} scope="col" className="ws-account">{t('ui.konto_2')}</th>
                    {columns.map(g => <th key={g.key} colSpan={2} scope="colgroup" className="ws-first ws-center">{g.label}</th>)}
                  </tr>
                  <tr>
                    {columns.map(g => (
                      <React.Fragment key={g.key}>
                        <th scope="col" className="ws-first">{t('ui.debet')}</th>
                        <th scope="col">{t('ui.kredit')}</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => (
                    <React.Fragment key={group.key}>
                      <tr className="ws-group"><td colSpan={1 + columns.length * 2}>{WS_GROUP_LABELS[group.key]}</td></tr>
                      {group.rows.map(r => (
                        <tr key={r.code} className={flagged.has(r.code) ? 'ws-flagged' : undefined}>
                          <td><span className="ws-code">{r.code}</span>{r.name}</td>
                          {columns.map(c => pair(c.key, r[c.key]))}
                        </tr>
                      ))}
                      <tr className="ws-sum">
                        <td>{t('ui.summa')} {WS_GROUP_LABELS[group.key].toLowerCase()}</td>
                        {columns.map(c => pair(c.key, group.totals[c.key]))}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  {ws.priorResult !== 0 && resultRow('prior', t('ui.rapp_tidigare_ars_resultat'), { raw: toSides(ws.priorResult), adjusted: toSides(ws.priorResult), balance: toSides(ws.priorResult) })}
                  {ws.yearResult !== 0 && resultRow('year', resultLabel, {
                    income: { debet: ws.incomeBalanced.debet - ws.totals.income.debet, kredit: ws.incomeBalanced.kredit - ws.totals.income.kredit },
                    balance: toSides(ws.yearResult),
                  })}
                  <tr className="ws-total">
                    <td>{t('ui.summa')}</td>
                    {columns.map(c => pair(c.key, {
                      raw: ws.rawWithPrior, adjustments: ws.totals.adjustments, adjusted: ws.adjustedWithPrior, income: ws.incomeBalanced, balance: ws.balanceWithResult,
                    }[c.key]))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── Förändring av eget kapital ──────────────────────────────────────────
function EquityReport({ verifications, accounts, start, end }) {
  const { palette, amount } = useReportDisplay();
  const eq = useMemo(() => computeEquityStatement(verifications, accounts, toISO(start), toISO(end)), [verifications, accounts, start, end]);
  const hasData = eq.rows.some(r => !r.synthetic) || eq.yearResult !== 0;
  if (!hasData) return <ReportSheet><EmptyState text={t('ui.inget_eget_kapital_bokfort_for_denna_period')} /></ReportSheet>;
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('ui.ingaende')} value={amount.value(eq.totals.opening)} icon={Wallet} tone={palette.neutral} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('ui.forandring')} value={amount.value(eq.totals.movement)} icon={eq.totals.movement >= 0 ? TrendingUp : TrendingDown} tone={eq.totals.movement >= 0 ? palette.profit : palette.loss} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('ui.utgaende')} value={amount.value(eq.totals.closing)} icon={Wallet} tone={palette.profit} />
        </div>
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title={t('ui.forandring_av_eget_kapital')} subtitle={t('ui.ingaende_saldo_forandring_under_perioden_och_utg')}>
            <DataTable
              columns={[
                { key: 'name', label: t('ui.konto_2'), render: r => (r.code ? `${r.code} ${r.name}` : r.name) },
                { key: 'opening', label: t('ui.ingaende'), align: 'right', render: r => formatSEK(r.opening) },
                { key: 'movement', label: t('ui.forandring'), align: 'right', render: r => formatSEK(r.movement) },
                { key: 'closing', label: t('ui.utgaende'), align: 'right', emphasize: true, render: r => formatSEK(r.closing) },
              ]}
              rows={eq.rows}
              rowKey={(r, i) => `${r.code}_${i}`}
              footer={[t('ui.summa'), formatSEK(eq.totals.opening), formatSEK(eq.totals.movement), formatSEK(eq.totals.closing)]}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 7. Fakturarapporter ─────────────────────────────────────────────────
function InvoiceReport({ invoices, contacts, start, end }) {
  const { palette, amount } = useReportDisplay();
  const report = useMemo(() => computeInvoiceReport(invoices, contacts, start, end), [invoices, contacts, start, end]);
  if (report.rows.length === 0) return <ReportSheet><EmptyState text={t('ui.inga_kundfakturor_bokforda_skickade_for_denna_pe')} /></ReportSheet>;
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('ui.fakturerat')} value={amount.value(report.totals.invoiced)} icon={TrendingUp} tone={palette.income} context={`${report.invoiceCount} fakturor`} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('ui.betalt')} value={amount.value(report.totals.paid)} icon={ArrowUpRight} tone={palette.profit} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('ui.utestaende')} value={amount.value(report.totals.outstanding)} icon={Scale} tone={palette.cost} />
        </div>
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title={t('ui.fakturerat_betalt_och_utestaende_per_kund')}>
            <DataTable
              columns={[
                { key: 'name', label: t('ui.kund'), emphasize: true },
                { key: 'invoiceCount', label: t('ui.antal'), align: 'right' },
                { key: 'invoiced', label: t('ui.fakturerat'), align: 'right', render: r => formatSEK(r.invoiced) },
                { key: 'paid', label: t('ui.betalt'), align: 'right', render: r => formatSEK(r.paid) },
                { key: 'outstanding', label: t('ui.utestaende'), align: 'right', emphasize: true, render: r => formatSEK(r.outstanding) },
              ]}
              rows={report.rows}
              rowKey={r => r.customerId || r.name}
              footer={['Summa', String(report.invoiceCount), formatSEK(report.totals.invoiced), formatSEK(report.totals.paid), formatSEK(report.totals.outstanding)]}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 8. Lönerapporter ────────────────────────────────────────────────────
function PayrollReport({ payrollRuns, start, end }) {
  const { palette, amount } = useReportDisplay();
  const tablesReady = usePayrollPreload(payrollRuns);
  const report = useMemo(() => tablesReady ? aggregatePayroll(payrollRuns, start, end) : null, [tablesReady, payrollRuns, start, end]);

  if (!tablesReady) {
    return (
      <ReportSheet>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13.5px', padding: '26px 28px' }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> {t('ui.laser_in_skattetabeller')}
        </div>
      </ReportSheet>
    );
  }
  if (!report || report.rows.length === 0) return <ReportSheet><EmptyState text={t('ui.inga_bokforda_lonekorningar_for_denna_period')} /></ReportSheet>;
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('ui.bruttolon')} value={amount.value(report.totals.gross)} icon={TrendingUp} tone={palette.income} context={`${report.rows.length} anställda`} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('ui.avdragen_skatt')} value={amount.value(report.totals.tax)} icon={Scale} tone={palette.cost} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('ui.arbetsgivaravgifter')} value={amount.value(report.totals.employerFee)} icon={ArrowDownRight} tone={palette.cost} />
        </div>
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title={t('ui.bruttolon_skatt_och_arbetsgivaravgifter_per_anst')}>
            <DataTable
              columns={[
                { key: 'name', label: t('ui.anstalld'), emphasize: true },
                { key: 'gross', label: t('ui.bruttolon'), align: 'right', render: r => formatSEK(r.gross) },
                { key: 'tax', label: t('ui.avdragen_skatt'), align: 'right', render: r => formatSEK(r.tax) },
                { key: 'employerFee', label: t('ui.arbetsgivaravgifter'), align: 'right', render: r => formatSEK(r.employerFee) },
              ]}
              rows={report.rows}
              rowKey={r => r.employeeId}
              footer={['Summa', formatSEK(report.totals.gross), formatSEK(report.totals.tax), formatSEK(report.totals.employerFee)]}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── Kvartal ─────────────────────────────────────────────────────────────
// Räkenskapsåret kvartal för kvartal med moms och arbetsgivaravgifter, ligger
// sist i Resultaträkningen. Alltid innevarande räkenskapsår, oavsett vald period.
function QuarterPanel({ verifications, accounts, payrollRuns, company }) {
  const { fyStart, now } = useMemo(() => {
    const now = new Date();
    const { start: fyStart } = fiscalYearBounds(companyFiscalYearSetting(company), now);
    return { fyStart, now };
  }, [company]);

  const tablesReady = usePayrollPreload(payrollRuns);

  const quarters = useMemo(() => {
    const list = [];
    for (let q = 0; q < 4; q++) {
      const qStart = new Date(fyStart.getFullYear(), fyStart.getMonth() + q * 3, fyStart.getDate());
      const qNaturalEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, qStart.getDate() - 1);
      if (qStart > now) break;
      const qEnd = qNaturalEnd < now ? qNaturalEnd : now;
      const omsattning = sumFlowByType(verifications, accounts, 'intakt', qStart, qEnd);
      const kostnader = sumFlowByType(verifications, accounts, 'kostnad', qStart, qEnd);
      const vat = computeVatPeriod({ verifications, periodStart: toISO(qStart), periodEnd: toISO(qEnd) });
      const payroll = tablesReady ? aggregatePayroll(payrollRuns, qStart, qEnd) : { totals: { employerFee: 0 } };
      list.push({ label: t('ui.kvartal_2', { v0: q + 1 }), omsattning, resultat: omsattning - kostnader, momsAttBetala: vat.netToPay, arbetsgivaravgifter: payroll.totals.employerFee });
    }
    return list;
  }, [verifications, accounts, payrollRuns, tablesReady, fyStart, now]);

  return (
    <SheetPanel title={t('ui.kvartal_for_kvartal')} subtitle={t('ui.rakenskapsaret_som_startade', { v0: fmtDate(fyStart) })}>
      <DataTable
        columns={[
          { key: 'label', label: t('ui.kvartal'), emphasize: true },
          { key: 'omsattning', label: t('ui.omsattning'), align: 'right', render: r => formatSEK(r.omsattning) },
          { key: 'resultat', label: t('ui.resultat'), align: 'right', emphasize: true, render: r => formatSEK(r.resultat) },
          { key: 'momsAttBetala', label: t('ui.moms_att_betala'), align: 'right', render: r => formatSEK(r.momsAttBetala) },
          { key: 'arbetsgivaravgifter', label: t('ui.arbetsgivaravgifter'), align: 'right', render: r => (tablesReady ? formatSEK(r.arbetsgivaravgifter) : '…') },
        ]}
        rows={quarters}
        rowKey={r => r.label}
      />
    </SheetPanel>
  );
}

// ── Bokslutsunderlag ────────────────────────────────────────────────────
function ClosingReport(props) {
  const [tab, setTab] = useState('worksheet');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ChartTypeToggle
        value={tab} onChange={setTab} label={t('ui.rapp_bokslutsunderlag')}
        options={[{ id: 'worksheet', label: t('ui.arbetsblad') }, { id: 'equity', label: t('ui.forandring_av_eget_kapital') }]}
      />
      {tab === 'worksheet' ? <WorksheetReport {...props} /> : <EquityReport {...props} />}
    </div>
  );
}

// ── Verifikationslista (grundbok) ───────────────────────────────────────
// Bokföringen i datumordning, med kontroller överst: att varje verifikation
// balanserar och att nummerserierna saknar luckor (se utils/reportLedgers.js).
function CheckLine({ ok, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.5 }}>
      <span style={{ color: ok ? 'var(--status-green-text)' : 'var(--status-amber-text, #b45309)', display: 'flex', marginTop: '2px' }}>{ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}</span>
      <span>{children}</span>
    </div>
  );
}

function JournalReport({ verifications, accounts, start, end }) {
  const j = useMemo(() => computeJournal(verifications, accounts, start, end), [verifications, accounts, start, end]);
  if (j.count === 0) return <ReportSheet><EmptyState text={t('ui.inga_bokforda_transaktioner_for_denna_period')} /></ReportSheet>;
  const rows = [];
  for (const e of j.entries) {
    rows.push({ key: `${e.id}_h`, head: true, number: e.number, date: e.date, text: e.description });
    e.rows.forEach((r, i) => rows.push({ key: `${e.id}_${i}`, account: r.account, text: [r.name, r.text].filter(Boolean).join(' · '), debet: r.debet, kredit: r.kredit }));
  }
  const balanced = Math.abs(j.totalDebet - j.totalKredit) < 0.005 && j.unbalanced.length === 0;
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title={t('rpt.kontroller')}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <CheckLine ok>{t('rpt.journal_antal', { count: j.count })}</CheckLine>
              <CheckLine ok={balanced}>
                {balanced
                  ? t('rpt.journal_balanserar', { v: formatSEK(j.totalDebet) })
                  : t('rpt.journal_obalans', { list: j.unbalanced.map(u => `${u.number} (${formatSEK(u.diff)})`).join(', ') })}
              </CheckLine>
              <CheckLine ok={j.gaps.length === 0}>
                {j.gaps.length === 0
                  ? t('rpt.journal_inga_luckor')
                  : t('rpt.journal_luckor', { list: j.gaps.map(g => `${g.series}: ${g.missing.slice(0, 8).join(', ')}${g.missing.length > 8 ? ' …' : ''}`).join('; ') })}
              </CheckLine>
            </div>
          </SheetPanel>
        </div>
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title={t('rpt.verifikationslista')} subtitle={t('rpt.verifikationslista_hint')}>
            <DataTable
              columns={[
                { key: 'number', label: t('rpt.ver'), width: '84px', render: r => (r.head ? <strong style={{ color: 'var(--text-main)' }}>{r.number}</strong> : '') },
                { key: 'date', label: t('ui.datum'), width: '100px', render: r => (r.head ? <span style={{ whiteSpace: 'nowrap' }}>{r.date}</span> : '') },
                { key: 'account', label: t('rpt.konto'), width: '70px', render: r => r.account || '' },
                { key: 'text', label: t('rpt.text'), render: r => (r.head ? <strong style={{ color: 'var(--text-main)' }}>{r.text}</strong> : r.text) },
                { key: 'debet', label: t('ui.debet'), align: 'right', render: r => (r.debet ? formatSEK(r.debet) : '') },
                { key: 'kredit', label: t('ui.kredit'), align: 'right', render: r => (r.kredit ? formatSEK(r.kredit) : '') },
              ]}
              rows={rows}
              rowKey={r => r.key}
              footer={[t('rpt.summa'), '', '', '', formatSEK(j.totalDebet), formatSEK(j.totalKredit)]}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── Kund- och leverantörsreskontra ──────────────────────────────────────
// Öppna poster vid periodens slut, fördelade efter hur länge de varit
// förfallna, och avstämda mot 1510/2440 vid samma datum.
const ageLabels = () => ({ notDue: t('rpt.ej_forfallet'), d30: t('rpt.d30'), d60: t('rpt.d60'), d90: t('rpt.d90'), d90plus: t('rpt.d90plus') });

function OpenItemsReport({ kind, invoices, expenses, contacts, verifications, end }) {
  // Exakta belopp (inte tkr): reskontran ska gå att stämma av krona för krona.
  const { palette } = useReportDisplay();
  const customer = kind === 'receivables';
  const r = useMemo(
    () => (customer ? computeReceivables(invoices, contacts, end, verifications) : computePayables(expenses, contacts, end, verifications)),
    [customer, invoices, expenses, contacts, end, verifications],
  );
  const labels = ageLabels();
  const overdue = r.totals.total - r.totals.notDue;
  const matches = Math.abs(r.difference) < 1;
  const accountName = customer ? t('rpt.kundfordringar') : t('rpt.leverantorsskulder');
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={customer ? t('rpt.att_fa') : t('rpt.att_betala')} value={formatSEK(r.totals.total)} icon={Wallet} tone={customer ? palette.income : palette.cost} context={t(r.count === 1 ? 'rpt.poster_en' : 'rpt.poster', { count: r.count })} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label={t('rpt.forfallet')} value={formatSEK(overdue)} icon={AlertTriangle} tone={palette.cost} context={r.totals.d90plus ? t('rpt.varav_over_90', { v: formatSEK(r.totals.d90plus) }) : undefined} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile
            label={t('rpt.mot_bokforingen', { account: r.ledgerAccount })}
            value={matches ? t('rpt.stammer') : formatSEK(r.difference)}
            icon={matches ? CheckCircle2 : AlertTriangle}
            tone={matches ? palette.profit : palette.cost}
            context={t('rpt.saldo_konto', { name: accountName, v: formatSEK(r.ledgerBalance) })}
          />
        </div>
        {(!matches || r.unbooked > 0) && (
          <div className="sheet-span-12" style={cellBg}>
            <SheetPanel title={t('rpt.avstamning')}>
              <div style={{ display: 'grid', gap: '8px' }}>
                {r.unbooked > 0 && <CheckLine ok={false}>{t('rpt.obokforda', { v: formatSEK(r.unbooked) })}</CheckLine>}
                {!matches && <CheckLine ok={false}>{t(customer ? 'rpt.diff_kund' : 'rpt.diff_lev', { diff: formatSEK(r.difference), account: r.ledgerAccount })}</CheckLine>}
              </div>
            </SheetPanel>
          </div>
        )}
        {r.count === 0 ? (
          <div className="sheet-span-12" style={cellBg}><EmptyState text={customer ? t('rpt.inga_obetalda_kund') : t('rpt.inga_obetalda_lev')} /></div>
        ) : (
          <>
            <div className="sheet-span-12" style={cellBg}>
              <SheetPanel title={customer ? t('rpt.per_kund') : t('rpt.per_leverantor')} subtitle={t('rpt.alder_hint', { date: r.asOf })}>
                <DataTable
                  columns={[
                    { key: 'name', label: customer ? t('ui.kund') : t('rpt.leverantor'), emphasize: true, render: p => p.name || t('ui.okand') },
                    ...AGE_BUCKETS.map(b => ({ key: b.key, label: labels[b.key], align: 'right', render: p => (p[b.key] ? formatSEK(p[b.key]) : '') })),
                    { key: 'total', label: t('rpt.totalt'), align: 'right', emphasize: true, render: p => formatSEK(p.total) },
                  ]}
                  rows={r.parties}
                  rowKey={(p, i) => `${p.name}_${i}`}
                  footer={[t('rpt.summa'), ...AGE_BUCKETS.map(b => (r.totals[b.key] ? formatSEK(r.totals[b.key]) : '')), formatSEK(r.totals.total)]}
                />
              </SheetPanel>
            </div>
            <div className="sheet-span-12" style={cellBg}>
              <SheetPanel title={t('rpt.oppna_fakturor')}>
                <DataTable
                  columns={[
                    { key: 'number', label: t('rpt.faktura'), render: i => i.number || '—' },
                    { key: 'partyName', label: customer ? t('ui.kund') : t('rpt.leverantor'), render: i => i.partyName || t('ui.okand') },
                    { key: 'date', label: t('rpt.fakturadatum'), render: i => <span style={{ whiteSpace: 'nowrap' }}>{i.date}</span> },
                    { key: 'dueDate', label: t('rpt.forfallodag'), render: i => <span style={{ whiteSpace: 'nowrap' }}>{i.dueDate}</span> },
                    { key: 'daysOverdue', label: t('rpt.dagar_sen'), align: 'right', render: i => (i.daysOverdue > 0 ? String(i.daysOverdue) : '') },
                    { key: 'open', label: t('rpt.belopp'), align: 'right', emphasize: true, render: i => `${formatSEK(i.open)}${i.unbooked ? ` · ${t('rpt.ej_bokford')}` : ''}${i.currency ? ` (${i.currency})` : ''}` },
                  ]}
                  rows={r.parties.flatMap(p => p.items)}
                  rowKey={i => i.id}
                />
              </SheetPanel>
            </div>
          </>
        )}
      </div>
    </ReportSheet>
  );
}
