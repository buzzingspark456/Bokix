import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  FileText, Receipt, TrendingUp, TrendingDown,
  ChevronRight, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Minus, BarChart2,
  UserPlus, Users, Clock, AlertCircle, Zap, X, MessageSquare, ClipboardCheck,
  // Aliasat — 'LineChart' krockar annars med recharts-komponenten med
  // samma namn som redan importeras nedan (två helt olika saker: en ikon
  // kontra en diagramkomponent).
  LineChart as LineChartIcon, Table2,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Cell
} from 'recharts';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { quarterToRange } from '../utils/vatCalculation';
import { nextVatDeadline } from '../utils/declarationDeadlines';
import { getGreeting } from '../utils/greeting';
import { BRAND, KPI_GRADIENTS, VIVID } from '../utils/brandColors';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';

/* ── Färger (Sida 30): grönt för positivt/rött för negativt, konsekvent i
   hela appen. Två nyanser per färg: en ljusare "grafisk" ton för linjer/
   stapelfyllnad (kräver bara 3:1-kontrast enligt WCAG AA för grafiska
   element) och en mörkare ton från BRAND för text på ljus bakgrund (kräver
   4.5:1). Verifierat: #E24B4A mot vitt ≈ 3.9:1 — gott och väl godkänt för
   grafiska element, men medvetet ALDRIG använt som brödtextfärg — se
   REVENUE/EXPENSE nedan kontra BRAND.greenDark/BRAND.redText.
   OBS: REVENUE/EXPENSE används numera bara för Resultat-läget (en enda
   stapelserie som pekar upp/ner — position mot nollinjen bär identiteten,
   färgen är bara sekundär bekräftelse). De dög INTE för Intäkter/Utgifter-
   läget där två serier ligger sida vid sida och måste kunna särskiljas på
   färgen ensam: validate_palette.js gav ΔE 2.1 för deuteranopi — långt under
   golvet på 6. Den kategoriska jämförelsen använder CHART_REVENUE/
   CHART_EXPENSE istället (ΔE 12.4, godkänt både ljust och mörkt). ── */
const REVENUE = '#639922';
const EXPENSE = '#E24B4A';
const LIME_L  = BRAND.greenLight;
const RED_L   = BRAND.redBg;

// Djärvare, mer "glad" variant av de tre resultaträkningskorten (Sida 33) —
// fyllda gradientytor istället för vitt kort + liten ikon-chip. Intäkter har
// en egen blå nyans så den inte längre ser identisk ut som Resultat-vid-vinst
// (båda var tidigare exakt samma gröna gradient). Kostnader delar medvetet
// samma röda/rosa gradient som Resultat-vid-förlust — båda signalerar
// "kostnad/negativt" och ska se ihop. Vit text på dessa mörka gradienter
// ligger gott och väl över 4.5:1 i båda ändarna, så kontraster hålls.
// Gradient-paren själva flyttade till brandColors.js (KPI_GRADIENTS) så
// andra sidors egna sammanfattningskort (Reports.jsx m.fl.) kan återanvända
// EXAKT samma nyanser — se kommentaren där.
const KPI_GRAD_POSITIVE = KPI_GRADIENTS.positive; // Resultat: vinst
const KPI_GRAD_NEGATIVE = KPI_GRADIENTS.negative; // Resultat: förlust, Kostnader
const KPI_GRAD_REVENUE  = KPI_GRADIENTS.revenue;  // Intäkter

// Intäkter-vs-Utgifter-grafen (kategorisk, två serier sida vid sida) — blått/
// rosa istället för grönt/rött. Samma toner som Intäkter- och Kostnader-
// korten ovan, så graf och nyckeltal hänger ihop visuellt, och paret klarar
// CVD-kontrollen som det gamla gröna/röda inte gjorde (se kommentar ovan).
const CHART_REVENUE = KPI_GRAD_REVENUE[0];  // blå
const CHART_EXPENSE = KPI_GRAD_NEGATIVE[0]; // rosa/röd

// Föregående års jämförelselinjer (Intäkter vs Utgifter-läget): SAMMA
// validerade nyanser som ovan, bara halvtransparenta — inte en tredje/fjärde
// egen kulör att CVD-validera på nytt (validate_palette.js, se dataviz-
// skillen). Urskiljs från innevarande års staplar via FORM (streckad linje
// ovanpå/vid sidan av stapeln), inte via en ny färg — samma "sekundär,
// icke-färgbaserad kodning"-princip som redan etablerats för Rapport och
// analys (ReportUI.jsx: dashed grå linje = "Föregående period").
const hexToRgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
const CHART_REVENUE_PREV = hexToRgba(CHART_REVENUE, 0.55);
const CHART_EXPENSE_PREV = hexToRgba(CHART_EXPENSE, 0.55);

// "Kom igång"-checklistan (Sida 31) — en egen accentfärg per steg istället
// för enhetligt grått, så listan blir lättare att skanna. Klar-status
// målas i samma nyans som steget hade innan, bara fylld istället för outline.
const ONBOARD_STEP_COLORS = {
  customer: '#3b93d1', // blå — matchar Intäkter-kortets nya blå ton
  invoice:  '#2f8a3a', // grön — samma familj som "vinst"
  expense:  '#e2891f', // orange
  supplier: '#8b5cf6', // lila
};
const CONFETTI_COLORS = [ONBOARD_STEP_COLORS.customer, ONBOARD_STEP_COLORS.invoice, ONBOARD_STEP_COLORS.expense, ONBOARD_STEP_COLORS.supplier, '#e0527a'];
const ONBOARDING_DISMISSED_KEY = 'bokix_dashboard_checklist_dismissed';
// Kundrapporterad bugg: "Grattis, du är igång!"-firandet blossade upp på
// NYTT varje gång man lämnade Dashboard och kom tillbaka, trots att alla
// fyra steg redan var klara sedan tidigare besök. Orsaken var
// wasAllOnboardingDoneRef nedan — en `ref`, som (till skillnad från denna
// localStorage-backade flagga) alltid börjar om på `false` varje gång
// Dashboard monteras om (varje flikbyte bort och tillbaka), så effekten
// trodde att kontot "just nu" blev klart igen och triggade om firandet.
// Den här flaggan kommer ihåg att firandet redan skett EN gång, permanent
// — texten lovar "den här rutan försvinner nu", inte "till nästa besök".
const ONBOARDING_CELEBRATED_KEY = 'bokix_dashboard_checklist_celebrated';

