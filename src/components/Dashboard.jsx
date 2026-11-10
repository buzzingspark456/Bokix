import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import {
  FileText, Receipt,
  ChevronRight, ArrowUpRight, ArrowDownRight,
  CheckCircle2, BarChart2,
  UserPlus, Users, AlertCircle, X, MessageSquare, Upload, Calendar, Banknote, ClipboardCheck,
  TodoOverdueIcon, TodoReviewIcon, TodoDraftIcon, TodoVatIcon, TodoPayrollIcon, TodoBankIcon,
  // Aliasat — 'LineChart' krockar annars med recharts-komponenten med
  // samma namn som redan importeras nedan (två helt olika saker: en ikon
  // kontra en diagramkomponent).
  LineChart as LineChartIcon, AreaChart as AreaChartIcon, Table2,
} from './icons';
import { buildTodoItems, todoDismissedKey, calendarDaysOverdue } from '../utils/todoItems';
import { getGreeting } from '../utils/greeting';
import SieImportModal from './SieImportModal';
import GetStarted, { readGetStarted, shouldShowGetStarted } from './dashboard/GetStarted';
import { supabase } from '../supabaseClient';
import { BRAND } from '../utils/brandColors';
import { resolveChartPalette } from '../utils/chartPalette';
import { useIsDarkTheme } from '../hooks/useIsDarkTheme';
import { ReportDisplayProvider, PeriodHeading } from './reports/reportDisplay';
// Diagrammet (recharts) laddas för sig, så siffrorna syns direkt.
const RevenueExpenseChart = lazy(() => import('./reports/ReportUI').then(m => ({ default: m.RevenueExpenseChart })));
import { useTranslation, dateLocale } from '../i18n';
// Kundönskemål: samma fem period-flikar (Denna månad/3 mån/6 mån/
// Räkenskapsåret/Sedan start) som Rapport och analys → Företagsöversikt,
// på "Intäkter vs Utgifter"-grafen här också — delad komponent/lista och
// delad datumberäkning istället för en andra, lokal implementation som kan
// glida isär (se PeriodPicker/OVERVIEW_PERIODS-kommentaren i ReportUI.jsx).
import { layoutRect, layoutViewport } from '../utils/dropdownPlacement';
import { overviewPeriodBounds, buildResultSeries, companyFiscalYearSetting } from '../utils/reportCalculations';
import { invoiceCustomerRemainingSek } from '../utils/rotRutConfig';
import { numberFormat } from '../utils/intlCache';

// Intäkter-vs-Utgifter-grafens färger kommer numera från paletten
// (utils/chartPalette.js, se `chart` i komponenten): förvalet är samma
// blå/röda par som tidigare — samma toner som Intäkter- och Kostnader-
// korten ovan, och det par som klarar CVD-kontrollen som det gamla
// gröna/röda inte gjorde (se kommentaren högst upp) — men företaget kan
// välja andra i rapporternas Utseende-meny, och då ska startsidan följa
// med. Annars visar de två sidorna samma två tal i olika färger, vilket
// var precis det problemet valen skulle lösa.

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
// Kundönskemål (Sida 51, SIE4-import) — en EGEN dismiss-flagga, samma
// mönster som checklistans, men medvetet en helt fristående ruta, INTE en
// femte rad i onboardingSteps: den arrayens längd är hårdkodad in i "X av
// 4 klara"-räknaren och konfetti-villkoret ovan, och den här rutan gäller
// bara den mindre gruppen som faktiskt bytte från ett annat program — de
// flesta nya konton gör aldrig det här steget, till skillnad från de
// fyra riktiga onboarding-stegen.
const SIE_IMPORT_DISMISSED_KEY = 'bokix_dashboard_sie_import_dismissed';
// Kundönskemål ("de kan ignorera det, de behöver inte följa allihopa"):
// varje rad i "Att göra idag" går att avfärda för sig — sparas per
// FÖRETAG (bokförd moms/lön/fakturor är olika per företag, en global
// flagga hade dolt Företag B:s riktiga påminnelse bara för att man
// avfärdat Företag A:s) och per SIGNATUR (kind+text, se todos-uppbyggnaden
// nedan) snarare än bara kind — ändras det underliggande talet (t.ex. en
// fjärde faktura förfaller utöver de tre redan avfärdade) är det en NY
// verklig händelse och ska synas igen, inte tyst svalt av en gammal
// avfärdning.
// Nyckeln och listan bor i utils/todoItems.js (todoDismissedKey, buildTodoItems).
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

// Diagramformat — samma data, tre sätt att läsa den. "Tabell" är inte bara
// en extra vy för smaksak: dataviz-skillens tillgänglighetskrav säger att en
// tabellvy alltid ska finnas som alternativ till en ren grafisk framställning.
//
// "Yta" fanns här förut, togs bort, och är nu tillbaka — det är värt att
// skriva ut varför, så ingen tar bort den igen på gamla grunder.
// Ursprungsproblemet var att två OBEROENDE serier (Intäkter mycket större,
// Utgifter mycket mindre) ritades som två platt fyllda, halvtransparenta
// ytor: i överlappet blandades kulörerna till en tredje, grumlig ton
// (kundfeedback: "yta-diagrammet ser så dåligt ut"). Det var formen som var
// fel, inte färgerna.
//
// Det som ändrats sedan dess är att widgeten inte längre ritar sin egen
// graf: linje- och ytläget renderas av EXAKT samma komponent som
// Företagsöversikten (RevenueExpenseChart, ReportUI.jsx), där ytan är en
// gradient som tonar ut mot noll i stället för en platt fyllning. Överlappet
// blir då den mindre seriens egen ton mot en nästan genomskinlig bakgrund,
// inte två färger som blandas. Kundönskemål: "linje och yta på startsidan
// ska vara samma som i Företagsöversikt".
const formatModes = (t) => [
  { id: 'bars',  label: t('dashboard.chart.formatBars'),  icon: BarChart2 },
  { id: 'line',  label: t('dashboard.chart.formatLine'),  icon: LineChartIcon },
  { id: 'area',  label: t('dashboard.chart.formatArea'),  icon: AreaChartIcon },
  { id: 'table', label: t('dashboard.chart.formatTable'), icon: Table2 },
];

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

/** Tabellformatet — samma rader (dag eller månad, beroende på vald period) som graferna,
 * med intäkter, kostnader och resultat per rad och en summarad längst ner. Föregående
 * års resultat och förändringen visas bara när det finns fjolårsdata (och inte på telefon). */
