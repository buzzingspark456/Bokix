import React, { useMemo, useState } from 'react';
import {
  FileText, Receipt, TrendingUp, TrendingDown,
  ChevronRight, Download, ArrowUpRight, ArrowDownRight,
  CheckCircle, CheckCircle2, Minus, BarChart2,
  UserPlus, Users, Clock, AlertCircle, Zap
} from 'lucide-react';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Cell
} from 'recharts';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { quarterToRange } from '../utils/vatCalculation';
import { getGreeting } from '../utils/greeting';
import { BRAND } from '../utils/brandColors';

/* ── Färger (Sida 30): grönt för intäkter/positivt kassaflöde, rött för
   utgifter/kostnader — konsekvent i hela appen, inte längre blått/orange.
   Två nyanser per färg: en ljusare "grafisk" ton för linjer/stapelfyllnad
   (kräver bara 3:1-kontrast enligt WCAG AA för grafiska element) och en
   mörkare ton från BRAND för text på ljus bakgrund (kräver 4.5:1). Verifierat:
   #E24B4A mot vitt ≈ 3.9:1 — gott och väl godkänt för grafiska element,
   men medvetet ALDRIG använt som brödtextfärg — se REVENUE/EXPENSE nedan
   kontra BRAND.greenDark/BRAND.redText. ── */
const REVENUE = '#639922';
const EXPENSE = '#E24B4A';
const LIME_L  = BRAND.greenLight;
const RED_L   = BRAND.redBg;

// Djärvare, mer "glad" variant av de tre resultaträkningskorten (Sida 33) —
// fyllda gradientytor istället för vitt kort + liten ikon-chip. Fortfarande
// samma två semantiska hörn som resten av appen (grönt = positivt, rosa/rött
// = kostnad), bara mer mättat. Vit text på dessa mörka gradienter ligger
// gott och väl över 4.5:1 i båda ändarna, så kontraster hålls.
const KPI_GRAD_POSITIVE = ['#2f8a3a', '#54b854'];
const KPI_GRAD_NEGATIVE = ['#e0527a', '#c8305a'];

const CHART_MODES = [
  { id: 'revenue-expense', label: 'Intäkter vs Utgifter', icon: BarChart2 },
  { id: 'result',          label: 'Resultat',              icon: Minus },
];

// Snabbåtgärder — varje genväg får en egen tydlig färg istället för samma
// enfärgade gröna chip för alla fyra, så raden känns levande och man kan
// skilja knapparna åt med ett enda ögonkast.
const QUICK_ACTIONS = [
  { label: 'Ny faktura',       icon: FileText, tab: 'invoices', fg: '#1f7a34', bg: '#dcf4e3' },
  { label: 'Ladda upp kvitto', icon: Receipt,  tab: 'expenses', fg: '#1f6fa8', bg: '#dcedf7' },
  { label: 'Ny kontakt',       icon: UserPlus, tab: 'contacts', fg: '#a83a70', bg: '#fbe3ee' },
  { label: 'Rapportera tid',   icon: Clock,    tab: 'projects', fg: '#a3730a', bg: '#fbecc9' },
];

// Röd/gul/grön — exakt BRAND-tokens, samma som redan används för statusar
// i övriga listor i appen (Bokförd/Granska/Förfallen).
const SEV = {
  danger:  { bg: BRAND.redBg,    text: BRAND.redText,   rank: 0 },
  warning: { bg: BRAND.amberBg,  text: BRAND.amberText, rank: 1 },
  success: { bg: BRAND.greenLight, text: BRAND.greenDark, rank: 2 },
};

// Etikett för "Senast bokfört" — vilken typ av affärshändelse en
// verifikation kommer ifrån, för den korta "datum · typ"-metaraden.
const BOOK_TYPE_LABEL = {
  invoice:                  'Faktura',
  invoice_payment:          'Betalning',
  expense:                  'Utgift',
  expense_fix:              'Utgift',
  supplier_invoice:         'Leverantörsfaktura',
  supplier_invoice_payment: 'Betalning',
  payroll:                  'Lön',
  vat_declaration:          'Moms',
  manual:                   'Manuell',
};

function pad2(n) { return String(n).padStart(2, '0'); }
function formatISODate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