// Tysta textlänkar i "Kom igång"-kortets fot (support-genvägar + den
// manuella dölj-länken) — samma dämpade mönster som HelpDrawer.jsx:s
// motsvarande footer, så en användare känner igen sig oavsett var i appen
// de stöter på "Kontakta support".
const ONBOARD_FOOTER_LINK_STYLE = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
  textDecoration: 'none', transition: 'color 0.15s',
};

const CHART_MODES = [
  { id: 'revenue-expense', label: 'Intäkter vs Utgifter', icon: BarChart2 },
  { id: 'result',          label: 'Resultat',              icon: Minus },
];

// Diagramformat — samma data, tre sätt att läsa den. "Tabell" är inte bara
// en extra vy för smaksak: dataviz-skillens tillgänglighetskrav säger att en
// tabellvy alltid ska finnas som alternativ till en ren grafisk framställning.
const FORMAT_MODES = [
  { id: 'bars',  label: 'Staplar', icon: BarChart2 },
  { id: 'line',  label: 'Linje',   icon: LineChartIcon },
  { id: 'table', label: 'Tabell',  icon: Table2 },
];

// Linjestil (kundönskemål: "olika varianter så de kan välja hur den ska se
// ut") — bara relevant i Linje-formatet ovan, en egen liten radväljare som
// bara syns där. `type` är Recharts egen <Line>-prop: 'monotone' rundar av
// kurvan mellan punkterna, 'linear' drar raka segment rakt mellan dem,
// 'stepAfter' hoppar i steg (håller föregående månads värde tills nästa
// punkt) — tre olika sätt att läsa SAMMA siffror, ingen ändrar datan.
const LINE_VARIANTS = [
  { id: 'smooth',   label: 'Slät',   type: 'monotone' },
  { id: 'straight', label: 'Rak',    type: 'linear' },
  { id: 'step',     label: 'Trappa', type: 'stepAfter' },
];

/** Liten färgad prick/streck-swatch för handbyggda legender (samma mönster
 * som ReportUI.jsx:s `swatch`-hjälpare, men lokal här eftersom Dashboard.jsx
 * inte i övrigt delar presentationsdelar med Rapport och analys). */
function legendSwatch(color, dashed = false) {
  return (
    <span style={{
      width: '13px', height: dashed ? '2px' : '9px', borderRadius: dashed ? 0 : '50%',
      background: dashed ? 'none' : color, borderTop: dashed ? `2px dashed ${color}` : undefined,
      display: 'inline-block', flexShrink: 0,
    }} />
  );
}

/** Delta-badge (pil + procent) för tabellformatets "vs föreg. år"-kolumn —
 * samma piktogram/färglogik som KPI-kortens delta, i miniatyr. `null` (inte
 * "0%") när fjolårssiffran är 0, av samma skäl som ReportUI.jsx:s
 * formatDelta: en procentuell förändring från noll är matematiskt
 * meningslös, inte "oändligt bra/dåligt". */
