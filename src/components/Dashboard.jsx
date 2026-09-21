import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  FileText, Receipt, TrendingUp, TrendingDown,
  ChevronRight, ArrowUpRight, ArrowDownRight,
  CheckCircle2, BarChart2,
  UserPlus, Users, Clock, AlertCircle, X, MessageSquare, Upload,
  QuickNewInvoiceIcon, QuickUploadReceiptIcon, QuickNewContactIcon, QuickLogTimeIcon, QuickRunPayrollIcon,
  // Aliasat — 'LineChart' krockar annars med recharts-komponenten med
  // samma namn som redan importeras nedan (två helt olika saker: en ikon
  // kontra en diagramkomponent).
  LineChart as LineChartIcon, AreaChart as AreaChartIcon, Table2,
} from './icons';
import { nextVatDeadline } from '../utils/declarationDeadlines';
import { getGreeting } from '../utils/greeting';
import SieImportModal from './SieImportModal';
import { BRAND, VIVID } from '../utils/brandColors';
import { resolveChartPalette, makeAmountFormatters, CHART_COLOR_FAMILIES } from '../utils/chartPalette';
import { RevenueExpenseChart, ReportDisplayProvider, useReportDisplay } from './reports/ReportUI';
import { useTranslation } from '../i18n';
// Kundönskemål: samma fem period-flikar (Denna månad/3 mån/6 mån/
// Räkenskapsåret/Sedan start) som Rapport och analys → Företagsöversikt,
// på "Intäkter vs Utgifter"-grafen här också — delad komponent/lista och
// delad datumberäkning istället för en andra, lokal implementation som kan
// glida isär (se PeriodPicker/OVERVIEW_PERIODS-kommentaren i ReportUI.jsx).
import { PeriodPicker, PeriodHeading, OVERVIEW_PERIODS } from './reports/ReportUI';
import { overviewPeriodBounds, buildResultSeries } from '../utils/reportCalculations';

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
// fyllda gradientytor istället för vitt kort + liten ikon-chip. Vit text på
// dessa mörka gradienter ligger gott och väl över 4.5:1 i båda ändarna, så
// kontraster hålls.
//
// Kundfeedback ("intäkter ska vara blått som i analytics, samma med rött
// och grönt"): körde tidigare de STATISKA KPI_GRADIENTS-nyanserna
// (brandColors.js) rakt av här — alltid samma blå/röd/grön oavsett vad
// företaget faktiskt valt för graffärger (chart.roles). Ersatt av
// kpiGradIncome/kpiGradCost/kpiGradProfit/kpiGradLoss (se `chart`-memot
// ovan), som byggs från SAMMA CHART_COLOR_FAMILIES-familj som grafen
// använder — så korten alltid matchar stapeln/punkten de sitter ovanför,
// även efter ett bytt färgval. KPI_GRADIENTS (brandColors.js) lever kvar
// oförändrad för andra sidor (Reports.jsx m.fl.) som fortfarande vill ha
// den fasta paletten.

// Intäkter-vs-Utgifter-grafens färger kommer numera från paletten
// (utils/chartPalette.js, se `chart` i komponenten): förvalet är samma
// blå/röda par som tidigare — samma toner som Intäkter- och Kostnader-
// korten ovan, och det par som klarar CVD-kontrollen som det gamla
// gröna/röda inte gjorde (se kommentaren högst upp) — men företaget kan
// välja andra i rapporternas Utseende-meny, och då ska startsidan följa
// med. Annars visar de två sidorna samma två tal i olika färger, vilket
// var precis det problemet valen skulle lösa.

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
// (Jämförelseårets halvtransparenta varianter räknas fram i komponenten,
// eftersom grundfärgen numera kan komma från företagets eget val.)

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
function todoDismissedKey(companyId) { return `bokix_dashboard_todo_dismissed_${companyId || 'default'}`; }
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

/** Färgförklaring till den samlade grafen: intäkter, kostnader och resultat. Ligger inuti
 * ReportDisplayProvider så färgerna alltid är samma som grafens egna. */
