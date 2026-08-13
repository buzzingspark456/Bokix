import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, HelpCircle, Wallet, PieChart, Scale } from 'lucide-react';
import {
  getPeriodBounds, sumFlowByType, groupCostsByAccount, buildCashflowSeries,
  buildResultSeries, computeBalanceSheet, hasAnyBookedData, isCashAccount, isBooked,
} from '../utils/reportCalculations';

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const fmtDate = (d) => new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(d instanceof Date ? d : new Date(d));

function formatDelta(current, previous, invert = false) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return { text: 'Ingen bokföring under samma period förra året', good: null };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rising = pct >= 0;
  const good = invert ? !rising : rising;
  return { text: `${rising ? '+' : ''}${pct.toFixed(0)}% mot föregående år`, good };
}

function KpiCard({ label, value, help, delta, accent }) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        {help && (
          <span title={help} style={{ display: 'inline-flex', cursor: 'help', color: '#b0b7c3' }}>
            <HelpCircle size={13} />
          </span>
        )}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: accent || '#0f172a', marginBottom: delta ? '6px' : 0 }}>{value}</div>
      {delta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: delta.good === null ? '#9ca3af' : delta.good ? '#15803d' : '#dc2626' }}>
          {delta.good !== null && (delta.good ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
          {delta.text}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '13.5px', lineHeight: 1.6 }}>
      {text}
    </div>
  );
}

/** Resultatdiagram: två linjer (intäkter/kostnader) per månad i perioden. */
function ResultTrendChart({ series }) {
  const w = 600, h = 160, pad = 8;
  const maxVal = Math.max(1, ...series.flatMap(s => [s.intakt, s.kostnad]));
  const stepX = series.length > 1 ? (w - pad * 2) / (series.length - 1) : 0;
  const toXY = (i, val) => {
    const x = pad + i * stepX;
    const y = h - pad - (val / maxVal) * (h - pad * 2);
    return `${x},${y}`;
  };
  const revenueLine = series.map((s, i) => toXY(i, s.intakt)).join(' ');
  const costLine = series.map((s, i) => toXY(i, s.kostnad)).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '160px' }}>
        <polyline points={revenueLine} fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={costLine} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
        {series.map((s, i) => <span key={i}>{s.label}</span>)}
      </div>
      <div style={{ display: 'flex', gap: '18px', marginTop: '12px', fontSize: '12.5px', fontWeight: 600 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#15803d', display: 'inline-block' }} /> Intäkter</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#dc2626', display: 'inline-block' }} /> Kostnader</span>
      </div>
    </div>
  );
}

/** Likviditetsdiagram: ackumulerat bank-/kassasaldo, kan gå under noll. */
function CashflowChart({ points }) {
  const w = 600, h = 160, pad = 8;
  const values = points.map(p => p.balance);
  const maxVal = Math.max(0, ...values);
  const minVal = Math.min(0, ...values);
  const range = Math.max(1, maxVal - minVal);
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const toY = (val) => h - pad - ((val - minVal) / range) * (h - pad * 2);
  const line = points.map((p, i) => `${pad + i * stepX},${toY(p.balance)}`).join(' ');
  const fillArea = `${pad},${toY(0)} ${line} ${pad + (points.length - 1) * stepX},${toY(0)}`;
  const zeroY = toY(0);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '160px' }}>
        {minVal < 0 && <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="#e4e4e7" strokeWidth="1" strokeDasharray="3,3" />}
        <polyline points={fillArea} fill="rgba(26,48,40,0.08)" stroke="none" />
        <polyline points={line} fill="none" stroke="#1a3028" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
        {points.map((p, i) => <span key={i}>{fmtDate(p.date)}</span>)}
      </div>
    </div>
  );
}