function DeltaBadge({ current, previous }) {
  if (!previous) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rising = pct >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: rising ? BRAND.greenDark : BRAND.redText, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      {rising ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/** Tabellformatet — samma tolv månadsrader som graferna, som en riktig
 * `<table>` istället för streck/staplar. Kolumnerna anpassar sig efter
 * chartMode så tabellen aldrig visar en tom "Utgifter"-kolumn i Resultat-läget. */
function ChartDataTable({ data, mode, fmt, hasPrevYearData, previousYear }) {
  const showRevExp = mode === 'revenue-expense';
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Månad</th>
            {showRevExp && <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Intäkter</th>}
            {showRevExp && <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Utgifter</th>}
            <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Resultat</th>
            {hasPrevYearData && <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Resultat {previousYear}</th>}
            {hasPrevYearData && <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Förändring</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.name} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 1 ? 'var(--bg-muted)' : 'transparent' }}>
              <td style={{ padding: '7px 10px', color: 'var(--text-main)', fontWeight: 600 }}>{row.name}</td>
              {showRevExp && <td style={{ textAlign: 'right', padding: '7px 10px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.Intäkter)}</td>}
              {showRevExp && <td style={{ textAlign: 'right', padding: '7px 10px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.Utgifter)}</td>}
              <td style={{ textAlign: 'right', padding: '7px 10px', color: row.Resultat >= 0 ? BRAND.greenDark : BRAND.redText, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.Resultat)}</td>
              {hasPrevYearData && <td style={{ textAlign: 'right', padding: '7px 10px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.PrevResultat)}</td>}
              {hasPrevYearData && <td style={{ textAlign: 'right', padding: '7px 10px' }}><DeltaBadge current={row.Resultat} previous={row.PrevResultat} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Snabbåtgärder — varje genväg får en egen tydlig färg istället för samma
// enfärgade gröna chip för alla fyra, så raden känns levande och man kan
// skilja knapparna åt med ett enda ögonkast.
// Kundfeedback ("starkare färger, inte AI-mall-känsla"): bytt från de bleka
// status-badge-tonerna (BRAND.*Bg/*Text, tänkta för diskreta märken) till
// VIVID — solida, mättade plattor med vit ikon (se brandColors.js).
const QUICK_ACTIONS = [
  { label: 'Ny faktura',       icon: FileText, tab: 'invoices', bg: VIVID.green },
  { label: 'Ladda upp kvitto', icon: Receipt,  tab: 'expenses', bg: VIVID.blue },
  { label: 'Ny kontakt',       icon: UserPlus, tab: 'contacts', bg: VIVID.pink },
  { label: 'Rapportera tid',   icon: Clock,    tab: 'projects', bg: VIVID.amber },
];

// Röd/gul/grön — samma BRAND-tokens som statusar i övriga listor i appen
// (Bokförd/Granska/Förfallen) för radens BAKGRUND (bg, diskret tint), men en
// solid VIVID-platta för ikon-chippen (icon) — se QUICK_ACTIONS-kommentaren.
const SEV = {
  danger:  { bg: BRAND.redBg,    text: BRAND.redText,   icon: VIVID.red,   rank: 0 },
  warning: { bg: BRAND.amberBg,  text: BRAND.amberText, icon: VIVID.amber, rank: 1 },
  success: { bg: BRAND.greenLight, text: BRAND.greenDark, icon: VIVID.green, rank: 2 },
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

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.09)',
      fontSize: '12.5px',
      minWidth: '160px',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', fontSize: '13px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
          </div>
          <strong style={{ color: 'var(--text-main)' }}>{fmt(p.value)}</strong>
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
function KpiCard({ label, value, sub, icon: Icon, color, bg, positive, onClick, hero, gradient }) {
  const bold = !!gradient;
  return (
    <button onClick={onClick} style={{
      background: bold ? `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` : 'white',
      border: bold ? 'none' : (hero ? `1px solid ${sparkColor || color}33` : '1px solid var(--border)'),
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
      if (!bold) e.currentTarget.style.borderColor = 'var(--border)';
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
        <div style={{ fontSize: '11px', fontWeight: 600, color: bold ? 'rgba(255,255,255,0.82)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</div>
        <div style={{ fontSize: hero ? '32px' : '22px', fontWeight: 700, color: bold ? '#fff' : 'var(--text-main)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: '11.5px', color: bold ? 'rgba(255,255,255,0.78)' : 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
      </div>
    </button>
  );
}

/* ── "Idag"-raden — konkreta, klickbara händelser. Röd > gul > grön styr
   ordningen, aldrig kronologi. Tom kö renderas inte här längre — Dashboards
   "Allt klart"-läge (hasUrgent === false) tar ett eget, lugnare spår
   istället, se anropsstället. Så varje TodayRow som faktiskt renderas är
   alltid klickbar, riktig hover (lyft + skugga, samma språk som
   Snabbåtgärder-korten ovanför) istället för bara en opacitetsdimning. ── */
function TodayRow({ item, onClick }) {
  const c = SEV[item.sev] || SEV.warning;
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
        padding: '11px 12px', background: c.bg, border: 'none',
        borderRadius: '10px', cursor: 'pointer',
        textAlign: 'left', transition: 'transform 0.15s, box-shadow 0.15s', fontFamily: 'inherit',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
    >
      <div style={{ width: 26, height: 26, borderRadius: '8px', background: c.icon, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 5px ${c.icon}55` }}>
        <Icon size={13} />
      </div>
      <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 600, color: c.text, lineHeight: 1.3 }}>{item.text}</span>
      {item.tab && <ChevronRight size={13} style={{ color: c.text, opacity: 0.6, flexShrink: 0 }} />}
    </button>
  );
}

export default function Dashboard({ verifications, invoices, expenses, contacts, setActiveTab, company, user, vatPeriods = {}, payrollRuns = [] }) {
  const [chartMode, setChartMode] = useState('revenue-expense');
  const [chartFormat, setChartFormat] = useState('bars');
  // Sparat val, samma mönster som temat (App.jsx bokix_theme) — en användare
  // som väljer "Trappa" en gång ska inte behöva välja om det varje besök.
  const [lineStyle, setLineStyle] = useState(() => {
    try { return localStorage.getItem('bokix_chart_line_style') || 'smooth'; }
    catch { return 'smooth'; }
  });
  const handleSetLineStyle = (id) => {
    setLineStyle(id);
    try { localStorage.setItem('bokix_chart_line_style', id); } catch { /* privat läge etc. */ }
  };
  const curveType = LINE_VARIANTS.find(v => v.id === lineStyle)?.type || 'monotone';
  const isMobileViewport = useIsMobileViewport();

  // ── "Kom igång"-checklistan ── Ska ligga kvar tills ALLA fyra steg är
  // klara (inte bara försvinna så fort kontot inte längre räknas som "nytt",
  // vilket tidigare hände redan efter första kunden/fakturan/utgiften) —
  // plus en manuell "Dölj rutan"-länk i kortets fot för den som inte vill ha
  // kvar rutan (en textlänk längst ner, inte ett kryss uppe i hörnet — se
  // kommentaren vid showOnboarding-renderingen för varför).
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1'; } catch { return false; }
  });
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  // Se ONBOARDING_CELEBRATED_KEY-kommentaren ovan för bugen den här löser.
  const [hasCelebratedBefore, setHasCelebratedBefore] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_CELEBRATED_KEY) === '1'; } catch { return false; }
  });
  const wasAllOnboardingDoneRef = useRef(false);
  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    try { localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1'); } catch { /* privat läge etc. — inte kritiskt */ }
  };

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

  // ── Onboarding ──
  const hasCustomers  = contacts.some(c => c.type === 'customer');
  const hasInvoices   = invoices.length > 0;
  const hasExpenses   = expenses.length > 0;
  const hasSuppliers  = contacts.some(c => c.type === 'supplier');
  const isNew         = !hasCustomers && !hasInvoices && !hasExpenses;

  // Alla fyra checklist-steg klara → trigga konfetti en gång (inte om
  // effekten kör om av andra skäl medan `allOnboardingDone` redan var sant).
  const allOnboardingDone = hasCustomers && hasInvoices && hasExpenses && hasSuppliers;
  const onboardingSteps = [
    { done: hasCustomers, label: 'Skapa din första kund',       tab: 'contacts', icon: UserPlus, color: ONBOARD_STEP_COLORS.customer },
    { done: hasInvoices,  label: 'Skapa din första faktura',    tab: 'invoices', icon: FileText, color: ONBOARD_STEP_COLORS.invoice },
    { done: hasExpenses,  label: 'Lägg till din första utgift', tab: 'expenses', icon: Receipt,  color: ONBOARD_STEP_COLORS.expense },
    { done: hasSuppliers, label: 'Lägg till en leverantör',     tab: 'contacts', icon: Users,    color: ONBOARD_STEP_COLORS.supplier },
  ];
  const onboardingDoneCount = onboardingSteps.filter(s => s.done).length;
  useEffect(() => {
    // !hasCelebratedBefore — se ONBOARDING_CELEBRATED_KEY-kommentaren
    // ovan: utan den här kollen triggade en ombygg (Dashboard monteras om
    // vid varje flikbyte bort och tillbaka) om firandet på nytt varje gång,
    // eftersom wasAllOnboardingDoneRef ensam alltid börjar om på `false`.
    if (allOnboardingDone && !wasAllOnboardingDoneRef.current && !onboardingDismissed && !hasCelebratedBefore) {
      setCelebrating(true);
      setCelebrationKey(k => k + 1);
      setHasCelebratedBefore(true);
      try { localStorage.setItem(ONBOARDING_CELEBRATED_KEY, '1'); } catch { /* privat läge etc. — inte kritiskt */ }
      const t = setTimeout(() => setCelebrating(false), 2600);
      wasAllOnboardingDoneRef.current = true;
      return () => clearTimeout(t);
    }
    wasAllOnboardingDoneRef.current = allOnboardingDone;
  }, [allOnboardingDone, onboardingDismissed, hasCelebratedBefore]);
  // Rutan ligger kvar tills allt är klart (inte bara tills kontot slutar
  // räknas som "nytt") — men får fira klart sig innan den försvinner av sig
  // själv, precis som texten "rutan försvinner när du är igång" lovar.
  const showOnboarding = !onboardingDismissed && (!allOnboardingDone || celebrating);
  const confettiPieces = useMemo(() => {
    if (!celebrating) return [];
    return Array.from({ length: 46 }, (_, i) => ({
      left: Math.random() * 100,
      size: 6 + Math.random() * 6,
      duration: 1.8 + Math.random() * 1.3,
      delay: Math.random() * 0.5,
      rotate: Math.round(Math.random() * 360),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrationKey]);

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

  // ── Chartdata ──
  // Räknar nu fram BÅDA årens Intäkter/Utgifter/Resultat, inte bara
  // innevarande år — subtitleraden under diagramrubriken ("Innevarande
  // räkenskapsår X jämfört med Y") lovade den jämförelsen sedan tidigare,
  // men PrevIntäkter/PrevUtgifter räknades aldrig ut (bara en ensam,
  // aldrig renderad 'Föregående år'-summa för intäkter) — grafen visade
  // alltså aldrig det den påstod. Fixat här; själva ritningen (streckade
  // jämförelselinjer) sker längre ner i JSX:en.
  const previousYear = String(parseInt(currentYear) - 1);
  const chartData = useMemo(() => {
    const names = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
    const data = names.map(name => ({ name, Intäkter: 0, Utgifter: 0, Resultat: 0, PrevIntäkter: 0, PrevUtgifter: 0, PrevResultat: 0 }));
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
        } else if (year === previousYear) {
          data[mIdx].PrevIntäkter += rev;
          data[mIdx].PrevUtgifter += cost;
        }
      });
    });
    data.forEach(d => {
      d.Resultat = d.Intäkter - d.Utgifter;
      d.PrevResultat = d.PrevIntäkter - d.PrevUtgifter;
    });
    // Kundfeedback: grafen visade hela kalenderåret (Jan–Dec) rakt av, så
    // Sep–Dec stod som en missvisande platt nolla mitt i (både stapel- och
    // tabellformatet) och som ett rakt STUP ner till 0 i linjeformatet —
    // exakt likadant som "ingen försäljning alls" hade sett ut, trots att
    // de månaderna helt enkelt inte har inträffat än. `currentYear` här ÄR
    // per definition det verkliga innevarande kalenderåret (`new Date().
    // getFullYear()`, se konstanten ovan) — det finns alltså aldrig ett
    // läge där den här widgeten visar ett förflutet år och SKA rendera
    // hela tolv månader. Klipper bort allt efter dagens månad istället.
    const ytd = data.slice(0, new Date().getMonth() + 1);
    // Samma problem i andra änden (kundfrågan "varför börjar grafen i
    // januari om företaget bokförde sin första verifikation i augusti?"):
    // ett nytt företag utan importerad historik har Jan–Jul som samma
    // missvisande platta nolla i graf-STARTEN. Klipper bort ledande månader
    // helt utan data (varken i år eller föregående år) — men bara fram till
    // den FÖRSTA månaden som faktiskt har något bokfört. Ett företag som
    // importerat gammal historik (bokförd med riktiga datum tillbaka till
    // januari) har alltså data redan i januari och klipps inte alls; ett
    // helt nytt företag som bara bokfört sedan augusti visar bara Aug–nu.
    // Om HELA året saknar data (`hasChartData`/`hasPrevYearData` nedan blir
    // false) finns ingen "första månad" att hitta — då behålls ytd orörd,
    // widgeten faller tillbaka på sitt vanliga tomt-läge istället.
    const firstDataIdx = ytd.findIndex(d => d.Intäkter !== 0 || d.Utgifter !== 0 || d.PrevIntäkter !== 0 || d.PrevUtgifter !== 0);
    return firstDataIdx > 0 ? ytd.slice(firstDataIdx) : ytd;
  }, [verifications, currentYear, previousYear]);
  const hasChartData = chartData.some(d => d.Intäkter !== 0 || d.Utgifter !== 0);
  // Bara sant om det FAKTISKT finns bokförd fjolårsdata — annars skulle
  // jämförelselinjerna bara vara en missvisande platt nolla (t.ex. ett
  // helt nytt företags allra första räkenskapsår).
  const hasPrevYearData = chartData.some(d => d.PrevIntäkter !== 0 || d.PrevUtgifter !== 0);
  const prevYearResultatTotal = chartData.reduce((sum, d) => sum + d.PrevResultat, 0);

  // ── Hälsning — tidsgränser i delad util, inte inline ──
  const { greeting } = getGreeting();
  // Kundönskemål: hälsningen ska visa vad ANVÄNDAREN vill bli kallad (satt
  // under Inställningar → Min profil → Förnamn), inte en gissning baserad
  // på företagsnamnet — en enskild firma "Anna Andersson AB" gav "Anna",
  // men ett aktiebolag "Nordstrom Konsult AB" hade lika gärna kunnat ge
  // "Nordstrom" istället för ett riktigt förnamn. Företagsnamnet är kvar
  // som sista utväg för konton som ännu inte fyllt i sitt förnamn.
  const firstName = user?.user_metadata?.first_name || company?.name?.split(' ')[0] || '';
  // Samma Min profil-sektion: av/på för hela hälsningsraden. Standard PÅ
  // (bara explicit false döljer den) så befintliga konton inte tappar den
  // tyst. Döljs den ska resten av sidan flytta upp — se att blocket nedan
  // hoppas över HELT (inget tomt div kvar som fortfarande tar sin
  // marginBottom) istället för att bara göra texten osynlig.
  const showGreeting = user?.user_metadata?.show_dashboard_greeting !== false;

  return (
    // Bugkritiskt: rotdiven hade varken minHeight eller egen bakgrund, bara
    // maxWidth. Den stod visserligen som flex:1 (via .main-content-inner > *),
    // men eftersom den var transparent syntes den gråa sidbakgrunden som ett
    // tomt fält under sista kortet på korta sidor (t.ex. en ny, nästan tom
    // startsida) istället för att sidan kändes heltäckande. Samma mönster
    // som redan fixat i SupplierInvoices.jsx.
    // Kundfeedback ("God kväll... ska inte vara för mycket åt vänster"):
    // roten hade noll padding (uppmätt: h1 stod EXAKT vid samma x-koordinat
    // som sidomenyns högerkant, 0px marginal) — till skillnad från Rapport
    // och analys/Skatt och bokslut, som redan har egen 24px innehålls-
    // padding på motsvarande nivå. Samma 24px här nu (sidor/botten), så
    // Startsidan matchar de andra "dashboard-liknande" sidorna istället för
    // att stå ensam helt flush mot kanten.
    // Uppföljning ("för mycket space" efter att topbaren krympte och
    // tappade sin egen bakgrund/kant): samma 24px OVANFÖR gav nu, utan en
    // synlig linje som motiverar den, ett stort odifferentierat tomrum
    // innan hälsningen — bara toppen trimmad, sidorna/botten oförändrade.
    <div style={{ maxWidth: '100%', margin: '0 auto', width: '100%', minHeight: '100%', boxSizing: 'border-box', background: 'var(--bg-page)', padding: '24px', paddingTop: '8px' }}>
      <style>{`
        @media (max-width: 900px) {
          .dash-lower-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .dash-kpi-grid { grid-template-columns: 1fr !important; }
          .dash-quick-actions { grid-template-columns: repeat(2,1fr) !important; }
          .dash-todo-grid { grid-template-columns: 1fr !important; }
          /* En tidigare version hade en egen margin-bottom-regel här på
             .dash-lower-grid, byggd på antagandet att Moms-kortet "ofta"
             var sidans sista kort — trasig så fort showOnboarding-kortet
             (nedan i JSX:en) renderades EFTER den, vilket gjorde att just
             det kortet (inte dash-lower-grid) blev det verkliga sista
             elementet utan eget skydd. Riktig fix nu istället: index.css
             ROOT-variabeln --mobile-nav-height matchar bottennavens
             faktiska höjd och .main-wrapper:s padding-bottom (samma fil)
             räknar på den — skyddar VAD SOM ÄN råkar vara sist på VILKEN
             SOM HELST mobilsida, inte bara den här komponentens gissning. */
        }
      `}</style>

      {/* ─── HEADER ─── */}
      {/* Kundfeedback: räkenskapsårsraden och "X saker väntar"-statusraden
          (tidigare här) togs bort helt — kändes onödiga/upprepade (statusen
          finns redan i "Att göra idag" nedan, räkenskapsåret i grafrubriken
          längre ner). Bara hälsningen kvar, större och centrerad.
          Går att stänga av helt (Inställningar → Min profil) — blocket
          hoppas då över i sin helhet, ingen kvarlämnad marginBottom, så
          Snabbåtgärder-raden nedanför flyttar upp och tar platsen istället
          för att lämna ett tomt hål. */}
      {showGreeting && (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', padding: '0 12px' }}>
        {/* Bugkritiskt: display:flex på ett <h1> som bara innehåller löpande
            text (namn + emoji) bröt radbrytningen på smala/halva skärmar —
            "Good evening" och ", Abdullah 👋" hamnade på separata rader på
            konstiga ställen istället för att radbryta som en sammanhängande
            mening. En vanlig textrad (ingen flex, bara textAlign:center)
            radbryter normalt om den någonsin behöver, och clamp() gör att
            den sällan ens behöver det — storleken krymper mjukt med
            fönsterbredden istället för en fast 44px oavsett skärm. */}
        <h1 style={{ fontFamily: 'var(--font-voice)', fontWeight: 700, fontSize: 'clamp(24px, 6vw, 44px)', letterSpacing: '-0.01em', color: 'var(--text-main)', textAlign: 'center', margin: 0, maxWidth: '100%' }}>
          {greeting}, {firstName || 'Användare'} 👋
        </h1>
      </div>
      )}

      {/* ─── SNABBÅTGÄRDER — det man faktiskt kom hit för att GÖRA, högst
          upp och tydligt, istället för begravt längst ner på sidan under
          alla siffror. Fyra tydligt olikfärgade kort, inte fyra identiska
          gröna chips, så raden känns levande och går att skanna snabbt.
          Visas alltid, även på ett helt nytt/tomt konto — de här fyra
          genvägarna ÄR de första stegen man vill ta, så de ska inte gömmas
          undan bakom `isNew` som resten av sidans siffror/grafer. ─── */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Zap size={14} style={{ color: BRAND.greenDark }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Snabbåtgärder</span>
        </div>
        <div className="dash-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              onClick={() => setActiveTab(a.tab)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                padding: '11px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px',
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', textAlign: 'left',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '9px', background: a.bg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 6px ${a.bg}4d` }}>
                <a.icon size={15} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── ATT GÖRA IDAG — sidans mest konkreta, klickbara lista, nu i full
          bredd direkt under Snabbåtgärder istället för instängd i en trång
          bottenruta. Röd/gul/grön styr ordning, aldrig kronologi.
          Kundfeedback ("bättre UI/bakgrund"): dekorationscirkeln var
          osynlig/meningslös (5% grön på cremefärg), rubriken hade ingen
          ikon (till skillnad från Snabbåtgärder ovanför) och radernas
          "hover" var bara en opacitetsdimning — allt uppgraderat nedan.
          "Allt klart" var dessutom bara ÄNNU en radknapp trots att den inte
          går att klicka på (tab: null) — nu ett eget, lugnare tillstånd som
          faktiskt känns som en belöning istället för fyllnadsinnehåll. ─── */}
      {!isNew && (
        <div style={{ position: 'relative', background: 'var(--bg-cream)', border: '1px solid var(--bg-cream-border)', borderRadius: '14px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden', marginBottom: '20px' }}>
          {/* Glöden syns bara när allt faktiskt ÄR klart — dekoration som
              betyder något (lugn/klart), inte bara utfyllnad oavsett läge. */}
          {!hasUrgent && (
            <div aria-hidden="true" style={{ position: 'absolute', top: '-70px', right: '-50px', width: '200px', height: '200px', borderRadius: '50%', background: `radial-gradient(circle, ${VIVID.green}1f, transparent 70%)` }} />
          )}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 28, height: 28, borderRadius: '9px', background: hasUrgent ? VIVID.amber : VIVID.green, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 6px ${(hasUrgent ? VIVID.amber : VIVID.green)}4d` }}>
                <ClipboardCheck size={16} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Att göra idag</span>
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px',
              background: hasUrgent ? 'var(--bg-muted)' : BRAND.greenLight,
              color: hasUrgent ? 'var(--text-main)' : BRAND.greenDark,
            }}>
              {hasUrgent ? `${todos.length} ${todos.length === 1 ? 'post' : 'poster'}` : 'Allt klart'}
            </span>
          </div>

          {hasUrgent ? (
            <div className="dash-todo-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: todos.length > 1 ? 'repeat(2,1fr)' : '1fr', gap: '8px' }}>
              {todos.map((t, i) => (
                <TodayRow key={i} item={t} onClick={() => t.tab && setActiveTab(t.tab)} />
              ))}
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 2px 2px' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: VIVID.green, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 3px 8px ${VIVID.green}40` }}>
                <CheckCircle2 size={16} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{todos[0].text}</span>
            </div>
          )}
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
          gradient={raResultat >= 0 ? KPI_GRAD_POSITIVE : KPI_GRAD_NEGATIVE}
        />
        <KpiCard
          label="Intäkter" value={fmt(raOmsattning)} sub={`Hittills ${currentYear}`}
          icon={ArrowUpRight} color={BRAND.greenDark} bg={LIME_L} positive={true}
          onClick={() => setActiveTab('reports')}
          gradient={KPI_GRAD_REVENUE}
        />
        <KpiCard
          label="Kostnader" value={fmt(raKostnader)} sub={`Hittills ${currentYear}`}
          icon={ArrowDownRight} color={BRAND.redText} bg={RED_L} positive={false}
          onClick={() => setActiveTab('expenses')}
          gradient={KPI_GRAD_NEGATIVE}
        />
      </div>

      {/* ─── GRAF — full bredd, svag cremeton (Sida 31/32) istället för rent
          vitt för att skilja den från de vita KPI-korten ovanför. Syns alltid
          (inte bara `!isNew`) — men visar en lugn tomt-läge-vy istället för
          en platt nollstapel-graf tills det finns något att rita ut. ─── */}
      <div style={{ background: 'var(--bg-cream)', border: '1px solid var(--bg-cream-border)', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', marginBottom: '18px', minWidth: 0 }}>
        {/* Chart header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em', marginBottom: '2px' }}>
              {CHART_MODES.find(m => m.id === chartMode)?.label}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {/* "jämfört med"-delen visas bara när det FAKTISKT finns
                  bokförd fjolårsdata (hasPrevYearData) — annars lovade
                  raden en jämförelse som varken graf eller tabell hade
                  något att visa för (t.ex. företagets allra första
                  räkenskapsår). */}
              Innevarande räkenskapsår {currentYear}{hasPrevYearData ? ` jämfört med ${previousYear}` : ''}
            </p>
            {/* Legenden uppdateras dynamiskt beroende på vald flik — aldrig
                statisk text som bara passar första vyn. Intäkter/Utgifter-
                läget använder CHART_REVENUE/CHART_EXPENSE (blå/rosa) i både
                punkt och text — samma toner som KPI-korten ovan och ett
                CVD-säkert par (se konstant-kommentaren). Resultat-läget
                behåller det klassiska grönt/rött eftersom det är en enda
                serie vars läge mot nollinjen (inte färgen) bär betydelsen.
                Föregående års siffror (när de finns) läggs till som en egen,
                dämpad/streckad post — samma "form, inte färg, bär den andra
                dimensionen"-princip som graferna längre ner använder. */}
            {chartMode === 'revenue-expense' && (
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: CHART_REVENUE, fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_REVENUE, display: 'inline-block' }} />
                  Intäkter {fmt(raOmsattning)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: CHART_EXPENSE, fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_EXPENSE, display: 'inline-block' }} />
                  Utgifter {fmt(raKostnader)}
                </span>
                {hasPrevYearData && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {legendSwatch(CHART_REVENUE_PREV, true)}{legendSwatch(CHART_EXPENSE_PREV, true)}
                    {previousYear}
                  </span>
                )}
              </div>
            )}
            {chartMode === 'result' && (
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: raResultat >= 0 ? BRAND.greenDark : BRAND.redText }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: raResultat >= 0 ? REVENUE : EXPENSE, display: 'inline-block' }} />
                  Resultat {fmt(raResultat)}
                </span>
                {hasPrevYearData && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {legendSwatch('var(--text-muted)', true)}
                    Resultat {previousYear} {fmt(prevYearResultatTotal)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-muted)', padding: '3px', borderRadius: '9px', border: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
            {CHART_MODES.map(m => (
              <button key={m.id} onClick={() => setChartMode(m.id)} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 11px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: chartMode === m.id ? 600 : 400,
                background: chartMode === m.id ? BRAND.green : 'transparent',
                color: chartMode === m.id ? 'white' : 'var(--text-secondary)',
                boxShadow: chartMode === m.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
                <m.icon size={11} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Formatväljare (Staplar/Linje/Tabell) — samma data, tre sätt att
            läsa den (kundönskemål: "olika format"). Egen, mindre rad under
            huvudväxlaren istället för att klämmas in bredvid den — annars
            får headerraden fyra knappar att trängas om utrymme med titel +
            legend på små skärmar. Döljs i tomt-läge (nedan) — inget att
            växla format PÅ än. */}
        {hasChartData && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-muted)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              {FORMAT_MODES.map(f => (
                <button key={f.id} onClick={() => setChartFormat(f.id)} title={f.label} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 9px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                  fontSize: '11.5px', fontWeight: chartFormat === f.id ? 600 : 400,
                  background: chartFormat === f.id ? 'var(--bg-card)' : 'transparent',
                  color: chartFormat === f.id ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: chartFormat === f.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}>
                  <f.icon size={11} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Linjestil-väljaren — bara meningsfull i Linje-formatet ovan. */}
        {hasChartData && chartFormat === 'line' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px', marginTop: '-8px' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-muted)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              {LINE_VARIANTS.map(v => (
                <button key={v.id} onClick={() => handleSetLineStyle(v.id)} title={v.label} style={{
                  padding: '4px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                  fontSize: '11.5px', fontWeight: lineStyle === v.id ? 600 : 400,
                  background: lineStyle === v.id ? 'var(--bg-card)' : 'transparent',
                  color: lineStyle === v.id ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: lineStyle === v.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tomt läge — inga bokförda verifikationer än. Ett eget litet vyläge
            istället för att bara rita en platt nollinje, så rutan förklarar
            vad som saknas istället för att se trasig/tom ut. */}
        {!hasChartData ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '220px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CHART_REVENUE, marginBottom: '2px' }}>
              <BarChart2 size={20} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ingen bokföring ännu</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px' }}>
              Så fort du bokfört en faktura eller en utgift dyker den här grafen upp här.
            </p>
          </div>
        ) : chartFormat === 'table' ? (
          <ChartDataTable data={chartData} mode={chartMode} fmt={fmt} hasPrevYearData={hasPrevYearData} previousYear={previousYear} />
        ) : (
          <>
            {chartMode === 'revenue-expense' && (
              <ResponsiveContainer width="100%" height={260}>
                {chartFormat === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} dy={6} interval={isMobileViewport ? 2 : 0} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={fmtShort} width={44} />
                    <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                    <Legend iconType="plainline" verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                    <Line type={curveType} dataKey="Intäkter" name="Intäkter" stroke={CHART_REVENUE} strokeWidth={3.5} dot={false} activeDot={{ r: 5 }} />
                    <Line type={curveType} dataKey="Utgifter" name="Utgifter" stroke={CHART_EXPENSE} strokeWidth={3.5} dot={false} activeDot={{ r: 5 }} />
                    {hasPrevYearData && <Line type={curveType} dataKey="PrevIntäkter" name={`Intäkter ${previousYear}`} stroke={CHART_REVENUE_PREV} strokeWidth={2} strokeDasharray="4 3" dot={false} />}
                    {hasPrevYearData && <Line type={curveType} dataKey="PrevUtgifter" name={`Utgifter ${previousYear}`} stroke={CHART_EXPENSE_PREV} strokeWidth={2} strokeDasharray="4 3" dot={false} />}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    {/* interval=2: visa en etikett, hoppa över 2, visa nästa — var
                        tredje månad på mobil istället för alla tolv som annars
                        överlappar varandra på en 375px-bred yta. */}
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} dy={6} interval={isMobileViewport ? 2 : 0} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={fmtShort} width={44} />
                    <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                    {/* verticalAlign="bottom" (uttryckligt, inte bara standard-
                        värdet) — flyttar/håller legenden under diagrammet på
                        mobil istället för att riskera att den kläms in bredvid. */}
                    <Legend iconType="circle" iconSize={7} verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                    <Bar dataKey="Intäkter" fill={CHART_REVENUE} radius={[4,4,0,0]} barSize={16} />
                    <Bar dataKey="Utgifter" fill={CHART_EXPENSE} radius={[4,4,0,0]} barSize={16} />
                    {/* Föregående års jämförelse ritas som en streckad linje
                        ovanpå de egna årets staplar (samma konvention som
                        Rapport och analys, ReportUI.jsx) — bara när det finns
                        något att jämföra med. */}
                    {hasPrevYearData && <Line type="monotone" dataKey="PrevIntäkter" name={`Intäkter ${previousYear}`} stroke={CHART_REVENUE_PREV} strokeWidth={2} strokeDasharray="4 3" dot={false} legendType="plainline" />}
                    {hasPrevYearData && <Line type="monotone" dataKey="PrevUtgifter" name={`Utgifter ${previousYear}`} stroke={CHART_EXPENSE_PREV} strokeWidth={2} strokeDasharray="4 3" dot={false} legendType="plainline" />}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}

            {chartMode === 'result' && (
              <ResponsiveContainer width="100%" height={260}>
                {chartFormat === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} dy={6} interval={isMobileViewport ? 2 : 0} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={fmtShort} width={44} />
                    <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                    {/* Recharts (v3 i det här projektet, se package.json) hämtar
                        <Legend>-innehållet ENBART från en intern context som
                        varje diagramelement registrerar sig i självt — en
                        manuellt satt `payload`-prop på <Legend> läses inte
                        längre (till skillnad från Recharts v2, där mönstret
                        kom ifrån). Rätt fix är alltså att ge varje element sin
                        egen korrekta `name`/färg och låta Legend läsa av dem
                        automatiskt, inte att skicka in en egen payload-array. */}
                    {hasPrevYearData && <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />}
                    <Line type={curveType} dataKey="Resultat" name="Resultat" stroke={raResultat >= 0 ? REVENUE : EXPENSE} strokeWidth={3.5} dot={false} activeDot={{ r: 5 }} />
                    {hasPrevYearData && <Line type={curveType} dataKey="PrevResultat" name={`Resultat ${previousYear}`} stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="4 3" dot={false} />}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} dy={6} interval={isMobileViewport ? 2 : 0} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={fmtShort} width={44} />
                    <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                    {/* Legend bara när det finns en fjolårslinje att förklara —
                        annars är en enda stapelserie självförklarande via sin
                        position mot nollinjen (se kommentaren vid CHART_MODES-
                        legenden ovan), precis som innan denna ändring. Bar-
                        elementet nedan får därför sitt EGET explicita `fill`
                        (som annars vore onödigt — färgen sätts annars per
                        Cell) enbart för att Recharts v3:s auto-legend-context
                        ska ha en färg att läsa av; se kommentaren i Linje-
                        formatets Legend ovan för varför en manuell `payload`
                        inte fungerar här. */}
                    {hasPrevYearData && <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />}
                    <Bar dataKey="Resultat" name="Resultat" fill={raResultat >= 0 ? REVENUE : EXPENSE} radius={[4,4,0,0]} barSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.Resultat >= 0 ? REVENUE : EXPENSE} />
                      ))}
                    </Bar>
                    {hasPrevYearData && <Line type="monotone" dataKey="PrevResultat" name={`Resultat ${previousYear}`} stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="4 3" dot={false} />}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </>
        )}
      </div>

      {/* ─── SENAST BOKFÖRT + MOMS — sidans två "läge just nu"-rutor, parade
          i en 2/1-rad längst ner istället för att tävla om samma vikt som
          Snabbåtgärder/Att göra idag/Nyckeltalen ovanför (Sida 34). ─── */}
      {!isNew && (
        <div className="dash-lower-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '18px', alignItems: 'stretch' }}>

          {/* Senast bokfört — riktiga, bokförda händelser (aldrig utkast),
              sorterade på riktigt datum. Beskrivningen är exakt den som redan
              sparades när händelsen bokfördes, inte en omskriven version. */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Senast bokfört</span>
              <button onClick={() => setActiveTab('verifications')} className="ds-link-btn sm">Alla verifikationer</button>
            </div>
            {recentBooked.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-muted)' }}>Inga bokförda verifikationer än</div>
            ) : (
              <div>
                {recentBooked.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '13px 20px', borderBottom: '1px solid #f7f8f7' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.date} · {item.type}</div>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', flexShrink: 0 }}>{fmt(item.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Moms — nästa (ännu ej inlämnade) momsperiod, räknat från riktiga
              bokförda utgående/ingående moms-rader inom perioden. */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {vatPeriodSummary ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Moms Q{vatPeriodSummary.quarter} {vatPeriodSummary.year}</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Förfaller {vatPeriodSummary.dueDateLabel}</span>
                </div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{fmt(Math.abs(vatPeriodSummary.attBetala))}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{vatPeriodSummary.attBetala >= 0 ? 'att betala' : 'att få tillbaka'}</div>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: BRAND.amberBg, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999, background: BRAND.green,
                    width: `${vatPeriodSummary.utgaende > 0 ? Math.min(100, Math.max(0, (vatPeriodSummary.ingaende / vatPeriodSummary.utgaende) * 100)) : 0}%`,
                  }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Utgående {fmt(vatPeriodSummary.utgaende)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ingående {fmt(vatPeriodSummary.ingaende)}</span>
                </div>
                <button onClick={() => setActiveTab('taxes')} className="btn btn-secondary btn-sm" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}>Se momsrapport</button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Moms</span>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Ingen kommande momsdeklaration att visa.</p>
                <button onClick={() => setActiveTab('taxes')} className="btn btn-secondary btn-sm" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}>Till Skatt &amp; Moms</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* "Företagsprofilen är inte klar..."-panelen (profileIncomplete && !isNew)
          togs bort här på uttrycklig kundönskan — upplevdes som en irriterande
          nagging-banner på Dashboard. showOnboarding-kortet nedan (de fyra
          onboarding-stegen) är den enda kvarvarande vägen tillbaka till
          registreringen om användaren själv vill fortsätta den. */}
      {showOnboarding && (
        // Sida 31: tomt-läge/hero-yta — cremeton istället för vitt, samma
        // princip som Idag-modulen ovan. Ligger kvar tills alla fyra steg är
        // klara ELLER användaren själv döljer den via fotlänken (se
        // `showOnboarding`/`dismissOnboarding`), inte bara tills kontot
        // slutar räknas som "nytt". `position: relative` krävs för
        // konfetti-lagret, som positioneras absolut ovanpå innehållet.
        <div data-tour="dash-checklist" style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-cream)', border: '1px solid var(--bg-cream-border)', borderRadius: '14px', padding: '20px 22px', marginTop: '4px' }}>
          {celebrating && (
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {confettiPieces.map((p, i) => (
                <span key={i} style={{
                  position: 'absolute', top: '-12px', left: `${p.left}%`,
                  width: p.size, height: p.size * 0.42,
                  background: p.color, borderRadius: '2px', opacity: 0.9,
                  // Animationen styr transform (fall + snurr) från och med
                  // frame 0 — den slumpade start-rotationen sätts via en CSS-
                  // variabel som keyframen roterar vidare från, se index.css.
                  '--rot-start': `${p.rotate}deg`,
                  animation: `bokix-confetti-fall ${p.duration}s cubic-bezier(.4,0,.6,1) ${p.delay}s forwards`,
                }} />
              ))}
            </div>
          )}

          {celebrating ? (
            <div style={{ textAlign: 'center', padding: '20px 8px', position: 'relative' }}>
              <div style={{ fontSize: '34px', marginBottom: '6px' }}>🎉</div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>Grattis, du är igång!</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Alla startsteg är klara — den här rutan försvinner nu.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
                <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Kom igång med Bokix</h2>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {onboardingDoneCount} av {onboardingSteps.length} klara
                </span>
              </div>

              {/* Fyra segment istället för en enfärgad laddningsbar — varje
                  ruta fylls i sitt EGET stegs färg när det är klart, så
                  raden dubblar som en legend för listan under den, inte bara
                  en generisk procent-mätare. */}
              <div style={{ display: 'flex', gap: '4px', margin: '8px 0 14px' }}>
                {onboardingSteps.map((step, i) => (
                  <span key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: step.done ? step.color : 'var(--border-light)', transition: 'background 0.3s' }} />
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {onboardingSteps.map((step, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveTab(step.tab)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '11px', width: '100%',
                      padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '10px',
                      border: '1px solid var(--border-light)', cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = step.color; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {/* Ring som fylls i — en riktig bock-metafor istället för
                        en fyrkantig ikon-chip, så "klart" känns som att
                        pricka av en rad i en checklista, inte som att byta
                        färg på en ikon. */}
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: step.done ? step.color : 'transparent',
                      border: step.done ? 'none' : `2px solid ${step.color}`,
                      color: step.done ? 'white' : step.color,
                      transition: 'all 0.2s',
                    }}>
                      {step.done ? <CheckCircle2 size={13} /> : <step.icon size={12} />}
                    </span>
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: step.done ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: step.done ? 'line-through' : 'none' }}>
                      {step.label}
                    </span>
                    {!step.done && <ChevronRight size={15} color={step.color} style={{ flexShrink: 0 }} />}
                  </button>
                ))}
              </div>

              {/* Fot: support-genvägar + den manuella dölj-länken. INTE ett
                  krysskort uppe i högra hörnet igen — det var precis det som
                  läste ut som ett kryss klistrat i topbaren på mobil förra
                  gången (se git-historik). En vanlig textlänk längst ner ger
                  samma "bli av med rutan för gott"-möjlighet utan att krocka
                  visuellt med appens egen topbar. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px 16px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--bg-cream-border)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                  <a
                    href="mailto:support@bokix.se?subject=Support%20-%20Bokix"
                    style={ONBOARD_FOOTER_LINK_STYLE}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <MessageSquare size={13} /> Kontakta support
                  </a>
                  <a
                    href="mailto:support@bokix.se?subject=Felrapport%20-%20Bokix"
                    style={ONBOARD_FOOTER_LINK_STYLE}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <AlertCircle size={13} /> Rapportera ett fel
                  </a>
                </div>
                <button
                  type="button"
                  onClick={dismissOnboarding}
                  style={{ ...ONBOARD_FOOTER_LINK_STYLE, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <X size={13} /> Dölj rutan
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
