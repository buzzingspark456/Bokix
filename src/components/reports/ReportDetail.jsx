import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Download, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Percent, Scale, Wallet, Loader2, AlertTriangle } from 'lucide-react';
import {
  formatSEK, fmtDate, fmtMonthYear, toISO, formatDelta,
  KpiCard, TabHeadline, EmptyState, ReportSection, DataTable,
  ResultBarChart, CashflowLineChart, TrendChart, ChartFormatToggle,
  CostBreakdownDonut, CostRankingList, BalanceSheetTable, ComparisonLegend, swatch, REVENUE,
} from './ReportUI';
import {
  sumFlowByType, buildResultSeries, buildCashflowSeries, computeBalanceSheet,
  computeLedger, computeInvoiceReport, computeKeyFigures, fiscalYearBounds,
  groupCostsByCategory, groupCostsByAccount,
} from '../../utils/reportCalculations';
import { computeVatPeriod } from '../../utils/vatCalculation';
import { VAT_RUTOR } from '../../utils/vatConfig';
import { getReportMeta } from '../../utils/reportDefinitions';
import { computeEmployeePayroll } from '../../utils/payrollCalculation';
import { neededTaxTableKeysForYear } from '../../utils/kuExport';
import { preloadSkattetabell } from '../../utils/skattetabell';

const fmtPct = (v) => (v == null ? '—' : `${v.toFixed(1)}%`);

/** Genererar en kort, faktabaserad sammanfattning för Årsrapporten utifrån
 * redan beräknade, riktiga tal — INTE ett fritextfält användaren förväntas
 * fylla i själv (Sida 14c, uttryckligt krav). Rena mall-meningar med
 * verkliga siffror insatta, aldrig en påhittad slutsats. */
