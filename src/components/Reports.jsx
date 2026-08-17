import React, { useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, HelpCircle, Wallet, PieChart as PieChartIcon, Scale, Receipt,
  Download, ChevronRight, FileText, FileSpreadsheet, ArrowUpRight, ArrowDownRight, Percent, Inbox,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { BRAND } from '../utils/brandColors';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { computeVatPeriod } from '../utils/vatCalculation';
import {
  getPeriodBounds, sumFlowByType, groupCostsByAccount, groupCostsByCategory, buildCashflowSeries,
  buildResultSeries, computeBalanceSheet, hasAnyBookedData, isCashAccount, isBooked,
} from '../utils/reportCalculations';

// Sida 14c: intäkter/utgifter-jämförelser (raka stapeldiagram som ställer
// intäkt direkt mot utgift, t.ex. Resultat-flikens diverging-diagram) är
// grönt/rött — grönt = pengar in, rött = pengar ut. Ljusare ton för det
// grafiska elementet (3:1-kontrast räcker), mörkare BRAND-ton för text
// intill (kräver 4.5:1).
const REVENUE = '#639922';
const EXPENSE = '#E24B4A';
// Kostnader SOM EGET MÅTT (KPI-kortet, kostnadsfördelningens ringdiagram)
// är INTE samma röd som ovan — verifierat direkt mot Startsidans "RÅ
// kostnader"-kort (Dashboard.jsx, KPI_GRAD_NEGATIVE): en rosa/coral-
// magenta-gradient, #e0527a → #c8305a, inte ren röd. De två sidorna ska
// visa samma nyans för samma begrepp.
const COST_LIGHT = '#e0527a';
const COST_DARK = '#c8305a';
const COST_BG = '#fbe7ed'; // ljus rosa/coral-tint för ikon-chip-bakgrunder, samma familj som COST_DARK/COST_LIGHT
const COST_CATEGORY_COLORS = [COST_DARK, COST_LIGHT, '#ec7ca0', '#f4b8d0'];

// Fortnox-jämförelsen (kundfeedback): tunnar ut en etikettrad till ~6
// synliga poster på mobil istället för alla (kan vara upp till 12
// månader eller ännu fler kassaflödes-datapunkter).
function thinLabels(labels, isMobile) {
  if (!isMobile || labels.length <= 6) return labels;
  const interval = Math.ceil(labels.length / 6);
  return labels.map((l, i) => (i % interval === 0 ? l : ''));
}

const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
const fmtDate = (d) => new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(d instanceof Date ? d : new Date(d));
const fmtMonthYear = (d) => new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(d);
// .toISOString() konverterar till UTC — fel datum i en tidzon före/efter
// UTC vid midnatt lokal tid (t.ex. svensk sommartid, UTC+2). bounds.start/
// end är redan lokala Date-objekt (från getPeriodBounds), så komponenterna
// läses ut direkt istället för att gå via en UTC-konvertering.
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function formatDelta(current, previous, invert = false) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return { text: 'Ingen bokföring under samma period förra året', good: null };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rising = pct >= 0;
  const good = invert ? !rising : rising;
  return { text: `${rising ? '+' : ''}${pct.toFixed(0)}% mot samma period föregående år`, good };
}