function ChartDataTable({ data, fmt, hasPrevYearData, comparisonLabel }) {
  const { t } = useTranslation();
  const total = data.reduce((a, r) => ({
    income: a.income + r.Intäkter, cost: a.cost + r.Utgifter, result: a.result + r.Resultat, prev: a.prev + r.PrevResultat,
  }), { income: 0, cost: 0, result: 0, prev: 0 });
  const neg = (v) => (v < 0 ? 'neg' : '');
  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>{t('dashboard.chart.tablePeriod')}</th>
            <th>{t('dashboard.kpi.income')}</th>
            <th>{t('dashboard.kpi.costs')}</th>
            <th>{t('dashboard.kpi.result')}</th>
            {hasPrevYearData && <th className="dash-table-prev">{t('dashboard.chart.tableResultCompared', { label: comparisonLabel })}</th>}
            {hasPrevYearData && <th className="dash-table-prev">{t('dashboard.chart.tableChange')}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{fmt(row.Intäkter)}</td>
              <td>{fmt(row.Utgifter)}</td>
              <td className={`result ${neg(row.Resultat)}`}>{fmt(row.Resultat)}</td>
              {hasPrevYearData && <td className="dash-table-prev muted">{fmt(row.PrevResultat)}</td>}
              {hasPrevYearData && <td className="dash-table-prev"><DeltaBadge current={row.Resultat} previous={row.PrevResultat} /></td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{t('dashboard.chart.tableTotal')}</td>
            <td>{fmt(total.income)}</td>
            <td>{fmt(total.cost)}</td>
            <td className={`result ${neg(total.result)}`}>{fmt(total.result)}</td>
            {hasPrevYearData && <td className="dash-table-prev muted">{fmt(total.prev)}</td>}
            {hasPrevYearData && <td className="dash-table-prev"><DeltaBadge current={total.result} previous={total.prev} /></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}


// Ikonen per sorts rad i Att göra (utils/todoItems.js har bara `kind`).
const TODO_ICONS = {
  overdue_invoices: TodoOverdueIcon, supplier_due: TodoOverdueIcon, vat_deadline: TodoVatIcon, agi_deadline: TodoVatIcon,
  year_end: TodoVatIcon, income_declaration: TodoVatIcon, annual_report: TodoVatIcon, start_vat: TodoVatIcon, payroll_pending: TodoPayrollIcon, employees_tax: TodoPayrollIcon,
  review: TodoReviewIcon, bank_unmatched: TodoBankIcon, draft_invoices: TodoDraftIcon,
};

/* ── Nyckeltalsruta: Resultat, Intäkter, Kostnader och Likviditet som fyra
   mjuka grå rutor, Resultatet först och i sin egen färg (`tint`). Färgen
   finns annars bara som en prick framför etiketten, samma färg som serien i
   diagrammet under. Under beloppet en rad som säger något om det; finns
   fjolårsdata står förändringen först som ett litet märke (`delta`), grönt
   uppåt och rött nedåt. Rött belopp bara för en förlust. Layouten bor i
   index.css (.dash-kpi-*). ── */

// Rutorna är bara siffror, inga knappar (2026-10-03): de ledde förut till
// Rapporter, Kvitton och Bank, vilket ingen kunde gissa sig till.
function KpiCard({ role, label, value, sub, delta, deltaUp, dot, negative, tint }) {
  return (
    <div className={`dash-kpi-card dash-kpi-card--${role}${negative ? ' is-negative' : ''}${tint ? ' is-tinted' : ''}`} style={tint ? { '--kpi-tint': tint } : undefined}>
      <span className="dash-kpi-card-label"><i className="dash-kpi-dot" style={{ background: dot }} aria-hidden="true" />{label}</span>
      <span className="dash-kpi-card-value">{value}</span>
      <span className="dash-kpi-card-sub">
        {delta != null && <span className={`dash-kpi-delta ${deltaUp ? 'is-up' : 'is-down'}`}>{delta}</span>}
        {sub || ''}
      </span>
    </div>
  );
}

/* ── En sak i Att göra, som ett eget litet kort efter Fortnox förlaga
   (2026-10-03): överst vad man gör ("Visa faktura") i liten grå text, sedan
   rubriken i fetstil och detaljraden, och till höger en rund ikon i radens ton
   (rött = försenat, gult = snart, grönt = Bokix, grått = övrigt). Hela kortet är
   knappen. Ordningen (viktigast först) styrs av todos-listan.
   Att dölja en rad: på telefon sveper man raden åt vänster ("Dölj", som i Mail), på datorn
   finns ett litet kryss när man håller musen över raden. Ringen som stod här förut såg ut
   som en kryssruta men bockade inte av något: en förfallen faktura är lika obetald när
   raden är dold. ── */
const SWIPE_OPEN = 84;
function TodayRow({ item, onClick, onDismiss }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const [offset, setOffset] = useState(0);
  const drag = useRef(null);
  const onTouchStart = (e) => {
    const p = e.touches[0];
    drag.current = { x: p.clientX, y: p.clientY, base: offset, horizontal: null };
  };
  const onTouchMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = e.touches[0];
    const dx = p.clientX - d.x;
    if (d.horizontal === null && (Math.abs(dx) > 8 || Math.abs(p.clientY - d.y) > 8)) d.horizontal = Math.abs(dx) > Math.abs(p.clientY - d.y);
    if (!d.horizontal) return;
    setOffset(Math.max(-SWIPE_OPEN - 24, Math.min(0, d.base + dx)));
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.horizontal) return;
    setOffset(o => (o < -SWIPE_OPEN / 2 ? -SWIPE_OPEN : 0));
  };
  const open = offset !== 0;
  return (
    <li className="dash-today-row" data-open={open ? 'true' : undefined}>
      <button type="button" className="dash-today-swipe-hide" onClick={onDismiss} tabIndex={open ? 0 : -1} aria-hidden={!open}>
        {t('dashboard.todo.hide')}
      </button>
      <div
        className="dash-today-slide"
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: drag.current ? 'none' : undefined }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <button type="button" className={`dash-today-btn dash-today-btn--${item.tone || 'neu'}`} onClick={() => (open ? setOffset(0) : onClick())}>
          <span className="dash-today-lines">
            {item.action && <span className="dash-today-kicker">{item.action}</span>}
            <span className="dash-today-title">{item.title}</span>
            {(item.detail || item.when) && <span className={`dash-today-detail${item.late ? ' is-late' : ''}`}>{item.detail || item.when}</span>}
          </span>
          {Icon && <span className="dash-today-ic" aria-hidden="true"><Icon size={20} /></span>}
        </button>
        <button type="button" className="dash-today-x" onClick={onDismiss} aria-label={t('dashboard.today.dismiss')} title={t('dashboard.today.dismiss')}>
          <X size={15} />
        </button>
      </div>
    </li>
  );
}

function useIsPhone(maxWidth = 640) {
  const query = `(max-width: ${maxWidth}px)`;
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const onChange = (e) => setPhone(e.matches);
    setPhone(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', onChange); else mq.removeListener(onChange); };
  }, [query]);
  return phone;
}

