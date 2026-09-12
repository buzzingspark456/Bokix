import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  FileText, Receipt, TrendingUp, TrendingDown,
  ChevronRight, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Minus, BarChart2,
  UserPlus, Users, Clock, AlertCircle, X, MessageSquare, ClipboardCheck, Upload,
  // Aliasat — 'LineChart' krockar annars med recharts-komponenten med
  // samma namn som redan importeras nedan (två helt olika saker: en ikon
  // kontra en diagramkomponent).
  LineChart as LineChartIcon, AreaChart as AreaChartIcon, Table2, Layers,
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
import SieImportModal from './SieImportModal';
import { BRAND, VIVID } from '../utils/brandColors';
import { resolveChartPalette, makeAmountFormatters, CHART_COLOR_FAMILIES } from '../utils/chartPalette';
import { RevenueExpenseChart, ReportDisplayProvider } from './reports/ReportUI';
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

// Tre sätt att läsa samma period. "Översikt" står först — den samlade
// bilden före de två avgränsade frågorna den är byggd av (hur mycket kom
// in och gick ut, respektive vad blev kvar) — så den som vill se sambandet
// mellan dem inte tvingades växla fram och tillbaka och hålla den ena
// kurvan i huvudet.
const CHART_MODES = [
  { id: 'all',             label: 'Översikt',              icon: Layers },
  { id: 'revenue-expense', label: 'Intäkter vs Utgifter', icon: BarChart2 },
  { id: 'result',          label: 'Resultat',              icon: Minus },
];

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
const FORMAT_MODES = [
  { id: 'bars',  label: 'Staplar', icon: BarChart2 },
  { id: 'line',  label: 'Linje',   icon: LineChartIcon },
  { id: 'area',  label: 'Yta',     icon: AreaChartIcon },
  { id: 'table', label: 'Tabell',  icon: Table2 },
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

/** Tabellformatet — samma rader (dag eller månad, beroende på vald
 * period-flik, se PeriodPicker/overviewPeriodBounds) som graferna, som en
 * riktig `<table>` istället för streck/staplar. Kolumnerna anpassar sig
 * efter chartMode så tabellen aldrig visar en tom "Utgifter"-kolumn i
 * Resultat-läget. */
function ChartDataTable({ data, mode, fmt, hasPrevYearData, comparisonLabel }) {
  // 'all' visar samma kolumner som Intäkter vs Utgifter plus resultatet —
  // resultatkolumnen finns redan alltid, så det räcker att öppna de två
  // första för det nya läget.
  const showRevExp = mode === 'revenue-expense' || mode === 'all';
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Period</th>
            {showRevExp && <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Intäkter</th>}
            {showRevExp && <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Utgifter</th>}
            <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Resultat</th>
            {hasPrevYearData && <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Resultat {comparisonLabel}</th>}
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
// `staffOnly: true` visas bara för företag som FAKTISKT har personal.
// Kundönskemål: en enskild firma utan anställda ska inte mötas av
// lönefunktioner den aldrig kommer använda. Villkoret är verkliga
// anställda, inte vilket abonnemang som köpts — se kommentaren vid
// `hasStaff` i komponenten för varför.
const QUICK_ACTIONS = [
  { label: 'Ny faktura',       icon: FileText, tab: 'invoices', bg: VIVID.green },
  { label: 'Ladda upp kvitto', icon: Receipt,  tab: 'expenses', bg: VIVID.blue },
  { label: 'Ny kontakt',       icon: UserPlus, tab: 'contacts', bg: VIVID.pink },
  { label: 'Rapportera tid',   icon: Clock,    tab: 'projects', bg: VIVID.amber },
  { label: 'Kör lön',          icon: Users,    tab: 'payroll',  bg: VIVID.red, staffOnly: true },
];

// Röd/gul/grön — samma BRAND-tokens som statusar i övriga listor i appen
// (Bokförd/Granska/Förfallen) för radens BAKGRUND (bg, diskret tint), men en
// solid VIVID-platta för ikon-chippen (icon) — se QUICK_ACTIONS-kommentaren.
const SEV = {
  danger:  { bg: BRAND.redBg,    text: BRAND.redText,   icon: VIVID.red,   rank: 0 },
  warning: { bg: BRAND.amberBg,  text: BRAND.amberText, icon: VIVID.amber, rank: 1 },
  success: { bg: BRAND.greenLight, text: BRAND.greenDark, icon: VIVID.green, rank: 2 },
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
    // className:er (dash-kpi-*) finns bara så det trånga telefonläget
    // (@media (max-width: 640px) nedan) kan krympa padding/typsnitt med
    // !important — en inline style kan aldrig nås av en media query, se
    // samma resonemang som .form-row-stack (index.css). Färgerna/layouten
    // själva styrs fortfarande av de vanliga inline-stilarna här, oförändrat
    // på desktop.
    <button className="dash-kpi-card" onClick={onClick} style={{
      background: bold ? `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` : 'var(--bg-card)',
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
      {/* Kundfeedback ("färgen mycket bättre"): de tre gradientkorten
          (Intäkter/Kostnader/Resultat) var en platt tvåfärgs-lutning utan
          djup — samma diskreta glans-highlight som "Att göra idag"-kortet
          redan använder (VIVID.green-glöden där), fast vit och i hörnet,
          så gradienten känns som en riktig yta med ljusinfall i stället för
          en tvådimensionell färgplatta. */}
      {bold && (
        <div aria-hidden="true" style={{ position: 'absolute', top: '-40px', right: '-30px', width: '130px', height: '130px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%)', pointerEvents: 'none' }} />
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="dash-kpi-card-icon" style={{ background: bold ? 'rgba(255,255,255,0.24)' : bg, color: bold ? '#fff' : color, width: 36, height: 36, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: bold ? 'inset 0 0 0 1px rgba(255,255,255,0.3)' : 'none' }}>
          <Icon size={16} />
        </div>
        {positive != null && (
          <div style={{ color: bold ? 'rgba(255,255,255,0.9)' : (positive ? BRAND.greenDark : BRAND.redText), fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
            {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <div className="dash-kpi-card-label" style={{ fontSize: '11px', fontWeight: 600, color: bold ? 'rgba(255,255,255,0.82)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</div>
        <div className="dash-kpi-card-value" style={{ fontSize: hero ? '32px' : '22px', fontWeight: 700, color: bold ? '#fff' : 'var(--text-main)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>{value}</div>
        {sub && <div className="dash-kpi-card-sub" style={{ fontSize: '11.5px', color: bold ? 'rgba(255,255,255,0.78)' : 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
      </div>
    </button>
  );
}

/* ── "Idag"-raden — konkreta, klickbara händelser. Röd > gul > grön styr
   ordningen, aldrig kronologi. Hela sektionen döljs numera i stället om
   listan är tom (se anropsstället, kundönskemål) — den här komponenten
   renderas alltså bara när det faktiskt finns något att visa. Varje rad
   har både en klickbar del (navigerar, riktig hover: lyft + skugga, samma
   språk som Snabbåtgärder-korten ovanför) och en fristående X-knapp
   (onDismiss) — kundönskemål: man ska kunna ignorera en rad utan att
   känna sig tvingad att agera på den. ── */
function TodayRow({ item, onClick, onDismiss }) {
  const c = SEV[item.sev] || SEV.warning;
  const Icon = item.icon;
  return (
    <div
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: '11px', width: '100%',
        background: c.bg, borderRadius: '11px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: '11px', flex: 1, minWidth: 0,
          padding: '12px 14px', background: 'none', border: 'none',
          borderRadius: '11px', cursor: 'pointer',
          textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <div style={{ width: 28, height: 28, borderRadius: '8px', background: c.icon, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 5px ${c.icon}55` }}>
          <Icon size={14} />
        </div>
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: c.text, lineHeight: 1.35 }}>{item.text}</span>
        {item.tab && <ChevronRight size={14} style={{ color: c.text, opacity: 0.6, flexShrink: 0 }} />}
      </button>
      {/* Kundönskemål: "de kan ignorera det, de behöver inte följa
          allihopa" — en rad man inte tänker agera på ska gå att stänga av
          utan att behöva klicka in på den (och därmed navigera bort).
          stopPropagation krävs inte här (egen knapp bredvid, inte inuti,
          radens klickbara knapp) men onDismiss anropas ändå oberoende av
          onClick ovan — två separata knappar, inte en overlay. */}
      <button
        onClick={onDismiss}
        aria-label="Ignorera"
        title="Ignorera"
        style={{
          flexShrink: 0, width: 24, height: 24, marginRight: '10px', borderRadius: '7px',
          border: 'none', background: 'transparent', color: c.text, opacity: 0.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          transition: 'opacity 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'transparent'; }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function Dashboard({ verifications, accounts = [], invoices, expenses, contacts, setActiveTab, company, user, vatPeriods = {}, payrollRuns = [], employees = [], onBulkImportSie }) {
  // Har företaget personal? Avgörs på verkliga anställda och lönekörningar,
  // inte på vilket abonnemang som köpts. Nivån GÅR numera att läsa
  // (subscriptions.plan, se src/utils/plans.js) — men faktisk användning är
  // ändå det ärligare villkoret här: den som skaffar sin första anställd
  // får lönegenvägen samma dag, utan att först behöva byta abonnemang.
  const hasStaff = employees.length > 0 || payrollRuns.length > 0;
  const quickActions = QUICK_ACTIONS.filter(a => !a.staffOnly || hasStaff);
  const [chartMode, setChartMode] = useState('revenue-expense');
  // Företagets egna färg- och beloppsval (samma post som rapportsidan
  // sparar, company.reportDisplay). `useMemo` för att paletten annars
  // skulle byggas om vid varje omritning av startsidan.
  const { chart, amount } = useMemo(() => ({
    chart: resolveChartPalette(company?.reportDisplay?.colors),
    amount: makeAmountFormatters(company?.reportDisplay?.unit),
  }), [company?.reportDisplay?.colors, company?.reportDisplay?.unit]);
  const chartRevenue = chart.income;
  const chartExpense = chart.cost;
  const chartRevenuePrev = hexToRgba(chartRevenue, 0.55);
  const chartExpensePrev = hexToRgba(chartExpense, 0.55);
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
  // Kundfeedback: linjestil-väljaren (Slät/Rak/Trappa) bort helt — alltid
  // den släta (monotone) kurvan, samma som var förvalt innan.
  const curveType = 'monotone';

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
  const axisTick = explicitUnit ? amount.axis : fmtShort;
  const axisWidth = explicitUnit ? amount.axisWidth : 52;

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

  // ── Moms-kortet — utgående/ingående moms bokförd inom den kommande
  // (ännu inte inlämnade) perioden. Räknas fram riktigt från bokförda
  // verifikationsrader, aldrig uppskattat — samma princip som resten av
  // sidan.
  //
  // Kundfeedback ("på Startsidan visar Moms-kortet ingenting"): kortet
  // byggde tidigare BARA på vatDeadline, som `nextVatDeadline` (declaration-
  // Deadlines.js) medvetet returnerar null för — dess kommentar säger rakt
  // ut "det enda flödet som faktiskt är implementerat är kvartalsvis".
  // Alla företag med Inställningar → company.vatPeriod satt till 'monthly'
  // eller 'yearly' fick alltså ALLTID det tomma "Ingen kommande moms-
  // deklaration"-läget, oavsett hur mycket moms som faktiskt var bokfört.
  // Fixet räknar nu fram RIKTIGA summor för samtliga tre perioder (innevarande
  // månad/kvartal/år) — men visar bara ett exakt förfallodatum för kvartals-
  // vis (den enda perioden vars Skatteverket-regel är verifierad, se
  // declarationDeadlines.js), aldrig ett gissat datum för månads-/årsvis.
  const vatPeriodSummary = useMemo(() => {
    const period = company?.vatPeriod || 'quarterly';
    const today = new Date();
    let start, end, label, dueDateLabel = null;
    if (period === 'quarterly') {
      if (!vatDeadline) return null;
      [start, end] = quarterToRange(vatDeadline.year, vatDeadline.quarter);
      label = `Q${vatDeadline.quarter} ${vatDeadline.year}`;
      dueDateLabel = formatISODate(vatDeadline.dueDate);
    } else if (period === 'monthly') {
      const y = today.getFullYear(), m = today.getMonth();
      start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      end = new Date(y, m + 1, 0).toISOString().split('T')[0];
      label = today.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    } else { // 'yearly'
      const y = today.getFullYear();
      start = `${y}-01-01`; end = `${y}-12-31`;
      label = String(y);
    }
    let utgaende = 0, ingaende = 0;
    verifications.forEach(v => {
      if ((v.status || 'booked') === 'draft') return;
      if (v.date < start || v.date > end) return;
      v.rows.forEach(r => {
        if (['2611', '2612', '2613'].includes(r.account)) utgaende += (getKredit(r) - getDebet(r));
        else if (r.account === '2641') ingaende += (getDebet(r) - getKredit(r));
      });
    });
    return { label, utgaende, ingaende, attBetala: utgaende - ingaende, dueDateLabel };
  }, [vatDeadline, verifications, company?.vatPeriod]);

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
    const whenText = overdueInvoices.length === 1
      ? (mostOverdueDays <= 1 ? 'förföll igår' : `förföll för ${mostOverdueDays} dagar sedan`)
      : 'har förfallit';
    rawTodos.push({
      kind: 'overdue_invoices', sev: 'danger', icon: AlertCircle, tab: 'invoices', daysLeft: -mostOverdueDays,
      text: overdueInvoices.length === 1
        ? `1 faktura ${whenText} — ${fmt(overdueAmount)}`
        : `${overdueInvoices.length} fakturor ${whenText} — ${fmt(overdueAmount)} totalt`,
    });
  }
  if (vatDeadline) {
    if (vatDeadline.daysLeft < 0) {
      rawTodos.push({ kind: 'vat_deadline', sev: 'danger', icon: AlertCircle, text: `Momsdeklaration för kvartal ${vatDeadline.quarter} är försenad`, tab: 'taxes', daysLeft: vatDeadline.daysLeft });
    } else if (vatDeadline.daysLeft <= 7) {
      const when = vatDeadline.daysLeft === 0 ? 'idag' : vatDeadline.daysLeft === 1 ? 'imorgon' : `om ${vatDeadline.daysLeft} dagar`;
      rawTodos.push({ kind: 'vat_deadline', sev: 'warning', icon: Clock, text: `Momsdeklaration ska lämnas ${when}`, tab: 'taxes', daysLeft: vatDeadline.daysLeft });
    }
  }
  if (pendingPayrollRuns.length > 0) {
    rawTodos.push({
      kind: 'payroll_pending', sev: 'warning', icon: Users, tab: 'payroll',
      text: pendingPayrollRuns.length === 1
        ? `Lönekörning ${pendingPayrollRuns[0].period || ''} väntar på godkännande`
        : `${pendingPayrollRuns.length} lönekörningar väntar på godkännande`,
    });
  }
  if (unhandledReceipts.length > 0) {
    rawTodos.push({ kind: 'unhandled_receipts', sev: 'success', icon: Receipt, tab: 'expenses', text: `${unhandledReceipts.length} kvitto${unhandledReceipts.length > 1 ? 'n' : ''} väntar på granskning` });
  }
  if (draftInvoices.length > 0) {
    rawTodos.push({ kind: 'draft_invoices', sev: 'success', icon: FileText, tab: 'invoices', text: `${draftInvoices.length} fakturautkast väntar` });
  }
  // Allvarsgrad först (försenat före kommande), men DÄRINOM det som har
  // minst tid kvar. Utan `daysLeft` som andrahandsnyckel avgjorde
  // insättningsordningen i koden vad som stod överst, vilket inte har
  // något med hur bråttom det är att göra.
  rawTodos.sort((a, b) => {
    const bySeverity = SEV[a.sev].rank - SEV[b.sev].rank;
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

  const comparisonChartData = useMemo(() => chartData.map(row => ({
    ...row,
    [`Intäkter ${comparisonLabel}`]: row.PrevIntäkter,
    [`Utgifter ${comparisonLabel}`]: row.PrevUtgifter,
  })), [chartData, comparisonLabel]);
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
          /* Kundfeedback ("på telefonen ska de ligga bredvid varandra som
             på datorn, inte under"): stod tidigare på 1fr här — tre kort
             staplade rakt under varandra i stället för sida vid sida.
             Behåller nu tre kolumner på alla bredder, bara tätare
             (padding/typsnitt/ikon krympta via dash-kpi-card-* nedan) så de
             faktiskt får plats utan att klämmas eller radbryta konstigt. */
          .dash-kpi-grid { gap: 8px !important; }
          .dash-kpi-card { padding: 12px 10px !important; gap: 8px !important; }
          .dash-kpi-card-icon { width: 26px !important; height: 26px !important; }
          .dash-kpi-card-icon svg { width: 13px !important; height: 13px !important; }
          .dash-kpi-card-label { font-size: 9.5px !important; margin-bottom: 3px !important; }
          .dash-kpi-card-value { font-size: 14.5px !important; }
          .dash-kpi-card-sub { font-size: 10px !important; }
          .dash-quick-actions { grid-template-columns: repeat(2,1fr) !important; }
          /* Kundfeedback: "på telefonen är det tomt bredvid Kör lön". Med
             personal visas FEM genvägar, och den femte hamnade ensam på
             sista raden med en lika stor tom ruta bredvid sig. En udda
             sista genväg får därför spänna över båda kolumnerna i stället
             — ingen tom halva, och knappen blir samtidigt en större
             träffyta. */
          .dash-quick-actions > :last-child:nth-child(odd) { grid-column: 1 / -1; }
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
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Snabbåtgärder</span>
        </div>
        {/* Kolumnantalet följer hur många genvägar som faktiskt visas (fyra
            utan personal, fem med) — ett fast fyrkolumnsrutnät hade lämnat
            den femte ensam på en egen rad. */}
        <div className="dash-quick-actions" style={{ display: 'grid', gridTemplateColumns: `repeat(${quickActions.length},1fr)`, gap: '10px' }}>
          {quickActions.map(a => (
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
          Kundönskemål ("ska inte visas om de inte har något, och de kan
          ignorera det de inte vill följa"): kortet visade tidigare ALLTID
          något (en syntetisk "Allt klart"-rad om listan annars var tom) —
          bytt mot att kortet helt enkelt inte finns i DOM:en alls när
          `todos` är tom (se todos-uppbyggnaden ovan, ingen platshållare
          längre), och varje rad går nu att avfärda för sig (TodayRow:s
          nya X-knapp → dismissTodo) i stället för att vara en obligatorisk
          lista man måste beta av. ─── */}
      {!isNew && todos.length > 0 && (
        // Kundfeedback: cremetonen (var(--bg-cream), Sida 31s "bryt upp en
        // helvit sida"-princip) lästes bara som "lite beige/smutsig", inte
        // som en avsiktlig accent — ren kortvit (var(--bg-card), samma som
        // resten av sidans kort) istället.
        <div style={{ position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '10px', background: VIVID.blue, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 3px 8px ${VIVID.blue}55` }}>
                <ClipboardCheck size={17} />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Att göra idag</span>
            </div>
            <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 11px', borderRadius: '999px', background: 'var(--bg-muted)', color: 'var(--text-main)' }}>
              {todos.length} {todos.length === 1 ? 'post' : 'poster'}
            </span>
          </div>

          <div className="dash-todo-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: todos.length > 1 ? 'repeat(2,1fr)' : '1fr', gap: '8px' }}>
            {todos.map(t => (
              <TodayRow key={t.dismissKey} item={t} onClick={() => t.tab && setActiveTab(t.tab)} onDismiss={() => dismissTodo(t.dismissKey)} />
            ))}
          </div>
        </div>
      )}

      {/* ─── GRAF — full bredd. Var tidigare en svag cremeton (Sida 31/32) för
          att skilja den från de vita KPI-korten ovanför — kundfeedback: lästes
          bara som "lite beige", bytt till samma kortvita som resten av sidan.
          Syns alltid (inte bara `!isNew`) — men visar en lugn tomt-läge-vy
          istället för en platt nollstapel-graf tills det finns något att
          rita ut. ─── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', marginBottom: '18px', minWidth: 0 }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
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
            label="Intäkter" value={fmt(periodOmsattning)} sub={periodBounds.label}
            icon={ArrowUpRight} color={BRAND.greenDark} bg={LIME_L} positive={true}
            onClick={() => setActiveTab('reports')}
            gradient={kpiGradIncome}
          />
          <KpiCard
            label="Kostnader" value={fmt(periodKostnader)} sub={periodBounds.label}
            icon={ArrowDownRight} color={BRAND.redText} bg={RED_L} positive={false}
            onClick={() => setActiveTab('expenses')}
            gradient={kpiGradCost}
          />
          <KpiCard
            label="Resultat" value={fmt(periodResultat)}
            sub={periodBounds.label}
            icon={periodResultat >= 0 ? TrendingUp : TrendingDown}
            color={periodResultat >= 0 ? BRAND.greenDark : BRAND.redText}
            bg={periodResultat >= 0 ? LIME_L : RED_L}
            positive={periodResultat >= 0}
            onClick={() => setActiveTab('reports')}
            gradient={periodResultat >= 0 ? kpiGradProfit : kpiGradLoss}
          />
        </div>

        {/* Chart header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em', marginBottom: '4px' }}>
              {CHART_MODES.find(m => m.id === chartMode)?.label}
            </h2>
            {/* Kort — INTE periodetiketten igen (PeriodHeading ovan visar
                redan etikett + datum en gång) — bara jämförelsenoten, och
                bara när den FAKTISKT stämmer (hasPrevYearData). */}
            {hasPrevYearData && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Jämfört med samma period {comparisonLabel}.
              </p>
            )}
            {/* Legenden uppdateras dynamiskt beroende på vald flik — aldrig
                statisk text som bara passar första vyn. Intäkter/Utgifter-
                läget använder chartRevenue/chartExpense (blå/rosa) i både
                punkt och text — samma toner som KPI-korten ovan och ett
                CVD-säkert par (se konstant-kommentaren). Resultat-läget
                behåller det klassiska grönt/rött eftersom det är en enda
                serie vars läge mot nollinjen (inte färgen) bär betydelsen.
                Föregående års siffror (när de finns) läggs till som en egen,
                dämpad/streckad post — samma "form, inte färg, bär den andra
                dimensionen"-princip som graferna längre ner använder. */}
            {chartMode === 'revenue-expense' && (
              <div style={{ display: 'flex', gap: '18px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: chartRevenue, fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: chartRevenue, display: 'inline-block' }} />
                  Intäkter {fmt(periodOmsattning)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: chartExpense, fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: chartExpense, display: 'inline-block' }} />
                  Utgifter {fmt(periodKostnader)}
                </span>
                {hasPrevYearData && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {legendSwatch(chartRevenuePrev, true)}{legendSwatch(chartExpensePrev, true)}
                    Föregående år
                  </span>
                )}
              </div>
            )}
            {chartMode === 'result' && (
              <div style={{ display: 'flex', gap: '18px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: periodResultat >= 0 ? BRAND.greenDark : BRAND.redText }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: periodResultat >= 0 ? REVENUE : EXPENSE, display: 'inline-block' }} />
                  Resultat {fmt(periodResultat)}
                </span>
                {hasPrevYearData && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {legendSwatch('var(--text-muted)', true)}
                    Resultat {comparisonLabel} {fmt(prevYearResultatTotal)}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Samma väljare som perioden ovanför (PeriodPicker, ReportUI.jsx),
              bara med en annan ikon. Var tidigare en knapprad — med tre lägen
              och en formatrad under blev det fyra plus fyra knappar som
              trängdes med rubriken på samma yta. En rullgardin säger dessutom
              vad som ÄR valt utan att man ska läsa vilken knapp som är fylld. */}
          <PeriodPicker
            value={chartMode}
            onChange={setChartMode}
            options={CHART_MODES}
            icon={CHART_MODES.find(m => m.id === chartMode)?.icon || BarChart2}
            ariaLabel="Välj diagram"
          />
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

        {/* Tomt läge — inga bokförda verifikationer än. Ett eget litet vyläge
            istället för att bara rita en platt nollinje, så rutan förklarar
            vad som saknas istället för att se trasig/tom ut. */}
        {!hasChartData ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '220px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: chartRevenue, marginBottom: '2px' }}>
              <BarChart2 size={20} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ingen bokföring ännu</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px' }}>
              Så fort du bokfört en faktura eller en utgift dyker den här grafen upp här.
            </p>
          </div>
        ) : chartFormat === 'table' ? (
          <ChartDataTable data={chartData} mode={chartMode} fmt={fmt} hasPrevYearData={hasPrevYearData} comparisonLabel={comparisonLabel} />
        ) : (
          <>
            {/* Bugkritiskt (kundrapporterad: "en massa saker är osynliga,
                de ligger utanför"): `margin.left` var tidigare -20 och
                Y-axelns `width` bara 44 — ett negativt vänstermarginal-värde
                flyttar HELA ritytan (inklusive Y-axelns etiketter) 20px åt
                vänster om <svg>:ns egen vänsterkant, och en <svg> klipper
                per spec allt som hamnar utanför sitt eget koordinatsystem
                (`overflow: hidden` är webbläsarens default för <svg>-
                rotelement). Kombinationen klippte routinmässigt den FÖRSTA
                siffran i en Y-axeletikett ("160k" visades som "l0k") så
                fort talet blev tillräckligt stort/brett — `margin.left: 0`
                + `width={52}` ger etiketterna faktiskt utrymme att rymmas
                innanför SVG:ns vänsterkant istället för att gissa ett
                negativt tal som råkade fungera för just kortare belopp. */}
            {/* Översikt. I stapelläget är det kombiformen — fyllda
                intäktsstaplar, dämpade utgiftsstaplar och resultatet som en
                linje ovanpå — alltså exakt samma bild som Företagsöversikten
                ritar. I linje- och ytläget blir resultatet i stället en tredje
                kurva bredvid de två andra. Samma komponent i båda fallen. */}
            {chartMode === 'all' && chartFormat !== 'table' && (
              <ReportDisplayProvider colors={company?.reportDisplay?.colors} unit={company?.reportDisplay?.unit}>
                <RevenueExpenseChart
                  data={combinedChartData}
                  indexKey="name"
                  variant={chartFormat === 'bars' ? 'combo' : chartFormat}
                  height={260}
                  isMobile={false}
                  extraSeries={chartFormat === 'bars' ? [] : [{ label: 'Resultat', color: chart.profit, dashed: false }]}
                />
              </ReportDisplayProvider>
            )}

            {chartMode === 'revenue-expense' && (chartFormat === 'line' || chartFormat === 'area') && (
              // Samma komponent som Företagsöversikten ritar med — mjuk
              // monotone-kurva, samma linjetjocklek, punkter i linjeläget och
              // gradientfylld yta i ytläget. Föregående år följer med som två
              // streckade serier, samma konvention som stapelläget nedan.
              <ReportDisplayProvider colors={company?.reportDisplay?.colors} unit={company?.reportDisplay?.unit}>
                <RevenueExpenseChart
                  data={comparisonChartData}
                  indexKey="name"
                  variant={chartFormat}
                  height={260}
                  isMobile={false}
                  extraSeries={hasPrevYearData ? [
                    { label: `Intäkter ${comparisonLabel}`, color: chartRevenuePrev },
                    { label: `Utgifter ${comparisonLabel}`, color: chartExpensePrev },
                  ] : []}
                />
              </ReportDisplayProvider>
            )}

            {chartMode === 'revenue-expense' && chartFormat === 'bars' && (
              <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    {/* `interval="preserveStartEnd"` — recharts väljer själv hur
                        många etiketter som får plats utan att överlappa, istället
                        för det tidigare hårdkodade "hoppa över var tredje", som
                        antog exakt tolv kalendermånader. Med period-flikarna
                        (PeriodPicker ovan) kan `chartData` nu lika gärna vara
                        31 DAGAR ("Denna månad") som 3/6/12+ månader — ett fast
                        hopp-tal hade antingen klämt ihop dagsetiketter eller
                        glesat ut en redan kort månadsserie i onödan. */}
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} dy={6} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={axisTick} width={axisWidth} />
                    <Tooltip content={<ChartTooltip fmt={fmt} />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                    {/* verticalAlign="bottom" (uttryckligt, inte bara standard-
                        värdet) — flyttar/håller legenden under diagrammet på
                        mobil istället för att riskera att den kläms in bredvid. */}
                    <Legend iconType="circle" iconSize={7} verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                    <Bar dataKey="Intäkter" fill={chartRevenue} radius={[4,4,0,0]} barSize={16} />
                    <Bar dataKey="Utgifter" fill={chartExpense} radius={[4,4,0,0]} barSize={16} />
                    {/* Föregående års jämförelse ritas som en streckad linje
                        ovanpå de egna årets staplar (samma konvention som
                        Rapport och analys, ReportUI.jsx) — bara när det finns
                        något att jämföra med. */}
                    {hasPrevYearData && <Line type="monotone" dataKey="PrevIntäkter" name={`Intäkter ${comparisonLabel}`} stroke={chartRevenuePrev} strokeWidth={2} strokeDasharray="4 3" dot={false} legendType="plainline" />}
                    {hasPrevYearData && <Line type="monotone" dataKey="PrevUtgifter" name={`Utgifter ${comparisonLabel}`} stroke={chartExpensePrev} strokeWidth={2} strokeDasharray="4 3" dot={false} legendType="plainline" />}
                  </BarChart>
              </ResponsiveContainer>
            )}

            {chartMode === 'result' && (
              <ResponsiveContainer width="100%" height={260}>
                {chartFormat === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} dy={6} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={axisTick} width={axisWidth} />
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
                    <Line type={curveType} dataKey="Resultat" name="Resultat" stroke={periodResultat >= 0 ? REVENUE : EXPENSE} strokeWidth={3.5} dot={false} activeDot={{ r: 5 }} />
                    {hasPrevYearData && <Line type={curveType} dataKey="PrevResultat" name={`Resultat ${comparisonLabel}`} stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="4 3" dot={false} />}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} dy={6} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={axisTick} width={axisWidth} />
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
                    <Bar dataKey="Resultat" name="Resultat" fill={periodResultat >= 0 ? REVENUE : EXPENSE} radius={[4,4,0,0]} barSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.Resultat >= 0 ? REVENUE : EXPENSE} />
                      ))}
                    </Bar>
                    {hasPrevYearData && <Line type="monotone" dataKey="PrevResultat" name={`Resultat ${comparisonLabel}`} stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="4 3" dot={false} />}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </>
        )}
      </div>

      {/* ─── UTESTÅENDE + MOMS — sidans två "läge just nu"-rutor, parade
          i en 2/1-rad längst ner istället för att tävla om samma vikt som
          Snabbåtgärder/Att göra idag/Nyckeltalen ovanför (Sida 34). ─── */}
      {!isNew && (
        <div className="dash-lower-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '18px', alignItems: 'stretch' }}>

          {/* Utestående — se kommentaren vid `outstanding` ovan för varför
              den här ytan inte längre visar de senaste verifikationerna. */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Utestående</span>
              <button onClick={() => setActiveTab('invoices')} className="ds-link-btn sm">Alla fakturor</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-light)', flex: 1 }}>
              {[
                {
                  key: 'in', label: 'Att få in', amount: outstanding.receivable,
                  count: outstanding.inCount, overdue: outstanding.overdueInCount,
                  tone: chartRevenue, tab: 'invoices',
                  empty: 'Inga obetalda kundfakturor',
                  note: outstanding.oldestOverdue > 0
                    ? `äldsta förföll för ${outstanding.oldestOverdue} dagar sedan`
                    : null,
                },
                {
                  key: 'out', label: 'Att betala', amount: outstanding.payable,
                  count: outstanding.outCount, overdue: outstanding.overdueOutCount,
                  tone: chartExpense, tab: 'expenses',
                  empty: 'Inga obetalda leverantörsfakturor',
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
                  <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                    {fmt(box.amount)}
                  </span>
                  {box.count === 0 ? (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{box.empty}</span>
                  ) : (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {box.count} {box.count === 1 ? 'faktura' : 'fakturor'}
                      {box.overdue > 0 && (
                        <span style={{ color: 'var(--status-red-text)', fontWeight: 700 }}>{` · ${box.overdue} förfallen${box.overdue === 1 ? '' : 'a'}`}</span>
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
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Netto</span>
              <span style={{ fontSize: '15px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: outstanding.net >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
                {fmt(outstanding.net)}
              </span>
            </div>
          </div>
          {/* Moms — nästa (ännu ej inlämnade) momsperiod, räknat från riktiga
              bokförda utgående/ingående moms-rader inom perioden. */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {vatPeriodSummary ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>Moms {vatPeriodSummary.label}</span>
                  {vatPeriodSummary.dueDateLabel && (
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Förfaller {vatPeriodSummary.dueDateLabel}</span>
                  )}
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

      {/* Kundönskemål (Sida 51): "har du bokfört någon annanstans innan?"
          — en helt FRISTÅENDE ruta, inte en femte checklista-rad (se
          SIE_IMPORT_DISMISSED_KEY-kommentaren ovan för varför). Samma
          isNew-villkor som checklistan ovan, men sitt eget dismiss-state
          så den inte kopplas till checklistans "alla klara"-firande. */}
      {isNew && !sieImportDismissed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Upload size={17} color="var(--status-green-text)" />
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>Har du bokfört någon annanstans innan?</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Importera din bokföring från Fortnox, Spiris eller Bokio via en SIE4-fil.</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button type="button" onClick={() => setShowSieImportModal(true)} style={{ padding: '9px 16px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Importera bokföring
            </button>
            <button type="button" onClick={dismissSieImportCallout} aria-label="Dölj" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}>
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