function buildAnnualSummary({ omsattning, prevOmsattning, resultat, prevResultat, vinstmarginal, soliditet }) {
  const sentences = [];
  if (prevOmsattning) {
    const pct = ((omsattning - prevOmsattning) / Math.abs(prevOmsattning)) * 100;
    sentences.push(`Omsättningen ${pct >= 0 ? 'ökade' : 'minskade'} med ${Math.abs(pct).toFixed(0)}% jämfört med föregående räkenskapsår (${formatSEK(prevOmsattning)} → ${formatSEK(omsattning)}).`);
  } else if (omsattning) {
    sentences.push(`Omsättningen för året landade på ${formatSEK(omsattning)}. Ingen bokföring hittades för föregående år att jämföra med.`);
  }
  if (prevResultat) {
    const pct = ((resultat - prevResultat) / Math.abs(prevResultat)) * 100;
    sentences.push(`Resultatet ${pct >= 0 ? 'ökade' : 'minskade'} med ${Math.abs(pct).toFixed(0)}% (${formatSEK(prevResultat)} → ${formatSEK(resultat)}).`);
  } else {
    sentences.push(`Årets resultat blev ${formatSEK(resultat)}${resultat >= 0 ? ', ett positivt resultat' : ', ett underskott'}.`);
  }
  if (vinstmarginal != null) {
    sentences.push(`Vinstmarginalen för året var ${vinstmarginal.toFixed(1)}%.`);
  }
  if (soliditet != null) {
    sentences.push(`Soliditeten (eget kapital i förhållande till totala tillgångar) uppgick till ${soliditet.toFixed(1)}%.`);
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

export default function ReportDetail({
  reportId, bounds, verifications, accounts, invoices, payrollRuns, contacts, company,
  isMobile, onBack,
}) {
  const meta = getReportMeta(reportId);
  const { start, end, prevStart, prevEnd } = bounds;
  const periodLabel = `${bounds.label} · ${fmtMonthYear(start)}–${fmtMonthYear(end)}`;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '16px 20px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 600, padding: 0, marginBottom: '10px' }}>
          <ChevronLeft size={14} /> Alla rapporter
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{meta?.name || 'Rapport'}</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{periodLabel}</p>
          </div>
          {/* Ladda ner-knappen: platsen och utformningen finns redan (Sida
              14c, uppföljning), men själva PDF/Excel-kopplingen är ett
              senare steg — därför inaktiv med en tydlig "kommer snart"-
              förklaring istället för att låtsas fungera. */}
          <button
            disabled
            title="PDF/Excel-export för enskilda rapporter kommer i ett senare steg."
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)', cursor: 'not-allowed' }}
          >
            <Download size={14} /> Ladda ner (kommer snart)
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
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
function OverviewReport({ verifications, accounts, company, isMobile }) {
  // Kundönskemål: "de kan välja typ av graf" — tre oberoende format-val,
  // ett per panel (inte ett enda globalt för hela sidan, eftersom
  // Stapel/Linje/Yta passar olika bra för olika serier, se
  // ChartFormatToggle-kommentaren i ReportUI.jsx). 'bar' som standard för
  // Omsättning/resultat (matchar tidigare fast beteende innan den här
  // ändringen), 'area' som standard för Marginal/Kassaflöde (samma
  // gradientfyllda look som redan var fast innan valmöjligheten fanns).
  const [resultFormat, setResultFormat] = useState('bar');
  const [marginFormat, setMarginFormat] = useState('area');
  const [cashFormat, setCashFormat] = useState('area');

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
  const prevSeries = useMemo(() => buildResultSeries(verifications, accounts, prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const cashPoints = useMemo(() => buildCashflowSeries(verifications, accounts, fyStart, fyEnd), [verifications, accounts, fyStart, fyEnd]);
  const prevCashPoints = useMemo(() => buildCashflowSeries(verifications, accounts, prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const costCategories = useMemo(() => groupCostsByCategory(verifications, accounts, fyStart, fyEnd), [verifications, accounts, fyStart, fyEnd]);
  const costAccounts = useMemo(() => groupCostsByAccount(verifications, accounts, fyStart, fyEnd), [verifications, accounts, fyStart, fyEnd]);

  const hasActivity = series.some(m => m.intakt !== 0 || m.kostnad !== 0);
  if (!hasActivity) return <ReportSection><EmptyState text="Ingen bokförd data ännu för innevarande räkenskapsår." /></ReportSection>;

  const resultChartData = series.map((m, i) => ({ label: m.label, resultat: m.intakt - m.kostnad, prevResultat: prevSeries[i] ? (prevSeries[i].intakt - prevSeries[i].kostnad) : null }));
  // `margin`: null (inte 0) för en månad helt utan omsättning — 0/0 är
  // odefinierat, inte "0% marginal", och TrendChart hoppar redan medvetet
  // över null-punkter i Linje-/Yta-format (connectNulls={false}) istället
  // för att rita ett missvisande dropp till noll.
  const marginData = series.map(m => ({ label: m.label, margin: m.intakt !== 0 ? ((m.intakt - m.kostnad) / m.intakt) * 100 : null }));
  const cashChartData = cashPoints.map((p, i) => ({ label: fmtDate(p.date), balance: p.balance, prevBalance: prevCashPoints[i] ? prevCashPoints[i].balance : null }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <KpiCard label="Omsättning" value={formatSEK(k.omsattning)} icon={TrendingUp} accent="var(--text-main)" iconBg="var(--border-light)" delta={formatDelta(k.omsattning, prevK.omsattning)} />
        <KpiCard label="Resultat" value={formatSEK(k.resultat)} icon={k.resultat >= 0 ? TrendingUp : TrendingDown} accent={k.resultat >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)'} iconBg="var(--border-light)" delta={formatDelta(k.resultat, prevK.resultat)} />
        <KpiCard label="Vinstmarginal" value={fmtPct(k.vinstmarginal)} icon={Percent} accent="var(--text-main)" iconBg="var(--border-light)" />
        <KpiCard label="Soliditet" value={fmtPct(k.soliditet)} icon={Scale} accent="var(--text-main)" iconBg="var(--border-light)" />
      </div>

      <ReportSection
        title="Omsättning och resultat" subtitle="Resultat per månad, jämfört med samma period föregående räkenskapsår."
        actions={<ChartFormatToggle value={resultFormat} onChange={setResultFormat} formats={['bar', 'line', 'area']} />}
      >
        <TrendChart
          data={resultChartData} format={resultFormat} isMobile={isMobile}
          dataKey="resultat" name="Resultat" colorBySign
          prevDataKey="prevResultat" prevName="Föregående räkenskapsår"
        />
        <ComparisonLegend currentLabel="Innevarande räkenskapsår" previousLabel="Föregående räkenskapsår" currentColorSwatch={swatch(REVENUE)} previousColorSwatch={swatch('var(--text-muted)', true)} />
      </ReportSection>

      <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <ReportSection title="Kostnadsfördelning" subtitle="Var pengarna gick, i fyra breda kategorier.">
          {costCategories.categories.length === 0
            ? <EmptyState text="Inga bokförda kostnader ännu." />
            : <CostBreakdownDonut categories={costCategories.categories} total={costCategories.total} />}
        </ReportSection>
        <ReportSection
          title="Marginalutveckling" subtitle="Vinstmarginal per månad — resultat i förhållande till omsättning."
          actions={<ChartFormatToggle value={marginFormat} onChange={setMarginFormat} formats={['area', 'line']} />}
        >
          <TrendChart
            data={marginData} format={marginFormat} isMobile={isMobile}
            dataKey="margin" name="Vinstmarginal" color={REVENUE}
            yTickFormatter={v => `${v}%`} valueFormatter={v => `${v.toFixed(1)}%`}
            yAxisWidth={48}
          />
        </ReportSection>
      </div>

      <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <ReportSection
          title="Kassaflöde" subtitle="Ackumulerat saldo på bank och i kassa genom året."
          actions={<ChartFormatToggle value={cashFormat} onChange={setCashFormat} formats={['area', 'line']} />}
        >
          <TrendChart
            data={cashChartData} format={cashFormat} isMobile={isMobile}
            dataKey="balance" name="Saldo" color="var(--accent)"
            prevDataKey="prevBalance" prevName="Föregående räkenskapsår"
          />
          <ComparisonLegend currentLabel="Innevarande räkenskapsår" previousLabel="Föregående räkenskapsår" currentColorSwatch={swatch('var(--accent)')} previousColorSwatch={swatch('var(--text-muted)', true)} />
        </ReportSection>
        <ReportSection title="Största kostnadskontona" subtitle="De fem konton som stod för mest av årets kostnader.">
          {costAccounts.rows.length === 0
            ? <EmptyState text="Inga bokförda kostnader ännu." />
            : <CostRankingList rows={costAccounts.rows} total={costAccounts.total} />}
        </ReportSection>
      </div>
    </div>
  );
}

// ── 1. Resultaträkning ──────────────────────────────────────────────────
function ResultReport({ verifications, accounts, start, end, prevStart, prevEnd, isMobile }) {
  const omsattning = useMemo(() => sumFlowByType(verifications, accounts, 'intakt', start, end), [verifications, accounts, start, end]);
  const kostnader = useMemo(() => sumFlowByType(verifications, accounts, 'kostnad', start, end), [verifications, accounts, start, end]);
  const resultat = omsattning - kostnader;
  const prevOmsattning = useMemo(() => sumFlowByType(verifications, accounts, 'intakt', prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const prevKostnader = useMemo(() => sumFlowByType(verifications, accounts, 'kostnad', prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const prevResultat = prevOmsattning - prevKostnader;

  const series = useMemo(() => buildResultSeries(verifications, accounts, start, end), [verifications, accounts, start, end]);
  const prevSeries = useMemo(() => buildResultSeries(verifications, accounts, prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const hasActivity = series.some(m => m.intakt !== 0 || m.kostnad !== 0);
  const chartData = series.map((m, i) => ({ label: m.label, resultat: m.intakt - m.kostnad, prevResultat: prevSeries[i] ? (prevSeries[i].intakt - prevSeries[i].kostnad) : null }));

  if (!hasActivity) return <ReportSection><EmptyState text="Ingen bokförd data ännu för denna period." /></ReportSection>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ReportSection>
        <TabHeadline label="Resultat för perioden" value={formatSEK(resultat)} accent={resultat >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)'} delta={formatDelta(resultat, prevResultat)} />
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Grönt för lönsamma perioder, rött för de som gick back.</p>
        <ResultBarChart data={chartData} isMobile={isMobile} />
        <ComparisonLegend currentLabel="Vald period" previousLabel="Föregående år" currentColorSwatch={swatch(REVENUE)} previousColorSwatch={swatch('var(--text-muted)', true)} />
      </ReportSection>
      <ReportSection title="Månad för månad">
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
      </ReportSection>
    </div>
  );
}

// ── 2. Balansräkning ────────────────────────────────────────────────────
function BalanceReport({ verifications, accounts, end }) {
  const balance = useMemo(() => computeBalanceSheet(verifications, accounts, end), [verifications, accounts, end]);
  const isEmpty = balance.assets.length === 0 && balance.equityAndLiabilities.length === 0;
  return (
    // Ingen extra avslutande punkt efter fmtDate(end) — svenska korta
    // månadsförkortningar ("aug.", "sep.") har redan en egen punkt, en till
    // gav en synlig dubbelpunkt ("28 aug..").
    <ReportSection title="Balansräkning" subtitle={`Ögonblicksbild av vad företaget äger och är skyldigt, per ${fmtDate(end)}`}>
      {isEmpty ? <EmptyState text="Inga bokförda tillgångs- eller skuldsaldon ännu." /> : (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <BalanceSheetTable title="Tillgångar" rows={balance.assets} total={balance.totalAssets} />
          <BalanceSheetTable title="Eget kapital och skulder" rows={balance.equityAndLiabilities} total={balance.totalEquityAndLiabilities} />
        </div>
      )}
    </ReportSection>
  );
}

// ── 3. Kassaflödesanalys ────────────────────────────────────────────────
function CashflowReport({ verifications, accounts, start, end, prevStart, prevEnd, isMobile }) {
  const points = useMemo(() => buildCashflowSeries(verifications, accounts, start, end), [verifications, accounts, start, end]);
  const prevPoints = useMemo(() => buildCashflowSeries(verifications, accounts, prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const hasActivity = points.some(p => p.balance !== 0) || prevPoints.some(p => p.balance !== 0);
  const currentCash = points.length ? points[points.length - 1].balance : 0;
  const chartData = points.map((p, i) => ({ label: fmtDate(p.date), balance: p.balance, prevBalance: prevPoints[i] ? prevPoints[i].balance : null }));

  if (!hasActivity) return <ReportSection><EmptyState text="Ingen kassaflödesdata för denna period." /></ReportSection>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ReportSection>
        <TabHeadline label="Pengar på bank och i kassa" value={formatSEK(currentCash)} accent={currentCash >= 0 ? 'var(--text-main)' : 'var(--status-red-text)'} />
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Ackumulerat saldo genom perioden, konto 1900–1999.</p>
        <CashflowLineChart data={chartData} isMobile={isMobile} />
        <ComparisonLegend currentLabel="Vald period" previousLabel="Föregående år" currentColorSwatch={swatch('var(--accent)')} previousColorSwatch={swatch('var(--text-muted)', true)} />
      </ReportSection>
      <ReportSection title="Saldo per månad">
        <DataTable
          columns={[{ key: 'label', label: 'Datum' }, { key: 'balance', label: 'Saldo', align: 'right', emphasize: true, render: r => formatSEK(r.balance) }]}
          rows={points}
          rowKey={r => r.date}
        />
      </ReportSection>
    </div>
  );
}

// ── 4. Nyckeltal ────────────────────────────────────────────────────────
function KeyFiguresReport({ verifications, accounts, start, end }) {
  const k = useMemo(() => computeKeyFigures(verifications, accounts, start, end), [verifications, accounts, start, end]);
  if (!k.hasData) return <ReportSection><EmptyState text="Ingen bokförd data ännu för denna period." /></ReportSection>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        <KpiCard label="Vinstmarginal" value={fmtPct(k.vinstmarginal)} icon={Percent} accent="var(--text-main)" iconBg="var(--border-light)" help="Resultat i förhållande till omsättning. Högre är bättre." />
        <KpiCard label="Soliditet" value={fmtPct(k.soliditet)} icon={Scale} accent="var(--text-main)" iconBg="var(--border-light)" help="Eget kapital i förhållande till totala tillgångar — hur mycket av verksamheten som är finansierad med eget kapital snarare än lån." />
        <KpiCard label="Kassalikviditet (ungefärlig)" value={fmtPct(k.kassalikviditet)} icon={Wallet} accent="var(--text-main)" iconBg="var(--border-light)" help="(Kassa/bank + kundfordringar) / kortfristiga skulder — förmågan att betala kortfristiga skulder. Förenklad beräkning baserad på kontonummer, inte en fullständig uppdelning i lång-/kortfristigt." />
      </div>
      <ReportSection title="Underlag">
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
      </ReportSection>
    </div>
  );
}

// ── 5. Momsrapport ──────────────────────────────────────────────────────
function VatReport({ verifications, start, end }) {
  const vat = useMemo(() => computeVatPeriod({ verifications, periodStart: toISO(start), periodEnd: toISO(end) }), [verifications, start, end]);
  const valueForRuta = (ruta) => {
    if (ruta.kind === 'salesTotal') return vat.underlagByRate[25] + vat.underlagByRate[12] + vat.underlagByRate[6];
    if (ruta.kind === 'output') return vat.outputVatByRate[ruta.rate];
    if (ruta.kind === 'input') return vat.inputVat;
    if (ruta.kind === 'net') return vat.netToPay;
    return 0;
  };
  const hasActivity = vat.outputVatTotal !== 0 || vat.inputVat !== 0;
  if (!hasActivity) return <ReportSection><EmptyState text="Ingen momspliktig aktivitet bokförd för denna period." /></ReportSection>;
  return (
    <ReportSection title="Momsrapport" subtitle="Underlag till momsdeklarationen, ruta för ruta — samma beräkning som Skatt och bokslut → Moms.">
      <DataTable
        columns={[
          { key: 'ruta', label: 'Ruta', width: '70px' },
          { key: 'label', label: 'Beskrivning' },
          { key: 'value', label: 'Belopp', align: 'right', emphasize: true, render: r => formatSEK(r.value) },
        ]}
        rows={VAT_RUTOR.map(r => ({ ...r, value: valueForRuta(r) }))}
        rowKey={r => r.ruta}
      />
    </ReportSection>
  );
}

// ── 6. Huvudbok ─────────────────────────────────────────────────────────
function LedgerReport({ verifications, accounts, start, end }) {
  const ledger = useMemo(() => computeLedger(verifications, accounts, start, end), [verifications, accounts, start, end]);
  if (ledger.accounts.length === 0) return <ReportSection><EmptyState text="Inga bokförda transaktioner för denna period." /></ReportSection>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {ledger.accounts.map(acc => (
        <ReportSection key={acc.code} title={`${acc.code} — ${acc.name}`} subtitle={`Ingående saldo ${formatSEK(acc.openingBalance)} · Utgående saldo ${formatSEK(acc.closingBalance)}`}>
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
        </ReportSection>
      ))}
    </div>
  );
}

// ── 7. Fakturarapporter ─────────────────────────────────────────────────
function InvoiceReport({ invoices, contacts, start, end }) {
  const report = useMemo(() => computeInvoiceReport(invoices, contacts, start, end), [invoices, contacts, start, end]);
  if (report.rows.length === 0) return <ReportSection><EmptyState text="Inga kundfakturor bokförda/skickade för denna period." /></ReportSection>;
  return (
    <ReportSection title="Fakturerat, betalt och utestående per kund">
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
    </ReportSection>
  );
}

// ── 8. Lönerapporter ────────────────────────────────────────────────────
function PayrollReport({ payrollRuns, start, end }) {
  const tablesReady = usePayrollPreload(payrollRuns);
  const report = useMemo(() => tablesReady ? aggregatePayroll(payrollRuns, start, end) : null, [tablesReady, payrollRuns, start, end]);

  if (!tablesReady) {
    return (
      <ReportSection>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Läser in skattetabeller…
        </div>
      </ReportSection>
    );
  }
  if (!report || report.rows.length === 0) return <ReportSection><EmptyState text="Inga bokförda lönekörningar för denna period." /></ReportSection>;
  return (
    <ReportSection title="Bruttolön, skatt och arbetsgivaravgifter per anställd">
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
    </ReportSection>
  );
}

// ── 9. Årsrapport ───────────────────────────────────────────────────────
// Ignorerar avsiktligt sidans valda period — en årsrapport är per
// definition hela räkenskapsåret, oavsett vad som råkar vara valt i
// listvyns period-väljare (samma resonemang som Taxes.jsx alltid använder
// innevarande räkenskapsår, oberoende av Rapport och analys' egen filter).
function AnnualReport({ verifications, accounts, company, isMobile }) {
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
  const prevSeries = useMemo(() => buildResultSeries(verifications, accounts, prevStart, prevEnd), [verifications, accounts, prevStart, prevEnd]);
  const chartData = series.map((m, i) => ({ label: m.label, resultat: m.intakt - m.kostnad, prevResultat: prevSeries[i] ? (prevSeries[i].intakt - prevSeries[i].kostnad) : null }));
  const hasActivity = series.some(m => m.intakt !== 0 || m.kostnad !== 0);

  if (!hasActivity) return <ReportSection><EmptyState text="Ingen bokförd data ännu för innevarande räkenskapsår." /></ReportSection>;

  const summary = buildAnnualSummary({
    omsattning: k.omsattning, prevOmsattning: prevK.omsattning,
    resultat: k.resultat, prevResultat: prevK.resultat,
    vinstmarginal: k.vinstmarginal, soliditet: k.soliditet,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ReportSection title={`Räkenskapsåret ${fyStart.getFullYear()}${fyStart.getFullYear() !== fyEnd.getFullYear() ? `–${fyEnd.getFullYear()}` : ''}`} subtitle={`${fmtDate(fyStart)} – ${fmtDate(fyEnd)}`}>
        <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.7, margin: 0 }}>{summary}</p>
      </ReportSection>
      <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <KpiCard label="Omsättning" value={formatSEK(k.omsattning)} icon={TrendingUp} accent="var(--text-main)" iconBg="var(--border-light)" />
        <KpiCard label="Resultat" value={formatSEK(k.resultat)} icon={k.resultat >= 0 ? TrendingUp : TrendingDown} accent={k.resultat >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)'} iconBg="var(--border-light)" />
        <KpiCard label="Vinstmarginal" value={fmtPct(k.vinstmarginal)} icon={Percent} accent="var(--text-main)" iconBg="var(--border-light)" />
        <KpiCard label="Soliditet" value={fmtPct(k.soliditet)} icon={Scale} accent="var(--text-main)" iconBg="var(--border-light)" />
      </div>
      <ReportSection title="Resultat per månad">
        <ResultBarChart data={chartData} isMobile={isMobile} />
        <ComparisonLegend currentLabel="Innevarande räkenskapsår" previousLabel="Föregående räkenskapsår" currentColorSwatch={swatch(REVENUE)} previousColorSwatch={swatch('var(--text-muted)', true)} />
      </ReportSection>
    </div>
  );
}

// ── 10. Kvartalsrapport ─────────────────────────────────────────────────
function QuarterlyReport({ verifications, accounts, payrollRuns, company }) {
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
    return <ReportSection><EmptyState text="Ingen bokförd data ännu för innevarande räkenskapsår." /></ReportSection>;
  }

  return (
    <ReportSection title="Kvartal för kvartal" subtitle={`Räkenskapsåret som startade ${fmtDate(fyStart)}`}>
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
    </ReportSection>
  );
}

// ── 11. Månadsrapport ───────────────────────────────────────────────────
function MonthlyReport({ verifications, accounts }) {
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
  if (!hasActivity) return <ReportSection><EmptyState text="Ingen bokförd data ännu." /></ReportSection>;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ReportSection title={`Senaste månaden: ${latest.label}`} subtitle="Jämfört med snittet av de tolv föregående månaderna.">
        <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          <KpiCard
            label="Omsättning" value={formatSEK(latest.omsattning)} icon={TrendingUp} accent="var(--text-main)" iconBg="var(--border-light)"
            delta={omsDeviation ? { text: `${omsDeviation.up ? '+' : ''}${omsDeviation.pct.toFixed(0)}% mot 12-månaderssnittet (${formatSEK(avgPriorOmsattning)})`, good: omsDeviation.up } : null}
          />
          <KpiCard
            label="Resultat" value={formatSEK(latest.resultat)} icon={latest.resultat >= 0 ? TrendingUp : TrendingDown} accent={latest.resultat >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)'} iconBg="var(--border-light)"
            delta={resDeviation ? { text: `${resDeviation.up ? '+' : ''}${resDeviation.pct.toFixed(0)}% mot 12-månaderssnittet (${formatSEK(avgPriorResultat)})`, good: resDeviation.up } : null}
          />
        </div>
        {(omsDeviation || resDeviation) && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '16px', padding: '10px 14px', background: 'var(--status-amber-bg)', borderRadius: '8px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Markant avvikelse (≥30%) mot de tolv föregående månadernas snitt — värt en extra koll, men inte nödvändigtvis fel.</span>
          </div>
        )}
      </ReportSection>
      <ReportSection title="De senaste 13 månaderna">
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
      </ReportSection>
    </div>
  );
}