export default function Dashboard({ verifications, accounts = [], invoices, expenses, contacts, setActiveTab, company, user, vatPeriods = {}, payrollRuns = [], employees = [], reviewTotal, onBulkImportSie, onCloseImportedYears, agiReports = [], bankTransactions = [], hiddenNavIds = [], payrollIncluded = true, onOpenItem }) {
  const { t } = useTranslation();
  const FORMAT_MODES = formatModes(t);
  // Har företaget personal? Avgörs på verkliga anställda och lönekörningar,
  // inte på vilket abonnemang som köpts. Nivån GÅR numera att läsa
  // (subscriptions.plan, se src/utils/plans.js) — men faktisk användning är
  // ändå det ärligare villkoret här: den som skaffar sin första anställd
  // får lönegenvägen samma dag, utan att först behöva byta abonnemang.
  // Företagets egna färgval (samma post som rapportsidan sparar,
  // company.reportDisplay). `useMemo` för att paletten annars skulle
  // byggas om vid varje omritning av startsidan.
  const isDark = useIsDarkTheme();
  const chart = useMemo(() => resolveChartPalette(company?.reportDisplay?.colors, { dark: isDark }), [company?.reportDisplay?.colors, isDark]);
  const chartRevenue = chart.income;
  const chartExpense = chart.cost;
  const [chartFormat, setChartFormat] = useState('bars');
  // Kundönskemål: samma period-flikar som Rapport och analys →
  // Företagsöversikt (PeriodPicker/OVERVIEW_PERIODS, ReportUI.jsx). 'year'
  // som standard — samma förvalda vy widgeten alltid haft (hela
  // räkenskapsåret hittills), bara nu en av fem valbara istället för det
  // enda alternativet.
  // Vald period sparas i webbläsaren, som tkr/kr nedan.
  const [periodId, setPeriodIdState] = useState(() => {
    try {
      const saved = localStorage.getItem('bokix_dash_period');
      return saved === 'last12' ? 'last12' : 'year';
    } catch { return 'year'; }
  });
  const setPeriodId = (id) => {
    setPeriodIdState(id);
    try { localStorage.setItem('bokix_dash_period', id); } catch { /* privat läge */ }
  };
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

  const [sieImportDismissed, setSieImportDismissed] = useState(() => {
    try { return localStorage.getItem(SIE_IMPORT_DISMISSED_KEY) === '1'; } catch { return false; }
  });
  const [showSieImportModal, setShowSieImportModal] = useState(false);
  const dismissSieImportCallout = () => {
    setSieImportDismissed(true);
    try { localStorage.setItem(SIE_IMPORT_DISMISSED_KEY, '1'); } catch { /* privat läge etc. — inte kritiskt */ }
  };

  // "Att göra idag" — se todoDismissedKey-kommentaren ovan. Läses om varje
  // gång man byter aktivt företag (company?.id i beroendelistan), annars
  // hade ett företagsbyte visat FÖREGÅENDE företagets avfärdade rader
  // (eller tvärtom) tills sidan laddades om.
  const [dismissedTodoKeys, setDismissedTodoKeys] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(todoDismissedKey(company?.id)) || '[]')); } catch { return new Set(); }
  });
  useEffect(() => {
    try { setDismissedTodoKeys(new Set(JSON.parse(localStorage.getItem(todoDismissedKey(company?.id)) || '[]'))); } catch { setDismissedTodoKeys(new Set()); }
  }, [company?.id]);
  const dismissTodo = (key) => {
    setDismissedTodoKeys(prev => {
      const next = new Set(prev); next.add(key);
      try { localStorage.setItem(todoDismissedKey(company?.id), JSON.stringify([...next])); } catch { /* privat läge etc. — inte kritiskt */ }
      return next;
    });
  };

  // Bugvakt (Sida 32): `maximumFractionDigits: 0` avrundar t.ex. -0.4 till
  // -0, och Intl.NumberFormat skriver då ut "-0 kr" istället för "0 kr" —
  // ett äkta minustecken framför en siffra som i praktiken är noll. Ett
  // konto utan bokförda transaktioner ska alltid visa exakt "0 kr", aldrig
  // "-0 kr" eller ett nästan-noll-belopp som antyder en dold avrundningsbugg
  // i beräkningskedjan ovan.
  const fmt = (val) => {
    const rounded = Math.round(val || 0);
    return numberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(rounded === 0 ? 0 : rounded);
  };

  // tkr eller kr för nyckeltalen, "Vad ingår i resultatet?" och diagrammet.
  // Ett val per person och enhet (localStorage), inte per företag: det är
  // hur man vill läsa, inte en egenskap hos bokföringen. kr är förvalet,
  // samma som startsidan alltid visat.
  const [amountUnit, setAmountUnitState] = useState(() => {
    try { return localStorage.getItem('bokix_dash_unit') === 'tkr' ? 'tkr' : 'kr'; } catch { return 'kr'; }
  });
  const setAmountUnit = (u) => {
    setAmountUnitState(u);
    try { localStorage.setItem('bokix_dash_unit', u); } catch { /* privat läge */ }
  };
  // tkr från 10 000 kr och mkr från en miljon. Mindre belopp står i hela
  // kronor: "719 kr" läses lättare än "0,7 tkr".
  const fmtTkr = (v) => {
    const n = Math.abs(v || 0);
    if (n < 10000) return fmt(v || 0);
    if (n >= 1e6) return `${numberFormat('sv-SE', { maximumFractionDigits: 1 }).format((v || 0) / 1e6)} mkr`;
    return `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format((v || 0) / 1000)} tkr`;
  };
  const fmtKpi = amountUnit === 'tkr' ? fmtTkr : fmt;

  // NYCKELTAL-korten (Intäkter/Kostnader/Resultat) hade tidigare en egen,
  // lokal "hela innevarande kalenderår"-uträkning här — borttagen. De läser
  // nu periodOmsattning/periodKostnader/periodResultat (samma period-
  // medvetna totaler som grafen redan räknar ut, se den koden längre ner)
  // i stället, så de aldrig kan visa ett annat tidsspann än det PeriodPicker
  // faktiskt är satt till. Se kommentaren vid NYCKELTAL-blocket i JSX:en.

  // En rad eller faktura öppnar just den saken (App.jsx handleGlobalAction),
  // annars sidan.
  const openTarget = (target) => {
    if (!target) return;
    if (target.action && onOpenItem) onOpenItem(target.action, target.tab);
    else setActiveTab(target.tab);
  };
  // ── Kom igång (dashboard/GetStarted.jsx) ── ett nytt konto väljer om det
  // börjar från noll eller flyttar in; listan ersätter då Kom igång-raderna
  // i Att göra, den tomma grafen och importrutan längst ner.
  // Valet görs i registreringen (OnboardingFlow, steget Start) och sparas på
  // kontot (user_metadata.start_path), så det följer med till andra enheter.
  // Webbläsarens kopia har överhand; den har även Hoppa över-valen.
  const gsFromSources = () => {
    const local = readGetStarted(company?.id);
    const meta = user?.user_metadata || {};
    // Visa igen (Inställningar → Utseende) sätter getstarted_reset; en dölj
    // som gjordes före det gäller inte längre.
    const reset = Number(meta.getstarted_reset) || 0;
    const localDismissed = Boolean(local.dismissed) && !(reset && (local.dismissedAt || 0) < reset);
    return { ...local, path: local.path || meta.start_path || undefined, dismissed: localDismissed || meta.getstarted_dismissed === true };
  };
  const [gsState, setGsState] = useState(gsFromSources);
  useEffect(() => { setGsState(gsFromSources()); }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeGsState = (next) => {
    setGsState(next);
    const meta = user?.user_metadata || {};
    const isRealUser = user?.id && user.id !== 'demo-user';
    if (isRealUser && (meta.start_path !== next.path || Boolean(meta.getstarted_dismissed) !== Boolean(next.dismissed))) {
      supabase.auth.updateUser({ data: { start_path: next.path || null, getstarted_dismissed: Boolean(next.dismissed) } }).catch(() => { /* webbläsarens kopia räcker */ });
    }
  };
  const hasAnyData = (verifications || []).length > 0 || (expenses || []).length > 0 || (invoices || []).length > 0;
  const showGetStarted = Boolean(company?.id) && shouldShowGetStarted(gsState, { hasAnyData });

  // ── Att göra ── (utils/todoItems.js, samma lista som notisklockan)
  const todos = buildTodoItems({
    t, company, invoices, expenses, contacts, verifications, payrollRuns, employees, agiReports, bankTransactions,
    vatPeriods, reviewTotal, hiddenNavIds, dismissedKeys: dismissedTodoKeys,
  }).filter(item => !((showGetStarted || gsState.path || gsState.dismissed) && item.group === 'start')).map(item => ({ ...item, icon: TODO_ICONS[item.kind] || TodoDraftIcon }));

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
    { done: hasCustomers, label: t('dashboard.onboarding.stepCustomer'), tab: 'contacts', icon: UserPlus, color: ONBOARD_STEP_COLORS.customer },
    { done: hasInvoices,  label: t('dashboard.onboarding.stepInvoice'),  tab: 'invoices', icon: FileText, color: ONBOARD_STEP_COLORS.invoice },
    { done: hasExpenses,  label: t('dashboard.onboarding.stepExpense'), tab: 'expenses', icon: Receipt,  color: ONBOARD_STEP_COLORS.expense },
    { done: hasSuppliers, label: t('dashboard.onboarding.stepSupplier'), tab: 'contacts', icon: Users,    color: ONBOARD_STEP_COLORS.supplier },
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
  //
  // Kundönskemål: checklistan ("Skapa din första kund/faktura/utgift...")
  // avstängd tills vidare — `false &&` istället för att riva ut logiken,
  // så den är ett enda tecken bort från att slås på igen om den kommer
  // tillbaka i någon form senare.
  const showOnboarding = false && !onboardingDismissed && (!allOnboardingDone || celebrating);
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

  // ── Utestående — pengar på väg in och pengar på väg ut ──────────────
  //
  // Ersatte "Senast bokfört", som visade de fyra senaste verifikationerna.
  // Den rutan var en backspegel: den listade det du själv nyss gjort,
  // krävde ingenting av dig, och låg bredvid momskortet som gör precis
  // tvärtom. Ytan används nu till den enda siffra på sidan som svarar på
  // "har jag pengar nästa månad" — vad kunderna är skyldiga dig och vad du
  // är skyldig dina leverantörer. Hela verifikationslistan finns kvar under
  // Bokföring, som är där man går när man vill titta bakåt.
  //
  // Räknas ur fakturorna och leverantörsfakturorna själva, aldrig ur
  // bokförda saldon: en obetald faktura är utestående oavsett hur den
  // bokförts, och kontantmetoden bokför den inte alls förrän den betalas.
  const outstanding = useMemo(() => {
    const daysOverdue = calendarDaysOverdue;

    // Bara det som faktiskt är kvar att betala: en skickad faktura på 0 kr, eller en
    // som redan betalats eller krediterats fullt, stod annars som obetald med 0 kr.
    const unpaidInvoices = (invoices || []).filter(i => i.status === 'sent' && invoiceCustomerRemainingSek(i) > 0);
    // Delbetalda fakturor räknas på det som ÅTERSTÅR, inte på hela
    // beloppet — annars säger rutan att man har mer att få in än man har.
    const receivable = unpaidInvoices.reduce((sum, i) => sum + invoiceCustomerRemainingSek(i), 0);
    const overdueIn = unpaidInvoices.filter(i => daysOverdue(i.dueDate) > 0);
    const oldestOverdue = overdueIn.reduce((max, i) => Math.max(max, daysOverdue(i.dueDate)), 0);

    // Leverantörsfakturor ligger bland utgifterna med type
    // 'supplier_invoice' och en egen status (se SupplierInvoices.jsx) —
    // inte i en egen lista.
    const unpaidSupplier = (expenses || []).filter(e => e.type === 'supplier_invoice' && e.status !== 'paid');
    const payable = unpaidSupplier.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const overdueOut = unpaidSupplier.filter(e => daysOverdue(e.dueDate) > 0);

    // Själva fakturorna, båda hållen i en lista sorterad på förfallodag
    // (2026-10-03): på bred dator sträcks kortet ner till diagrammets
    // nederkant, och ytan under summorna stod annars tom.
    const nameOf = (id, fallback) => (contacts || []).find(c => c.id === id)?.name || fallback || '';
    const items = [
      ...unpaidInvoices.map(i => ({
        key: `in-${i.id}`, dir: 'in', target: { tab: 'invoices', action: { type: 'open_invoice', payload: { id: i.id } } },
        name: nameOf(i.customerId, i.invoiceNumber ? `#${i.invoiceNumber}` : ''),
        amount: invoiceCustomerRemainingSek(i), dueDate: i.dueDate, overdue: daysOverdue(i.dueDate),
      })),
      ...unpaidSupplier.map(e => ({
        key: `out-${e.id}`, dir: 'out', target: { tab: 'supplier_invoices', action: { type: 'view_supplier_invoice', payload: { id: e.id } } },
        name: nameOf(e.supplierId, e.supplier || e.description),
        amount: Number(e.amount) || 0, dueDate: e.dueDate, overdue: daysOverdue(e.dueDate),
      })),
    ].sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')));

    return {
      receivable, payable,
      inCount: unpaidInvoices.length, outCount: unpaidSupplier.length,
      overdueInCount: overdueIn.length, overdueOutCount: overdueOut.length,
      oldestOverdue,
      net: receivable - payable,
      items,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, expenses, contacts]);
  // ── Chartdata ──
  // Kundönskemål: samma fem period-flikar som Rapport och analys →
  // Företagsöversikt (PeriodPicker ovan) styr nu den här grafen också, inte
  // ett hårdkodat "hela kalenderåret hittills". overviewPeriodBounds
  // (reportCalculations.js) räknar ut datumintervallet OCH bucket-
  // storleken (dag för "Denna månad", annars månad), buildResultSeries
  // bucketar de faktiskt bokförda beloppen — samma två funktioner som
  // Företagsöversikten använder, inte en andra, lokal kalenderårsimplementation
  // som (innan den här ändringen) alltid räknade kalenderår oavsett
  // företagets riktiga räkenskapsår och aldrig kunde visa mer än 12 månader.
  //
  // `hasComparison` (från overviewPeriodBounds) är falskt för "Sedan start"
  // — det finns ingen meningsfull period FÖRE företagets första bokförda
  // dag att jämföra med, se samma resonemang i ReportDetail.jsx.
  // En generisk "föregående år" i stället för ett inbakat årtal: flikarnas
  // fönster kan spänna över ett årsskifte, men jämförelseperioden är
  // alltid EXAKT ett år tidigare. Ren visningstext, ALDRIG använd för att bygga nyckeln i
  // comparisonChartData (se useMemo nedan) eller i extraSeries som skickas
  // till den delade RevenueExpenseChart (ReportUI.jsx, Tremor-baserad) —
  // den grafens kategorier/dataKeys är fortfarande hårdkodad svenska
  // (Intäkter/Utgifter, se ReportUI.jsx) och delas med Rapport och analys,
  // så en halvöversatt nyckel (`Intäkter previous year`) hade tyst slutat
  // matcha och tappat jämförelselinjen. comparisonLabelDisplay används
  // bara i JSX-text och i `name=`-proppar på de RÅA Recharts-elementen
  // (stapel-/resultatformatet längre ner), där `name` redan är frikopplat
  // från `dataKey` — säkert att översätta där.
  const comparisonLabelDisplay = t('dashboard.chart.previousYear');
  const periodBounds = useMemo(
    () => overviewPeriodBounds(periodId, { fiscalYearStart: companyFiscalYearSetting(company), verifications }),
    [periodId, company?.fiscalYear, company?.firstFiscalYear, verifications],
  );
  const chartData = useMemo(() => {
    const { start, end, prevStart, prevEnd, granularity, hasComparison } = periodBounds;
    const series = buildResultSeries(verifications, accounts, start, end, granularity);
    const prevSeries = hasComparison ? buildResultSeries(verifications, accounts, prevStart, prevEnd, granularity) : [];
    return series.map((m, i) => {
      const prev = prevSeries[i];
      return {
        name: m.label, title: m.title, Intäkter: m.intakt, Utgifter: m.kostnad, Resultat: m.intakt - m.kostnad,
        PrevIntäkter: prev ? prev.intakt : 0, PrevUtgifter: prev ? prev.kostnad : 0,
        PrevResultat: prev ? (prev.intakt - prev.kostnad) : 0,
      };
    });
  }, [verifications, accounts, periodBounds]);

  // Samma rader som `chartData`, men med jämförelseårets tal även under de
  // ETIKETTER den delade grafen använder som serienamn ("Intäkter 2025").
  // Tremor-porten identifierar en serie på kategorinamnet, inte på ett eget
  // dataKey — och `chartData` behålls oförändrad eftersom tabellvyn och
  // stapelläget läser sina egna Prev*-fält.
  // "Översikt": intäkter och utgifter som vanligt plus resultatet
  // som en tredje serie. Resultatet ligger redan i `chartData`, det behöver
  // bara ett fältnamn som matchar seriens etikett.
  const combinedChartData = useMemo(() => chartData.map(row => ({ ...row, Resultat: row.Resultat })), [chartData]);

  const hasChartData = chartData.some(d => d.Intäkter !== 0 || d.Utgifter !== 0);
  // Bara sant om det FAKTISKT finns bokförd fjolårsdata OCH perioden har en
  // meningsfull jämförelse alls (periodBounds.hasComparison — falskt för
  // "Sedan start") — annars skulle jämförelselinjerna bara vara en
  // missvisande platt nolla.
  const hasPrevYearData = periodBounds.hasComparison && chartData.some(d => d.PrevIntäkter !== 0 || d.PrevUtgifter !== 0);
  // Grafens EGNA totaler för den valda perioden — INTE raOmsattning/
  // raKostnader/raResultat (NYCKELTAL-korten ovan, alltid innevarande
  // KALENDERÅR, ett separat och medvetet oförändrat mått). Grafens legend/
  // rubrik måste stämma med vad grafen faktiskt visar, annars läser en
  // besökare på "Denna månad" en legend som fortfarande påstår hela
  // kalenderårets summa.
  const periodOmsattning = chartData.reduce((sum, d) => sum + d.Intäkter, 0);
  const periodKostnader = chartData.reduce((sum, d) => sum + d.Utgifter, 0);
  const periodResultat = periodOmsattning - periodKostnader;

  // Raden under beloppet i nyckeltalsrutorna: ett tal som säger något om
  // beloppet, aldrig en upprepning av det. Finns fjolårsdata visas
  // förändringen som ett märke ("+12 %") följt av "mot i fjol"; annars
  // marginal, snitt per månad och andel av intäkterna. Likviditeten är det
  // faktiska saldot på bank och kassa i dag, ur bokföringen.
  const pctFmt = (n, signed = false) => numberFormat(dateLocale(), { style: 'percent', maximumFractionDigits: 0, ...(signed ? { signDisplay: 'exceptZero' } : {}) }).format(n);
  const prevOmsattning = chartData.reduce((sum, d) => sum + d.PrevIntäkter, 0);
  const prevResultat = chartData.reduce((sum, d) => sum + d.PrevResultat, 0);
  const deltaOf = (now, before) => (hasPrevYearData && before ? (now - before) / Math.abs(before) : null);
  const incomeDelta = deltaOf(periodOmsattning, prevOmsattning);
  const resultDelta = deltaOf(periodResultat, prevResultat);
  const kpiSubIncome = incomeDelta != null
    ? t('dashboard.kpi.vsLastYearShort')
    : (periodBounds.granularity === 'month' && chartData.length > 1 && periodOmsattning > 0
      ? t('dashboard.kpi.perMonth', { amount: fmtKpi(periodOmsattning / chartData.length) })
      : '');
  // Pengarna på bank och kassa i dag (1900–1999), oavsett vald period: det
  // första en småföretagare vill veta (2026-11-07).
  const kpiSubCost = periodOmsattning > 0 ? t('dashboard.kpi.shareOfIncome', { pct: pctFmt(periodKostnader / periodOmsattning) }) : '';
  const kpiSubResult = resultDelta != null
    ? t('dashboard.kpi.vsLastYearShort')
    : (periodOmsattning > 0 ? t('dashboard.kpi.margin', { pct: pctFmt(periodResultat / periodOmsattning) }) : '');
  // Innevarande månad är inte slut än; diagrammet ritar den halvt genomskinlig.
  const lastIsPartial = periodBounds.granularity === 'month' && periodBounds.end >= new Date(new Date().setHours(0, 0, 0, 0));
  // ── Hälsning — tidsgränser i delad util, inte inline ──
  const { timeOfDay } = getGreeting();
  const greeting = t(`dashboard.greeting${timeOfDay.charAt(0).toUpperCase()}${timeOfDay.slice(1)}`);
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
  // Startsidans layout (Inställningar → Utseende): två kolumner är standard,
  // 'stack' lägger allt i en kolumn med Att göra överst (2026-11-09).
  const stackLayout = useDashboardLayout(user) === 'stack';
  const isPhone = useIsPhone();
  // Att göra idag: på telefon först på sidan, före Snabbåtgärder (det som väntar
  // på dig är viktigare än genvägarna, och genvägarna tog annars halva skärmen
  // innan listan syntes). På bredare skärmar ligger den kvar i högerkolumnen.
  const todoFirst = useIsPhone(768);
  // Högst fyra rader syns; listan är redan sorterad med det viktigaste först.
  // Resten ligger bakom "Visa alla", så kortet aldrig blir en lång vägg.
  const TODO_VISIBLE = 4;
  const [todosExpanded, setTodosExpanded] = useState(false);
  // Utestående: fyra fakturor syns i smalt fönster, resten bakom Visa alla.
  const [outExpanded, setOutExpanded] = useState(false);
  // "Minimera" fäller ihop listan till bara rubriken; valet sparas i webbläsaren.
  const [todosCollapsed, setTodosCollapsed] = useState(() => {
    try { return localStorage.getItem('bokix_todo_collapsed') === '1'; } catch { return false; }
  });
  const toggleTodosCollapsed = () => setTodosCollapsed(v => {
    try { localStorage.setItem('bokix_todo_collapsed', v ? '0' : '1'); } catch { /* privat läge */ }
    return !v;
  });
  const visibleTodos = todosExpanded ? todos : todos.slice(0, TODO_VISIBLE);
  // Sakerna grupperade per ämne (Kundfakturor, Bokföring, Moms och skatt, Lön),
  // gruppen med det viktigaste först. Rubrikerna visas bara när det finns
  // saker i mer än ett ämne; en ensam rubrik säger inget.
  const todoGroups = visibleTodos.reduce((acc, item) => {
    const id = item.group || 'other';
    const g = acc.find(x => x.id === id);
    if (g) g.items.push(item); else acc.push({ id, items: [item] });
    return acc;
  }, []);
  const showGroupTitles = todoGroups.length > 1;
  const todoCard = todos.length > 0 ? (
    <section className="dash-todo-card" aria-label={t('dashboard.today.title')}>
      <div className="dash-todo-head">
        <h2 className="dash-todo-title">
          {t('dashboard.today.title')}
          <span className="dash-todo-badge" aria-label={todos.length === 1 ? t('dashboard.todo.countOne') : t('dashboard.todo.countMany', { count: todos.length })}>{todos.length}</span>
        </h2>
        <button type="button" className="dash-todo-toggle" onClick={toggleTodosCollapsed} aria-expanded={!todosCollapsed}>
          {todosCollapsed ? t('dashboard.todo.expand') : t('dashboard.todo.minimize')}
          <ChevronRight size={16} aria-hidden="true" style={{ transform: todosCollapsed ? 'rotate(90deg)' : 'rotate(-90deg)' }} />
        </button>
      </div>
      {!todosCollapsed && (<>
      <div className="dash-todo-list">
        {todoGroups.map(g => (
          <section key={g.id} className="dash-todo-group" aria-label={showGroupTitles ? t(`dashboard.todo.group.${g.id}`) : undefined}>
            {showGroupTitles && <h3 className="dash-todo-group-title">{t(`dashboard.todo.group.${g.id}`)}</h3>}
            <ul className="dash-todo-group-list">
              {g.items.map(todo => (
                <TodayRow key={todo.dismissKey} item={todo} onClick={() => openTarget(todo.target)} onDismiss={() => dismissTodo(todo.dismissKey)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {todos.length > TODO_VISIBLE && (
        <button type="button" className="dash-todo-more" onClick={() => setTodosExpanded(v => !v)} aria-expanded={todosExpanded}>
          {todosExpanded ? t('dashboard.todo.showLess') : t('dashboard.todo.showAll', { count: todos.length })}
          <ChevronRight size={15} aria-hidden="true" style={{ transform: todosExpanded ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
        </button>
      )}
      </>)}
    </section>
  ) : null;
  // Tomt läge, bara på telefon: en liten lugn rad så man ser att listan är
  // kollad och tom, i stället för att kortet bara saknas. På datorn
  // försvinner kortet helt som förut (tidigare kundönskemål), och raden är
  // ingen lista att beta av, bara ett besked.
  const todoEmpty = todoFirst && !isNew && todos.length === 0 ? (
    <section className="dash-todo-empty" aria-label={t('dashboard.today.title')}>
      <span className="dash-todo-empty-title">{t('dashboard.today.title')}</span>
      <span className="dash-todo-empty-text">{t('dashboard.todo.empty')}</span>
    </section>
  ) : null;

  // Diagrammets höjd på bred dator: växer mot fönstrets nederkant så att det
  // inte blir ett stort tomt fält under Räkenskapsåret, men högst 720 så att
  // kortet inte blir för stort (användaren 2026-11-09). Minst 340.
  const chartSlotRef = useRef(null);
  const [fillH, setFillH] = useState(null);
  const hasOutstanding = outstanding.inCount > 0 || outstanding.outCount > 0;
  useLayoutEffect(() => {
    const measure = () => {
      const slot = chartSlotRef.current;
      if (!slot || stackLayout || !window.matchMedia('(min-width: 1200px)').matches) { setFillH(null); return; }
      const scroller = slot.closest('.main-wrapper');
      const top = layoutRect(slot).top - (scroller ? layoutRect(scroller).top - scroller.scrollTop : 0);
      const viewport = scroller ? scroller.clientHeight : layoutViewport().height;
      // Under diagrammet: kortets innerkant och ram (19), kroppens marginal
      // (16) och sidans botten (24).
      let h = viewport - top - 60;
      // Högerkolumnen (Att göra + Utestående) längre än fönstret, som på en
      // laptop: diagrammet växer mot kolumnens nederkant (taket nedan gäller),
      // så att det inte blir ett stort tomt fält under Räkenskapsåret.
      const body = slot.closest('.dash-body');
      const todo = body && body.querySelector(':scope > .dash-todo-card');
      const out = body && body.querySelector('.dash-outstanding');
      if (body && (todo || out)) {
        const outMin = out ? layoutRect(out).height : 0;
        const rightH = (todo ? layoutRect(todo).height + 16 : 0) + outMin;
        h = Math.max(h, layoutRect(body).top + rightH - layoutRect(slot).top - 19);
      }
      setFillH(Math.round(h));
    };
    measure();
    window.addEventListener('resize', measure);
    // Att göra ändrar höjd när man trycker Visa alla eller Minimera.
    const todoEl = chartSlotRef.current?.closest('.dash-body')?.querySelector(':scope > .dash-todo-card');
    const ro = todoEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    if (ro) ro.observe(todoEl);
    return () => { window.removeEventListener('resize', measure); if (ro) ro.disconnect(); };
  // hasChartData och isNew: diagrammet finns inte förrän företagets data
  // laddats; utan dem mättes höjden bara före laddningen.
  }, [chartFormat, periodId, todos.length, hasOutstanding, showGreeting, hasChartData, isNew, stackLayout]);
  const chartH = isPhone ? 240 : stackLayout ? 360 : fillH != null ? Math.max(340, Math.min(720, fillH)) : 340;

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
    <div className="dash-root" style={{ maxWidth: '100%', margin: '0 auto', width: '100%', minHeight: isPhone ? 0 : '100%', boxSizing: 'border-box', background: 'var(--bg-page)', padding: '24px', paddingTop: '8px' }}>
      <style>{`
        @media (max-width: 900px) {
          .dash-lower-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
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

      {/* ─── SIDHUVUD — bara hälsningen, centrerad, med ett tunt streck under
          som skiljer den från översikten (2026-10-03). Snabbknapparna (Ny
          faktura, Ny offert …) är borttagna på användarens begäran; samma
          saker finns som knappar på respektive sida. Hälsningen går
          att stänga av (Inställningar → Min profil); då försvinner hela raden. ─── */}
      <div className={`dash-top${showGreeting ? '' : ' dash-top--bare'}`}>
        {showGreeting && (
          <h1 className="dash-hello">
            {greeting}, {firstName || t('dashboard.greetingFallbackName')} 👋
          </h1>
        )}
      </div>

      {showGetStarted && (
        <GetStarted
          companyId={company.id}
          firstName={user?.user_metadata?.first_name || ''}
          state={gsState}
          onChange={changeGsState}
          data={{ company, verifications: verifications || [], expenses: expenses || [], invoices: invoices || [], contacts: contacts || [], employees, bankTransactions, hiddenNavIds, payrollIncluded }}
          onOpenTab={setActiveTab}
          onOpenAction={(action, tab) => (onOpenItem ? onOpenItem(action, tab) : setActiveTab(tab))}
          onImportSie={() => setShowSieImportModal(true)}
        />
      )}

      {todoFirst && (todoCard || todoEmpty)}

      {/* ─── ATT GÖRA IDAG — sidans mest konkreta, klickbara lista, nu i full
          bredd direkt under Snabbåtgärder istället för instängd i en trång
          bottenruta. Röd/gul/grön styr ordning, aldrig kronologi.
          Kundönskemål ("ska inte visas om de inte har något, och de kan
          ignorera det de inte vill följa"): kortet visade tidigare ALLTID
          något (en syntetisk "Allt klart"-rad om listan annars var tom) —
          bytt mot att kortet helt enkelt inte finns i DOM:en alls när
          `todos` är tom (se todos-uppbyggnaden ovan, ingen platshållare
          längre), och varje rad går nu att avfärda för sig (TodayRow:s
          nya X-knapp → dismissTodo) i stället för att vara en obligatorisk
          lista man måste beta av. ─── */}
      {/* På bred dator (index.css, .dash-body) ligger diagrammet till vänster och
          Att göra, Utestående och Moms i en smal kolumn till höger, så att hela
          översikten syns utan att skrolla. Smalare än så staplas allt som förut. */}
      <div className={`dash-body${isNew || (todos.length === 0 && !hasOutstanding) ? ' dash-body--solo' : (todos.length > 0 ? '' : ' dash-body--no-todo')}${stackLayout ? ' dash-body--stack' : ''}`}>
      {!todoFirst && todoCard}

      {/* ─── GRAF — full bredd. Var tidigare en svag cremeton (Sida 31/32) för
          att skilja den från de vita KPI-korten ovanför — kundfeedback: lästes
          bara som "lite beige", bytt till samma kortvita som resten av sidan.
          Syns alltid (inte bara `!isNew`) — men visar en lugn tomt-läge-vy
          istället för en platt nollstapel-graf tills det finns något att
          rita ut. ─── */}
      <div className="dash-chart-card" style={{ ...(showGetStarted && !hasChartData ? { display: 'none' } : null), background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', marginBottom: '18px', minWidth: 0 }}>
        {/* Period-väljare (kundönskemål: "ska vara på startsidan också" +
            "det måste visa datumet") — samma PeriodHeading/PeriodPicker/
            OVERVIEW_PERIODS som Rapport och analys → Företagsöversikt
            (ReportUI.jsx): etikett OCH exakt start–slutdatum till vänster,
            flikarna till höger. Alltid synlig (inte gated på hasChartData)
            av samma skäl som CHART_MODES-växlaren nedan redan är det: en
            besökare som landar på en tom flik (t.ex. "Denna månad" utan
            bokföring än) måste kunna växla till en flik som FAKTISKT har
            data, inte fastna i ett tomt läge utan utväg. Egen rad, tydligt
            skild (18px) från graf-rubrikraden under — två separata beslut
            (VILKEN period, VILKEN graf) ska inte läsas ihop till ett. */}
        <div className="dash-period-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <PeriodHeading label={periodBounds.label} start={periodBounds.start} end={periodBounds.end} />
          <div className="dash-period-controls">
            {/* Bara två perioder, I år och Senaste 12 mån, som små knappar i samma
                stil som tkr/kr (2026-10-03). Denna månad och Sedan start finns i
                Rapport och analys. */}
            <div className="dash-format-seg dash-period-seg" role="group" aria-label={t('dashboard.period.label')}>
              {['year', 'last12'].map(id => (
                <button key={id} type="button" onClick={() => setPeriodId(id)} aria-pressed={periodId === id} className={`dash-format-btn${periodId === id ? ' active' : ''}`}>
                  {t(`dashboard.period.${id}`)}
                </button>
              ))}
            </div>
            <div className="dash-format-seg" role="group" aria-label={t('dashboard.unit.label')}>
              {['tkr', 'kr'].map(u => (
                <button key={u} type="button" onClick={() => setAmountUnit(u)} aria-pressed={amountUnit === u} title={t(`dashboard.unit.${u}Title`)} className={`dash-format-btn${amountUnit === u ? ' active' : ''}`}>{u}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── NYCKELTAL — Intäkter → Kostnader → Resultat, i den ordning
            talen faktiskt uppstår: det kommer in pengar, det går ut pengar,
            och skillnaden är resultatet.
            Kundönskemål ("slå ihop dem med analyssidan, visa vilken period
            man vill"): korten stod tidigare i en egen ram OVANFÖR den här,
            alltid låsta till "hela räkenskapsåret hittills" — oberoende av
            PeriodPicker:n här nedanför, som redan styrde grafen. Två
            besökare kunde alltså läsa "Denna månad" i grafen men "hela året"
            i korten ovanför, utan att inse att de var olika mått. Flyttade
            in HÄR, i samma kort, samma period (periodOmsattning/
            periodKostnader/periodResultat — grafens egna, redan uträknade
            totaler för periodBounds, se kommentaren vid dem) — väljer man
            "Denna månad" ovan uppdateras både korten och grafen tillsammans,
            en enda källa till sanning istället för två. ─── */}
        <div className="dash-kpi-grid">
          <KpiCard
            role="result" label={t('dashboard.kpi.result')} value={fmtKpi(periodResultat)} sub={kpiSubResult}
            delta={resultDelta != null ? pctFmt(resultDelta, true) : null} deltaUp={resultDelta >= 0}
            dot={periodResultat >= 0 ? chart.profit : chart.loss} negative={periodResultat < 0}
            tint={periodResultat >= 0 ? chart.profit : chart.loss}
          />
          <KpiCard
            role="income" label={t('dashboard.kpi.income')} value={fmtKpi(periodOmsattning)} sub={kpiSubIncome}
            delta={incomeDelta != null ? pctFmt(incomeDelta, true) : null} deltaUp={incomeDelta >= 0}
            dot={chart.income}
          />
          <KpiCard
            role="cost" label={t('dashboard.kpi.costs')} value={fmtKpi(periodKostnader)} sub={kpiSubCost}
            dot={chart.costBar}
          />
        </div>

        {/* Grafen visar alltid allt samlat: intäkter, kostnader och resultat. Formatet väljs
            med knapparna (staplar, linje, yta, tabell). */}
        <div className="dash-chart-head">
          <h2 className="dash-chart-title">{t('dashboard.chart.trendTitle')}</h2>
          {hasChartData && (
            <div className="dash-format-row">
              <div className="dash-format-seg" role="group" aria-label={t('dashboard.chart.selectChart')}>
                {FORMAT_MODES.map(f => (
                  <button key={f.id} type="button" onClick={() => setChartFormat(f.id)} title={f.label} aria-pressed={chartFormat === f.id} className={`dash-format-btn${chartFormat === f.id ? ' active' : ''}`}>
                    <f.icon size={13} />
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tomt läge — inga bokförda verifikationer än. Ett eget litet vyläge
            istället för att bara rita en platt nollinje, så rutan förklarar
            vad som saknas istället för att se trasig/tom ut. */}
        {!hasChartData ? (
          <div className="dash-chart-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '220px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: chartRevenue, marginBottom: '2px' }}>
              <BarChart2 size={20} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('dashboard.chart.emptyTitle')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px' }}>
              {t('dashboard.chart.emptySubtitle')}
            </p>
          </div>
        ) : chartFormat === 'table' ? (
          <ChartDataTable data={chartData} fmt={fmt} hasPrevYearData={hasPrevYearData} comparisonLabel={comparisonLabelDisplay} />
        ) : (
          <ReportDisplayProvider colors={company?.reportDisplay?.colors} unit={amountUnit}>
            {chartFormat === 'bars' && (
              <div className="dash-chart-key">
                <span><i className="dash-chart-key-dot" style={{ background: chart.income }} />{t('dashboard.kpi.income')}</span>
                <span><i className="dash-chart-key-dot" style={{ background: chart.costBar }} />{t('dashboard.kpi.costs')}</span>
              </div>
            )}
            <div ref={chartSlotRef}>
            <Suspense fallback={<div style={{ height: chartH }} aria-hidden="true" />}>
            <RevenueExpenseChart
              data={combinedChartData}
              indexKey="name"
              variant={chartFormat === 'bars' ? 'diverging' : chartFormat}
              height={chartH}
              isMobile={isPhone}
              extraSeries={chartFormat === 'bars' ? [] : [{ label: 'Resultat', color: chart.profit, dashed: false }]}
              prevKey={hasPrevYearData ? 'PrevResultat' : undefined}
              prevName={t('dashboard.chart.resultLastYear')}
              partialLast={lastIsPartial}
            />
            </Suspense>
            </div>
          </ReportDisplayProvider>
        )}
      </div>

      {/* ─── UTESTÅENDE — vad som ska komma in och vad som ska betalas. Moms-kortet är
          borttaget härifrån (kundönskemål): en tom Moms-ruta sa bara "0" och förklarade inget.
          Påminnelsen om momsdeklarationen finns kvar i Att göra idag. ─── */}
      {!isNew && hasOutstanding && (
        <div className="dash-lower-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '18px', alignItems: 'stretch' }}>

          {/* Utestående — se kommentaren vid `outstanding` ovan för varför
              den här ytan inte längre visar de senaste verifikationerna. */}
          <div className="dash-outstanding" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="dash-outstanding-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{t('dashboard.outstanding.title')}</span>
              <button onClick={() => setActiveTab('invoices')} className="ds-link-btn sm">{t('dashboard.outstanding.allInvoices')}</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-light)', flex: 'none' }}>
              {[
                {
                  key: 'in', label: t('dashboard.outstanding.toReceive'), amount: outstanding.receivable,
                  count: outstanding.inCount, overdue: outstanding.overdueInCount,
                  tone: chartRevenue, tab: 'invoices', hint: t('dashboard.outstanding.toReceiveHint'),
                  empty: t('dashboard.outstanding.noUnpaidCustomerInvoices'),
                  note: outstanding.oldestOverdue > 0
                    ? t('dashboard.outstanding.oldestOverdueNote', { days: outstanding.oldestOverdue })
                    : null,
                },
                {
                  key: 'out', label: t('dashboard.outstanding.toPay'), amount: outstanding.payable,
                  count: outstanding.outCount, overdue: outstanding.overdueOutCount,
                  tone: chartExpense, tab: 'supplier_invoices', hint: t('dashboard.outstanding.toPayHint'),
                  empty: t('dashboard.outstanding.noUnpaidSupplierInvoices'),
                  note: null,
                },
              ].map(box => (
                <button
                  key={box.key} type="button" onClick={() => setActiveTab(box.tab)}
                  style={{
                    background: 'var(--bg-card)', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: box.tone }} />
                    {box.label}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{box.hint}</span>
                  <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: '2px' }}>
                    {fmt(box.amount)}
                  </span>
                  {box.count === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{box.empty}</span>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {box.count} {box.count === 1 ? t('dashboard.outstanding.invoiceSingular') : t('dashboard.outstanding.invoicePlural')}
                      {box.overdue > 0 && (
                        <span style={{ color: 'var(--status-red-text)', fontWeight: 700 }}>{t(box.overdue === 1 ? 'dashboard.outstanding.overdueSuffixSingular' : 'dashboard.outstanding.overdueSuffixPlural', { count: box.overdue })}</span>
                      )}
                    </span>
                  )}
                  {box.note && (
                    <span style={{ fontSize: '11px', color: 'var(--status-red-text)' }}>{box.note}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Nettot är poängen med att visa de två bredvid varandra: det
                säger om månaden går ihop, vilket ingen av siffrorna gör ensam. */}
            {(outstanding.receivable !== 0 || outstanding.payable !== 0) && (
            <div className="dash-outstanding-net" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('dashboard.outstanding.net')}</span>
              <span style={{ fontSize: '15px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: outstanding.net >= 0 ? 'var(--text-main)' : 'var(--status-red-text)' }}>
                {fmt(outstanding.net)}
              </span>
            </div>
            )}
            {/* De obetalda fakturorna, närmast förfallodag först. Listan tar den
                höjd kortet har kvar och skrollar om den inte får plats. */}
            {outstanding.items.length > 0 && (
              <div className={`dash-out-list${outExpanded ? ' is-open' : ''}`}>
                <div className="dash-out-list-title">{t('dashboard.outstanding.listTitle')}</div>
                <ul>
                  {outstanding.items.map(it => (
                    <li key={it.key}>
                      <button type="button" className="dash-out-row" onClick={() => openTarget(it.target)}>
                        <i className="dash-out-dot" style={{ background: it.dir === 'in' ? chartRevenue : chartExpense }} aria-hidden="true" />
                        <span className="dash-out-main">
                          <span className="dash-out-name">{it.name}</span>
                          <span className={`dash-out-due${it.overdue > 0 ? ' is-late' : ''}`}>
                            {it.overdue > 0
                              ? t('dashboard.outstanding.rowOverdue', { days: it.overdue })
                              : !it.dueDate
                                ? ''
                                : new Date(it.dueDate).toDateString() === new Date().toDateString()
                                  ? t('dashboard.outstanding.rowDueToday')
                                  : t('dashboard.outstanding.rowDue', { date: new Date(it.dueDate).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) })}
                          </span>
                        </span>
                        <span className="dash-out-amount">{it.dir === 'out' ? '−' : ''}{fmt(it.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {outstanding.items.length > 4 && (
                  <button type="button" className="dash-todo-more dash-out-more" onClick={() => setOutExpanded(v => !v)} aria-expanded={outExpanded}>
                    {outExpanded ? t('dashboard.todo.showLess') : t('dashboard.todo.showAll', { count: outstanding.items.length })}
                    <ChevronRight size={15} aria-hidden="true" style={{ transform: outExpanded ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      )}
      </div>

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
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{t('dashboard.onboarding.celebrateTitle')}</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{t('dashboard.onboarding.celebrateSubtitle')}</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
                <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{t('dashboard.onboarding.title')}</h2>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {t('dashboard.onboarding.stepsCompleted', { done: onboardingDoneCount, total: onboardingSteps.length })}
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
                    <MessageSquare size={13} /> {t('dashboard.onboarding.contactSupport')}
                  </a>
                  <a
                    href="mailto:support@bokix.se?subject=Felrapport%20-%20Bokix"
                    style={ONBOARD_FOOTER_LINK_STYLE}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <AlertCircle size={13} /> {t('dashboard.onboarding.reportBug')}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={dismissOnboarding}
                  style={{ ...ONBOARD_FOOTER_LINK_STYLE, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <X size={13} /> {t('dashboard.onboarding.hideBox')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Kundönskemål (Sida 51): "har du bokfört någon annanstans innan?"
          — en helt FRISTÅENDE ruta, inte en femte checklista-rad (se
          SIE_IMPORT_DISMISSED_KEY-kommentaren ovan för varför). Samma
          isNew-villkor som checklistan ovan, men sitt eget dismiss-state
          så den inte kopplas till checklistans "alla klara"-firande. */}
      {isNew && !showGetStarted && !sieImportDismissed && (
        <div className="dash-sie" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Upload size={17} color="var(--status-green-text)" />
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{t('dashboard.sieImport.title')}</div>
              <div className="dash-sie-sub" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{t('dashboard.sieImport.subtitle')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button type="button" onClick={() => setShowSieImportModal(true)} style={{ padding: '9px 16px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {t('dashboard.sieImport.button')}
            </button>
            <button type="button" onClick={dismissSieImportCallout} aria-label={t('dashboard.sieImport.dismiss')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {showSieImportModal && (
        <SieImportModal
          accounts={accounts}
          verifications={verifications}
          company={company}
          onCloseYears={onCloseImportedYears}
          onImport={(newVerifications, newAccounts, sourceTag) => onBulkImportSie?.(newVerifications, newAccounts, sourceTag)}
          onClose={() => setShowSieImportModal(false)}
        />
      )}
    </div>
  );
}
