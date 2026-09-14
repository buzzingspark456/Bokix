import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Printer, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Percent, Scale, Wallet, Loader2, AlertTriangle } from 'lucide-react';
import {
  formatSEK, formatPct, fmtDate, fmtMonthYear, toISO, formatDelta,
  EmptyState, ReportSection, DataTable,
  CostBreakdownDonut, CostRankingList, BalanceSheetTable,
  formatSharePct,
  ChartTypeToggle, TREND_CHART_TYPES, FLOW_CHART_TYPES, SHARE_CHART_TYPES, KeyFigureGauge,
  ReportDisplayProvider, useReportDisplay, DisplaySettingsMenu,
  CHART_H_MAIN, CHART_H_SIDE,
  ReportSheet, SheetPanel, InlineLegend, StatTile, MarginLinesChart, MARGIN_SERIES,
  PeriodPicker, PeriodHeading, OVERVIEW_PERIODS, RevenueExpenseChart, CashflowComparisonChart,
} from './ReportUI';
import {
  sumFlowByType, buildResultSeries, buildMarginSeries, buildCashflowSeries, computeBalanceSheet,
  computeLedger, computeInvoiceReport, computeKeyFigures, fiscalYearBounds,
  groupCostsByCategory, groupCostsByAccount, overviewPeriodBounds,
} from '../../utils/reportCalculations';
import { computeVatPeriod } from '../../utils/vatCalculation';
import { VAT_RUTOR } from '../../utils/vatConfig';
import { getReportMeta } from '../../utils/reportDefinitions';
import { computeEmployeePayroll } from '../../utils/payrollCalculation';
import { neededTaxTableKeysForYear } from '../../utils/kuExport';
import { preloadSkattetabell } from '../../utils/skattetabell';

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
    sentences.push(`Omsättningen ${pct >= 0 ? 'ökade' : 'minskade'} med ${formatPct(Math.abs(pct), 0)} jämfört med föregående räkenskapsår (${formatSEK(prevOmsattning)} → ${formatSEK(omsattning)}).`);
  } else if (omsattning) {
    sentences.push(`Omsättningen för året landade på ${formatSEK(omsattning)}. Ingen bokföring hittades för föregående år att jämföra med.`);
  }
  if (prevResultat) {
    const pct = ((resultat - prevResultat) / Math.abs(prevResultat)) * 100;
    sentences.push(`Resultatet ${pct >= 0 ? 'ökade' : 'minskade'} med ${formatPct(Math.abs(pct), 0)} (${formatSEK(prevResultat)} → ${formatSEK(resultat)}).`);
  } else {
    sentences.push(`Årets resultat blev ${formatSEK(resultat)}${resultat >= 0 ? ', ett positivt resultat' : ', ett underskott'}.`);
  }
  if (vinstmarginal != null) {
    sentences.push(`Vinstmarginalen för året var ${formatPct(vinstmarginal)}.`);
  }
  if (soliditet != null) {
    sentences.push(`Soliditeten (eget kapital i förhållande till totala tillgångar) uppgick till ${formatPct(soliditet)}.`);
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
          name: `${row.employeeSnapshot.firstName || ''} ${row.employeeSnapshot.lastName || ''}`.trim() || 'Okänd',
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

/** `display` är företagets sparade presentationsval (färger + enhet, se
 * utils/chartPalette.js) och `onDisplayChange` sparar en ändring. Båda
 * kommer från Reports.jsx, som äger företagsposten — detaljvyn läser och
 * skickar vidare, den äger ingenting själv. */
export default function ReportDetail({
  reportId, bounds, verifications, accounts, invoices, payrollRuns, contacts, company,
  isMobile, onBack, display, onDisplayChange,
}) {
  const meta = getReportMeta(reportId);
  const { start, end, prevStart, prevEnd } = bounds;
  const periodLabel = `${bounds.label} · ${fmtMonthYear(start)}–${fmtMonthYear(end)}`;

  return (
    <ReportDisplayProvider colors={display?.colors} unit={display?.unit}>
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 20px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 600, padding: 0, marginBottom: '10px' }}>
          <ChevronLeft size={14} /> Alla rapporter
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{meta?.name || 'Rapport'}</h1>
            {/* Företagsöversikten (reportId === 'overview') har en EGEN,
                oberoende periodväljare (PeriodHeading/PeriodPicker, se
                OverviewReport nedan) — den här raden byggs av sidans
                GEMENSAMMA period (listvyns eget filter i Reports.jsx), som
                Företagsöversikten aldrig använt för sina egna beräkningar.
                Att visa båda samtidigt gav en synlig motsägelse (rubriken
                påstod t.ex. hela räkenskapsåret medan grafen, satt till
                "Denna månad", visade något helt annat) — döljs därför bara
                här, Företagsöversikten visar sin egen, korrekta rad istället. */}
            {reportId !== 'overview' && <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{periodLabel}</p>}
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
          {onDisplayChange && (
            <DisplaySettingsMenu
              colors={display?.colors} unit={display?.unit}
              onChange={onDisplayChange}
            />
          )}
          <button
            onClick={() => window.print()}
            title="Öppnar webbläsarens utskrift. Välj &quot;Spara som PDF&quot; som skrivare för en PDF-fil."
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
          >
            <Printer size={14} /> Skriv ut / PDF
          </button>
          </div>
        </div>
      </div>

      <div className="report-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {reportId === 'overview' && <OverviewReport {...{ verifications, accounts, company, isMobile }} />}
        {reportId === 'result' && <ResultReport {...{ verifications, accounts, start, end, prevStart, prevEnd, isMobile }} />}
        {reportId === 'balance' && <BalanceReport {...{ verifications, accounts, end }} />}
        {reportId === 'cashflow' && <CashflowReport {...{ verifications, accounts, start, end, prevStart, prevEnd, isMobile }} />}
        {reportId === 'keyfigures' && <KeyFiguresReport {...{ verifications, accounts, start, end }} />}
        {reportId === 'vat' && <VatReport {...{ verifications, start, end }} />}
        {reportId === 'ledger' && <LedgerReport {...{ verifications, accounts, start, end }} />}
        {reportId === 'invoices' && <InvoiceReport {...{ invoices, contacts, start, end }} />}
        {reportId === 'payroll' && <PayrollReport {...{ payrollRuns, start, end }} />}
        {reportId === 'annual' && <AnnualReport {...{ verifications, accounts, company, isMobile }} />}
        {reportId === 'quarterly' && <QuarterlyReport {...{ verifications, accounts, payrollRuns, company }} />}
        {reportId === 'monthly' && <MonthlyReport {...{ verifications, accounts }} />}
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

  const bounds = useMemo(() => overviewPeriodBounds(periodId, { fiscalYearStart: company?.fiscalYear, verifications }), [periodId, company?.fiscalYear, verifications]);
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
        ? 'Inga varukostnader eller finansiella poster i perioden — brutto- och vinstmarginalen sammanfaller med rörelsemarginalen.'
        : dropped[0] === 'brutto'
          ? 'Inga varukostnader i perioden — bruttomarginalen ligger på 100 % hela perioden.'
          : 'Inga finansiella poster i perioden — vinstmarginalen sammanfaller med rörelsemarginalen.';
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
        <ReportSection><EmptyState text={`Ingen bokförd data ännu för ${periodLabel.toLowerCase()}.`} /></ReportSection>
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
    ...(hasComparison ? { 'Föregående år': prevCashPoints[i] ? prevCashPoints[i].balance : null } : {}),
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
  const comparisonNote = comparable ? 'Jämfört med samma period föregående år.' : null;
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
              label="Omsättning" value={amount.value(k.omsattning)} icon={TrendingUp} tone={palette.income}
              delta={omsDelta} context={omsDelta?.context}
            />
          </div>
          <div className="sheet-span-3" style={cellBg}>
            <StatTile
              label="Resultat" value={amount.value(k.resultat)} icon={k.resultat >= 0 ? TrendingUp : TrendingDown}
              tone={k.resultat >= 0 ? palette.profit : palette.cost}
              accent={k.resultat >= 0 ? palette.profit : palette.cost}
              delta={resDelta}
              context={k.vinstmarginal != null ? `marginal ${fmtPct(k.vinstmarginal)}` : resDelta?.context}
            />
          </div>
          <div className="sheet-span-3" style={cellBg}>
            <StatTile
              label="Kassalikviditet" value={fmtPct(k.kassalikviditet)} icon={Wallet} tone={palette.cash}
              context={k.soliditet != null ? `soliditet ${fmtPct(k.soliditet)}` : 'saknar underlag'}
            />
          </div>
          <div className="sheet-span-3" style={cellBg}>
            <StatTile
              label="Kostnader" value={amount.value(k.kostnader)} icon={Scale} tone={palette.cost}
              delta={kostDelta}
              context={topCost ? `varav ${topCost.name.toLowerCase()} ${formatSharePct(topCost.amount, costCategories.total)}` : kostDelta?.context}
            />
          </div>

          <div className="sheet-span-7" style={cellBg}>
            <SheetPanel
              title="Intäkter vs utgifter"
              subtitle={comparisonNote}
              /* Kombi ritar en tredje serie (resultatet) — legenden måste
                 följa med, annars står en grön linje i diagrammet utan att
                 något säger vad den är. */
              legend={<InlineLegend items={[
                { label: 'Intäkter', color: palette.income },
                { label: 'Utgifter', color: palette.cost },
                ...(revenueChart === 'combo' ? [{ label: 'Resultat', color: palette.profit }] : []),
              ]} />}
              controls={<ChartTypeToggle value={revenueChart} onChange={setRevenueChart} options={TREND_CHART_TYPES} />}
            >
              <RevenueExpenseChart data={revenueExpenseData} isMobile={isMobile} granularity={granularity} height={mainH} variant={revenueChart} />
            </SheetPanel>
          </div>
          <div className="sheet-span-5" style={cellBg}>
            <SheetPanel
              title="Kostnadsfördelning"
              controls={costCategories.categories.length > 0
                ? <ChartTypeToggle value={costChart} onChange={setCostChart} options={SHARE_CHART_TYPES} />
                : null}
            >
              {costCategories.categories.length === 0
                ? <EmptyState text="Inga bokförda kostnader ännu." />
                : <CostBreakdownDonut categories={costCategories.categories} total={costCategories.total} variant={costChart} />}
            </SheetPanel>
          </div>

          <div className="sheet-span-7" style={cellBg}>
            <SheetPanel
              title="Marginalanalys"
              subtitle={visibleMargins.series.length > 1
                ? 'Andel av omsättningen som är kvar efter varje kostnadslager'
                : `${visibleMargins.series[0].label} — andel av omsättningen som är kvar efter rörelsens kostnader`}
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
              title="Kassaflöde"
              subtitle={`Likvida medel per period · ${amount.value(currentCash)} vid periodens slut`}
              controls={<ChartTypeToggle value={cashChart} onChange={setCashChart} options={FLOW_CHART_TYPES} />}
            >
              <CashflowComparisonChart
                data={cashChartData} currentLabel={periodLabel}
                previousLabel={comparable ? 'Föregående år' : null}
                height={sideH} variant={cashChart}
              />
            </SheetPanel>
          </div>

          <div className="sheet-span-7" style={cellBg}>
            <SheetPanel title="Största kostnadskontona" subtitle="De fem konton som drar mest i perioden">
              {costAccounts.rows.length === 0
                ? <EmptyState text="Inga bokförda kostnader ännu." />
                : <CostRankingList rows={costAccounts.rows} total={costAccounts.total} />}
            </SheetPanel>
          </div>
          {/* Nyckeltalen får en egen panel i stället för att bara ligga som
              kontexttext under brickorna högst upp: tre procenttal som
              ringar visar direkt vilket av dem som ligger lågt, vilket en
              rad text aldrig gör. Samma tal som brickorna, ingen ny
              beräkning — se computeKeyFigures. */}
          <div className="sheet-span-5" style={cellBg}>
            <SheetPanel title="Nyckeltal" subtitle="Tre fristående mått på hur företaget står — inte tre delar av samma helhet">
              <KeyFigureGauge
                figures={[
                  { label: 'Vinstmarginal', value: k.vinstmarginal, display: fmtPct(k.vinstmarginal), color: palette.profit, help: 'Andel av omsättningen som blir kvar' },
                  { label: 'Kassalikviditet', value: k.kassalikviditet, display: fmtPct(k.kassalikviditet), color: palette.cash, help: 'Omsättningstillgångar mot kortfristiga skulder' },
                  { label: 'Soliditet', value: k.soliditet, display: fmtPct(k.soliditet), color: palette.neutral, help: 'Eget kapital i förhållande till balansomslutningen' },
                ]}
              />
            </SheetPanel>
          </div>
        </div>
      </ReportSheet>
    </div>
  );
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
function ResultReport({ verifications, accounts, start, end, prevStart, prevEnd, isMobile }) {
  const { palette, amount } = useReportDisplay();
  const [chartType, setChartType] = useState('bar');

  const omsattning = useMemo(() => sumFlowByType(verifications, accounts, 'intakt', start, end), [verifications, accounts, start, end]);
  const kostnader = useMemo(() => sumFlowByType(verifications, accounts, 'kostnad', start, end), [verifications, accounts, start, end]);
  const resultat = omsattning - kostnader;
  const prevOmsattning = useMemo(() => sumFlowByType(verifications, accounts, 'intakt', prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const prevKostnader = useMemo(() => sumFlowByType(verifications, accounts, 'kostnad', prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const prevResultat = prevOmsattning - prevKostnader;
  const marginal = omsattning ? (resultat / omsattning) * 100 : null;

  const series = useMemo(() => buildResultSeries(verifications, accounts, start, end), [verifications, accounts, start, end]);
  const hasActivity = series.some(m => m.intakt !== 0 || m.kostnad !== 0);
  const chartData = series.map(m => ({ label: m.label, Intäkter: m.intakt, Utgifter: m.kostnad }));

  if (!hasActivity) return <ReportSheet><EmptyState text="Ingen bokförd data ännu för denna period." /></ReportSheet>;

  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label="Omsättning" value={amount.value(omsattning)} icon={TrendingUp} tone={palette.income} delta={formatDelta(omsattning, prevOmsattning)} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label="Kostnader" value={amount.value(kostnader)} icon={Scale} tone={palette.cost} delta={formatDelta(kostnader, prevKostnader, true)} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile
            label="Resultat" value={amount.value(resultat)} icon={resultat >= 0 ? TrendingUp : TrendingDown}
            tone={resultat >= 0 ? palette.profit : palette.cost} accent={resultat >= 0 ? palette.profit : palette.cost}
            delta={formatDelta(resultat, prevResultat)}
          />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label="Marginal" value={marginal != null ? fmtPct(marginal) : '—'} icon={Percent} tone={palette.neutral} context="andel av omsättningen" />
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title="Intäkter vs utgifter" subtitle="Grönt för lönsamma perioder, rött för de som gick back."
            legend={<InlineLegend items={[{ label: 'Intäkter', color: palette.income }, { label: 'Utgifter', color: palette.cost }]} />}
            controls={<ChartTypeToggle value={chartType} onChange={setChartType} options={TREND_CHART_TYPES} />}
          >
            <RevenueExpenseChart data={chartData} isMobile={isMobile} height={CHART_H_MAIN} variant={chartType} />
          </SheetPanel>
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title="Månad för månad">
            <DataTable
              columns={[
                { key: 'label', label: 'Månad' },
                { key: 'intakt', label: 'Intäkter', align: 'right', render: r => formatSEK(r.intakt) },
                { key: 'kostnad', label: 'Kostnader', align: 'right', render: r => formatSEK(r.kostnad) },
                { key: 'resultat', label: 'Resultat', align: 'right', emphasize: true, render: r => formatSEK(r.intakt - r.kostnad) },
              ]}
              rows={series}
              rowKey={r => r.label}
              footer={['Summa', formatSEK(omsattning), formatSEK(kostnader), formatSEK(resultat)]}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 2. Balansräkning ────────────────────────────────────────────────────
function BalanceReport({ verifications, accounts, end }) {
  const { palette, amount } = useReportDisplay();
  const balance = useMemo(() => computeBalanceSheet(verifications, accounts, end), [verifications, accounts, end]);
  const isEmpty = balance.assets.length === 0 && balance.equityAndLiabilities.length === 0;
  // Balansräkningens grundekvation: tillgångar = eget kapital + skulder,
  // alltid — ingen tredje, oberoende siffra att räkna fram. Brickan är
  // bara en visuell kontroll att de faktiskt stämmer, inte ett nytt mått.
  const balanced = Math.abs(balance.totalAssets - balance.totalEquityAndLiabilities) < 1;
  if (isEmpty) return <ReportSheet><EmptyState text="Inga bokförda tillgångs- eller skuldsaldon ännu." /></ReportSheet>;
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-6" style={cellBg}>
          <StatTile label="Tillgångar" value={amount.value(balance.totalAssets)} icon={Wallet} tone={palette.income} />
        </div>
        <div className="sheet-span-6" style={cellBg}>
          <StatTile
            label="Eget kapital och skulder" value={amount.value(balance.totalEquityAndLiabilities)} icon={Scale} tone={palette.neutral}
            context={balanced ? 'balanserar mot tillgångarna' : 'stämmer inte mot tillgångarna — bokför klart perioden'}
            accent={balanced ? undefined : 'var(--status-red-text)'}
          />
        </div>
        {/* Ingen extra avslutande punkt efter fmtDate(end) — svenska korta
            månadsförkortningar ("aug.", "sep.") har redan en egen punkt, en
            till gav en synlig dubbelpunkt ("28 aug.."). */}
        <div className="sheet-span-6" style={cellBg}>
          <SheetPanel title="Tillgångar" subtitle={`Per ${fmtDate(end)}`}>
            <BalanceSheetTable rows={balance.assets} total={balance.totalAssets} />
          </SheetPanel>
        </div>
        <div className="sheet-span-6" style={cellBg}>
          <SheetPanel title="Eget kapital och skulder" subtitle={`Per ${fmtDate(end)}`}>
            <BalanceSheetTable rows={balance.equityAndLiabilities} total={balance.totalEquityAndLiabilities} />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 3. Kassaflödesanalys ────────────────────────────────────────────────
function CashflowReport({ verifications, accounts, start, end, prevStart, prevEnd }) {
  const { palette, amount } = useReportDisplay();
  const [chartType, setChartType] = useState('area');
  const points = useMemo(() => buildCashflowSeries(verifications, accounts, start, end), [verifications, accounts, start, end]);
  const prevPoints = useMemo(() => buildCashflowSeries(verifications, accounts, prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const hasActivity = points.some(p => p.balance !== 0) || prevPoints.some(p => p.balance !== 0);
  const currentCash = points.length ? points[points.length - 1].balance : 0;
  const startCash = points.length ? points[0].balance : 0;
  const comparable = prevPoints.some(p => p.balance !== 0);
  const chartData = points.map((p, i) => ({
    label: fmtDate(p.date), 'Vald period': p.balance,
    ...(comparable ? { 'Föregående år': prevPoints[i] ? prevPoints[i].balance : null } : {}),
  }));

  if (!hasActivity) return <ReportSheet><EmptyState text="Ingen kassaflödesdata för denna period." /></ReportSheet>;

  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-6" style={cellBg}>
          <StatTile label="Saldo vid periodens slut" value={amount.value(currentCash)} icon={Wallet} tone={palette.cash} accent={currentCash >= 0 ? undefined : 'var(--status-red-text)'} />
        </div>
        <div className="sheet-span-6" style={cellBg}>
          <StatTile label="Förändring under perioden" value={amount.value(currentCash - startCash)} icon={currentCash >= startCash ? TrendingUp : TrendingDown} tone={currentCash >= startCash ? palette.profit : palette.cost} />
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title="Kassaflöde" subtitle="Ackumulerat saldo genom perioden, konto 1900–1999."
            controls={<ChartTypeToggle value={chartType} onChange={setChartType} options={FLOW_CHART_TYPES} />}
          >
            <CashflowComparisonChart
              data={chartData} currentLabel="Vald period" previousLabel={comparable ? 'Föregående år' : null}
              height={CHART_H_MAIN} variant={chartType}
            />
          </SheetPanel>
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title="Saldo per månad">
            <DataTable
              columns={[{ key: 'label', label: 'Datum' }, { key: 'balance', label: 'Saldo', align: 'right', emphasize: true, render: r => formatSEK(r.balance) }]}
              rows={points}
              rowKey={r => r.date}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 4. Nyckeltal ────────────────────────────────────────────────────────
function KeyFiguresReport({ verifications, accounts, start, end }) {
  const { palette } = useReportDisplay();
  const k = useMemo(() => computeKeyFigures(verifications, accounts, start, end), [verifications, accounts, start, end]);
  if (!k.hasData) return <ReportSheet><EmptyState text="Ingen bokförd data ännu för denna period." /></ReportSheet>;
  return (
    <ReportSheet>
      <div className="sheet-grid">
        {/* Samma KeyFigureGauge (ring per mått) som Översiktens egen
            "Nyckeltal"-panel — samma tre mått, samma visuella form, bara
            som en egen, full rapport i stället för en delyta bland fem
            andra. */}
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title="Nyckeltal" subtitle="Tre fristående mått på hur företaget står — inte tre delar av samma helhet.">
            <KeyFigureGauge
              figures={[
                { label: 'Vinstmarginal', value: k.vinstmarginal, display: fmtPct(k.vinstmarginal), color: palette.profit, help: 'Resultat i förhållande till omsättning. Högre är bättre.' },
                { label: 'Kassalikviditet', value: k.kassalikviditet, display: fmtPct(k.kassalikviditet), color: palette.cash, help: '(Kassa/bank + kundfordringar) / kortfristiga skulder — förenklad beräkning baserad på kontonummer.' },
                { label: 'Soliditet', value: k.soliditet, display: fmtPct(k.soliditet), color: palette.neutral, help: 'Eget kapital i förhållande till totala tillgångar.' },
              ]}
            />
          </SheetPanel>
        </div>
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title="Underlag">
            <DataTable
              columns={[{ key: 'label', label: 'Post' }, { key: 'value', label: 'Belopp', align: 'right', emphasize: true }]}
              rows={[
                { label: 'Omsättning', value: formatSEK(k.omsattning) },
                { label: 'Kostnader', value: formatSEK(k.kostnader) },
                { label: 'Resultat', value: formatSEK(k.resultat) },
                { label: 'Eget kapital', value: formatSEK(k.egetKapital) },
                { label: 'Totala tillgångar', value: formatSEK(k.totalaTillgangar) },
                { label: 'Kortfristiga skulder (konto ≥ 2400)', value: formatSEK(k.kortfristigaSkulder) },
                { label: 'Kassa och bank', value: formatSEK(k.kassaOchBank) },
                { label: 'Kundfordringar', value: formatSEK(k.kundfordringar) },
              ]}
              rowKey={r => r.label}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 5. Momsrapport ──────────────────────────────────────────────────────
function VatReport({ verifications, start, end }) {
  const { palette, amount } = useReportDisplay();
  const vat = useMemo(() => computeVatPeriod({ verifications, periodStart: toISO(start), periodEnd: toISO(end) }), [verifications, start, end]);
  const valueForRuta = (ruta) => {
    if (ruta.kind === 'salesTotal') return vat.underlagByRate[25] + vat.underlagByRate[12] + vat.underlagByRate[6];
    if (ruta.kind === 'output') return vat.outputVatByRate[ruta.rate];
    if (ruta.kind === 'input') return vat.inputVat;
    if (ruta.kind === 'net') return vat.netToPay;
    return 0;
  };
  const hasActivity = vat.outputVatTotal !== 0 || vat.inputVat !== 0;
  if (!hasActivity) return <ReportSheet><EmptyState text="Ingen momspliktig aktivitet bokförd för denna period." /></ReportSheet>;
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label="Utgående moms" value={amount.value(vat.outputVatTotal)} icon={ArrowUpRight} tone={palette.income} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label="Ingående moms" value={amount.value(vat.inputVat)} icon={ArrowDownRight} tone={palette.cost} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile
            label={vat.netToPay >= 0 ? 'Att betala' : 'Att få tillbaka'} value={amount.value(Math.abs(vat.netToPay))}
            icon={Scale} tone={vat.netToPay >= 0 ? palette.cost : palette.profit}
          />
        </div>
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title="Momsrapport" subtitle="Underlag till momsdeklarationen, ruta för ruta — samma beräkning som Skatt och bokslut → Moms.">
            <DataTable
              columns={[
                { key: 'ruta', label: 'Ruta', width: '70px' },
                { key: 'label', label: 'Beskrivning' },
                { key: 'value', label: 'Belopp', align: 'right', emphasize: true, render: r => formatSEK(r.value) },
              ]}
              rows={VAT_RUTOR.map(r => ({ ...r, value: valueForRuta(r) }))}
              rowKey={r => r.ruta}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 6. Huvudbok ─────────────────────────────────────────────────────────
function LedgerReport({ verifications, accounts, start, end }) {
  const ledger = useMemo(() => computeLedger(verifications, accounts, start, end), [verifications, accounts, start, end]);
  if (ledger.accounts.length === 0) return <ReportSheet><EmptyState text="Inga bokförda transaktioner för denna period." /></ReportSheet>;
  // En panel per konto, i samma sheet-grid som resten av rapporterna —
  // ingen naturlig nyckeltalsrad här (antalet konton varierar fritt), så
  // arket är bara staplade full-bredd-paneler i stället för ett rutnät.
  return (
    <ReportSheet>
      <div className="sheet-grid">
        {ledger.accounts.map(acc => (
          <div key={acc.code} className="sheet-span-12" style={cellBg}>
            <SheetPanel title={`${acc.code} — ${acc.name}`} subtitle={`Ingående saldo ${formatSEK(acc.openingBalance)} · Utgående saldo ${formatSEK(acc.closingBalance)}`}>
              {acc.rows.length === 0 ? (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Ingen aktivitet under perioden — saldot är oförändrat sedan periodens start.</div>
              ) : (
                <DataTable
                  columns={[
                    { key: 'date', label: 'Datum', width: '100px', render: r => fmtDate(r.date) },
                    { key: 'description', label: 'Beskrivning' },
                    { key: 'debet', label: 'Debet', align: 'right', render: r => r.debet ? formatSEK(r.debet) : '' },
                    { key: 'kredit', label: 'Kredit', align: 'right', render: r => r.kredit ? formatSEK(r.kredit) : '' },
                    { key: 'runningBalance', label: 'Saldo', align: 'right', emphasize: true, render: r => formatSEK(r.runningBalance) },
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

// ── 7. Fakturarapporter ─────────────────────────────────────────────────
function InvoiceReport({ invoices, contacts, start, end }) {
  const { palette, amount } = useReportDisplay();
  const report = useMemo(() => computeInvoiceReport(invoices, contacts, start, end), [invoices, contacts, start, end]);
  if (report.rows.length === 0) return <ReportSheet><EmptyState text="Inga kundfakturor bokförda/skickade för denna period." /></ReportSheet>;
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label="Fakturerat" value={amount.value(report.totals.invoiced)} icon={TrendingUp} tone={palette.income} context={`${report.invoiceCount} fakturor`} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label="Betalt" value={amount.value(report.totals.paid)} icon={ArrowUpRight} tone={palette.profit} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label="Utestående" value={amount.value(report.totals.outstanding)} icon={Scale} tone={palette.cost} />
        </div>
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title="Fakturerat, betalt och utestående per kund">
            <DataTable
              columns={[
                { key: 'name', label: 'Kund', emphasize: true },
                { key: 'invoiceCount', label: 'Antal', align: 'right' },
                { key: 'invoiced', label: 'Fakturerat', align: 'right', render: r => formatSEK(r.invoiced) },
                { key: 'paid', label: 'Betalt', align: 'right', render: r => formatSEK(r.paid) },
                { key: 'outstanding', label: 'Utestående', align: 'right', emphasize: true, render: r => formatSEK(r.outstanding) },
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
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Läser in skattetabeller…
        </div>
      </ReportSheet>
    );
  }
  if (!report || report.rows.length === 0) return <ReportSheet><EmptyState text="Inga bokförda lönekörningar för denna period." /></ReportSheet>;
  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label="Bruttolön" value={amount.value(report.totals.gross)} icon={TrendingUp} tone={palette.income} context={`${report.rows.length} anställda`} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label="Avdragen skatt" value={amount.value(report.totals.tax)} icon={Scale} tone={palette.cost} />
        </div>
        <div className="sheet-span-4" style={cellBg}>
          <StatTile label="Arbetsgivaravgifter" value={amount.value(report.totals.employerFee)} icon={ArrowDownRight} tone={palette.cost} />
        </div>
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title="Bruttolön, skatt och arbetsgivaravgifter per anställd">
            <DataTable
              columns={[
                { key: 'name', label: 'Anställd', emphasize: true },
                { key: 'gross', label: 'Bruttolön', align: 'right', render: r => formatSEK(r.gross) },
                { key: 'tax', label: 'Avdragen skatt', align: 'right', render: r => formatSEK(r.tax) },
                { key: 'employerFee', label: 'Arbetsgivaravgifter', align: 'right', render: r => formatSEK(r.employerFee) },
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

// ── 9. Årsrapport ───────────────────────────────────────────────────────
// Ignorerar avsiktligt sidans valda period — en årsrapport är per
// definition hela räkenskapsåret, oavsett vad som råkar vara valt i
// listvyns period-väljare (samma resonemang som Taxes.jsx alltid använder
// innevarande räkenskapsår, oberoende av Rapport och analys' egen filter).
function AnnualReport({ verifications, accounts, company, isMobile }) {
  const { palette, amount } = useReportDisplay();
  const [chartType, setChartType] = useState('bar');
  // Kodgranskning: `now`/fyStart/fyEnd räknades tidigare om som VANLIGA
  // const:ar i komponentkroppen (inte i en useMemo), men listades ändå som
  // useMemo-beroenden nedan — `new Date()` är ett NYTT objekt varje render,
  // så jämförelsen mot förra rendern var aldrig lika och memoiseringen
  // gjorde alltså ingenting alls (räknade om k/prevK/series/prevSeries på
  // VARJE render, inte bara när verifications/accounts faktiskt ändrades).
  // Hela datumintervallet i en enda useMemo, med `now` beräknad INUTI den
  // — stabilt över omrenderingar tills company.fiscalYear faktiskt ändras.
  // fiscalYearBounds (reportCalculations.js) återanvänds istället för att
  // (som innan) räkna ut samma sak för hand igen här.
  const { fyStart, fyEnd, prevStart, prevEnd } = useMemo(() => {
    const now = new Date();
    const { start: fyStart, end: fyNaturalEnd } = fiscalYearBounds(company?.fiscalYear, now);
    const fyEnd = fyNaturalEnd < now ? fyNaturalEnd : now;
    const prevStart = new Date(fyStart.getFullYear() - 1, fyStart.getMonth(), fyStart.getDate());
    const prevEnd = new Date(fyEnd.getFullYear() - 1, fyEnd.getMonth(), fyEnd.getDate());
    return { fyStart, fyEnd, prevStart, prevEnd };
  }, [company?.fiscalYear]);

  const k = useMemo(() => computeKeyFigures(verifications, accounts, fyStart, fyEnd), [verifications, accounts, fyStart, fyEnd]);
  const prevK = useMemo(() => computeKeyFigures(verifications, accounts, prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const series = useMemo(() => buildResultSeries(verifications, accounts, fyStart, fyEnd), [verifications, accounts, fyStart, fyEnd]);
  const hasActivity = series.some(m => m.intakt !== 0 || m.kostnad !== 0);

  if (!hasActivity) return <ReportSheet><EmptyState text="Ingen bokförd data ännu för innevarande räkenskapsår." /></ReportSheet>;

  const summary = buildAnnualSummary({
    omsattning: k.omsattning, prevOmsattning: prevK.omsattning,
    resultat: k.resultat, prevResultat: prevK.resultat,
    vinstmarginal: k.vinstmarginal, soliditet: k.soliditet,
  });
  const revenueExpenseData = series.map(m => ({ label: m.label, Intäkter: m.intakt, Utgifter: m.kostnad }));

  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title={`Räkenskapsåret ${fyStart.getFullYear()}${fyStart.getFullYear() !== fyEnd.getFullYear() ? `–${fyEnd.getFullYear()}` : ''}`} subtitle={`${fmtDate(fyStart)} – ${fmtDate(fyEnd)}`}>
            <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.7, margin: 0 }}>{summary}</p>
          </SheetPanel>
        </div>

        <div className="sheet-span-3" style={cellBg}>
          <StatTile label="Omsättning" value={amount.value(k.omsattning)} icon={TrendingUp} tone={palette.income} delta={formatDelta(k.omsattning, prevK.omsattning)} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile
            label="Resultat" value={amount.value(k.resultat)} icon={k.resultat >= 0 ? TrendingUp : TrendingDown}
            tone={k.resultat >= 0 ? palette.profit : palette.cost} accent={k.resultat >= 0 ? palette.profit : palette.cost}
            delta={formatDelta(k.resultat, prevK.resultat)}
          />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label="Vinstmarginal" value={fmtPct(k.vinstmarginal)} icon={Percent} tone={palette.neutral} />
        </div>
        <div className="sheet-span-3" style={cellBg}>
          <StatTile label="Soliditet" value={fmtPct(k.soliditet)} icon={Scale} tone={palette.neutral} />
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title="Resultat per månad"
            legend={<InlineLegend items={[{ label: 'Intäkter', color: palette.income }, { label: 'Utgifter', color: palette.cost }]} />}
            controls={<ChartTypeToggle value={chartType} onChange={setChartType} options={TREND_CHART_TYPES} />}
          >
            <RevenueExpenseChart data={revenueExpenseData} isMobile={isMobile} height={CHART_H_MAIN} variant={chartType} />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 10. Kvartalsrapport ─────────────────────────────────────────────────
function QuarterlyReport({ verifications, accounts, payrollRuns, company }) {
  const { palette, amount } = useReportDisplay();
  // Samma fix/resonemang som AnnualReport ovan: `now`/fyStart i en enda
  // useMemo (stabil tills company.fiscalYear ändras, inte ett nytt
  // Date-objekt varje render) + fiscalYearBounds återanvänd istället för
  // handuträknad igen.
  const { fyStart, now } = useMemo(() => {
    const now = new Date();
    const { start: fyStart } = fiscalYearBounds(company?.fiscalYear, now);
    return { fyStart, now };
  }, [company?.fiscalYear]);

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
      list.push({ label: `Kvartal ${q + 1}`, start: qStart, end: qEnd, omsattning, kostnader, resultat: omsattning - kostnader, momsAttBetala: vat.netToPay, arbetsgivaravgifter: payroll.totals.employerFee });
    }
    return list;
  }, [verifications, accounts, payrollRuns, tablesReady, fyStart, now]);

  if (quarters.every(q => q.omsattning === 0 && q.kostnader === 0)) {
    return <ReportSheet><EmptyState text="Ingen bokförd data ännu för innevarande räkenskapsår." /></ReportSheet>;
  }

  const totalOmsattning = quarters.reduce((s, q) => s + q.omsattning, 0);
  const totalResultat = quarters.reduce((s, q) => s + q.resultat, 0);
  const chartData = quarters.map(q => ({ label: q.label, Intäkter: q.omsattning, Utgifter: q.kostnader }));

  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-6" style={cellBg}>
          <StatTile label="Omsättning hittills i år" value={amount.value(totalOmsattning)} icon={TrendingUp} tone={palette.income} />
        </div>
        <div className="sheet-span-6" style={cellBg}>
          <StatTile
            label="Resultat hittills i år" value={amount.value(totalResultat)} icon={totalResultat >= 0 ? TrendingUp : TrendingDown}
            tone={totalResultat >= 0 ? palette.profit : palette.cost} accent={totalResultat >= 0 ? palette.profit : palette.cost}
          />
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title="Omsättning per kvartal" subtitle={`Räkenskapsåret som startade ${fmtDate(fyStart)}`}
            legend={<InlineLegend items={[{ label: 'Intäkter', color: palette.income }, { label: 'Utgifter', color: palette.cost }]} />}
          >
            <RevenueExpenseChart data={chartData} isMobile={false} height={CHART_H_SIDE} variant="bar" />
          </SheetPanel>
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title="Kvartal för kvartal">
            <DataTable
              columns={[
                { key: 'label', label: 'Kvartal', emphasize: true },
                { key: 'omsattning', label: 'Omsättning', align: 'right', render: r => formatSEK(r.omsattning) },
                { key: 'resultat', label: 'Resultat', align: 'right', emphasize: true, render: r => formatSEK(r.resultat) },
                { key: 'momsAttBetala', label: 'Moms att betala', align: 'right', render: r => formatSEK(r.momsAttBetala) },
                { key: 'arbetsgivaravgifter', label: 'Arbetsgivaravgifter', align: 'right', render: r => tablesReady ? formatSEK(r.arbetsgivaravgifter) : '…' },
                {
                  key: 'trend', label: 'Utveckling', align: 'right', render: (r, i) => {
                    if (i === 0) return '—';
                    const prev = quarters[i - 1];
                    const delta = formatDelta(r.resultat, prev.resultat);
                    if (!delta) return '—';
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: delta.good === null ? 'var(--text-muted)' : delta.good ? 'var(--status-green-text)' : 'var(--status-red-text)', fontWeight: 600 }}>
                        {delta.good !== null && (delta.good ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
                        {delta.text.split(' mot')[0]}
                      </span>
                    );
                  },
                },
              ]}
              rows={quarters}
              rowKey={r => r.label}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}

// ── 11. Månadsrapport ───────────────────────────────────────────────────
function MonthlyReport({ verifications, accounts }) {
  const { palette, amount } = useReportDisplay();
  const months = useMemo(() => {
    const now = new Date();
    const list = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mNaturalEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const mEnd = mNaturalEnd < now ? mNaturalEnd : now;
      const omsattning = sumFlowByType(verifications, accounts, 'intakt', mStart, mEnd);
      const kostnader = sumFlowByType(verifications, accounts, 'kostnad', mStart, mEnd);
      list.push({ label: new Intl.DateTimeFormat('sv-SE', { month: 'short', year: '2-digit' }).format(d), start: mStart, end: mEnd, omsattning, kostnader, resultat: omsattning - kostnader });
    }
    return list;
  }, [verifications, accounts]);

  const latest = months[months.length - 1];
  const prior = months.slice(0, -1);
  const avgPriorResultat = prior.length ? prior.reduce((s, m) => s + m.resultat, 0) / prior.length : 0;
  const avgPriorOmsattning = prior.length ? prior.reduce((s, m) => s + m.omsattning, 0) / prior.length : 0;

  const hasActivity = months.some(m => m.omsattning !== 0 || m.kostnader !== 0);
  if (!hasActivity) return <ReportSheet><EmptyState text="Ingen bokförd data ännu." /></ReportSheet>;

  // Avvikelse: >30% avvikelse mot snittet av de 12 föregående månaderna
  // flaggas — en tydlig, förklarad tröskel istället för en gissad "känsla".
  const deviationFlag = (value, avg) => {
    if (!avg) return null;
    const pct = ((value - avg) / Math.abs(avg)) * 100;
    if (Math.abs(pct) < 30) return null;
    return { pct, up: pct > 0 };
  };
  const omsDeviation = deviationFlag(latest.omsattning, avgPriorOmsattning);
  const resDeviation = deviationFlag(latest.resultat, avgPriorResultat);
  const chartData = months.map(m => ({ label: m.label, Intäkter: m.omsattning, Utgifter: m.kostnader }));

  return (
    <ReportSheet>
      <div className="sheet-grid">
        <div className="sheet-span-6" style={cellBg}>
          <StatTile
            label="Omsättning senaste månaden" value={amount.value(latest.omsattning)} icon={TrendingUp} tone={palette.income}
            delta={omsDeviation ? { text: `${omsDeviation.up ? '+' : ''}${formatPct(omsDeviation.pct, 0)} mot snittet`, good: omsDeviation.up } : null}
            context={!omsDeviation ? `snitt ${formatSEK(avgPriorOmsattning)}` : undefined}
          />
        </div>
        <div className="sheet-span-6" style={cellBg}>
          <StatTile
            label="Resultat senaste månaden" value={amount.value(latest.resultat)} icon={latest.resultat >= 0 ? TrendingUp : TrendingDown}
            tone={latest.resultat >= 0 ? palette.profit : palette.cost} accent={latest.resultat >= 0 ? palette.profit : palette.cost}
            delta={resDeviation ? { text: `${resDeviation.up ? '+' : ''}${formatPct(resDeviation.pct, 0)} mot snittet`, good: resDeviation.up } : null}
            context={!resDeviation ? `snitt ${formatSEK(avgPriorResultat)}` : undefined}
          />
        </div>

        {(omsDeviation || resDeviation) && (
          <div className="sheet-span-12" style={cellBg}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '14px 28px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Markant avvikelse (≥30%) mot de tolv föregående månadernas snitt, {latest.label} — värt en extra koll, men inte nödvändigtvis fel.</span>
            </div>
          </div>
        )}

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel
            title="De senaste 13 månaderna" subtitle="Jämfört med snittet av de tolv föregående månaderna."
            legend={<InlineLegend items={[{ label: 'Intäkter', color: palette.income }, { label: 'Utgifter', color: palette.cost }]} />}
          >
            <RevenueExpenseChart data={chartData} isMobile={false} height={CHART_H_MAIN} variant="bar" />
          </SheetPanel>
        </div>

        <div className="sheet-span-12" style={cellBg}>
          <SheetPanel title="De senaste 13 månaderna, i siffror">
            <DataTable
              columns={[
                { key: 'label', label: 'Månad' },
                { key: 'omsattning', label: 'Omsättning', align: 'right', render: r => formatSEK(r.omsattning) },
                { key: 'kostnader', label: 'Kostnader', align: 'right', render: r => formatSEK(r.kostnader) },
                { key: 'resultat', label: 'Resultat', align: 'right', emphasize: true, render: r => formatSEK(r.resultat) },
              ]}
              rows={[...months].reverse()}
              rowKey={r => r.label}
            />
          </SheetPanel>
        </div>
      </div>
    </ReportSheet>
  );
}