/* ── Momsdeklarationens förfallodag enligt Skatteverkets allmänna regel för
   kvartalsvis redovisning (12:e i andra månaden efter periodens slut),
   framflyttat till nästa vardag om det landar på en helg. Tar INTE hänsyn
   till röda dagar (annandag jul m.fl.) som Skatteverket ibland flyttar fram
   separat — bara den generella regeln, som ett riktvärde. Visas bara för
   kvartalsvis redovisning eftersom det är det enda flödet som faktiskt är
   implementerat i momsmodulen (se VatDeclaration.jsx). ── */
function nextVatDeadline(company, vatPeriods) {
  if ((company?.vatPeriod || 'quarterly') !== 'quarterly') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let y = today.getFullYear();
  let q = Math.floor(today.getMonth() / 3) + 1;
  let guard = 0;
  while (vatPeriods[`${y}-Q${q}`] && guard < 8) {
    q += 1;
    if (q > 4) { q = 1; y += 1; }
    guard += 1;
  }
  const [, periodEnd] = quarterToRange(y, q);
  const d = new Date(periodEnd + 'T00:00:00');
  d.setMonth(d.getMonth() + 2);
  d.setDate(12);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  const daysLeft = Math.round((d - today) / 86400000);
  return { daysLeft, quarter: q, year: y, dueDate: d };
}

/* ── Sparklinje (staplar) — diskreta staplar istället för en kurva, till
   KPI-kortens riktningsindikator. Alltid byggd från samma riktiga
   dagsserier som resten av sidan, aldrig slumpad. ── */