function CostBreakdownBars({ rows, total }) {
  const maxAmount = Math.max(1, ...rows.map(r => r.amount));
  return (
    <div>
      {rows.slice(0, 10).map(r => (
        <div key={r.code} style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <span style={{ color: '#374151', fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: '#111', fontWeight: 700 }}>{formatSEK(r.amount)} <span style={{ color: '#9ca3af', fontWeight: 500 }}>({total ? Math.round(r.amount / total * 100) : 0}%)</span></span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(r.amount / maxAmount) * 100}%`, background: '#1a3028', borderRadius: '4px' }} />
          </div>
        </div>
      ))}
      {rows.length > 10 && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>+ {rows.length - 10} till, mindre poster</div>}
    </div>
  );
}

function BalanceSheetTable({ title, rows, total }) {
  return (
    <div style={{ flex: 1, minWidth: '260px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>{title}</div>
      <div style={{ background: 'white', border: '1px solid #e4e4e7', borderRadius: '10px', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Inga bokförda saldon</div>
        ) : rows.map(r => (
          <div key={r.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '13.5px' }}>
            <span style={{ color: '#374151' }}>{r.name}</span>
            <span style={{ fontWeight: 600, color: '#111' }}>{formatSEK(r.amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', fontWeight: 800, fontSize: '14px' }}>
          <span>Summa</span><span>{formatSEK(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function Reports({ accounts = [], verifications = [], company = {} }) {
  const [activeTab, setActiveTab] = useState('result');
  const [period, setPeriod] = useState('year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const bounds = useMemo(() => getPeriodBounds(period, {
    fiscalYearStart: company?.fiscalYear, customStart, customEnd,
  }), [period, customStart, customEnd, company?.fiscalYear]);

  const companyHasAnyData = hasAnyBookedData(verifications);
  const customRangeIncomplete = period === 'custom' && !(customStart && customEnd);

  const omsattning = useMemo(() => sumFlowByType(verifications, accounts, 'intakt', bounds.start, bounds.end), [verifications, accounts, bounds]);
  const kostnader = useMemo(() => sumFlowByType(verifications, accounts, 'kostnad', bounds.start, bounds.end), [verifications, accounts, bounds]);
  const resultat = omsattning - kostnader;
  const marginal = omsattning !== 0 ? (resultat / omsattning) * 100 : null;

  const prevOmsattning = useMemo(() => sumFlowByType(verifications, accounts, 'intakt', bounds.prevStart, bounds.prevEnd), [verifications, accounts, bounds]);
  const prevKostnader = useMemo(() => sumFlowByType(verifications, accounts, 'kostnad', bounds.prevStart, bounds.prevEnd), [verifications, accounts, bounds]);
  const prevResultat = prevOmsattning - prevKostnader;

  const resultSeries = useMemo(() => buildResultSeries(verifications, accounts, bounds.start, bounds.end), [verifications, accounts, bounds]);
  const hasResultActivity = resultSeries.some(m => m.intakt !== 0 || m.kostnad !== 0);

  const cashflowPoints = useMemo(() => buildCashflowSeries(verifications, accounts, bounds.start, bounds.end), [verifications, accounts, bounds]);
  const hasCashActivity = useMemo(() => verifications.some(ver => isBooked(ver) && (ver.rows || []).some(r => isCashAccount(accounts.find(a => a.code === r.account)))), [verifications, accounts]);
  const currentCash = cashflowPoints.length ? cashflowPoints[cashflowPoints.length - 1].balance : 0;

  const costBreakdown = useMemo(() => groupCostsByAccount(verifications, accounts, bounds.start, bounds.end), [verifications, accounts, bounds]);

  const balanceSheet = useMemo(() => computeBalanceSheet(verifications, accounts, bounds.end), [verifications, accounts, bounds]);

  const inputSt = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: 'inherit', background: 'white' };

  const tabs = [
    { id: 'result', label: 'Resultat', icon: TrendingUp },
    { id: 'cashflow', label: 'Kassaflöde', icon: Wallet },
    { id: 'costs', label: 'Kostnadsfördelning', icon: PieChart },
    { id: 'balance', label: 'Balansräkning', icon: Scale },
  ];

  return (
    <div style={{ padding: '32px 40px', animation: 'fadeIn 0.25s ease', minHeight: '100%', maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Rapport och analys</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={inputSt}>
            <option value="month">Denna månad</option>
            <option value="quarter">Detta kvartal</option>
            <option value="year">Detta räkenskapsår</option>
            <option value="custom">Anpassat...</option>
          </select>
          {period === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inputSt} />
              <span style={{ color: '#9ca3af' }}>–</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={inputSt} />
            </>
          )}
        </div>
      </div>

      {!companyHasAnyData ? (
        <div style={{ background: 'white', border: '1px solid #e4e4e7', borderRadius: '12px' }}>
          <EmptyState text={
            <>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>Ingen bokförd data ännu</div>
              Så snart du bokför fakturor, kvitton eller verifikationer visas din omsättning, dina kostnader och ditt resultat här — räknat direkt från det du faktiskt har bokfört.
            </>
          } />
        </div>
      ) : customRangeIncomplete ? (
        <div style={{ background: 'white', border: '1px solid #e4e4e7', borderRadius: '12px' }}>
          <EmptyState text="Välj både start- och slutdatum för att visa den anpassade perioden." />
        </div>
      ) : (
        <>
          {/* KPI-rad — svarar direkt på "går det bra just nu?" utan att man behöver klicka vidare */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
            <KpiCard label="Omsättning" value={formatSEK(omsattning)} delta={formatDelta(omsattning, prevOmsattning)} help="Summan av allt du fakturerat/sålt för under perioden, exklusive moms." />
            <KpiCard label="Kostnader" value={formatSEK(kostnader)} delta={formatDelta(kostnader, prevKostnader, true)} help="Summan av alla bokförda kostnader under perioden, exklusive moms." />
            <KpiCard label="Resultat" value={formatSEK(resultat)} delta={formatDelta(resultat, prevResultat)} accent={resultat >= 0 ? '#15803d' : '#dc2626'} help="Omsättning minus kostnader — det som blir kvar (eller det du gått back med)." />
            <KpiCard label="Marginal" value={marginal === null ? '—' : `${marginal.toFixed(1)}%`} help="Hur stor andel av varje intjänad krona som blir resultat. Högre är bättre." />
          </div>

          <div style={{ display: 'flex', gap: '6px', borderBottom: '2px solid #e4e4e7', marginBottom: '20px' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: '14px',
                  fontWeight: activeTab === t.id ? 700 : 500,
                  color: activeTab === t.id ? '#1a3028' : '#6b7280',
                  background: 'none',
                  borderBottom: activeTab === t.id ? '2px solid #1a3028' : '2px solid transparent',
                  marginBottom: '-2px',
                }}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'result' && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', padding: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>Intäkter och kostnader per månad</div>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '0 0 16px' }}>Går det bra för företaget just nu — och hur ser trenden ut?</p>
              {hasResultActivity ? <ResultTrendChart series={resultSeries} /> : <EmptyState text="Ingen bokförd data ännu för denna period." />}
            </div>
          )}

          {activeTab === 'cashflow' && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>Pengar på bank och i kassa</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: currentCash >= 0 ? '#111' : '#dc2626' }}>{formatSEK(currentCash)}</div>
              </div>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '0 0 16px' }}>Har jag pengar på kontot? Ackumulerat saldo över tid, konto 1900–1999.</p>
              {hasCashActivity ? <CashflowChart points={cashflowPoints} /> : <EmptyState text="Inga bank- eller kassatransaktioner bokförda ännu." />}
            </div>
          )}

          {activeTab === 'costs' && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e4e4e7', padding: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>Vart tar pengarna vägen?</div>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '0 0 16px' }}>Bokförda kostnader under perioden, störst först.</p>
              {costBreakdown.rows.length > 0 ? <CostBreakdownBars rows={costBreakdown.rows} total={costBreakdown.total} /> : <EmptyState text="Ingen bokförd data ännu för denna period." />}
            </div>
          )}

          {activeTab === 'balance' && (
            <div>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '0 0 16px' }}>Ögonblicksbild av vad företaget äger och är skyldigt, per {fmtDate(bounds.end)}.</p>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <BalanceSheetTable title="Tillgångar" rows={balanceSheet.assets} total={balanceSheet.totalAssets} />
                <BalanceSheetTable title="Eget kapital och skulder" rows={balanceSheet.equityAndLiabilities} total={balanceSheet.totalEquityAndLiabilities} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
