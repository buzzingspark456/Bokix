import React, { useMemo, useState } from 'react';
import {
  FileText, CreditCard, Receipt, TrendingUp, TrendingDown,
  ChevronRight, Download, ArrowUpRight, ArrowDownRight,
  CheckCircle, Minus, BarChart2, Activity
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Cell
} from 'recharts';
import { getDebet, getKredit } from '../utils/verificationAmounts';

// Allra färgpalett
const LIME   = '#5ba85a';
const BLUE   = '#3a8fc1';
const LIME_L = '#f2f9f2';
const BLUE_L = '#eef5fb';

const CHART_MODES = [
  { id: 'revenue-expense', label: 'Intäkter vs Utgifter', icon: BarChart2 },
  { id: 'result',          label: 'Resultat',              icon: Minus },
  { id: 'liquidity',       label: 'Likviditet',            icon: Activity },
];

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

/* ── KPI Card ── */
function KpiCard({ label, value, sub, icon: Icon, color, bg, positive, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '14px',
      padding: '20px',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.09)';
      e.currentTarget.style.borderColor = color;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = '';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
      e.currentTarget.style.borderColor = '#e5e7eb';
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ background: bg, color, width: 36, height: 36, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} />
        </div>
        {positive != null && (
          <div style={{ color: positive ? LIME : '#dc2626', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
            {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827', letterSpacing: '-0.04em', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '4px' }}>{sub}</div>}
      </div>
    </button>
  );
}

export default function Dashboard({ verifications, balances, accounts, invoices, expenses, contacts, setActiveTab, company, profileIncomplete, onResumeOnboarding, stripeAccountId, onConnectStripe }) {
  const [chartMode, setChartMode] = useState('revenue-expense');

  const fmt = (val) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
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
  const likviditet = (balances['1930'] || 0) + (balances['1920'] || 0) + (balances['1910'] || 0);

  // ── Att göra ──
  const overdueInvoices = invoices.filter(i => i.status === 'sent' && new Date(i.dueDate) < new Date());
  const draftInvoices   = invoices.filter(i => i.status === 'draft');
  const vatLiability    = Math.max(0, -(balances['2611'] || 0) + (balances['2641'] || 0));
  const unpaidInvoices  = invoices.filter(i => (i.type || 'invoice') === 'invoice' && (i.status === 'sent' || i.status === 'draft'));

  const todos = [];
  if (overdueInvoices.length > 0) todos.push({ sev: 'danger',  text: `${overdueInvoices.length} faktura${overdueInvoices.length > 1 ? 'r' : ''} har förfallit`, tab: 'invoices' });
  if (draftInvoices.length > 0)   todos.push({ sev: 'warning', text: `${draftInvoices.length} fakturautkast väntar`,                                                    tab: 'invoices' });
  if (vatLiability > 5000)        todos.push({ sev: 'warning', text: `Momsdeklaration: ${fmt(vatLiability)}`,                                                            tab: 'taxes'   });
  if (todos.length === 0)         todos.push({ sev: 'success', text: 'Allt i ordning – inga åtgärder krävs',                                                             tab: null      });

  // ── Onboarding ──
  const hasCustomers  = contacts.some(c => c.type === 'customer');
  const hasInvoices   = invoices.length > 0;
  const hasExpenses   = expenses.length > 0;
  const hasSuppliers  = contacts.some(c => c.type === 'supplier');
  const isNew         = !hasCustomers && !hasInvoices && !hasExpenses;

  // ── Chartdata ──
  const chartData = useMemo(() => {
    const names = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
    const data = names.map(name => ({ name, Intäkter: 0, Utgifter: 0, Resultat: 0, Likviditet: 0, 'Föregående år': 0 }));
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
    let running = 0;
    data.forEach(d => {
      d.Resultat  = d.Intäkter - d.Utgifter;
      running    += d.Resultat;
      d.Likviditet = running;
    });
    return data;
  }, [verifications, currentYear]);

  // Calculate gradient offset for Likviditet area chart
  const likviditetGradientOffset = () => {
    const dataMax = Math.max(...chartData.map(i => i.Likviditet));
    const dataMin = Math.min(...chartData.map(i => i.Likviditet));
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
    return dataMax / (dataMax - dataMin);
  };
  const liqOff = likviditetGradientOffset();

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

  // ── Hälsning ──
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'God morgon' : hour < 18 ? 'God eftermiddag' : 'God kväll';
  const firstName = company?.name?.split(' ')[0] || '';

  const todoColors = {
    danger:  { dot: '#ef4444', border: '#fca5a5', bg: '#fff1f1' },
    warning: { dot: '#f59e0b', border: '#fcd34d', bg: '#fffbeb' },
    success: { dot: LIME,      border: '#b8e2b8', bg: LIME_L    },
    info:    { dot: BLUE,      border: '#a8d1eb', bg: BLUE_L    },
  };

  return (
    // Bugkritiskt: rotdiven hade varken minHeight eller egen bakgrund, bara
    // maxWidth. Den stod visserligen som flex:1 (via .main-content-inner > *),
    // men eftersom den var transparent syntes den gråa sidbakgrunden som ett
    // tomt fält under sista kortet på korta sidor (t.ex. en ny, nästan tom
    // startsida) istället för att sidan kändes heltäckande. Samma mönster
    // som redan fixat i SupplierInvoices.jsx.
    <div style={{ maxWidth: '100%', margin: '0 auto', width: '100%', minHeight: '100%', boxSizing: 'border-box', background: 'var(--bg-page)' }}>

      {/* ─── HEADER ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: '#111827', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {greeting}, {firstName || company?.name?.split(' ')[0] || 'Användare'} 👋
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '13px', fontWeight: 400 }}>
            Räkenskapsår {currentYear} · {company?.name || 'Bokix'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {[['Ny offert', 'invoices'], ['Ny kund', 'contacts'], ['Ny utgift', 'expenses']].map(([label, tab], index) => (
              <React.Fragment key={tab}>
                <button
                  onClick={() => setActiveTab(tab)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', fontWeight: 500, padding: '0', transition: 'color 0.15s', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.color = LIME}
                  onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                >{label}</button>
                {index < 2 && <span style={{ color: '#d1d5db', fontSize: '13px', userSelect: 'none' }}>·</span>}
              </React.Fragment>
            ))}
          </div>
          <button onClick={handleExport} className="btn btn-secondary" style={{ marginLeft: '4px' }}>
            <Download size={14} /> Exportera
          </button>
          <button onClick={() => setActiveTab('invoices')} className="btn btn-primary">
            <FileText size={14} /> Ny faktura
          </button>
        </div>
      </div>

      {/* ─── ONBOARDING ─── */}
      {profileIncomplete && !isNew && (
        <div style={{ background: 'linear-gradient(135deg, #eef9ff 0%, #f3fdf5 100%)', border: `1px solid #c7e7d9`, borderRadius: '16px', padding: '24px 28px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Komplettera din företagsprofil</h2>
              <p style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>Du kan uppdatera viktig företagsinformation när som helst för att få rätt rapporter och dokument.</p>
              <button onClick={onResumeOnboarding} style={{ padding: '10px 16px', background: '#3a8fc1', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>Fortsätt registreringen</button>
            </div>
            <div style={{ display: 'grid', gap: '10px', minWidth: '220px', background: 'white', borderRadius: '14px', padding: '16px', border: '1px solid #e5f3ed' }}>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Profilstatus</div>
              <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700 }}>Företagsprofil inte slutförd</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Det här hjälper dig att komma igång snabbare och hålla ordning på moms, adress och kontaktuppgifter.</div>
            </div>
          </div>
        </div>
      )}
      {isNew && (
        // Tidigare gick gradienten mot BLUE_L, vilket dels bröt mot
        // "aldrig blått"-regeln, dels gjorde rutan så blek att den lästes
        // som en vanlig vit yta med en tunn grön kant istället för en
        // medveten del av det gröna bildspråket. Två gröna toner istället.
        <div style={{ background: `linear-gradient(135deg, #eaf3de 0%, ${LIME_L} 100%)`, border: `1px solid #b8e2b8`, borderRadius: '16px', padding: '24px 28px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Kom igång med Bokix</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>Slutför dessa steg för att komma igång.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { done: hasCustomers, label: 'Skapa din första kund',      tab: 'contacts' },
              { done: hasInvoices,  label: 'Skapa din första faktura',   tab: 'invoices' },
              { done: hasExpenses,  label: 'Lägg till din första utgift', tab: 'expenses' },
              { done: hasSuppliers, label: 'Lägg till en leverantör',    tab: 'contacts' },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'white', borderRadius: '10px', border: `1px solid ${step.done ? '#b8e2b8' : '#e5e7eb'}` }}>
                {step.done
                  ? <CheckCircle size={18} style={{ color: LIME, flexShrink: 0 }} />
                  : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #d1d5db', flexShrink: 0 }} />}
                <span style={{ flex: 1, fontSize: '14px', color: step.done ? '#9ca3af' : '#111827', textDecoration: step.done ? 'line-through' : 'none' }}>{step.label}</span>
                {!step.done && (
                  <button onClick={() => setActiveTab(step.tab)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: LIME, fontSize: '12px', fontWeight: 600, fontFamily: 'inherit' }}>Börja →</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── KPI CARDS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '28px' }}>
        <KpiCard
          label="RÅ Resultat" value={fmt(raResultat)}
          sub={raResultat >= 0 ? `Vinst ${currentYear}` : `Förlust ${currentYear}`}
          icon={raResultat >= 0 ? TrendingUp : TrendingDown}
          color={raResultat >= 0 ? LIME : '#dc2626'}
          bg={raResultat >= 0 ? LIME_L : '#fef2f2'}
          positive={raResultat >= 0}
          onClick={() => setActiveTab('reports')}
        />
        <KpiCard
          label="RÅ Omsättning" value={fmt(raOmsattning)} sub={currentYear}
          icon={ArrowUpRight} color={BLUE} bg={BLUE_L} positive={true}
          onClick={() => setActiveTab('reports')}
        />
        <KpiCard
          label="RÅ Kostnader" value={fmt(raKostnader)} sub={currentYear}
          icon={ArrowDownRight} color="#d97706" bg="#fffbeb" positive={false}
          onClick={() => setActiveTab('expenses')}
        />
        <KpiCard
          label="Likviditet" value={fmt(likviditet)} sub="Kassa & Bank"
          icon={CreditCard} color={BLUE} bg={BLUE_L} positive={likviditet > 0}
          onClick={() => setActiveTab('verifications')}
        />
      </div>

      <div style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
        {!stripeAccountId && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '12px', background: LIME_L, color: LIME, display: 'grid', placeItems: 'center' }}><CreditCard size={18} /></div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>Stripe Connect</div>
                <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.7' }}>Anslut Stripe för att ta emot kortbetalningar direkt till ditt företagskonto och använda Bokix som plattform.</div>
              </div>
            </div>
            <button onClick={onConnectStripe} style={{ padding: '11px 18px', borderRadius: '10px', border: 'none', background: '#3d7a2e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Anslut Stripe</button>
          </div>
        )}
        {stripeAccountId && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>Stripe Connect är anslutet</div>
              <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.7' }}>Ditt konto är kopplat och kan ta emot betalningar via Stripe Checkout. Uppdatera onboarding om du vill fortsätta verifieringen.</div>
            </div>
            <button onClick={onConnectStripe} style={{ padding: '11px 18px', borderRadius: '10px', border: 'none', background: '#3d7a2e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Öppna Stripe</button>
          </div>
        )}
      </div>

      {/* ─── ATT GÖRA (full bredd när aktivitet är borttagen) ─── */}
      {!isNew && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>Att göra idag</span>
              {unpaidInvoices.length > 0 && (
                <span style={{ background: '#fef9c3', color: '#92400e', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', border: '1px solid #fde68a' }}>
                  {unpaidInvoices.length} obetald{unpaidInvoices.length === 1 ? '' : 'a'}
                </span>
              )}
            </div>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todos.map((t, i) => {
                const c = todoColors[t.sev] || todoColors.info;
                return (
                  <button
                    key={i}
                    onClick={() => t.tab && setActiveTab(t.tab)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '11px 12px', background: c.bg, border: `1px solid ${c.border}`,
                      borderRadius: '9px', cursor: t.tab ? 'pointer' : 'default',
                      textAlign: 'left', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => t.tab && (e.currentTarget.style.opacity = '0.82')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#374151' }}>{t.text}</span>
                    {t.tab && <ChevronRight size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── CHART ─── */}
      {!isNew && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {/* Chart header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em', marginBottom: '2px' }}>
                {CHART_MODES.find(m => m.id === chartMode)?.label}
              </h2>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                Innevarande räkenskapsår {currentYear} jämfört med {parseInt(currentYear) - 1}
              </p>
              {chartMode === 'revenue-expense' && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#374151' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: LIME, display: 'inline-block' }} />
                    Intäkter {fmt(raOmsattning)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#374151' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                    Utgifter {fmt(raKostnader)}
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
                  background: chartMode === m.id ? 'white' : 'transparent',
                  color: chartMode === m.id ? '#111827' : '#6b7280',
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
                <Bar dataKey="Intäkter" fill={LIME}    radius={[4,4,0,0]} barSize={16} />
                <Bar dataKey="Utgifter" fill="#ef4444" radius={[4,4,0,0]} barSize={16} />
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
                    <Cell key={`cell-${index}`} fill={entry.Resultat >= 0 ? LIME : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartMode === 'liquidity' && (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradLiq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={liqOff} stopColor={LIME} stopOpacity={0.3} />
                    <stop offset={liqOff} stopColor="#ef4444" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="gradLiqStroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={liqOff} stopColor={LIME} stopOpacity={1} />
                    <stop offset={liqOff} stopColor="#ef4444" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#94a3b8" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={fmtShort} width={44} />
                <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ stroke: '#b8e2b8', strokeWidth: 1.5 }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                <Area type="monotone" dataKey="Likviditet"      name={`Likviditet ${currentYear}`}          stroke="url(#gradLiqStroke)"     strokeWidth={2.5} fill="url(#gradLiq)"  dot={false} />
                <Area type="monotone" dataKey="Föregående år"   name={`Omsättning ${parseInt(currentYear)-1}`} stroke="#94a3b8" strokeWidth={2}   strokeDasharray="6 4" fill="url(#gradPrev)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