function SparkBars({ data, color, height = 22 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height }}>
      {data.map((v, i) => {
        const h = Math.max(3, ((v - min) / range) * (height - 4) + 4);
        return <div key={i} style={{ flex: 1, height: `${h}px`, borderRadius: '2px', background: color }} />;
      })}
    </div>
  );
}

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.97)',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.09)',
      fontSize: '12.5px',
      minWidth: '160px',
    }}>
      <div style={{ fontWeight: 700, color: '#111827', marginBottom: '8px', fontSize: '13px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
            <span style={{ color: '#6b7280' }}>{p.name}</span>
          </div>
          <strong style={{ color: '#111827' }}>{fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

/* ── KPI Card — med en liten stapel-sparklinje som visar riktning.
   `hero`: Sida 31 punkt 3 — sidans viktigaste enskilda tal (RÅ Resultat,
   den mest sammanfattande siffran) får en märkbart större typsnittsstorlek
   än de andra korten, så ögat har en tydlig startpunkt istället för
   identiskt vägda rutor. ── */
function KpiCard({ label, value, sub, icon: Icon, color, bg, positive, onClick, spark, sparkColor, hero, gradient }) {
  const bold = !!gradient;
  return (
    <button onClick={onClick} style={{
      background: bold ? gradient[0] : 'white',
      border: bold ? 'none' : (hero ? `1px solid ${sparkColor || color}33` : '1px solid #e5e7eb'),
      borderRadius: '14px',
      padding: '20px',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: bold ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = bold ? '0 6px 16px rgba(0,0,0,0.16)' : '0 10px 28px rgba(0,0,0,0.09)';
      if (!bold) e.currentTarget.style.borderColor = sparkColor || color;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = '';
      e.currentTarget.style.boxShadow = bold ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)';
      if (!bold) e.currentTarget.style.borderColor = '#e5e7eb';
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ background: bold ? 'rgba(255,255,255,0.24)' : bg, color: bold ? '#fff' : color, width: 36, height: 36, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} />
        </div>
        {positive != null && (
          <div style={{ color: bold ? 'rgba(255,255,255,0.9)' : (positive ? BRAND.greenDark : BRAND.redText), fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
            {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: bold ? 'rgba(255,255,255,0.82)' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</div>
        <div style={{ fontSize: hero ? '32px' : '22px', fontWeight: 700, color: bold ? '#fff' : '#111827', letterSpacing: '-0.04em', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: '11.5px', color: bold ? 'rgba(255,255,255,0.78)' : '#9ca3af', marginTop: '4px' }}>{sub}</div>}
      </div>

      {spark && <SparkBars data={spark.slice(-14)} color={bold ? 'rgba(255,255,255,0.9)' : (sparkColor || color)} />}
    </button>
  );
}

/* ── "Idag"-raden — konkreta, klickbara händelser. Röd > gul > grön styr
   ordningen, aldrig kronologi. Tom kö visas aldrig som tomrum — en lugn
   grön rad förklarar att inget kräver uppmärksamhet. ── */
function TodayRow({ item, onClick }) {
  const c = SEV[item.sev] || SEV.warning;
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
        padding: '10px 10px', background: c.bg, border: 'none',
        borderRadius: '10px', cursor: item.tab ? 'pointer' : 'default',
        textAlign: 'left', transition: 'opacity 0.15s', fontFamily: 'inherit',
      }}
      onMouseEnter={e => item.tab && (e.currentTarget.style.opacity = '0.82')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      <div style={{ width: 24, height: 24, borderRadius: '7px', background: 'rgba(255,255,255,0.55)', color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={13} />
      </div>
      <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 600, color: c.text, lineHeight: 1.3 }}>{item.text}</span>
      {item.tab && <ChevronRight size={13} style={{ color: c.text, opacity: 0.6, flexShrink: 0 }} />}
    </button>
  );
}

export default function Dashboard({ verifications, balances, accounts, invoices, expenses, contacts, setActiveTab, company, profileIncomplete, onResumeOnboarding, vatPeriods = {}, payrollRuns = [] }) {
  const [chartMode, setChartMode] = useState('revenue-expense');

  // Bugvakt (Sida 32): `maximumFractionDigits: 0` avrundar t.ex. -0.4 till
  // -0, och Intl.NumberFormat skriver då ut "-0 kr" istället för "0 kr" —
  // ett äkta minustecken framför en siffra som i praktiken är noll. Ett
  // konto utan bokförda transaktioner ska alltid visa exakt "0 kr", aldrig
  // "-0 kr" eller ett nästan-noll-belopp som antyder en dold avrundningsbugg
  // i beräkningskedjan ovan.
  const fmt = (val) => {
    const rounded = Math.round(val || 0);
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(rounded === 0 ? 0 : rounded);
  };
  const fmtShort = (val) => {
    const v = val || 0;
    if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}Mkr`;
    if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
    return String(Math.round(v));
  };

  const currentYear = new Date().getFullYear().toString();

  // ── KPIs från verifikationer ──
  let raOmsattning = 0, raKostnader = 0;
  verifications.forEach(v => {
    if ((v.status || 'booked') === 'draft') return; // utkast påverkar inte nyckeltalen än
    if (!v.date.startsWith(currentYear)) return;
    v.rows.forEach(r => {
      if (r.account.startsWith('3')) raOmsattning += (getKredit(r) - getDebet(r));
      else if (['4','5','6','7'].some(p => r.account.startsWith(p))) raKostnader += (getDebet(r) - getKredit(r));
    });
  });
  const raResultat = raOmsattning - raKostnader;

  // ── Fakturabelopp inkl. moms — samma formel som App.jsx:s invoiceGross,
  // upprepad lokalt eftersom den inte exporteras därifrån. ──
  const invoiceGross = (inv) => (inv.rows || []).reduce((sum, r) => {
    const lineNet = r.qty * r.unitPrice;
    return sum + lineNet + lineNet * (r.vatRate / 100);
  }, 0);

  // ── Att göra ──
  const overdueInvoices = invoices.filter(i => i.status === 'sent' && new Date(i.dueDate) < new Date());
  const draftInvoices   = invoices.filter(i => i.status === 'draft');
  const unhandledReceipts = expenses.filter(e => !e.costAccount);
  const pendingPayrollRuns = payrollRuns.filter(r => r.completedSteps?.includes('calculated') && !r.completedSteps?.includes('booked'));

  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + Math.max(0, invoiceGross(i) - (i.paidAmount || 0)), 0);
  const mostOverdueDays = overdueInvoices.reduce((max, i) => {
    const days = Math.round((new Date() - new Date(i.dueDate)) / 86400000);
    return Math.max(max, days);
  }, 0);

  const vatDeadline = useMemo(() => nextVatDeadline(company, vatPeriods), [company, vatPeriods]);

  // ── Moms-kortet — utgående/ingående moms bokförd inom den kommande
  // (ännu inte inlämnade) perioden, samma period som vatDeadline pekar på.
  // Räknas fram riktigt från bokförda verifikationsrader, aldrig uppskattat —
  // samma princip som resten av sidan. ──
  const vatPeriodSummary = useMemo(() => {
    if (!vatDeadline) return null;
    const [start, end] = quarterToRange(vatDeadline.year, vatDeadline.quarter);
    let utgaende = 0, ingaende = 0;
    verifications.forEach(v => {
      if ((v.status || 'booked') === 'draft') return;
      if (v.date < start || v.date > end) return;
      v.rows.forEach(r => {
        if (['2611', '2612', '2613'].includes(r.account)) utgaende += (getKredit(r) - getDebet(r));
        else if (r.account === '2641') ingaende += (getDebet(r) - getKredit(r));
      });
    });
    return {
      quarter: vatDeadline.quarter,
      year: vatDeadline.year,
      utgaende, ingaende,
      attBetala: utgaende - ingaende,
      dueDateLabel: formatISODate(vatDeadline.dueDate),
    };
  }, [vatDeadline, verifications]);

  // Röd: förfallet (passerat förfallodatum). Gul: kommande deadline inom en
  // snar tidsram (~7 dagar). Grön: mindre brådskande, men värt att veta om.
  const todos = [];
  if (overdueInvoices.length > 0) {
    const whenText = overdueInvoices.length === 1
      ? (mostOverdueDays <= 1 ? 'förföll igår' : `förföll för ${mostOverdueDays} dagar sedan`)
      : 'har förfallit';
    todos.push({
      sev: 'danger', icon: AlertCircle, tab: 'invoices',
      text: overdueInvoices.length === 1
        ? `1 faktura ${whenText} — ${fmt(overdueAmount)}`
        : `${overdueInvoices.length} fakturor ${whenText} — ${fmt(overdueAmount)} totalt`,
    });
  }
  if (vatDeadline) {
    if (vatDeadline.daysLeft < 0) {
      todos.push({ sev: 'danger', icon: AlertCircle, text: `Momsdeklaration för kvartal ${vatDeadline.quarter} är försenad`, tab: 'taxes' });
    } else if (vatDeadline.daysLeft <= 7) {
      const when = vatDeadline.daysLeft === 0 ? 'idag' : vatDeadline.daysLeft === 1 ? 'imorgon' : `om ${vatDeadline.daysLeft} dagar`;
      todos.push({ sev: 'warning', icon: Clock, text: `Momsdeklaration ska lämnas ${when}`, tab: 'taxes' });
    }
  }
  if (pendingPayrollRuns.length > 0) {
    todos.push({
      sev: 'warning', icon: Users, tab: 'payroll',
      text: pendingPayrollRuns.length === 1
        ? `Lönekörning ${pendingPayrollRuns[0].period || ''} väntar på godkännande`
        : `${pendingPayrollRuns.length} lönekörningar väntar på godkännande`,
    });
  }
  if (unhandledReceipts.length > 0) {
    todos.push({ sev: 'success', icon: Receipt, tab: 'expenses', text: `${unhandledReceipts.length} kvitto${unhandledReceipts.length > 1 ? 'n' : ''} väntar på granskning` });
  }
  if (draftInvoices.length > 0) {
    todos.push({ sev: 'success', icon: FileText, tab: 'invoices', text: `${draftInvoices.length} fakturautkast väntar` });
  }
  if (todos.length === 0) {
    todos.push({ sev: 'success', icon: CheckCircle2, text: 'Inget kräver din uppmärksamhet idag', tab: null });
  }
  todos.sort((a, b) => SEV[a.sev].rank - SEV[b.sev].rank);

  const hasUrgent = todos[0].sev !== 'success' || todos.length > 1 || todos[0].tab !== null;
  const oneLiner = (todos.length === 1 && todos[0].tab === null)
    ? 'Allt ser bra ut — inget brådskande just nu'
    : `${todos.length} sak${todos.length > 1 ? 'er' : ''} väntar på dig idag`;

  // ── Onboarding ──
  const hasCustomers  = contacts.some(c => c.type === 'customer');
  const hasInvoices   = invoices.length > 0;
  const hasExpenses   = expenses.length > 0;
  const hasSuppliers  = contacts.some(c => c.type === 'supplier');
  const isNew         = !hasCustomers && !hasInvoices && !hasExpenses;

  // ── Senast bokfört — de senast bokförda (aldrig utkast) verifikationerna,
  // sorterade på riktigt datum. Beskrivningen är exakt den som redan
  // sparades när händelsen bokfördes. Beloppet är summan av debetsidan,
  // som (eftersom varje verifikation är balanserad) alltid motsvarar
  // radens bruttobelopp oavsett källa — faktura, utgift eller lön. ──
  const recentBooked = useMemo(() => {
    return verifications
      .filter(v => (v.status || 'booked') !== 'draft')
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)))
      .slice(0, 4)
      .map(v => ({
        id: v.id,
        description: v.description || v.number,
        date: v.date,
        type: BOOK_TYPE_LABEL[v.source] || 'Verifikation',
        amount: v.rows.reduce((s, r) => s + getDebet(r), 0),
      }));
  }, [verifications]);

  // ── 30-dagars sparklines — rekonstruerade från riktiga verifikationsrader,
  // aldrig slumpade. Om det bokförda historiken är kortare än 30 dagar (t.ex.
  // ett nystartat bolag) visas bara de dagar som faktiskt finns — ingen
  // uppdiktad platt förhistoria. Resultat/Omsättning/Kostnader summeras
  // löpande per dag. ──
  const sparkSeries = useMemo(() => {
    const DAYS = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fullStart = new Date(today);
    fullStart.setDate(fullStart.getDate() - (DAYS - 1));
    const fullStartKey = fullStart.toISOString().split('T')[0];

    const bookedDates = verifications
      .filter(v => (v.status || 'booked') !== 'draft')
      .map(v => v.date)
      .filter(Boolean);
    const earliest = bookedDates.length ? bookedDates.reduce((min, d) => (d < min ? d : min)) : fullStartKey;
    const startKey = earliest > fullStartKey ? earliest : fullStartKey;

    const dayKeys = [];
    for (let d = new Date(startKey + 'T00:00:00'); d <= today; d.setDate(d.getDate() + 1)) {
      dayKeys.push(d.toISOString().split('T')[0]);
    }
    const endKey = dayKeys[dayKeys.length - 1];

    const revenueByDay = Object.fromEntries(dayKeys.map(k => [k, 0]));
    const costByDay = Object.fromEntries(dayKeys.map(k => [k, 0]));

    verifications.forEach(v => {
      if ((v.status || 'booked') === 'draft') return;
      if (v.date < startKey || v.date > endKey) return;
      v.rows.forEach(r => {
        if (r.account.startsWith('3')) revenueByDay[v.date] += (getKredit(r) - getDebet(r));
        else if (['4','5','6','7'].some(p => r.account.startsWith(p))) costByDay[v.date] += (getDebet(r) - getKredit(r));
      });
    });

    let cumResult = 0;
    const revenueSeries = [], costSeries = [], resultSeries = [];
    dayKeys.forEach(k => {
      revenueSeries.push(revenueByDay[k]);
      costSeries.push(costByDay[k]);
      cumResult += (revenueByDay[k] - costByDay[k]);
      resultSeries.push(cumResult);
    });

    return { revenueSeries, costSeries, resultSeries };
  }, [verifications]);

  // ── Chartdata ──
  const chartData = useMemo(() => {
    const names = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
    const data = names.map(name => ({ name, Intäkter: 0, Utgifter: 0, Resultat: 0, 'Föregående år': 0 }));
    verifications.forEach(v => {
      if ((v.status || 'booked') === 'draft') return;
      const year = v.date.substring(0, 4);
      const mIdx = parseInt(v.date.substring(5, 7)) - 1;
      if (mIdx < 0 || mIdx >= 12) return;
      v.rows.forEach(r => {
        const rev  = r.account.startsWith('3') ? (getKredit(r) - getDebet(r)) : 0;
        const cost = ['4','5','6','7'].some(p => r.account.startsWith(p)) ? (getDebet(r) - getKredit(r)) : 0;
        if (year === currentYear) {
          data[mIdx].Intäkter += rev;
          data[mIdx].Utgifter += cost;
        } else if (year === String(parseInt(currentYear) - 1)) {
          data[mIdx]['Föregående år'] += rev;
        }
      });
    });
    data.forEach(d => {
      d.Resultat = d.Intäkter - d.Utgifter;
    });
    return data;
  }, [verifications, currentYear]);

  // ── Export ──
  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ company, invoices, expenses, verifications }, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `bokforing-backup-${currentYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Hälsning — tidsgränser i delad util, inte inline ──
  const { greeting } = getGreeting();
  const firstName = company?.name?.split(' ')[0] || '';

  return (
    // Bugkritiskt: rotdiven hade varken minHeight eller egen bakgrund, bara
    // maxWidth. Den stod visserligen som flex:1 (via .main-content-inner > *),
    // men eftersom den var transparent syntes den gråa sidbakgrunden som ett
    // tomt fält under sista kortet på korta sidor (t.ex. en ny, nästan tom
    // startsida) istället för att sidan kändes heltäckande. Samma mönster
    // som redan fixat i SupplierInvoices.jsx.
    <div style={{ maxWidth: '100%', margin: '0 auto', width: '100%', minHeight: '100%', boxSizing: 'border-box', background: 'var(--bg-page)' }}>
      <style>{`
        @media (max-width: 900px) {
          .dash-lower-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .dash-kpi-grid { grid-template-columns: 1fr !important; }
          .dash-quick-actions { grid-template-columns: repeat(2,1fr) !important; }
          .dash-todo-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ─── HEADER ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-voice)', fontWeight: 700, fontSize: '25px', letterSpacing: '-0.01em', color: '#111827', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {greeting}, {firstName || company?.name?.split(' ')[0] || 'Användare'} 👋
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 400, marginBottom: '2px' }}>
            Räkenskapsår {currentYear} · {company?.name || 'Bokix'}
          </p>
          {!isNew && (
            <p style={{ fontSize: '13.5px', fontWeight: 600, color: hasUrgent ? '#374151' : BRAND.greenDark, marginTop: '6px' }}>
              {oneLiner}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={handleExport} className="btn btn-secondary">
            <Download size={14} /> Exportera
          </button>
          <button onClick={() => setActiveTab('invoices')} className="btn btn-primary">
            <FileText size={14} /> Ny faktura
          </button>
        </div>
      </div>

      {/* ─── SNABBÅTGÄRDER — det man faktiskt kom hit för att GÖRA, högst
          upp och tydligt, istället för begravt längst ner på sidan under
          alla siffror. Fyra tydligt olikfärgade kort, inte fyra identiska
          gröna chips, så raden känns levande och går att skanna snabbt. ─── */}
      {!isNew && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <Zap size={14} style={{ color: BRAND.greenDark }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>Snabbåtgärder</span>
          </div>
          <div className="dash-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.label}
                onClick={() => setActiveTab(a.tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '14px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '13px',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', textAlign: 'left',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <a.icon size={16} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── ATT GÖRA IDAG — sidans mest konkreta, klickbara lista, nu i full
          bredd direkt under Snabbåtgärder istället för instängd i en trång
          bottenruta. Röd/gul/grön styr ordning, aldrig kronologi. ─── */}
      {!isNew && (
        <div style={{ position: 'relative', background: 'var(--bg-cream)', border: '1px solid var(--bg-cream-border)', borderRadius: '14px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden', marginBottom: '20px' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(61,122,46,0.05)' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>Att göra idag</span>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px',
              background: hasUrgent ? 'rgba(255,255,255,0.7)' : BRAND.greenLight,
              color: hasUrgent ? '#6b7280' : BRAND.greenDark,
            }}>
              {hasUrgent ? `${todos.length} ${todos.length === 1 ? 'post' : 'poster'}` : 'Allt klart'}
            </span>
          </div>
          <div className="dash-todo-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: todos.length > 1 ? 'repeat(2,1fr)' : '1fr', gap: '6px' }}>
            {todos.map((t, i) => (
              <TodayRow key={i} item={t} onClick={() => t.tab && setActiveTab(t.tab)} />
            ))}
          </div>
        </div>
      )}

      {/* ─── NYCKELTAL — Resultat/Intäkter/Kostnader, med vardagliga
          etiketter (inte bokföringsjargong som "RÅ Omsättning") så siffrorna
          är begripliga utan förkunskaper. ─── */}
      <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '20px' }}>
        <KpiCard
          hero
          label="Resultat" value={fmt(raResultat)}
          sub={raResultat >= 0 ? `Vinst ${currentYear}` : `Förlust ${currentYear}`}
          icon={raResultat >= 0 ? TrendingUp : TrendingDown}
          color={raResultat >= 0 ? BRAND.greenDark : BRAND.redText}
          bg={raResultat >= 0 ? LIME_L : RED_L}
          positive={raResultat >= 0}
          onClick={() => setActiveTab('reports')}
          spark={sparkSeries.resultSeries}
          sparkColor={raResultat >= 0 ? REVENUE : EXPENSE}
          gradient={raResultat >= 0 ? KPI_GRAD_POSITIVE : KPI_GRAD_NEGATIVE}
        />
        <KpiCard
          label="Intäkter" value={fmt(raOmsattning)} sub={`Hittills ${currentYear}`}
          icon={ArrowUpRight} color={BRAND.greenDark} bg={LIME_L} positive={true}
          onClick={() => setActiveTab('reports')}
          spark={sparkSeries.revenueSeries}
          sparkColor={REVENUE}
          gradient={KPI_GRAD_POSITIVE}
        />
        <KpiCard
          label="Kostnader" value={fmt(raKostnader)} sub={`Hittills ${currentYear}`}
          icon={ArrowDownRight} color={BRAND.redText} bg={RED_L} positive={false}
          onClick={() => setActiveTab('expenses')}
          spark={sparkSeries.costSeries}
          sparkColor={EXPENSE}
          gradient={KPI_GRAD_NEGATIVE}
        />
      </div>

      {/* ─── GRAF — full bredd, svag cremeton (Sida 31/32) istället för rent
          vitt för att skilja den från de vita KPI-korten ovanför. ─── */}
      {!isNew && (
        <div style={{ background: 'var(--bg-cream)', border: '1px solid var(--bg-cream-border)', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', marginBottom: '18px', minWidth: 0 }}>
          {/* Chart header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em', marginBottom: '2px' }}>
                {CHART_MODES.find(m => m.id === chartMode)?.label}
              </h2>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                Innevarande räkenskapsår {currentYear} jämfört med {parseInt(currentYear) - 1}
              </p>
              {/* Legenden uppdateras dynamiskt beroende på vald flik — aldrig
                  statisk text som bara passar första vyn. */}
              {chartMode === 'revenue-expense' && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: BRAND.greenDark }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: REVENUE, display: 'inline-block' }} />
                    Intäkter {fmt(raOmsattning)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: BRAND.redText }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: EXPENSE, display: 'inline-block' }} />
                    Utgifter {fmt(raKostnader)}
                  </span>
                </div>
              )}
              {chartMode === 'result' && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: raResultat >= 0 ? BRAND.greenDark : BRAND.redText }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: raResultat >= 0 ? REVENUE : EXPENSE, display: 'inline-block' }} />
                    Resultat {fmt(raResultat)}
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px', background: '#f9fafb', padding: '3px', borderRadius: '9px', border: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
              {CHART_MODES.map(m => (
                <button key={m.id} onClick={() => setChartMode(m.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 11px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: chartMode === m.id ? 600 : 400,
                  background: chartMode === m.id ? BRAND.green : 'transparent',
                  color: chartMode === m.id ? 'white' : '#6b7280',
                  boxShadow: chartMode === m.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}>
                  <m.icon size={11} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Charts */}
          {chartMode === 'revenue-expense' && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={fmtShort} width={44} />
                <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                <Bar dataKey="Intäkter" fill={REVENUE} radius={[4,4,0,0]} barSize={16} />
                <Bar dataKey="Utgifter" fill={EXPENSE} radius={[4,4,0,0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartMode === 'result' && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={fmtShort} width={44} />
                <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5} />
                <Bar dataKey="Resultat" radius={[4,4,0,0]} barSize={20}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.Resultat >= 0 ? REVENUE : EXPENSE} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

        </div>
      )}

      {/* ─── SENAST BOKFÖRT + MOMS — sidans två "läge just nu"-rutor, parade
          i en 2/1-rad längst ner istället för att tävla om samma vikt som
          Snabbåtgärder/Att göra idag/Nyckeltalen ovanför (Sida 34). ─── */}
      {!isNew && (
        <div className="dash-lower-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '18px', alignItems: 'stretch' }}>

          {/* Senast bokfört — riktiga, bokförda händelser (aldrig utkast),
              sorterade på riktigt datum. Beskrivningen är exakt den som redan
              sparades när händelsen bokfördes, inte en omskriven version. */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>Senast bokfört</span>
              <button onClick={() => setActiveTab('verifications')} className="ds-link-btn sm">Alla verifikationer</button>
            </div>
            {recentBooked.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: '12.5px', color: '#9ca3af' }}>Inga bokförda verifikationer än</div>
            ) : (
              <div>
                {recentBooked.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '13px 20px', borderBottom: '1px solid #f7f8f7' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                      <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '2px' }}>{item.date} · {item.type}</div>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827', flexShrink: 0 }}>{fmt(item.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Moms — nästa (ännu ej inlämnade) momsperiod, räknat från riktiga
              bokförda utgående/ingående moms-rader inom perioden. */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {vatPeriodSummary ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>Moms Q{vatPeriodSummary.quarter} {vatPeriodSummary.year}</span>
                  <span style={{ fontSize: '10.5px', color: '#9ca3af', whiteSpace: 'nowrap' }}>Förfaller {vatPeriodSummary.dueDateLabel}</span>
                </div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{fmt(Math.abs(vatPeriodSummary.attBetala))}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{vatPeriodSummary.attBetala >= 0 ? 'att betala' : 'att få tillbaka'}</div>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: BRAND.amberBg, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999, background: BRAND.green,
                    width: `${vatPeriodSummary.utgaende > 0 ? Math.min(100, Math.max(0, (vatPeriodSummary.ingaende / vatPeriodSummary.utgaende) * 100)) : 0}%`,
                  }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Utgående {fmt(vatPeriodSummary.utgaende)}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Ingående {fmt(vatPeriodSummary.ingaende)}</span>
                </div>
                <button onClick={() => setActiveTab('taxes')} className="btn btn-secondary btn-sm" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}>Se momsrapport</button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>Moms</span>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Ingen kommande momsdeklaration att visa.</p>
                <button onClick={() => setActiveTab('taxes')} className="btn btn-secondary btn-sm" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}>Till Skatt &amp; Moms</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── ONBOARDING — nedtonat, sist på sidan, subtil border istället för
          framhävd bakgrundsfärg. Onboarding-hjälp, inte det dagliga fokuset. ─── */}
      {profileIncomplete && !isNew && (
        <div style={{ background: 'white', border: '1px solid #eef0f2', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12.5px', color: '#6b7280' }}>
            <strong style={{ color: '#374151', fontWeight: 700 }}>Företagsprofilen är inte klar. </strong>
            Komplettera den för att få rätt rapporter och dokument.
          </div>
          <button onClick={onResumeOnboarding} style={{ padding: '7px 14px', background: 'white', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12.5px', flexShrink: 0 }}>Fortsätt registreringen</button>
        </div>
      )}
      {isNew && (
        // Sida 31: tomt-läge/hero-yta för ett helt nytt konto — cremeton
        // istället för vitt, samma princip som Idag-modulen ovan.
        <div style={{ background: 'var(--bg-cream)', border: '1px solid var(--bg-cream-border)', borderRadius: '14px', padding: '20px 22px', marginTop: '4px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '2px' }}>Kom igång med Bokix</h2>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '14px' }}>Slutför dessa steg — den här rutan försvinner när du är igång.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { done: hasCustomers, label: 'Skapa din första kund',      tab: 'contacts' },
              { done: hasInvoices,  label: 'Skapa din första faktura',   tab: 'invoices' },
              { done: hasExpenses,  label: 'Lägg till din första utgift', tab: 'expenses' },
              { done: hasSuppliers, label: 'Lägg till en leverantör',    tab: 'contacts' },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'white', borderRadius: '9px', border: `1px solid ${step.done ? '#dcefdc' : '#eef0f2'}` }}>
                {step.done
                  ? <CheckCircle size={15} style={{ color: BRAND.greenDark, flexShrink: 0 }} />
                  : <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid #d1d5db', flexShrink: 0 }} />}
                <span style={{ flex: 1, fontSize: '13px', color: step.done ? '#b0b6be' : '#4b5563', textDecoration: step.done ? 'line-through' : 'none' }}>{step.label}</span>
                {!step.done && (
                  <button onClick={() => setActiveTab(step.tab)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND.green, fontSize: '11.5px', fontWeight: 600, fontFamily: 'inherit' }}>Börja →</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