// Samma ikon-chip + hover-lyft-mönster som Startsidans KpiCard
// (Dashboard.jsx) — inte en egen, avvikande kortstil här. Konsekvent
// premiumkänsla mellan de två sidorna istället för att Rapport och
// analys ser platt/billigare ut i jämförelse.
function KpiCard({ label, value, help, delta, accent, icon: Icon, iconBg }) {
  return (
    <div
      style={{
        background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.09)'; e.currentTarget.style.borderColor = accent || '#c7d2c1'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        {Icon && (
          <div style={{ width: 34, height: 34, borderRadius: '9px', background: iconBg || '#f1f5f9', color: accent || '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} />
          </div>
        )}
        {help && (
          <span title={help} style={{ display: 'inline-flex', cursor: 'help', color: '#b0b7c3' }}>
            <HelpCircle size={13} />
          </span>
        )}
      </div>
      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '23px', fontWeight: 800, color: accent || '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: delta ? '6px' : 0, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {delta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: delta.good === null ? '#9ca3af' : delta.good ? '#15803d' : '#dc2626' }}>
          {delta.good !== null && (delta.good ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
          {delta.text}
        </div>
      )}
    </div>
  );
}

// Sida 14c: den viktigaste siffran på varje flik ska vara märkbart större
// än delposter/axeletiketter (Sida 31-regeln, "text-3xl") — en delad
// rubrikkomponent istället för att varje flik sätter sin egen fontstorlek.
function TabHeadline({ label, value, accent, delta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{label}</span>
      <span style={{ fontSize: '32px', fontWeight: 800, color: accent || '#0f172a', lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {delta && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: 600, color: delta.good === null ? '#9ca3af' : delta.good ? '#15803d' : '#dc2626' }}>
          {delta.good !== null && (delta.good ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
          {delta.text}
        </span>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '13.5px', lineHeight: 1.6 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#cbd5e1' }}>
        <Inbox size={20} />
      </div>
      {text}
    </div>
  );
}

// Samma tooltip-stil som Startsidans diagram (Dashboard.jsx ChartTooltip)
// istället för Recharts standardruta — rundad, skuggad, färgprick + namn
// på egen rad. Ett diagram som ser exakt likadant ut på båda sidorna
// känns som EN produkt, inte två olika komponentbibliotek som råkar
// hamna bredvid varandra.
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(p => p.value != null && p.name !== undefined);
  if (!rows.length) return null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.09)', fontSize: '12.5px', minWidth: '160px' }}>
      {label && <div style={{ fontWeight: 700, color: '#111827', marginBottom: '8px', fontSize: '13px' }}>{label}</div>}
      {rows.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: '#6b7280' }}>{p.name}</span>
          </div>
          <strong style={{ color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatSEK(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

// Explicit legend som namnger BÅDA jämförelseperioderna med text, aldrig
// bara färgprickar (Sida 14c, uttryckligt krav).
function ComparisonLegend({ currentLabel, previousLabel, currentColorSwatch, previousColorSwatch }) {
  return (
    <div style={{ display: 'flex', gap: '18px', marginTop: '12px', fontSize: '12.5px', fontWeight: 600, flexWrap: 'wrap' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#374151' }}>{currentColorSwatch} {currentLabel}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af' }}>{previousColorSwatch} {previousLabel}</span>
    </div>
  );
}

const swatch = (color, dashed = false) => (
  <span style={{
    width: '14px', height: dashed ? '2px' : '10px', borderRadius: dashed ? 0 : '3px', background: dashed ? 'none' : color,
    borderTop: dashed ? `2px dashed ${color}` : undefined, display: 'inline-block', flexShrink: 0,
  }} />
);

/** Resultatdiagram (Sida 14c): diverging stapeldiagram — grön stapel för
 * positiva månader, röd för negativa (samma mönster som Startsidans
 * Resultat-vy) — plus en streckad linje för föregående periods
 * motsvarande resultat. */
function ResultBarChart({ data, isMobile }) {
  const tickData = useMemo(() => {
    const labels = thinLabels(data.map(d => d.label), isMobile);
    return data.map((d, i) => ({ ...d, label: labels[i] }));
  }, [data, isMobile]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={tickData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => formatSEK(v).replace(/\s?kr$/, '')} width={54} />
        <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
        <Bar dataKey="resultat" radius={[4, 4, 0, 0]} barSize={18} name="Resultat">
          {tickData.map((d, i) => <Cell key={i} fill={d.resultat >= 0 ? REVENUE : EXPENSE} />)}
        </Bar>
        <Line dataKey="prevResultat" stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 3" dot={false} name="Föregående period" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Likviditetsdiagram: ackumulerat bank-/kassasaldo genom perioden, plus
 * en streckad jämförelselinje för föregående period. */
function CashflowLineChart({ data, isMobile }) {
  const tickData = useMemo(() => {
    const labels = thinLabels(data.map(d => d.label), isMobile);
    return data.map((d, i) => ({ ...d, label: labels[i] }));
  }, [data, isMobile]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={tickData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => formatSEK(v).replace(/\s?kr$/, '')} width={54} />
        <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />
        <Line dataKey="balance" stroke="#1a3028" strokeWidth={2.5} dot={false} name="Saldo" />
        <Line dataKey="prevBalance" stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 3" dot={false} name="Föregående period" />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Kostnadsfördelningens ringdiagram — en färg per kategori (rosa/coral-
 * familjen, Sida 14c), procentandel i en egen HTML-legend (inte
 * Recharts inbyggda) så den går att lägga ut precis som andra listor
 * i appen. */
function CostBreakdownDonut({ categories, total }) {
  const data = categories.map((c, i) => ({ ...c, color: COST_CATEGORY_COLORS[i % COST_CATEGORY_COLORS.length] }));
  return (
    <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* position:relative + en absolut centrerad totalsumma i ringens
          hål — ett tomt hål mitt i diagrammet är bortkastad yta för det
          enda talet man ändå letar efter först ("hur mycket totalt?"). */}
      <div style={{ width: '220px', height: '220px', flexShrink: 0, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* paddingAngle bara med fler än en skiva — Recharts egen padding-
                beräkning antar mellanrum MELLAN sektorer, och med bara en
                (t.ex. allt i "Övrigt" för ett litet företag) renderar den
                en trasig, ihoptryckt båge istället för en hel ring. */}
            <Pie data={data} dataKey="amount" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Totalt</span>
          <span style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{formatSEK(total)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '200px' }}>
        {data.map(d => (
          <div
            key={d.name}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', padding: '4px 6px', borderRadius: '6px', transition: 'background-color 0.12s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
            <span style={{ color: '#374151', fontWeight: 600, flex: 1 }}>{d.name}</span>
            <span style={{ color: '#111', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatSEK(d.amount)}</span>
            <span style={{ color: '#9ca3af', fontWeight: 500, width: '38px', textAlign: 'right' }}>{total ? Math.round(d.amount / total * 100) : 0}%</span>
          </div>
        ))}
      </div>
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
          <div
            key={r.code}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '13.5px', transition: 'background-color 0.12s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span style={{ color: '#374151' }}>{r.name}</span>
            <span style={{ fontWeight: 600, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{formatSEK(r.amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', fontWeight: 800, fontSize: '14px' }}>
          <span>Summa</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatSEK(total)}</span>
        </div>
      </div>
    </div>
  );
}

function downloadCSV(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(esc).join(';')).join('\r\n');
  // BOM så Excel läser å/ä/ö rätt istället för att gissa fel teckenkodning.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports({ accounts = [], verifications = [], company = {}, onNavigate }) {
  const isMobile = useIsMobileViewport();
  const [activeTab, setActiveTab] = useState('result');
  const [period, setPeriod] = useState('year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

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
  const prevResultSeries = useMemo(() => buildResultSeries(verifications, accounts, bounds.prevStart, bounds.prevEnd), [verifications, accounts, bounds]);
  const hasResultActivity = resultSeries.some(m => m.intakt !== 0 || m.kostnad !== 0);
  const resultChartData = useMemo(() => resultSeries.map((m, i) => ({
    label: m.label,
    resultat: m.intakt - m.kostnad,
    prevResultat: prevResultSeries[i] ? (prevResultSeries[i].intakt - prevResultSeries[i].kostnad) : null,
  })), [resultSeries, prevResultSeries]);

  const cashflowPoints = useMemo(() => buildCashflowSeries(verifications, accounts, bounds.start, bounds.end), [verifications, accounts, bounds]);
  const prevCashflowPoints = useMemo(() => buildCashflowSeries(verifications, accounts, bounds.prevStart, bounds.prevEnd), [verifications, accounts, bounds]);
  const hasCashActivity = useMemo(() => verifications.some(ver => isBooked(ver) && (ver.rows || []).some(r => isCashAccount(accounts.find(a => a.code === r.account)))), [verifications, accounts]);
  const currentCash = cashflowPoints.length ? cashflowPoints[cashflowPoints.length - 1].balance : 0;
  const cashChartData = useMemo(() => cashflowPoints.map((p, i) => ({
    label: fmtDate(p.date),
    balance: p.balance,
    prevBalance: prevCashflowPoints[i] ? prevCashflowPoints[i].balance : null,
  })), [cashflowPoints, prevCashflowPoints]);

  const costBreakdown = useMemo(() => groupCostsByAccount(verifications, accounts, bounds.start, bounds.end), [verifications, accounts, bounds]);
  const costCategories = useMemo(() => groupCostsByCategory(verifications, accounts, bounds.start, bounds.end), [verifications, accounts, bounds]);
  const prevCostCategories = useMemo(() => groupCostsByCategory(verifications, accounts, bounds.prevStart, bounds.prevEnd), [verifications, accounts, bounds]);

  const balanceSheet = useMemo(() => computeBalanceSheet(verifications, accounts, bounds.end), [verifications, accounts, bounds]);
  const balanceIsEmpty = balanceSheet.assets.length === 0 && balanceSheet.equityAndLiabilities.length === 0;

  const vatPeriod = useMemo(() => computeVatPeriod({
    verifications, periodStart: toISO(bounds.start), periodEnd: toISO(bounds.end),
  }), [verifications, bounds]);
  const vatHasActivity = vatPeriod.outputVatTotal !== 0 || vatPeriod.inputVat !== 0;

  const currentPeriodLabel = `${bounds.label} (${fmtMonthYear(bounds.start)}–${fmtMonthYear(bounds.end)})`;
  const previousPeriodLabel = `Föregående år (${fmtMonthYear(bounds.prevStart)}–${fmtMonthYear(bounds.prevEnd)})`;

  const inputSt = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: 'inherit', background: 'white' };

  const tabs = [
    { id: 'result', label: 'Resultat', icon: TrendingUp },
    { id: 'cashflow', label: 'Kassaflöde', icon: Wallet },
    { id: 'costs', label: 'Kostnadsfördelning', icon: PieChartIcon },
    { id: 'balance', label: 'Balansräkning', icon: Scale },
    { id: 'vat', label: 'Moms', icon: Receipt },
  ];

  const exportCurrentTab = (format) => {
    setExportOpen(false);
    if (format === 'pdf') { window.print(); return; }
    // CSV — samma rådata som visas i den aktiva fliken, inte hela sidan
    // på en gång, så filen matchar det användaren faktiskt tittar på.
    if (activeTab === 'result') {
      downloadCSV('resultat.csv', ['Månad', 'Resultat', 'Föregående period'], resultChartData.map(d => [d.label, d.resultat, d.prevResultat ?? '']));
    } else if (activeTab === 'cashflow') {
      downloadCSV('kassaflode.csv', ['Datum', 'Saldo', 'Föregående period'], cashChartData.map(d => [d.label, d.balance, d.prevBalance ?? '']));
    } else if (activeTab === 'costs') {
      downloadCSV('kostnadsfordelning.csv', ['Kategori', 'Belopp'], costCategories.categories.map(c => [c.name, c.amount]));
    } else if (activeTab === 'balance') {
      downloadCSV('balansrakning.csv', ['Sektion', 'Konto', 'Belopp'], [
        ...balanceSheet.assets.map(r => ['Tillgångar', r.name, r.amount]),
        ...balanceSheet.equityAndLiabilities.map(r => ['Eget kapital och skulder', r.name, r.amount]),
      ]);
    } else if (activeTab === 'vat') {
      downloadCSV('moms.csv', ['Post', 'Belopp'], [
        ['Utgående moms', vatPeriod.outputVatTotal], ['Ingående moms', vatPeriod.inputVat], ['Netto att betala', vatPeriod.netToPay],
      ]);
    }
  };

  return (
    <div style={{ padding: '32px 40px', animation: 'fadeIn 0.25s ease', minHeight: '100%', maxWidth: '100%' }}>
      <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Rapport och analys</h1>
        <div className="no-print" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
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
          {/* Exportera — konsekvent med etablerat mönster på övriga listsidor
              (Sida 1/19): en knapp, ett litet menyval för PDF/Excel. */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setExportOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, color: '#374151', cursor: 'pointer', transition: 'border-color 0.15s ease, box-shadow 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3d7a2e'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(61,122,46,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Download size={14} /> Exportera
            </button>
            {exportOpen && (
              <>
                <div onClick={() => setExportOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white', border: '1px solid #e4e4e7', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 11, minWidth: '190px', transformOrigin: 'top right', animation: 'scaleIn 0.12s ease both' }}>
                  <button onClick={() => exportCurrentTab('pdf')} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13.5px', color: '#374151', textAlign: 'left', transition: 'background-color 0.12s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <FileText size={14} /> Ladda ner som PDF
                  </button>
                  <button onClick={() => exportCurrentTab('excel')} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13.5px', color: '#374151', textAlign: 'left', borderTop: '1px solid #f1f5f9', transition: 'background-color 0.12s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <FileSpreadsheet size={14} /> Ladda ner som Excel (CSV)
                  </button>
                </div>
              </>
            )}
          </div>
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
          <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
            <KpiCard label="Omsättning" value={formatSEK(omsattning)} delta={formatDelta(omsattning, prevOmsattning)} icon={TrendingUp} accent={BRAND.greenDark} iconBg={BRAND.greenLight} help="Summan av allt du fakturerat/sålt för under perioden, exklusive moms." />
            <KpiCard label="Kostnader" value={formatSEK(kostnader)} delta={formatDelta(kostnader, prevKostnader, true)} icon={ArrowDownRight} accent={COST_DARK} iconBg={COST_BG} help="Summan av alla bokförda kostnader under perioden, exklusive moms." />
            <KpiCard label="Resultat" value={formatSEK(resultat)} delta={formatDelta(resultat, prevResultat)} icon={resultat >= 0 ? TrendingUp : TrendingDown} accent={resultat >= 0 ? '#15803d' : '#dc2626'} iconBg={resultat >= 0 ? BRAND.greenLight : BRAND.redBg} help="Omsättning minus kostnader — det som blir kvar (eller det du gått back med)." />
            <KpiCard label="Marginal" value={marginal === null ? '—' : `${marginal.toFixed(1)}%`} icon={Percent} accent="#0f172a" iconBg="#f1f5f9" help="Hur stor andel av varje intjänad krona som blir resultat. Högre är bättre." />
          </div>

          <div className="tabs-scroll-x no-print" style={{ display: 'flex', gap: '6px', borderBottom: '2px solid #e4e4e7', marginBottom: '20px', overflowX: 'auto' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: '14px',
                  whiteSpace: 'nowrap', flexShrink: 0, borderRadius: '8px 8px 0 0',
                  fontWeight: activeTab === t.id ? 700 : 500,
                  color: activeTab === t.id ? '#1a3028' : '#6b7280',
                  background: activeTab === t.id ? 'rgba(61,122,46,0.06)' : 'none',
                  borderBottom: activeTab === t.id ? '2px solid #1a3028' : '2px solid transparent',
                  marginBottom: '-2px',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={e => { if (activeTab !== t.id) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                onMouseLeave={e => { if (activeTab !== t.id) e.currentTarget.style.background = 'none'; }}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'result' && (
            <div style={{ background: 'var(--bg-cream, #faf9f5)', border: '1px solid var(--bg-cream-border, #ede9de)', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <TabHeadline label="Resultat för perioden" value={formatSEK(resultat)} accent={resultat >= 0 ? '#15803d' : '#dc2626'} delta={formatDelta(resultat, prevResultat)} />
              <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '0 0 16px' }}>Så har ditt resultat utvecklats över tid — grönt för lönsamma perioder, rött för de som gick back.</p>
              {hasResultActivity ? (
                <>
                  <ResultBarChart data={resultChartData} isMobile={isMobile} />
                  <ComparisonLegend
                    currentLabel={currentPeriodLabel} previousLabel={previousPeriodLabel}
                    currentColorSwatch={swatch(REVENUE)} previousColorSwatch={swatch('#9ca3af', true)}
                  />
                </>
              ) : <EmptyState text="Ingen bokförd data ännu för denna period." />}
            </div>
          )}

          {activeTab === 'cashflow' && (
            <div style={{ background: 'var(--bg-cream, #faf9f5)', border: '1px solid var(--bg-cream-border, #ede9de)', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <TabHeadline label="Pengar på bank och i kassa" value={formatSEK(currentCash)} accent={currentCash >= 0 ? '#0f172a' : '#dc2626'} />
              <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '0 0 16px' }}>Har jag pengar på kontot? Ackumulerat saldo genom perioden, konto 1900–1999.</p>
              {hasCashActivity ? (
                <>
                  <CashflowLineChart data={cashChartData} isMobile={isMobile} />
                  <ComparisonLegend
                    currentLabel={currentPeriodLabel} previousLabel={previousPeriodLabel}
                    currentColorSwatch={swatch('#1a3028')} previousColorSwatch={swatch('#9ca3af', true)}
                  />
                </>
              ) : <EmptyState text="Ingen kassaflödesdata för denna period." />}
            </div>
          )}

          {activeTab === 'costs' && (
            <div style={{ background: 'var(--bg-cream, #faf9f5)', border: '1px solid var(--bg-cream-border, #ede9de)', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <TabHeadline label="Vart tar pengarna vägen?" value={formatSEK(costCategories.total)} accent={COST_DARK} delta={formatDelta(costCategories.total, prevCostCategories.total, true)} />
              <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '0 0 16px' }}>Bokförda kostnader under perioden, grupperat per kategori.</p>
              {costCategories.categories.length > 0 ? (
                <CostBreakdownDonut categories={costCategories.categories} total={costCategories.total} />
              ) : <EmptyState text="Ingen kostnadsdata för denna period." />}
              {costBreakdown.rows.length > 10 && (
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  {costBreakdown.rows.length} enskilda konton bokförda — se Bokföring → Kontoplan för alla, det här diagrammet visar dem grupperade.
                </div>
              )}
            </div>
          )}

          {activeTab === 'balance' && (
            <div style={{ background: 'var(--bg-cream, #faf9f5)', border: '1px solid var(--bg-cream-border, #ede9de)', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>Balansräkning</div>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '0 0 16px' }}>Ögonblicksbild av vad företaget äger och är skyldigt, per {fmtDate(bounds.end)}.</p>
              {balanceIsEmpty ? (
                <EmptyState text="Inga bokförda tillgångs- eller skuldsaldon ännu." />
              ) : (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <BalanceSheetTable title="Tillgångar" rows={balanceSheet.assets} total={balanceSheet.totalAssets} />
                  <BalanceSheetTable title="Eget kapital och skulder" rows={balanceSheet.equityAndLiabilities} total={balanceSheet.totalEquityAndLiabilities} />
                </div>
              )}
            </div>
          )}

          {activeTab === 'vat' && (
            <div style={{ background: 'var(--bg-cream, #faf9f5)', border: '1px solid var(--bg-cream-border, #ede9de)', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>Momsöversikt</div>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', margin: '0 0 16px' }}>
                Snabb överblick för perioden — inte en ersättning för den fullständiga momsdeklarationen.
              </p>
              {!vatHasActivity ? (
                <EmptyState text="Ingen momspliktig aktivitet bokförd för denna period." />
              ) : (
                <>
                  <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
                    <KpiCard label="Utgående moms" value={formatSEK(vatPeriod.outputVatTotal)} icon={ArrowUpRight} accent="#0f172a" iconBg="#f1f5f9" help="Moms du tagit ut av dina kunder på det du sålt — den ska du normalt betala in till Skatteverket." />
                    <KpiCard label="Ingående moms" value={formatSEK(vatPeriod.inputVat)} icon={ArrowDownRight} accent="#0f172a" iconBg="#f1f5f9" help="Moms du själv betalat på inköp — den får du normalt dra av mot den utgående momsen." />
                    <KpiCard
                      label="Netto att betala" value={formatSEK(Math.abs(vatPeriod.netToPay))}
                      icon={Receipt}
                      accent={vatPeriod.netToPay >= 0 ? '#dc2626' : '#15803d'}
                      iconBg={vatPeriod.netToPay >= 0 ? BRAND.redBg : BRAND.greenLight}
                      help={vatPeriod.netToPay >= 0 ? 'Utgående moms minus ingående moms — det du ska betala in till Skatteverket.' : 'Din ingående moms är högre än den utgående — du har en momsfordran (Skatteverket är skyldig dig pengar).'}
                    />
                  </div>
                  <button
                    onClick={() => onNavigate?.('taxes')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(61,122,46,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)'; }}
                  >
                    Gå till momsdeklaration <ChevronRight size={14} />
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