function ChartKey({ variant }) {
  const { t } = useTranslation();
  const { palette } = useReportDisplay();
  return (
    <div className="dash-chart-key">
      <span><i className="dash-chart-key-dot" style={{ background: palette.income }} />{t('dashboard.kpi.income')}</span>
      <span><i className="dash-chart-key-dot" style={{ background: palette.cost, opacity: variant === 'bars' ? 0.45 : 1 }} />{t('dashboard.kpi.costs')}</span>
      <span><i className="dash-chart-key-line" style={{ background: palette.profit }} />{t('dashboard.kpi.result')}</span>
    </div>
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

// Snabbåtgärder — varje genväg får en egen tydlig färg istället för samma
// enfärgade gröna chip för alla fyra, så raden känns levande och man kan
// skilja knapparna åt med ett enda ögonkast.
// Kundfeedback ("starkare färger, inte AI-mall-känsla"): bytt från de bleka
// status-badge-tonerna (BRAND.*Bg/*Text, tänkta för diskreta märken) till
// VIVID — solida, mättade plattor med vit ikon (se brandColors.js).
// `staffOnly: true` visas bara för företag som FAKTISKT har personal.
// Kundönskemål: en enskild firma utan anställda ska inte mötas av
// lönefunktioner den aldrig kommer använda. Villkoret är verkliga
// anställda, inte vilket abonnemang som köpts — se kommentaren vid
// `hasStaff` i komponenten för varför.
const quickActionDefs = (t) => [
  { label: t('dashboard.quickActions.newInvoice'),     icon: QuickNewInvoiceIcon,   tab: 'invoices', bg: VIVID.green },
  { label: t('dashboard.quickActions.uploadReceipt'),  icon: QuickUploadReceiptIcon, tab: 'expenses', bg: VIVID.blue },
  { label: t('dashboard.quickActions.newContact'),     icon: QuickNewContactIcon,   tab: 'contacts', bg: VIVID.pink },
  { label: t('dashboard.quickActions.logTime'),        icon: QuickLogTimeIcon,      tab: 'projects', bg: VIVID.amber },
  { label: t('dashboard.quickActions.runPayroll'),     icon: QuickRunPayrollIcon,   tab: 'payroll',  bg: VIVID.red, staffOnly: true },
];

// Ordningen i Att göra idag: försenat först, sedan det som närmar sig, sist det som är mindre bråttom.
// Bara en sorteringsnyckel: raderna visas utan färg.
const SEV_RANK = { danger: 0, warning: 1, success: 2 };

/* ── KPI Card — med en liten stapel-sparklinje som visar riktning.
   `hero`: Sida 31 punkt 3 — sidans viktigaste enskilda tal (RÅ Resultat,
   den mest sammanfattande siffran) får en märkbart större typsnittsstorlek
   än de andra korten, så ögat har en tydlig startpunkt istället för
   identiskt vägda rutor. ── */
function KpiCard({ label, value, sub, icon: Icon, color, bg, positive, onClick, hero, gradient }) {
  const bold = !!gradient;
  return (
    // className:er (dash-kpi-*) finns bara så det trånga telefonläget
    // (@media (max-width: 640px) nedan) kan krympa padding/typsnitt med
    // !important — en inline style kan aldrig nås av en media query, se
    // samma resonemang som .form-row-stack (index.css). Färgerna/layouten
    // själva styrs fortfarande av de vanliga inline-stilarna här, oförändrat
    // på desktop.
    <button className="dash-kpi-card" onClick={onClick} style={{
      // Kundönskemål: korten ska vara EN solid, ren färg (blått/grönt/rött)
      // utan vitt inblandat — inte en lutning mot en ljusare/blekare ton.
      // `gradient[0]` (basfärgen) räcker; `gradient[1]` (den ljusare
      // "soft"-tonen) används inte längre här (kvar i grafens egna
      // serier/legend, bara kortets bakgrund gjordes platt).
      background: bold ? gradient[0] : 'var(--bg-card)',
      border: bold ? 'none' : (hero ? `1px solid ${color}33` : '1px solid var(--border)'),
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
      if (!bold) e.currentTarget.style.borderColor = color;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = '';
      e.currentTarget.style.boxShadow = bold ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)';
      if (!bold) e.currentTarget.style.borderColor = 'var(--border)';
    }}
    >
      {/* Kundönskemål: ingen vit glans-highlight längre — korten ska läsas
          som en ren, solid färgplatta, inte en yta med vitt ljusinfall. */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="dash-kpi-card-icon" style={{ background: bold ? 'rgba(0,0,0,0.16)' : bg, color: bold ? '#fff' : color, width: 36, height: 36, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'none' }}>
          <Icon size={16} />
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div className="dash-kpi-card-label" style={{ fontSize: '11px', fontWeight: 600, color: bold ? 'rgba(255,255,255,0.82)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</div>
        <div className="dash-kpi-card-value" style={{ fontSize: hero ? '32px' : '22px', fontWeight: 700, color: bold ? '#fff' : 'var(--text-main)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>{value}</div>
        {sub && <div className="dash-kpi-card-sub" style={{ fontSize: '11.5px', color: bold ? 'rgba(255,255,255,0.78)' : 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
      </div>
    </button>
  );
}

/* ── "Idag"-raden — en rad i listan Att göra idag. Ingen färg och inga ikoner: bara texten,
   en liten ring till vänster som avfärdar raden (som i Påminnelser) och en pil som visar att
   raden går att klicka på. Ordningen (viktigast först) styrs av todos-listan, inte av färg. ── */
function TodayRow({ item, onClick, onDismiss }) {
  const { t } = useTranslation();
  return (
    <li className="dash-today-row">
      <button type="button" className="dash-today-check" onClick={onDismiss} aria-label={t('dashboard.today.dismiss')} title={t('dashboard.today.dismiss')} />
      <button type="button" className="dash-today-btn" onClick={onClick}>
        <span className="dash-today-text">{item.text}</span>
        {item.tab && <ChevronRight size={16} className="dash-today-chevron" />}
      </button>
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

export default function Dashboard({ verifications, accounts = [], invoices, expenses, contacts, setActiveTab, company, user, vatPeriods = {}, payrollRuns = [], employees = [], onBulkImportSie }) {
  const { t } = useTranslation();
  const FORMAT_MODES = formatModes(t);
  // Har företaget personal? Avgörs på verkliga anställda och lönekörningar,
  // inte på vilket abonnemang som köpts. Nivån GÅR numera att läsa
  // (subscriptions.plan, se src/utils/plans.js) — men faktisk användning är
  // ändå det ärligare villkoret här: den som skaffar sin första anställd
  // får lönegenvägen samma dag, utan att först behöva byta abonnemang.
  const hasStaff = employees.length > 0 || payrollRuns.length > 0;
  const quickActions = quickActionDefs(t).filter(a => !a.staffOnly || hasStaff);
  // Företagets egna färg- och beloppsval (samma post som rapportsidan
  // sparar, company.reportDisplay). `useMemo` för att paletten annars
  // skulle byggas om vid varje omritning av startsidan.
  const { chart, amount } = useMemo(() => ({
    chart: resolveChartPalette(company?.reportDisplay?.colors),
    amount: makeAmountFormatters(company?.reportDisplay?.unit),
  }), [company?.reportDisplay?.colors, company?.reportDisplay?.unit]);
  const chartRevenue = chart.income;
  const chartExpense = chart.cost;
  // Kundfeedback ("intäkter ska vara blått som i analytics, samma med rött
  // och grönt"): NYCKELTAL-kortens gradient kom tidigare från de STATISKA
  // KPI_GRADIENTS-konstanterna (brandColors.js) — alltid blått/rött/grönt,
  // oavsett vad företaget faktiskt valt för graffärger här (chart.roles,
  // samma val som Rapport och analys → Visningsinställningar). Byter någon
  // sin Intäkter-färg där, syntes det bara i grafen — korten i samma kort,
  // direkt ovanför, fortsatte visa den gamla färgen. Bygger nu gradienten
  // från SAMMA familj/roll som grafen (CHART_COLOR_FAMILIES[chart.roles.x]),
  // base→soft, så de alltid är exakt samma färg som stapeln/punkten de
  // sitter ovanför — även efter ett bytt färgval.
  const kpiGradIncome = (() => { const f = CHART_COLOR_FAMILIES[chart.roles.income] || CHART_COLOR_FAMILIES.blue; return [f.base, f.soft]; })();
  const kpiGradCost = (() => { const f = CHART_COLOR_FAMILIES[chart.roles.cost] || CHART_COLOR_FAMILIES.red; return [f.base, f.soft]; })();
  const kpiGradProfit = (() => { const f = CHART_COLOR_FAMILIES[chart.roles.profit] || CHART_COLOR_FAMILIES.green; return [f.base, f.soft]; })();
  // "Förlust"-läget (Resultat < 0) ska ändå läsas som en varning oavsett
  // vald färgpreferens för "profit"-rollen — samma undantag grafens egna
  // Resultat-läge redan gör (se kommentaren vid CHART_MODES/Resultat-linjen
  // längre ner: "behåller det klassiska grönt/rött eftersom det är en enda
  // serie vars läge mot nollinjen bär betydelsen"). Alltid den röda
  // familjen då, aldrig den valda "profit"-färgen.
  const kpiGradLoss = [CHART_COLOR_FAMILIES.red.base, CHART_COLOR_FAMILIES.red.soft];
  const [chartFormat, setChartFormat] = useState('bars');
  // Kundönskemål: samma period-flikar som Rapport och analys →
  // Företagsöversikt (PeriodPicker/OVERVIEW_PERIODS, ReportUI.jsx). 'year'
  // som standard — samma förvalda vy widgeten alltid haft (hela
  // räkenskapsåret hittills), bara nu en av fem valbara istället för det
  // enda alternativet.
  const [periodId, setPeriodId] = useState('year');
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
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(rounded === 0 ? 0 : rounded);
  };
  const fmtShort = (val) => {
    const v = val || 0;
    if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}Mkr`;
    if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
    return String(Math.round(v));
  };
  // Har företaget uttryckligen valt tusental eller kronor gäller det valet
  // även här. I `auto`-läget behålls widgetens egen korta form ("160k",
  // "1,2Mkr") — den är byggd för en smal ruta på startsidan, inte för en
  // rapportsida med gott om axelutrymme.
  const explicitUnit = company?.reportDisplay?.unit && company.reportDisplay.unit !== 'auto';

  // NYCKELTAL-korten (Intäkter/Kostnader/Resultat) hade tidigare en egen,
  // lokal "hela innevarande kalenderår"-uträkning här — borttagen. De läser
  // nu periodOmsattning/periodKostnader/periodResultat (samma period-
  // medvetna totaler som grafen redan räknar ut, se den koden längre ner)
  // i stället, så de aldrig kan visa ett annat tidsspann än det PeriodPicker
  // faktiskt är satt till. Se kommentaren vid NYCKELTAL-blocket i JSX:en.

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

  // Röd: förfallet (passerat förfallodatum). Gul: kommande deadline inom en
  // snar tidsram (~7 dagar). Grön: mindre brådskande, men värt att veta om.
  // Kundönskemål: "om det inte finns något ska 'Att göra idag' inte visas
  // alls" — det fanns tidigare ALLTID minst en post (en syntetisk "Inget
  // kräver din uppmärksamhet idag"-rad nedan om listan annars var tom),
  // just för att ge kortet ett "belöningsläge" i stället för att försvinna.
  // Ingen sådan platshållare längre — en riktigt tom lista betyder nu en
  // riktigt dold sektion, se anropsstället (rendrar bara `todos.length >
  // 0`). `kind` är en stabil kategori-nyckel per möjlig rad (till skillnad
  // från `text`, som ändras med siffrorna) — dismissTodo/dismissedTodoKeys
  // (ovan) nycklar på kind+text TILLSAMMANS, så en avfärdad rad återkommer
  // automatiskt den dagen den faktiska texten (beloppet/antalet/datumet)
  // ändras, i stället för att vara tyst begravd för gott.
  const rawTodos = [];
  if (overdueInvoices.length > 0) {
    rawTodos.push({
      kind: 'overdue_invoices', sev: 'danger', icon: AlertCircle, tab: 'invoices', daysLeft: -mostOverdueDays,
      text: overdueInvoices.length === 1
        ? (mostOverdueDays <= 1
          ? t('dashboard.todos.overdueInvoiceYesterday', { amount: fmt(overdueAmount) })
          : t('dashboard.todos.overdueInvoiceDaysAgo', { days: mostOverdueDays, amount: fmt(overdueAmount) }))
        : t('dashboard.todos.overdueInvoicesPlural', { count: overdueInvoices.length, amount: fmt(overdueAmount) }),
    });
  }
  if (vatDeadline) {
    if (vatDeadline.daysLeft < 0) {
      rawTodos.push({ kind: 'vat_deadline', sev: 'danger', icon: AlertCircle, text: t('dashboard.todos.vatOverdueQuarter', { quarter: vatDeadline.quarter }), tab: 'taxes', daysLeft: vatDeadline.daysLeft });
    } else if (vatDeadline.daysLeft <= 7) {
      const when = vatDeadline.daysLeft === 0 ? t('dashboard.todos.whenToday') : vatDeadline.daysLeft === 1 ? t('dashboard.todos.whenTomorrow') : t('dashboard.todos.whenInDays', { days: vatDeadline.daysLeft });
      rawTodos.push({ kind: 'vat_deadline', sev: 'warning', icon: Clock, text: t('dashboard.todos.vatDueWhen', { when }), tab: 'taxes', daysLeft: vatDeadline.daysLeft });
    }
  }
  if (pendingPayrollRuns.length > 0) {
    rawTodos.push({
      kind: 'payroll_pending', sev: 'warning', icon: Users, tab: 'payroll',
      text: pendingPayrollRuns.length === 1
        ? t('dashboard.todos.payrollPendingSingle', { period: pendingPayrollRuns[0].period || '' })
        : t('dashboard.todos.payrollPendingMultiple', { count: pendingPayrollRuns.length }),
    });
  }
  if (unhandledReceipts.length > 0) {
    rawTodos.push({
      kind: 'unhandled_receipts', sev: 'success', icon: Receipt, tab: 'expenses',
      text: unhandledReceipts.length === 1
        ? t('dashboard.todos.receiptsWaitingSingle')
        : t('dashboard.todos.receiptsWaitingPlural', { count: unhandledReceipts.length }),
    });
  }
  if (draftInvoices.length > 0) {
    rawTodos.push({ kind: 'draft_invoices', sev: 'success', icon: FileText, tab: 'invoices', text: t('dashboard.todos.draftInvoicesWaiting', { count: draftInvoices.length }) });
  }
  // Allvarsgrad först (försenat före kommande), men DÄRINOM det som har
  // minst tid kvar. Utan `daysLeft` som andrahandsnyckel avgjorde
  // insättningsordningen i koden vad som stod överst, vilket inte har
  // något med hur bråttom det är att göra.
  rawTodos.sort((a, b) => {
    const bySeverity = SEV_RANK[a.sev] - SEV_RANK[b.sev];
    if (bySeverity !== 0) return bySeverity;
    const aDays = a.daysLeft ?? Number.POSITIVE_INFINITY;
    const bDays = b.daysLeft ?? Number.POSITIVE_INFINITY;
    return aDays - bDays;
  });

  const todos = rawTodos
    .map(t => ({ ...t, dismissKey: `${t.kind}::${t.text}` }))
    .filter(t => !dismissedTodoKeys.has(t.dismissKey));

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysOverdue = (dueDate) => {
      if (!dueDate) return 0;
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      return Math.max(0, Math.round((today - due) / 86400000));
    };

    const unpaidInvoices = (invoices || []).filter(i => i.status === 'sent');
    // Delbetalda fakturor räknas på det som ÅTERSTÅR, inte på hela
    // beloppet — annars säger rutan att man har mer att få in än man har.
    const receivable = unpaidInvoices.reduce((sum, i) => sum + Math.max(0, invoiceGross(i) - (i.paidAmount || 0)), 0);
    const overdueIn = unpaidInvoices.filter(i => daysOverdue(i.dueDate) > 0);
    const oldestOverdue = overdueIn.reduce((max, i) => Math.max(max, daysOverdue(i.dueDate)), 0);

    // Leverantörsfakturor ligger bland utgifterna med type
    // 'supplier_invoice' och en egen status (se SupplierInvoices.jsx) —
    // inte i en egen lista.
    const unpaidSupplier = (expenses || []).filter(e => e.type === 'supplier_invoice' && e.status !== 'paid');
    const payable = unpaidSupplier.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const overdueOut = unpaidSupplier.filter(e => daysOverdue(e.dueDate) > 0);

    return {
      receivable, payable,
      inCount: unpaidInvoices.length, outCount: unpaidSupplier.length,
      overdueInCount: overdueIn.length, overdueOutCount: overdueOut.length,
      oldestOverdue,
      net: receivable - payable,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, expenses]);
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
  // `comparisonLabel` ersätter den tidigare inbakade årtalstexten
  // ("Intäkter 2025") i legender/tabellrubrik — flikarnas fönster kan nu
  // spänna över ett årsskifte (t.ex. "6 mån" i februari täcker både
  // föregående och innevarande kalenderår), så ett enda hårdkodat årtal
  // vore periodvis felaktigt. En generisk "föregående år" stämmer alltid,
  // eftersom jämförelseperioden (prevStart/prevEnd) alltid är EXAKT ett år
  // tidigare oavsett flik.
  const comparisonLabel = 'föregående år';
  // Ren visningstext, ALDRIG använd för att bygga nyckeln i
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
    () => overviewPeriodBounds(periodId, { fiscalYearStart: company?.fiscalYear, verifications }),
    [periodId, company?.fiscalYear, verifications],
  );
  const chartData = useMemo(() => {
    const { start, end, prevStart, prevEnd, granularity, hasComparison } = periodBounds;
    const series = buildResultSeries(verifications, accounts, start, end, granularity);
    const prevSeries = hasComparison ? buildResultSeries(verifications, accounts, prevStart, prevEnd, granularity) : [];
    return series.map((m, i) => {
      const prev = prevSeries[i];
      return {
        name: m.label, Intäkter: m.intakt, Utgifter: m.kostnad, Resultat: m.intakt - m.kostnad,
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
  const prevYearResultatTotal = chartData.reduce((sum, d) => sum + d.PrevResultat, 0);
  // Grafens EGNA totaler för den valda perioden — INTE raOmsattning/
  // raKostnader/raResultat (NYCKELTAL-korten ovan, alltid innevarande
  // KALENDERÅR, ett separat och medvetet oförändrat mått). Grafens legend/
  // rubrik måste stämma med vad grafen faktiskt visar, annars läser en
  // besökare på "Denna månad" en legend som fortfarande påstår hela
  // kalenderårets summa.
  const periodOmsattning = chartData.reduce((sum, d) => sum + d.Intäkter, 0);
  const periodKostnader = chartData.reduce((sum, d) => sum + d.Utgifter, 0);
  const periodResultat = periodOmsattning - periodKostnader;

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
  const isPhone = useIsPhone();
  // Fönstrets höjd på dator: diagrammet får plats på en laptop utan att man måste skrolla förbi det.
  const [viewH, setViewH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 900));
  useEffect(() => {
    const onResize = () => setViewH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Diagrammet är högre på telefon än förut: startsidan skrollas i stället för att pressas ihop.
  // Utestående visas bara när det finns obetalda fakturor åt något håll.
  const hasOutstanding = outstanding.inCount > 0 || outstanding.outCount > 0;
  const chartH = !isPhone ? Math.max(170, Math.min(340, Math.round(viewH * (viewH < 800 ? 0.28 : 0.34)))) : 240;

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
      <div className="dash-greeting" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', padding: '0 12px' }}>
        {/* Bugkritiskt: display:flex på ett <h1> som bara innehåller löpande
            text (namn + emoji) bröt radbrytningen på smala/halva skärmar —
            "Good evening" och ", Abdullah 👋" hamnade på separata rader på
            konstiga ställen istället för att radbryta som en sammanhängande
            mening. En vanlig textrad (ingen flex, bara textAlign:center)
            radbryter normalt om den någonsin behöver, och clamp() gör att
            den sällan ens behöver det — storleken krymper mjukt med
            fönsterbredden istället för en fast 44px oavsett skärm. */}
        <h1 style={{ fontFamily: 'var(--font-voice)', fontWeight: 700, fontSize: 'clamp(24px, min(6vw, 4vh), 44px)', letterSpacing: '-0.01em', color: 'var(--text-main)', textAlign: 'center', margin: 0, maxWidth: '100%' }}>
          {greeting}, {firstName || t('dashboard.greetingFallbackName')} 👋
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
      <div className="dash-quick" style={{ marginBottom: '18px' }}>
        <div className="dash-quick-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{t('dashboard.quickActions.title')}</span>
        </div>
        {/* Kolumnantalet följer hur många genvägar som faktiskt visas (fyra
            utan personal, fem med) — ett fast fyrkolumnsrutnät hade lämnat
            den femte ensam på en egen rad. */}
        <div className="dash-quick-actions" data-count={quickActions.length} style={{ display: 'grid', gridTemplateColumns: `repeat(${quickActions.length},1fr)`, gap: '10px' }}>
          {quickActions.map(a => (
            <button
              key={a.label}
              className="dash-quick-btn"
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
              <div className="dash-quick-ico" style={{ width: 32, height: 32, borderRadius: '9px', background: a.bg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 6px ${a.bg}4d` }}>
                <a.icon size={20} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

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
      <div className={`dash-body${isNew || (todos.length === 0 && !hasOutstanding) ? ' dash-body--solo' : (todos.length > 0 ? '' : ' dash-body--no-todo')}`}>
      {!isNew && todos.length > 0 && (
        <section className="dash-todo-card" aria-label={t('dashboard.today.title')}>
          <div className="dash-todo-head">
            <h2 className="dash-todo-title">{t('dashboard.today.title')}</h2>
            <span className="dash-todo-count">{todos.length}</span>
          </div>
          <ul className="dash-todo-list">
            {todos.map(todo => (
              <TodayRow key={todo.dismissKey} item={todo} onClick={() => todo.tab && setActiveTab(todo.tab)} onDismiss={() => dismissTodo(todo.dismissKey)} />
            ))}
          </ul>
        </section>
      )}

      {/* ─── GRAF — full bredd. Var tidigare en svag cremeton (Sida 31/32) för
          att skilja den från de vita KPI-korten ovanför — kundfeedback: lästes
          bara som "lite beige", bytt till samma kortvita som resten av sidan.
          Syns alltid (inte bara `!isNew`) — men visar en lugn tomt-läge-vy
          istället för en platt nollstapel-graf tills det finns något att
          rita ut. ─── */}
      <div className="dash-chart-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', marginBottom: '18px', minWidth: 0 }}>
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
          <PeriodPicker value={periodId} onChange={setPeriodId} options={OVERVIEW_PERIODS} />
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
        <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '24px' }}>
          <KpiCard
            label={t('dashboard.kpi.income')} value={fmt(periodOmsattning)}
            icon={ArrowUpRight} color={BRAND.greenDark} bg={LIME_L} positive={true}
            onClick={() => setActiveTab('reports')}
            gradient={kpiGradIncome}
          />
          <KpiCard
            label={t('dashboard.kpi.costs')} value={fmt(periodKostnader)}
            icon={ArrowDownRight} color={BRAND.redText} bg={RED_L} positive={false}
            onClick={() => setActiveTab('expenses')}
            gradient={kpiGradCost}
          />
          <KpiCard
            label={t('dashboard.kpi.result')} value={fmt(periodResultat)}
            icon={periodResultat >= 0 ? TrendingUp : TrendingDown}
            color={periodResultat >= 0 ? BRAND.greenDark : BRAND.redText}
            bg={periodResultat >= 0 ? LIME_L : RED_L}
            positive={periodResultat >= 0}
            onClick={() => setActiveTab('reports')}
            gradient={periodResultat >= 0 ? kpiGradProfit : kpiGradLoss}
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
          <ReportDisplayProvider colors={company?.reportDisplay?.colors} unit={company?.reportDisplay?.unit}>
            <ChartKey variant={chartFormat} />
            <RevenueExpenseChart
              data={combinedChartData}
              indexKey="name"
              variant={chartFormat === 'bars' ? 'combo' : chartFormat}
              height={chartH}
              isMobile={isPhone}
              extraSeries={chartFormat === 'bars' ? [] : [{ label: 'Resultat', color: chart.profit, dashed: false }]}
            />
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-light)', flex: 1 }}>
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
                  tone: chartExpense, tab: 'expenses', hint: t('dashboard.outstanding.toPayHint'),
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
              <span style={{ fontSize: '15px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: outstanding.net >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
                {fmt(outstanding.net)}
              </span>
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
      {isNew && !sieImportDismissed && (
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
          onImport={(newVerifications, newAccounts, sourceTag) => onBulkImportSie?.(newVerifications, newAccounts, sourceTag)}
          onClose={() => setShowSieImportModal(false)}
        />
      )}
    </div>
  );
}
