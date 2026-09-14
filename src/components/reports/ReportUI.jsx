import React, { useMemo, useState, useEffect, useRef } from 'react';
import { HelpCircle, ArrowUpRight, ArrowDownRight, Inbox, Calendar, ChevronDown, Palette } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
// Tremor Raw AreaChart/BarChart (src/components/tremor/) — AreaChart
// används i TrendChart's "Yta"-läge nedan samt i CashflowComparisonChart,
// BarChart i RevenueExpenseChart (Företagsöversiktens huvuddiagram, se
// ReportDetail.jsx).
import { AreaChart as TremorAreaChart } from '../tremor/AreaChart';
import { BarChart as TremorBarChart } from '../tremor/BarChart';
import { BRAND, KPI_GRADIENTS } from '../../utils/brandColors';
import AnchoredDropdown from '../shared/AnchoredDropdown';
import {
  resolveChartPalette, makeAmountFormatters, CHART_COLOR_CHOICES, CHART_ROLES,
  AMOUNT_UNITS, DEFAULT_CHART_COLORS, DEFAULT_AMOUNT_UNIT,
} from '../../utils/chartPalette';
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme';
// Tailwind, scopat till bara Tremor-komponenterna (src/tremor.css:s egen
// kommentar förklarar varför preflight/reset är avstängt) — CSS-import
// som sidoeffekt här, laddas en gång oavsett hur många ställen som
// importerar ReportUI.jsx.
import '../../tremor.css';

// Delade presentationsdelar för Rapport och analys — flyttade hit oförändrade
// från Reports.jsx (Sida 14c) när sidan byggdes om till en rapportportal
// (Sida 14c, uppföljning: 14 namngivna rapporter) så att både listsidan
// (Reports.jsx) och den nya detaljvyn (ReportDetail.jsx) delar EXAKT
// samma kort/diagram-stil istället för att en tredje, avvikande stil
// smyger sig in i detaljvyn.

/* ── Rapportportalens färgspråk: BETYDELSE, inte dekoration ────────────
 * Kundönskemål ("om det är intäkt ska den vara blå, är det kostnad kan den
 * vara röd, är det vinst kan den vara grön"): varje serie får sin färg av
 * VAD DEN ÄR, inte av vilken plats den råkar ha i en palett. Läsaren ska
 * kunna se på ett diagram vad som är pengar in, pengar ut och vad som blev
 * kvar — utan att först läsa legenden.
 *
 * Tonerna hämtas ur KPI_GRADIENTS (brandColors.js), samma källa som
 * Startsidans nyckeltalskort och dess Intäkter-vs-Utgifter-graf redan
 * använder. Två skäl, båda viktiga:
 *   1. Rapportsidan ritade tidigare EXAKT samma jämförelse (Intäkter mot
 *      Utgifter) i ett eget grönt/blått språk medan Startsidan ritade den i
 *      blått/rött. Samma två tal, två olika färgkoder, i samma app.
 *   2. Blå/röd-paret är redan CVD-kontrollerat (ΔE 12.4 vid deuteranopi,
 *      se kommentaren i Dashboard.jsx) — det gröna/blå paret var det inte.
 *      Grönt mot blått är dessutom det svåraste paret för den vanligaste
 *      formen av färgblindhet, och det är just det paret en översikt lutar
 *      hela sin läsbarhet mot.
 */
export const CHART_INCOME = KPI_GRADIENTS.revenue[0];   // Intäkter, pengar in
export const CHART_COST = KPI_GRADIENTS.negative[0];    // Kostnader, pengar ut
export const CHART_PROFIT = KPI_GRADIENTS.positive[0];  // Resultat, det som blev kvar
export const CHART_CASH = KPI_GRADIENTS.revenue[1];     // Behållning på kontot — samma familj som intäkter, en ton ljusare
export const CHART_NEUTRAL = KPI_GRADIENTS.neutral[0];  // Härledda kvoter utan egen +/- riktning
export const CHART_MUTED = '#c9d2cd';                   // jämförelseserie: nedtonad, aldrig en egen kulör

// Kundönskemål: tjockare linjer och bredare staplar. Båda måtten ligger som
// namngivna konstanter så att varje diagram i rapportportalen ritar med
// exakt samma vikt — en panel med 3px-linje bredvid en med 2px läses som
// två olika sorters data, inte som två diagram i samma rapport.
export const CHART_STROKE = 3.5;
// Staplarnas maxbredd. Höjd från 18 — grafen bär en hel panelbredd och ett
// fåtal månader, så smala staplar lämnade mest tom yta. Recharts fördelar
// själv bredden när perioden har många punkter, taket gäller bara när det
// finns gott om plats.
export const CHART_BAR_SIZE = 32;
// Diagramhöjder. Kundönskemål: graferna var för små för att läsas ordentligt.
// `CHART_H_MAIN` är huvuddiagrammet (Intäkter vs utgifter, panelen som bär
// hela översikten), `CHART_H_SIDE` de mindre panelerna bredvid och under.
export const CHART_H_MAIN = 340;
export const CHART_H_SIDE = 270;

// Kvar för Resultat-diagrammets tecken-färgning (en enda stapelserie som
// pekar upp eller ner — där bär POSITIONEN mot nollinjen identiteten och
// färgen är sekundär bekräftelse, se Dashboard.jsx:s egen kommentar).
export const REVENUE = CHART_PROFIT;
export const EXPENSE = KPI_GRADIENTS.negative[1];

/* Kostnadernas egen ramp. Allt i kostnadspanelerna hör till EN sak —
 * pengar ut — så de delar kostnadsfärgens familj i stället för att vara
 * sex nominellt olika kulörer. Det är skillnaden mot en godtycklig
 * kategoripalett: ringen säger "det här är kostnader, så här fördelade",
 * inte "här är sex saker som råkar ha varsin färg".
 *
 * Varje kategori har en FAST plats (se `colorIndex` i reportCalculations.js)
 * så en post behåller sin ton även när en annan kategori saknar belopp.
 * Index måste följa COST_CATEGORIES i reportCalculations.js:
 *   0 Personal · 1 Lokal · 2 Marknadsföring · 3 Varor och material
 *   4 Övriga externa kostnader · 5 Övrigt
 * Bara 'Övrigt' (restposten) är avfärgad till grått — de fem namngivna har
 * alla en bärande ton, eftersom vilken av dem som blir störst i ett verkligt
 * bokslut inte går att veta i förväg. */
// Tonerna är fördelade så att den kategori som i praktiken nästan alltid är
// störst — index 4, Övriga externa kostnader, där hela 6xxx bor — får
// familjens signaturton och inte rampens blekaste. En ramp sorterad ljus→mörk
// hade gett den dominerande posten den svagaste färgen på hela sidan.
export const COST_CATEGORY_COLORS = ['#8e1f3c', '#d4607f', '#a8456b', '#b62a4f', '#c8305a', '#b9adb1'];

/** Rankningslistans staplar. Till skillnad från kategorierna ovan ÄR den här
 * listan ordnad (störst först), så en ordinal mörk→ljus-ramp säger något sant
 * om ordningen i stället för att bara färglägga för färgläggandets skull. */
export const COST_RANK_COLORS = ['#8e1f3c', '#c8305a', '#dd5c7c', '#e88ba1', '#f0b6c4'];
export const COST_BG = '#f4e9ed'; // spårets ton bakom rankningsstaplarna, samma familj som staplarna

/* ── Presentationsvalen (färg + enhet) som en kontext ─────────────────
 * Diagrammen läser färger och beloppsformat HÄR i stället för ur
 * modulkonstanterna ovan. Skälet är att valen är företagets, inte
 * komponentens: samma tal ska se likadana ut i varje panel, och en
 * ändring ska slå igenom överallt på en gång.
 *
 * En kontext och inte props hela vägen ner: färgen behövs i ungefär tio
 * komponenter på fyra nivåers djup, och att tråda `palette` genom varje
 * mellanliggande panel hade gjort varje signatur längre utan att göra
 * något tydligare.
 *
 * Förvalet är den semantiska paletten och `auto`-enheten, alltså exakt
 * det som gällde innan valen fanns — en vy som INTE ligger under en
 * provider (t.ex. ett enskilt diagram i en annan del av appen) ritar
 * därför precis som förut.
 */
const ReportDisplayContext = React.createContext({
  palette: resolveChartPalette(),
  amount: makeAmountFormatters(),
});

export function ReportDisplayProvider({ colors, unit, children }) {
  // Temat är en del av paletten, inte en separat sak varje diagram måste
  // komma ihåg: två toner är valda för ett ljust ark och skrivs om i mörkt
  // läge (se resolveChartPalette). Läses här, EN gång, så alla paneler
  // under providern byter samtidigt när användaren växlar tema.
  const isDark = useIsDarkTheme();
  const value = useMemo(() => ({
    palette: resolveChartPalette(colors, { dark: isDark }),
    amount: makeAmountFormatters(unit),
  }), [colors, unit, isDark]);
  return <ReportDisplayContext.Provider value={value}>{children}</ReportDisplayContext.Provider>;
}

export function useReportDisplay() {
  return React.useContext(ReportDisplayContext);
}

/** Färg- och enhetsväljaren. Ligger i rapportens rubrikrad, inte under
 * Inställningar: det är ett val man vill göra medan man tittar på
 * diagrammet och ser skillnaden direkt, inte något man letar upp i en
 * separat vy och sedan går tillbaka för att kontrollera. */
export function DisplaySettingsMenu({ colors, unit, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const panelRef = useRef(null);
  const current = { ...DEFAULT_CHART_COLORS, ...(colors || {}) };

  // Stäng vid klick utanför och vid Escape. Panelen ligger i en portal
  // (AnchoredDropdown) och är därför inte ett barn till `ref` i DOM:en —
  // därav panelRef i kontrollen, annars räknas ett klick i panelen som ett
  // klick utanför och menyn stängs mitt i ett färgval.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="no-print" style={{ position: 'relative' }}>
      <button
        type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="dialog"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
      >
        <Palette size={14} /> Utseende
      </button>
      <AnchoredDropdown
          anchorRef={ref}
          panelRef={panelRef}
          open={open}
          align="right"
          minWidth={286}
          maxHeight={420}
          zIndex={1090}
          role="dialog" aria-label="Utseende"
          style={{ width: '286px', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', padding: '16px' }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '10px' }}>Färger</div>
          {CHART_ROLES.map(role => (
            <div key={role.id} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{role.label}</span>
                <span style={{ display: 'inline-flex', gap: '6px' }}>
                  {CHART_COLOR_CHOICES.map(choice => {
                    const active = current[role.id] === choice.id;
                    return (
                      <button
                        key={choice.id} type="button" title={choice.label} aria-label={`${role.label}: ${choice.label}`} aria-pressed={active}
                        onClick={() => onChange({ colors: { ...current, [role.id]: choice.id } })}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', padding: 0,
                          background: choice.base,
                          border: active ? '2px solid var(--text-main)' : '2px solid transparent',
                          boxShadow: active ? '0 0 0 2px var(--bg-card) inset' : 'none',
                        }}
                      />
                    );
                  })}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{role.help}</div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--border-light)', margin: '14px 0 12px' }} />
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '10px' }}>Belopp</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {AMOUNT_UNITS.map(u => {
              const active = (unit || DEFAULT_AMOUNT_UNIT) === u.id;
              return (
                <button
                  key={u.id} type="button" onClick={() => onChange({ unit: u.id })} aria-pressed={active}
                  style={{
                    textAlign: 'left', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
                    background: active ? BRAND.greenLight : 'transparent',
                    border: `1px solid ${active ? BRAND.green : 'var(--border)'}`,
                  }}
                >
                  <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: active ? BRAND.greenDark : 'var(--text-main)' }}>{u.label}</span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)' }}>{u.help}</span>
                </button>
              );
            })}
          </div>
      </AnchoredDropdown>
    </div>
  );
}
/** Belopp i tusental kronor — "7 329 000 kr" blir "7 329 tkr", precis som i
 * kundens utkast. Det är inte bara kortare: `tkr` är hur svenska
 * resultat-/balansrapporter faktiskt skrivs, så det läser som bokföring
 * snarare än som en banköversikt, och ett nyckeltal slutar radbryta.
 *
 * Under `minTkr` (100 000 kr) skrivs beloppet ut i kronor i stället — ett
 * litet bolags kostnad på 295 kr skulle annars visas som "0 tkr", vilket är
 * sämre än den långa varianten. Tröskeln, inte avrundningen, är poängen. */
export function formatTkr(val, { minTkr = 100000 } = {}) {
  const n = Math.round(val || 0);
  if (Math.abs(n) < minTkr) return formatSEK(n);
  return `${new Intl.NumberFormat('sv-SE').format(Math.round(n / 1000))} tkr`;
}

/** Y-axelns tick, alltid i tusental MED enhet ("500 tkr") som i utkastet.
 * Till skillnad från formatTkr växlar den aldrig enhet efter storlek — en
 * axel vars streck stod i olika enheter ("0 kr", "150 tkr", "300 tkr") vore
 * oläsbar. Exaktheten finns i tooltipen, som behåller hela kronbeloppet. */
export const fmtAxisTkrUnit = (v) => `${new Intl.NumberFormat('sv-SE').format(Math.round((v || 0) / 1000))} tkr`;

/** Delta som en liten pillerbricka (↗ +14,2 %) i stället för en bar färgad
 * textrad — hämtat rakt ur utkastet. Brickan ger siffran en egen tyngd utan
 * att skrika, och den efterföljande kontexttexten ("mot föregående år") kan
 * vara dämpad utan att förändringen tappas bort. */
export function DeltaPill({ delta, context }) {
  if (!delta) return context ? <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{context}</span> : null;
  const neutral = delta.good === null;
  const good = delta.good;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        padding: '2px 7px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 700,
        background: neutral ? 'var(--status-gray-bg)' : good ? 'var(--status-green-bg)' : 'var(--status-red-bg)',
        color: neutral ? 'var(--status-gray-text)' : good ? 'var(--status-green-text)' : 'var(--status-red-text)',
      }}>
        {!neutral && (good ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />)}
        {delta.short || delta.text}
      </span>
      {context && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{context}</span>}
    </span>
  );
}

/* ── Arket ──────────────────────────────────────────────────────────────
 * Kundens utkast har INGA kort: ingen ram per panel, ingen skugga, ingen
 * cremeplatta. Det är ETT vitt ark där panelerna skiljs åt av hårfina
 * linjer. Skillnaden är inte kosmetisk — kort med egen ram och skugga läser
 * som fristående öar och tvingar in luft mellan sig, medan ett delat ark
 * läser som en sammanhållen rapport och får plats med mer på samma yta.
 * Panelerna sätter själva sina `borderTop`/`borderLeft`, så rutnätet kan
 * varieras utan att linjerna dubbleras. */
export function ReportSheet({ children }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '18px', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

/** Diagramväljaren i en panels rubrikrad. Kundönskemål: samma data ska gå
 * att läsa i flera former — staplar när man jämför perioder mot varandra,
 * linje när man följer en utveckling, yta när volymen är poängen, ring när
 * andelarna är det. Valet är per panel och lokalt (ingen sparad
 * inställning): det är ett sätt att TITTA på samma siffror, inte en
 * konfiguration av rapporten.
 *
 * Riktiga knappar, inte en <select>: alternativen är två till fyra och
 * alltid synliga, så växlingen kostar ett klick i stället för två. Den
 * aktiva bär appens gröna, resten är avfärgade — samma mönster som
 * PeriodPicker och listornas flikrader redan använder. */
export function ChartTypeToggle({ value, onChange, options, label = 'Diagramtyp' }) {
  return (
    <span role="group" aria-label={label} className="no-print" style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id} type="button" onClick={() => onChange(opt.id)} aria-pressed={active}
            style={{
              padding: '5px 12px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '11.5px', fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap',
              background: active ? BRAND.green : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${active ? BRAND.green : 'var(--border)'}`,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </span>
  );
}

// Standarduppsättningarna. Ligger här och inte i ReportDetail.jsx så att
// alla paneler som visar samma SORTS data också erbjuder samma former.
export const TREND_CHART_TYPES = [
  { id: 'bar', label: 'Staplar' },
  { id: 'line', label: 'Linje' },
  { id: 'area', label: 'Yta' },
  { id: 'combo', label: 'Kombi' },
];
export const FLOW_CHART_TYPES = [
  { id: 'area', label: 'Yta' },
  { id: 'line', label: 'Linje' },
  { id: 'bar', label: 'Staplar' },
];
export const SHARE_CHART_TYPES = [
  { id: 'donut', label: 'Ring' },
  { id: 'pie', label: 'Paj' },
  { id: 'bar', label: 'Staplar' },
];
/** `controls` är panelens egen växlare (ChartTypeToggle ovan) och ligger i
 * rubrikraden till höger, medan `legend` flyttar ner under rubriken när
 * båda finns — annars trängs tre saker på samma rad och radbryter till en
 * rörig trappa på halvbred skärm. */
export function SheetPanel({ title, subtitle, legend, controls, children, style }) {
  const hasHead = title || legend || controls;
  return (
    <div className="sheet-panel" style={{ padding: '26px 28px 28px', minWidth: 0, ...style }}>
      {hasHead && (
        <div className="sheet-panel-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: subtitle ? '5px' : (legend && controls ? '10px' : '18px') }}>
          {title && <span style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{title}</span>}
          {controls || legend}
        </div>
      )}
      {subtitle && <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.55, maxWidth: '62ch' }}>{subtitle}</p>}
      {controls && legend && (
        <div style={{ marginBottom: '16px' }}>{legend}</div>
      )}
      {children}
    </div>
  );
}

/** Legenden ligger i panelens rubrikrad (höger), inte inne i diagramytan —
 * som i utkastet. Diagrammen ritar därför sina egna legender avstängda. */
export function InlineLegend({ items }) {
  return (
    <span style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
      {items.map(i => (
        <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: i.color, flexShrink: 0 }} />
          {i.label}
        </span>
      ))}
    </span>
  );
}

/** Nyckeltalsbrickan i arkets topprad. Skiljer sig från KpiCard (som resten
 * av rapportportalen använder) på tre punkter, alla hämtade ur utkastet:
 * ingen egen ram/skugga (arket bär den), ikonen ligger till HÖGER om
 * etiketten i stället för på en egen rad ovanför, och förändringen är en
 * pillerbricka med en dämpad kontexttext bredvid i stället för en färgad
 * textrad. Ingen sparkline: utkastets brickor är rena tal, och trenden
 * finns i diagrammen strax under. */
/** `tone` färgar ikonchipet efter vad brickan MÄTER (in/ut/resultat), samma
 * semantik som diagrammen: en läsare ska kunna koppla ihop brickan högst upp
 * med serien i diagrammet strax under utan att jämföra siffror. */
export function StatTile({ label, value, icon: Icon, delta, context, accent, tone }) {
  return (
    <div className="stat-tile" style={{ padding: '24px 28px 26px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
        {Icon && (
          <span style={{ width: 26, height: 26, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: tone ? `color-mix(in srgb, ${tone} 12%, transparent)` : 'var(--bg-muted)', color: tone || 'var(--text-muted)' }}>
            <Icon size={14} />
          </span>
        )}
      </div>
      <div className="stat-tile-value" style={{ fontSize: '30px', fontWeight: 700, color: accent || 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '11px' }}>{value}</div>
      <DeltaPill delta={delta} context={context} />
    </div>
  );
}

/** Andel i procent för en legend-/listrad. Avrundar till heltal, men aldrig
 * ner till "0%" för en post som faktiskt har ett belopp — då "<1%". */
export function formatSharePct(amount, total) {
  if (!total) return '0%';
  const pct = (amount / total) * 100;
  if (pct > 0 && pct < 0.5) return '<1%';
  return `${Math.round(pct)}%`;
}

export function thinLabels(labels, isMobile) {
  if (!isMobile || labels.length <= 6) return labels;
  const interval = Math.ceil(labels.length / 6);
  return labels.map((l, i) => (i % interval === 0 ? l : ''));
}

export const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);

/**
 * Procenttal på svenska: decimalKOMMA och hårt mellanslag före %-tecknet
 * ("49,1 %", inte "49.1%").
 *
 * Fanns tidigare som ett halvdussin egna `${v.toFixed(1)}%` runtom i
 * rapporterna, varav EN plats råkade göra `.replace('.', ',')` — så samma
 * rapport kunde visa "50.0 %" i ett diagram och "50,0 %" i nästa panel.
 * Ett hårt mellanslag ( ) så talet aldrig bryter rad mellan siffran
 * och tecknet.
 */
export const formatPct = (val, decimals = 1) => (
  val == null || !Number.isFinite(Number(val))
    ? '—'
    : `${new Intl.NumberFormat('sv-SE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(val))} %`
);
export const fmtDate = (d) => new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(d instanceof Date ? d : new Date(d));
export const fmtMonthYear = (d) => new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(d);
// Kundfeedback: "det måste visa datumet — om det är den här månaden ska
// den visa från den första till den sista". PeriodTabs (Företagsöversikten/
// Dashboard.jsx) bytte tidigare bara en ordetikett ("Denna månad"), utan
// någon synlig start–slut-siffra — `Intl.DateTimeFormat.prototype.
// formatRange` gör exakt rätt sak här: skriver bara ut det som skiljer
// (t.ex. "1–30 sep. 2026") istället för att upprepa månad/år i båda ändar,
// men skriver ut BÅDA årtalen om perioden råkar spänna över ett årsskifte
// (t.ex. "18 nov. 2025 – 5 sep. 2026", vilket "Senaste 6 månaderna" och
// "Sedan start" båda kan göra) — helt automatiskt, ingen egen sträng-
// hopslagning att hålla koll på för det specialfallet.
export const fmtDateRange = (start, end) => new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(start, end);
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function formatDelta(current, previous, invert = false) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    // Kort med flit: den här raden sitter under ett tal i ett smalt
    // nyckeltalskort och upprepas på varje kort som saknar fjolårssiffra.
    // Den tidigare hela meningen ("Ingen bokföring under samma period förra
    // året") radbröts till tre rader, sköt korten olika höga och tog mer
    // plats än talet den beskrev.
    return { text: 'Ingen data förra året', short: null, context: 'Ingen data förra året', good: null };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rising = pct >= 0;
  const good = invert ? !rising : rising;
  // `short` + `context` delar upp det `text` tidigare klämde ihop: brickan
  // (DeltaPill) bär själva talet, den dämpade texten bredvid bär jämförelsen.
  // Svensk decimalkomma och ett hårt mellanslag före %, som i utkastet.
  return {
    text: `${rising ? '+' : ''}${formatPct(pct, 0)} mot samma period föregående år`,
    short: `${rising ? '+' : '−'}${formatPct(Math.abs(pct))}`,
    context: 'mot föregående år',
    good,
  };
}

/** Minimal sparkline — en KPI-korts trend är RIKTIGA per-periodpunkter
 * (samma `series`/`marginData` som huvuddiagrammen redan räknar fram),
 * aldrig en dekorativ kurva. dataviz-skillens figur-kontrakt för en
 * stat tile: "trend (valfri; sparkline, aktuell period i accentfärgen)".
 * Mönsterspecen (samma skäl som hero-siffrans egen kommentar nedan):
 * 2px linje med rundad led, en >=6px slutprick med en ring i kortets EGEN
 * bakgrundsfärg (annars smälter pricken ihop med linjen där de möts), och
 * en genomskinlig (~12%) yta under linjen — en vy, aldrig ett mättat block.
 * Inga axlar/rutnät/etiketter: en sparklines enda jobb är "upp, ner eller
 * platt" — den exakta siffran är redan den stora texten ovanför. */
export function Sparkline({ data, color = 'var(--accent)', height = 30, width = 88, surface = 'var(--bg-card)' }) {
  const values = (data || []).filter(v => v != null && Number.isFinite(v));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => (v == null || !Number.isFinite(v) ? null : { x: i * stepX, y: height - ((v - min) / range) * (height - 6) - 3 }))
    .filter(Boolean);
  if (points.length < 2) return null;
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = `${linePath} L${last.x.toFixed(1)},${height} L${first.x.toFixed(1)},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }} aria-hidden="true">
      <path d={areaPath} fill={color} opacity={0.14} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r={3.5} fill={color} stroke={surface} strokeWidth={2} />
    </svg>
  );
}

/** `trend` (valfri, se Sparkline ovan): bara Företagsöversiktens kort
 * (ReportDetail.jsx) skickar den hittills — resten av rapportportalens
 * KpiCard-anrop är oförändrade och renderar exakt som innan.
 *
 * Kodgranskning (dataviz-skillen, "anti-patterns"): stora fristående tal
 * ska ha PROPORTIONELLA siffror, inte `tabular-nums` — tabular-nums ger
 * varje siffra bredden av en "0" för att kolumner av tal ska radas upp
 * rakt (DataTable, axel-ticks), men på ett stort ensamt tal som det här
 * kortets `value` gör det bara texten gles/ojämn. Borttaget här (fanns
 * tidigare, aldrig avsett för just den här storleken). */
export function KpiCard({ label, value, help, delta, accent, icon: Icon, iconBg, gradient, trend }) {
  const bold = !!gradient;
  return (
    <div
      style={{
        // `height: 100%` — korten ligger i ett rutnät med olika mycket text
        // (vissa har delta-rad, andra inte). Utan detta blir raden ojämn i
        // underkant, vilket läser som slarv snarare än som en rad.
        height: '100%', boxSizing: 'border-box',
        background: bold ? `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` : 'var(--bg-card)',
        borderRadius: '14px', border: bold ? 'none' : '1px solid var(--border)', padding: '18px 20px',
        boxShadow: bold ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = bold ? '0 6px 16px rgba(0,0,0,0.16)' : '0 10px 28px rgba(0,0,0,0.09)'; if (!bold) e.currentTarget.style.borderColor = accent || '#c7d2c1'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = bold ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)'; if (!bold) e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        {Icon && (
          <div style={{ width: 34, height: 34, borderRadius: '9px', background: bold ? 'rgba(255,255,255,0.24)' : (iconBg || 'var(--border-light)'), color: bold ? '#fff' : (accent || 'var(--text-secondary)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} />
          </div>
        )}
        {help && (
          <span title={help} style={{ display: 'inline-flex', cursor: 'help', color: bold ? 'rgba(255,255,255,0.75)' : '#b0b7c3' }}>
            <HelpCircle size={13} />
          </span>
        )}
      </div>
      <div style={{ fontSize: '12.5px', fontWeight: 600, color: bold ? 'rgba(255,255,255,0.82)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '23px', fontWeight: 800, color: bold ? '#fff' : (accent || 'var(--text-main)'), letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: delta ? '6px' : 0 }}>{value}</div>
          {delta && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: bold ? 'rgba(255,255,255,0.9)' : (delta.good === null ? 'var(--text-muted)' : delta.good ? 'var(--status-green-text)' : 'var(--status-red-text)') }}>
              {delta.good !== null && (delta.good ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
              {delta.text}
            </div>
          )}
        </div>
        {trend && <Sparkline data={trend} color={bold ? 'rgba(255,255,255,0.85)' : (accent || 'var(--accent)')} surface={bold ? gradient[1] : 'var(--bg-card)'} />}
      </div>
    </div>
  );
}

export function TabHeadline({ label, value, accent, delta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{label}</span>
      <span style={{ fontSize: '32px', fontWeight: 800, color: accent || 'var(--text-main)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</span>
      {delta && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: 600, color: delta.good === null ? 'var(--text-muted)' : delta.good ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
          {delta.good !== null && (delta.good ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
          {delta.text}
        </span>
      )}
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.6 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--text-muted)' }}>
        <Inbox size={20} />
      </div>
      {text}
    </div>
  );
}

// `valueFormatter` (default formatSEK) — tillagd för TrendChart nedan, vars
// serie ibland är en PROCENT (t.ex. Företagsöversiktens marginaltrend), inte
// ett kronbelopp; alla befintliga anropsställen (som inte bryr sig om
// skillnaden) fortsätter få exakt samma SEK-formatering som innan utan att
// ändra en enda rad hos dem.
/** Diagrammens tooltip — EN för hela appen.
 *
 * Det fanns två förut: den här och en till inne i den porterade
 * Tremor-grafen (tremor/AreaChart.jsx). Samma diagram kunde alltså visa
 * olika rutor beroende på vilken form man råkade ha valt — olika ram,
 * olika markör, olika radavstånd. Den här skickas numera in som
 * `customTooltip` till porten, så Tremors egen aldrig används.
 *
 * Två datakällor, en komponent: recharts skickar `name`, Tremor-portens
 * städade payload skickar `category`. Båda läses.
 *
 * `showDerived`: när rutan innehåller BÅDE Intäkter och Utgifter räknas
 * resultatet fram som en egen rad längst ner. Det är den siffra man
 * faktiskt är ute efter när man hovrar över en månad — annars får man
 * subtrahera i huvudet, med två sexsiffriga tal.
 */
export function ChartTooltip({ active, payload, label, valueFormatter = formatSEK, showDerived = true }) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .map(p => ({ name: p.name ?? p.category, value: p.value, color: p.color }))
    .filter(p => p.value != null && p.name !== undefined);
  if (!rows.length) return null;

  const income = rows.find(r => r.name === 'Intäkter');
  const cost = rows.find(r => r.name === 'Utgifter');
  const hasResult = rows.some(r => r.name === 'Resultat');
  const derived = showDerived && income && cost && !hasResult
    ? (income.value || 0) - (cost.value || 0)
    : null;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px',
      boxShadow: '0 12px 32px rgba(15, 30, 22, 0.16)', overflow: 'hidden',
      fontSize: '12.5px', minWidth: '196px',
    }}>
      {label && (
        <div style={{ padding: '9px 14px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-light)', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>
          {label}
        </div>
      )}
      <div style={{ padding: '11px 14px' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', padding: '3px 0' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {/* Rund prick, samma legendmarkör som paneler och listor
                  använder — inte Tremors lilla streck, som såg ut som en
                  tredje sorts markör i samma vy. */}
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
            </span>
            <span style={{ color: 'var(--text-main)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {valueFormatter(r.value)}
            </span>
          </div>
        ))}
        {derived != null && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Resultat</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: derived >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
              {valueFormatter(derived)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
export function ComparisonLegend({ currentLabel, previousLabel, currentColorSwatch, previousColorSwatch }) {
  return (
    <div style={{ display: 'flex', gap: '18px', marginTop: '12px', fontSize: '12.5px', fontWeight: 600, flexWrap: 'wrap' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>{currentColorSwatch} {currentLabel}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>{previousColorSwatch} {previousLabel}</span>
    </div>
  );
}

export const swatch = (color, dashed = false) => (
  <span style={{
    width: '14px', height: dashed ? '2px' : '10px', borderRadius: dashed ? 0 : '3px', background: dashed ? 'none' : color,
    borderTop: dashed ? `2px dashed ${color}` : undefined, display: 'inline-block', flexShrink: 0,
  }} />
);

export function ResultBarChart({ data, isMobile }) {
  const { palette, amount } = useReportDisplay();
  const tickData = useMemo(() => {
    const labels = thinLabels(data.map(d => d.label), isMobile);
    return data.map((d, i) => ({ ...d, label: labels[i] }));
  }, [data, isMobile]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={tickData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={amount.axis} width={amount.axisWidth} />
        <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
        <Tooltip content={<ChartTooltip valueFormatter={amount.exact} />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
        {/* Tecknet bär identiteten här (en enda serie som pekar upp eller
            ner mot nollinjen), så färgen följer resultatet: vinst i
            resultatfärgen, förlust i kostnadsfärgen. */}
        <Bar dataKey="resultat" radius={[4, 4, 0, 0]} maxBarSize={CHART_BAR_SIZE} name="Resultat">
          {tickData.map((d, i) => <Cell key={i} fill={d.resultat >= 0 ? palette.profit : palette.cost} />)}
        </Bar>
        <Line dataKey="prevResultat" stroke="var(--text-muted)" strokeWidth={2.5} strokeDasharray="4 3" dot={false} name="Föregående period" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashflowLineChart({ data, isMobile }) {
  const { palette, amount } = useReportDisplay();
  const tickData = useMemo(() => {
    const labels = thinLabels(data.map(d => d.label), isMobile);
    return data.map((d, i) => ({ ...d, label: labels[i] }));
  }, [data, isMobile]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={tickData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={amount.axis} width={amount.axisWidth} />
        <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
        <Tooltip content={<ChartTooltip valueFormatter={amount.exact} />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
        {/* Behållningen ritas i intäktsfamiljens ljusare ton, samma som
            kassaflödet i Företagsöversikten — inte i appens generella
            accentfärg, som inte betyder något särskilt i ett diagram. */}
        <Line dataKey="balance" stroke={palette.cash} strokeWidth={CHART_STROKE} dot={false} name="Saldo" />
        <Line dataKey="prevBalance" stroke="var(--text-muted)" strokeWidth={2.5} strokeDasharray="4 3" dot={false} name="Föregående period" />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Period-väljare — "titta på denna månad / 3/6 månader / hela
 * räkenskapsåret / sedan start", ett kundönskemål efter Tremors egna
 * "Portfolio Performance"-block (Last 7d/30d/Max-flikar): EN kontroll som
 * styr datumintervallet (och därmed bucket-storleken — dag/månad, se
 * overviewPeriodBounds i reportCalculations.js) för ALLA diagram den sitter
 * ovanför, inte bara ett enskilt kort. Används både av Rapport och analys →
 * Företagsöversikt (ReportDetail.jsx) och Startsidans "Intäkter vs
 * Utgifter"-graf (Dashboard.jsx, kundönskemål: "ska vara på startsidan
 * också") — samma komponent, samma fem flikar (OVERVIEW_PERIODS nedan),
 * inte två separata växlare som kan glida isär över tid.
 *
 * Kodgranskning: började som fem alltid synliga knappar i rad
 * (ChartFormatToggle-stilen) — kundfeedback: "gör så det bara visar EN,
 * som man kan trycka på, och då kan man ändra vilka datum man vill ha".
 * Nu EN knapp (visar bara den VALDA periodens etikett) som öppnar en liten
 * meny med de fem alternativen — PeriodHeading ovanför visar redan den
 * fulla etiketten + exakta datumspannet i klartext, så knappen här bara
 * behöver identifiera VILKEN som är vald, inte upprepa alla fem hela
 * tiden. Stängs vid klick utanför (samma mönster som andra popover-menyer
 * i appen) eller vid Escape. */
/** `icon` är valfri (kalender som förval) — samma väljare används numera
 * även för att välja DIAGRAMLÄGE på startsidan, och en kalenderikon på den
 * knappen hade lovat fel sak. */
export function PeriodPicker({ value, onChange, options, icon: Icon = Calendar, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const current = options.find(o => o.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    // panelRef: menyn ligger i en portal, se AnchoredDropdown.
    const onPointerDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={ariaLabel}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 14px', borderRadius: '9px', cursor: 'pointer', fontFamily: 'inherit',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          fontSize: '13px', fontWeight: 700, color: 'var(--text-main)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        {current.label}
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      <AnchoredDropdown
          anchorRef={rootRef}
          panelRef={panelRef}
          open={open}
          align="right"
          minWidth={190}
          maxHeight={360}
          role="menu"
          style={{ borderRadius: '10px', boxShadow: '0 12px 32px rgba(0,0,0,0.14)', padding: '5px', display: 'flex', flexDirection: 'column', gap: '2px' }}
        >
          {options.map(opt => (
            <button
              key={opt.id}
              role="menuitem"
              onClick={() => { onChange(opt.id); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: '7px', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '13.5px',
                fontWeight: value === opt.id ? 700 : 500,
                background: value === opt.id ? 'var(--bg-muted)' : 'transparent',
                color: value === opt.id ? 'var(--text-main)' : 'var(--text-secondary)',
              }}
              onMouseEnter={e => { if (value !== opt.id) e.currentTarget.style.background = 'var(--bg-muted)'; }}
              onMouseLeave={e => { if (value !== opt.id) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
      </AnchoredDropdown>
    </div>
  );
}

// Tre flikar (kundönskemål, uppföljning: "ta bort 3 mån och 6 mån, bara
// räkenskapsåret, sedan start och denna månad") — se overviewPeriodBounds
// i reportCalculations.js, som fortfarande KAN räkna ut 'q3'/'q6' (de
// grenarna lämnades kvar där, egna tester och allt) även om ingen flik
// längre exponerar dem här.
export const OVERVIEW_PERIODS = [
  { id: 'month', label: 'Denna månad' },
  { id: 'year', label: 'Räkenskapsåret' },
  { id: 'all', label: 'Sedan start' },
];

/** Rubrikrad ovanför PeriodTabs — kundfeedback: en flik som bara heter
 * "Denna månad" eller "Sedan start" påstår ett tidsspann utan att nånsin
 * SKRIVA UT det ("det måste visa datumet — om det är den här månaden ska
 * den visa från den första till den sista"). Vänster sida är alltså inte
 * bara etiketten utan etiketten + `fmtDateRange(start, end)` — den
 * FAKTISKA första och sista dagen i den valda perioden, i klartext. Egen
 * komponent (inte inline i varje anropsställe) eftersom både
 * Företagsöversikten (ReportDetail.jsx) och startsidans "Intäkter vs
 * Utgifter" (Dashboard.jsx) nu visar exakt samma rad. */
export function PeriodHeading({ label, start, end }) {
  return (
    <div>
      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{label}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{fmtDateRange(start, end)}</div>
    </div>
  );
}

/** Sammanfattningslista bredvid ett diagram — en färgad stapel + namn +
 * belopp per serie, radskild med en tunn linje. Modellerad rakt av på
 * Tremors egna "ETF performance comparison"-block (chart-compositions):
 * en `<ul>` med `divide-y`, en `w-1 shrink-0 rounded`-färgstapel per rad,
 * namn till vänster/belopp till höger — bara byggd i appens vanliga
 * inline-stil istället för Tailwind-klasser (samma skäl som TrendChart's
 * "Yta"-kommentar: kortet runt om, ReportSection, är inte ett Tremor-kort).
 * Ersätter en tidigare `ChartSummaryRow` (swatch-prickar i en rad OVANFÖR
 * diagrammet) — Tremor-blockets egen sida-vid-sida-layout (diagram 2/3,
 * lista 1/3) läses tydligare än en rad kläms in ovanpå grafen, se
 * RevenueExpenseChart-sektionen i ReportDetail.jsx. `delta` är ett eget
 * tillägg utöver förlagan (samma "mot samma period föregående år"-rad som
 * resten av rapportportalen redan visar). */
export function ChartSummaryList({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((it, i) => (
        <div key={it.label} style={{ display: 'flex', gap: '10px', padding: i === 0 ? '0 0 16px' : '16px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
          <span style={{ width: '4px', borderRadius: '3px', background: it.color, flexShrink: 0, alignSelf: 'stretch' }} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: it.accent || 'var(--text-main)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, letterSpacing: '-0.01em' }}>{it.value}</span>
            </div>
            {it.delta && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 600, marginTop: '4px', color: it.delta.good === null ? 'var(--text-muted)' : it.delta.good ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
                {it.delta.good !== null && (it.delta.good ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />)}
                {it.delta.text}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Företagsöversiktens huvuddiagram — Intäkter och Utgifter som VARSIN
 * serie, aldrig hopslagna till ett nettotal (kundfeedback: "Intäkter 0 kr /
 * Utgifter 0 kr ska synas som varsin stapel"). Formen växlar med
 * `granularity` (styrd av PeriodTabs → overviewPeriodBounds i
 * reportCalculations.js), inte ett fast val — en dataviz-avvägning, inte
 * en smaksak:
 *   - 'month' (upp till 31 DAGAR): grupperade staplar hade blivit 31×2=62
 *     ihopträngda stänger, olästbara. Två gradientfyllda linjer (Tremor
 *     Raw AreaChart, `fill="none"` gör ytan osynlig så bara linjen syns —
 *     effektivt en riktig linjegraf byggd på samma komponent) läser en
 *     daglig trend mycket bättre, se t.ex. Tremors egna dagliga
 *     aktiekurs-block (blocks.tremor.so/blocks/line-charts).
 *   - 'month'-alternativet ('q3'/'year', ≤12 MÅNADER): få kategorier är
 *     precis vad grupperade staplar (Tremor Raw BarChart) gör bäst —
 *     samma "Sales Overview"-mönster som blocks.tremor.so/blocks/bar-charts. */
/** Intäkter mot utgifter i fyra former. Delas av Företagsöversikten OCH
 * startsidans widget (Dashboard.jsx) — de visar exakt samma två tal, och
 * ritade dem tidigare i var sin egen implementation som hann glida isär i
 * kurvform, linjetjocklek, punkter och axelenhet. En komponent, ett
 * utseende.
 *
 * `indexKey` — startsidans dataserie heter `name`, rapportens `label`.
 * `extraSeries` — valfria jämförelseserier ({ key, label, color, dashed }),
 *   t.ex. föregående år. De ritas bara i linje- och ytläget; i stapelläget
 *   får anroparen lägga dem som egna element ovanpå.
 */
export function RevenueExpenseChart({ data, isMobile, granularity = 'month', height = 280, showLegend = false, variant = 'bar', indexKey = 'label', extraSeries = [] }) {
  const { palette, amount } = useReportDisplay();
  const tickData = useMemo(() => {
    const labels = thinLabels(data.map(d => d[indexKey]), isMobile);
    return data.map((d, i) => ({ ...d, [indexKey]: labels[i] }));
  }, [data, isMobile, indexKey]);

  // Tremor Raw:s egen `h-80`-klass (fast 320px) ersätts med en explicit
  // inline-höjd istället för att hitta på en dynamisk Tailwind-klass
  // (t.ex. `!h-[${height}px]`) — Tailwinds byggsteg känner bara igen
  // klassnamn som förekommer bokstavligt i källkoden, inte
  // sträng-interpolerade, så en sådan klass hade tyst inte genererats
  // alls. Inline style vinner ändå över klassens height i specificitet.
  //
  // `yAxisWidth={64}` (inte 60): en <svg> klipper per spec allt som ritas
  // utanför sitt koordinatsystem, och 60px räckte inte för ett fullt
  // SEK-belopp plus Tremor Raw:s egen `translate(-3, 0)` på Y-axelns text
  // — den FÖRSTA siffran klipptes tyst bort ("160 000" blev "l0 000").
  // Jämförelseserierna läggs sist så de ritas OVANPÅ de egna serierna men
  // under deras punkter — och alltid streckade, aldrig bara blekare.
  const extras = extraSeries.filter(e => e && e.label);
  const shared = {
    data: tickData,
    index: indexKey,
    categories: ['Intäkter', 'Utgifter', ...extras.map(e => e.label)],
    colors: [palette.income, palette.cost, ...extras.map(e => e.color || palette.muted)],
    dashedCategories: extras.filter(e => e.dashed !== false).map(e => e.label),
    valueFormatter: amount.exact,
    tickFormatter: amount.axis,
    yAxisWidth: amount.axisWidth,
    customTooltip: (props) => <ChartTooltip {...props} valueFormatter={amount.exact} />,
    showLegend,
    style: { height },
  };

  // Kombi: intäkterna som fyllda staplar, utgifterna som dämpade staplar
  // bakom dem, och RESULTATET (intäkter minus utgifter) som en mjuk linje
  // ovanpå. Det är den enda av de fyra formerna som visar något de andra
  // inte gör: skillnaden mellan staplarna, alltså det som faktiskt blev
  // kvar, utan att man behöver mäta höjdskillnaden med ögat. Linjen är
  // grön av samma skäl som Resultat-brickan är det — den mäter samma sak.
  if (variant === 'combo') {
    const comboData = tickData.map(d => ({ ...d, Resultat: (d.Intäkter || 0) - (d.Utgifter || 0) }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={comboData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
          <XAxis dataKey={indexKey} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={amount.axis} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={amount.axisWidth} />
          <Tooltip content={<ChartTooltip valueFormatter={amount.exact} />} cursor={{ fill: 'var(--bg-muted)', opacity: 0.4 }} />
          <Bar dataKey="Intäkter" fill={palette.income} radius={[4, 4, 0, 0]} maxBarSize={CHART_BAR_SIZE} isAnimationActive={false} />
          {/* Dämpad, inte bara ljusare: utgiftsstapeln ska läsas som
              bakgrund till intäktsstapeln, annars konkurrerar de två om
              samma plats i blicken och linjen försvinner mellan dem. */}
          <Bar dataKey="Utgifter" fill={palette.cost} fillOpacity={0.28} radius={[4, 4, 0, 0]} maxBarSize={CHART_BAR_SIZE} isAnimationActive={false} />
          <Line type="monotone" dataKey="Resultat" stroke={palette.profit} strokeWidth={CHART_STROKE} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }
  // Dagsupplösning har typiskt 30–90 punkter — staplar blir då ett
  // kammliknande sudd, så stapelvalet faller tillbaka på yta. Linje och yta
  // väljs fortfarande fritt.
  const effective = (granularity === 'day' && variant === 'bar') ? 'area' : variant;
  if (effective === 'line' || effective === 'area') {
    return (
      <TremorAreaChart
        {...shared}
        fill={effective === 'area' ? 'gradient' : 'none'}
        curveType="monotone"
        strokeWidth={CHART_STROKE}
        // Punkter i LINJEläget, inte i ytläget: ytan har redan en tydlig
        // kant mot bakgrunden, och punkter ovanpå en fylld yta blir prickar
        // i ett fält snarare än markörer på en kurva.
        showDots={effective === 'line'}
        connectNulls
      />
    );
  }
  // TremorBarChart känner inte till streckade serier; egenskapen hör bara
  // till kurvlägena och skickas därför inte vidare hit.
  const { dashedCategories: _dashed, ...barShared } = shared;
  return (
    <TremorBarChart
      {...barShared}
      // Utan ett tak blir recharts egen bandbredd omotiverat fet när det
      // bara finns få kategorier (t.ex. "3 mån") i ett brett kort.
      maxBarSize={CHART_BAR_SIZE}
      barGap={3}
    />
  );
}
/** Generell trendgraf som kan rita SAMMA data som Stapel, Linje eller
 * gradientfylld Yta (styrt av `format` — ett anropar-internt val, inte
 * längre en synlig växlare i UI:t; se kodgranskningen vid PeriodTabs ovan
 * för varför den knappraden togs bort) — ersätter de tidigare
 * fast-formaterade CashflowAreaChart/MarginTrendChart (togs bort här; bara
 * Företagsöversikten konsumerade dem, se ReportDetail.jsx) med EN
 * komponent istället för en nästan-identisk kopia per diagramformat.
 * Företagsöversikten anropar den numera bara med ETT fast `format` per
 * kort (t.ex. Marginalutveckling: alltid 'area') — Kassaflödet har flyttat
 * till en egen CashflowComparisonChart nedan, en riktigare Tremor-graf.
 *
 * `colorBySign`: färgar varje stapel grönt/rött efter tecken (Bar-läget,
 * t.ex. Resultat) istället för en enda `color` — bara meningsfullt för
 * Stapel-formatet, eftersom Linje/Yta bara kan ha EN stroke-färg för hela
 * serien (ingen "delad färg vid nolla"-gradient-trick här, se `color`-
 * fallet nedan som väljer en enda färg efter seriens ÖVERGRIPANDE tecken).
 * `prevDataKey`/`prevName`: valfri streckad, dämpad jämförelseserie (samma
 * konvention som resten av rapportportalen — se ComparisonLegend). `null`-
 * punkter (`connectNulls={false}`, gäller Linje/Yta) ritas som ett glapp,
 * aldrig en missvisande nolla — se Företagsöversiktens marginaldata. */
export function TrendChart({
  data, format = 'bar', dataKey, name, color, colorBySign = false,
  prevDataKey, prevName, prevColor = 'var(--text-muted)',
  yTickFormatter = v => formatSEK(v).replace(/\s?kr$/, ''), valueFormatter = formatSEK,
  // 60 (inte 48) som standard — matchar ResultBarChart/CashflowLineChart
  // ovan: en SEK-formatterad axel ("125 000") behöver mer bredd än en
  // procentaxel, annars klipper <svg>:ns default `overflow: hidden` bort
  // den första siffran (samma bugg som RevenueExpenseChart/
  // CashflowComparisonChart ovan fixade). Marginalutveckling
  // (ReportDetail.jsx) skickar 52 uttryckligen — en procentetikett
  // ("64.4%") behöver mindre men inte NOLL extra marginal.
  yAxisWidth = 60,
  height = 220, isMobile,
}) {
  const tickData = useMemo(() => {
    const labels = thinLabels(data.map(d => d.label), isMobile);
    return data.map((d, i) => ({ ...d, label: labels[i] }));
  }, [data, isMobile]);
  // Stapel-lägets per-punkt-tecken-färgning gäller bara Bar; Linje/Yta får
  // en enda stroke-färg vald efter seriens SAMMANLAGDA tecken (samma
  // förenkling som Dashboard.jsx:s Resultat-linjeformat använder).
  const singleColor = color || (colorBySign ? (data.reduce((s, d) => s + (d[dataKey] || 0), 0) >= 0 ? REVENUE : EXPENSE) : 'var(--accent)');

  const axesAndTooltip = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={yTickFormatter} width={yAxisWidth} />
      <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
      <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={format === 'bar' ? { fill: 'rgba(0,0,0,0.02)' } : { stroke: 'var(--border)', strokeWidth: 1 }} />
    </>
  );
  const prevLine = prevDataKey && (
    <Line type="monotone" dataKey={prevDataKey} name={prevName} stroke={prevColor} strokeWidth={2} strokeDasharray="4 3" dot={false} />
  );

  if (format === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={tickData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          {axesAndTooltip}
          {/* `fill` sätts även när colorBySign är sant (då egentligen
              onödigt — varje stapel målas om av sin egen Cell nedan) med
              flit: Recharts v3 läser <Legend>-swatchens färg från Bar-
              elementets EGNA fill, inte från Cell-barnen (se Dashboard.jsx:s
              motsvarande kommentar/fix) — men den här komponenten renderar
              ingen <Legend> alls (ComparisonLegend ovanför/under bär den
              rollen, som i resten av rapportportalen), så det är bara ett
              ofarligt säkerhetsnät om någon lägger till en Legend senare. */}
          <Bar dataKey={dataKey} name={name} fill={singleColor} radius={[4, 4, 0, 0]} barSize={18}>
            {colorBySign && tickData.map((d, i) => <Cell key={i} fill={d[dataKey] >= 0 ? REVENUE : EXPENSE} />)}
          </Bar>
          {prevLine}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Sida 56, kundfeedback: blockets EGNA Card+titel+summeringsrad
  // (AreaChartBlock, förra försöket) dubblerade det ComparisonLegend
  // redan visar ovanför/under det här kortet i varje rapportvy (se
  // ReportDetail.jsx) — en andra titel, en andra "aktuell vs föregående"-
  // summering, och EN ANNAN färg (blue/violet, blockets egna exempelfärger)
  // än ComparisonLegend faktiskt visar. Nu bara AreaChart-komponenten,
  // inget eget Card/titel/summering, och samma nedtonade, axelfria stil
  // (showYAxis={false}, startEndOnly, fill="solid") som blocks.tremor.so:s
  // egna exempel — bara utan deras överflödiga kort runt omkring.
  if (format === 'area') {
    const categories = prevDataKey ? [name, prevName] : [name];
    const colors = prevDataKey ? [singleColor, CHART_MUTED] : [singleColor];
    // TrendChart's data har redan dataKey/prevDataKey som fältnamn (t.ex.
    // "resultat"/"prevResultat") — Tremor vill ha fältnamnet som matchar
    // "name"/"prevName" (dess `categories`), så vi mappar om till en kopia
    // istället för att ändra hela datakontraktet uppåt i anropskedjan.
    const tremorData = tickData.map((d) => ({
      label: d.label,
      [name]: d[dataKey],
      ...(prevDataKey ? { [prevName]: d[prevDataKey] } : {}),
    }));
    return (
      <TremorAreaChart
        data={tremorData}
        index="label"
        categories={categories}
        colors={colors}
        valueFormatter={valueFormatter}
        showLegend={false}
        showYAxis={false}
        startEndOnly={true}
        fill="solid"
        style={{ height }}
      />
    );
  }

  const ChartTag = LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartTag data={tickData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        {axesAndTooltip}
        <Line type="monotone" dataKey={dataKey} name={name} stroke={singleColor} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} connectNulls={false} />
        {prevLine}
      </ChartTag>
    </ResponsiveContainer>
  );
}

// (Här låg tidigare `mapToTremorColor`, som översatte appens hexar till
// närmaste av Tremors nio namngivna Tailwind-tokens — den kompromissen
// behövs inte längre sedan porten tar rå hex, se CHART_INCOME-blocket högst
// upp. Färgen som skickas in ÄR numera färgen som ritas.)

/** Kassaflödets diagram — en riktig port av Tremors egna "month to date"-
 * jämförelsemönster (blocks.tremor.so/blocks/line-charts, "Line Chart 4":
 * `currentMonth` mot `lastMonth` som två linjer på SAMMA axel, en tunn
 * grå för föregående period och en solid färgad för den valda — inte
 * TrendChart's generella Stapel/Linje/Yta-val ovan (det korthörde bort,
 * se kodgranskningen vid PeriodTabs). `fill="none"` på Tremor Raw
 * AreaChart gör ytan osynlig så bara linjen syns (samma knep som
 * RevenueExpenseChart's dagsvy ovan) — det är alltså en riktig linjegraf
 * byggd på samma porterade komponent, inte ett eget LineChart-bygge.
 *
 * `previousLabel` (valfri): utelämnas för "Sedan start" (overviewPeriodBounds:
 * `hasComparison: false`) — det finns ingen meningsfull "föregående period"
 * före företagets första bokförda dag, så grafen ritar då bara EN linje
 * istället för att jämföra mot en period som per definition alltid är 0 kr. */
export function CashflowComparisonChart({ data, currentLabel, previousLabel, height = 320, showLegend = false, fill = 'none', variant }) {
  const { palette, amount } = useReportDisplay();
  const categories = previousLabel ? [currentLabel, previousLabel] : [currentLabel];
  const colors = previousLabel ? [palette.cash, palette.muted] : [palette.cash];
  const shared = {
    data,
    index: 'label',
    categories,
    colors,
    valueFormatter: amount.exact,
    tickFormatter: amount.axis,
    yAxisWidth: amount.axisWidth,
    customTooltip: (props) => <ChartTooltip {...props} valueFormatter={amount.exact} />,
    showLegend,
    style: { height },
  };
  // Staplar för ett ACKUMULERAT saldo är medvetet tillåtet men aldrig
  // förvalt: saldot är en nivå, inte ett flöde, och nivåer läses bäst som
  // en linje. Vill man ändå se varje mätpunkt för sig är stapeln rätt form,
  // och det är just det valet väljaren finns till för.
  if (variant === 'bar') {
    return <TremorBarChart {...shared} maxBarSize={CHART_BAR_SIZE} barGap={3} />;
  }
  return (
    // Axeln i tusental ("500 tkr"), tooltipen i exakta kronor.
    <TremorAreaChart
      {...shared}
      fill={variant ? (variant === 'area' ? 'gradient' : 'none') : fill}
      curveType="monotone"
      strokeWidth={CHART_STROKE}
      showDots={variant === 'line'}
      connectNulls
    />
  );
}
/** Marginalanalysens tre linjer (utkastets "Brutto / Rörelse / Vinst") —
 * samma kvot med olika mycket kostnader avdragna, se buildMarginSeries i
 * reportCalculations.js för vad varje linje faktiskt drar av.
 *
 * `connectNulls={false}` med flit: en period utan intäkter ger `null`, och
 * en bryggad linje över det glappet hade ritat en marginal som aldrig
 * fanns. Ett hål i linjen är det ärliga svaret.
 *
 * Utkastet ritar den tredje linjen prickad. Den porterade AreaChart kan inte
 * sätta streckmönster per serie, så de tre skiljs på färg i stället —
 * mörkgrön → mellangrön → blå, samma familj som resten av arket. */
// Marginalerna är lönsamhet — alltså grönt, samma familj som Resultat, och
// INTE tre nominellt olika kulörer. Djupare grönt ju längre ner i
// resultaträkningen måttet ligger: bruttomarginalen är den bredaste och
// ljusaste, vinstmarginalen är den som faktiskt blir kvar och därför den
// mörkaste. Ordningen i färgen speglar ordningen i beräkningen.
export const MARGIN_SERIES = [
  { key: 'brutto', label: 'Bruttomarginal', color: KPI_GRADIENTS.positive[1] },
  { key: 'rorelse', label: 'Rörelsemarginal', color: KPI_GRADIENTS.positive[0] },
  { key: 'vinst', label: 'Vinstmarginal', color: '#1c5c28' },
];

/** `series` låter anroparen visa en DELMÄNGD av trappan — se
 * `visibleMargins` i ReportDetail.jsx: lager utan kostnader ritas annars
 * antingen platt i taket eller exakt ovanpå lagret under. */
/** `series` låter anroparen visa en DELMÄNGD av trappan. Färgerna kommer
 * från paletten (resultatfamiljen) och inte från seriens egen `color`, så
 * ett byte av resultatfärg slår igenom även här. */
export function MarginLinesChart({ data, series = MARGIN_SERIES, isMobile, height = 200, variant = 'line' }) {
  const { palette } = useReportDisplay();
  const chartData = useMemo(() => {
    const labels = thinLabels(data.map(d => d.label), isMobile);
    return data.map((d, i) => {
      const row = { label: labels[i] };
      series.forEach(s => { row[s.label] = d[s.key]; });
      return row;
    });
  }, [data, series, isMobile]);
  const shared = {
    data: chartData,
    index: 'label',
    categories: series.map(s => s.label),
    colors: series.map(s => palette.marginTones[MARGIN_SERIES.findIndex(m => m.key === s.key)] || palette.profit),
    valueFormatter: v => formatPct(v),
    tickFormatter: v => `${Math.round(v)} %`,
    yAxisWidth: 52,
    // Procenttal: ingen härledd resultatrad, den skulle vara meningslös
    // (skillnaden mellan två marginaler är inte ett belopp).
    customTooltip: (props) => <ChartTooltip {...props} showDerived={false} valueFormatter={v => formatPct(v)} />,
    showLegend: false,
    style: { height },
  };
  if (variant === 'bar') return <TremorBarChart {...shared} maxBarSize={CHART_BAR_SIZE} barGap={3} />;
  return (
    // `connectNulls={false}` med flit: en period utan intäkter ger `null`,
    // och en bryggad linje över det glappet hade ritat en marginal som
    // aldrig fanns. Ett hål i linjen är det ärliga svaret.
    <TremorAreaChart
      {...shared}
      fill={variant === 'area' ? 'gradient' : 'none'}
      curveType="monotone"
      strokeWidth={CHART_STROKE}
      showDots={variant === 'line'}
      connectNulls={false}
    />
  );
}
export function CostBreakdownDonut({ categories, total, variant = 'donut' }) {
  const { palette, amount } = useReportDisplay();
  const data = categories.map((c, i) => ({ ...c, color: palette.costRamp[(c.colorIndex ?? i) % palette.costRamp.length] }));
  return (
    // Ringen ligger CENTRERAD ÖVER legenden (inte bredvid den), som i
    // utkastet — i en halvbred panel får ringen då sin fulla storlek och
    // legendraderna hela bredden för namn + belopp + andel.
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Ingen text i ringens mitt (som i utkastet). Den visade samma summa som
          KOSTNADER-brickan högst upp på arket redan bär, och dessutom i en
          ANNAN enhet än legendraderna strax under — samma tal, tre gånger, i
          två format. Ringen visar proportionen, raderna visar beloppen.
          `isAnimationActive={false}`: recharts svepanimation gjorde att ringen
          kunde fångas halvritad (en "C" i stället för en ring) medan sidan
          laddade — resten av arkets diagram animerar inte heller. */}
      {/* Staplar i stället för ring: samma andelar, men jämförbara mot
          varandra på en gemensam baslinje i stället för som cirkelsektorer
          — den enda av de tre formerna där man kan avgöra att en post är
          exakt dubbelt så stor som en annan.

          LIGGANDE staplar, inte stående: kategorinamnen ("Övriga externa
          kostnader") är för långa för att stå under varsin stående stapel
          utan att lutas eller kortas av. Liggande får varje namn en hel
          rad, och den skala som faktiskt bär jämförelsen (kronor) hamnar
          på den axel som har plats för den.

          Egen recharts-graf i stället för listan med CSS-spår som stod här
          förut: en riktig axel med sina egna tickar gör att man kan avläsa
          ETT belopp ur diagrammet, inte bara jämföra två staplars längd. */}
      {variant === 'bar' ? (
        <div style={{ width: '100%', height: Math.max(data.length * 52 + 40, 180) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-light)" />
              <XAxis
                type="number" tickFormatter={amount.axis}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
              />
              {/* `width` räcker till två radbrutna rader — kategorinamnen är
                  fasta och kända (se COST_CATEGORIES), det längsta är
                  "Övriga externa kostnader". */}
              <YAxis
                type="category" dataKey="name" width={118}
                tick={{ fontSize: 11.5, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false}
              />
              <Tooltip content={<ChartTooltip valueFormatter={amount.exact} />} cursor={{ fill: 'var(--bg-muted)', opacity: 0.5 }} />
              <Bar dataKey="amount" name="Belopp" radius={[0, 4, 4, 0]} maxBarSize={30} isAnimationActive={false}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
      <div style={{ width: '216px', height: '216px', position: 'relative', alignSelf: 'center' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data} dataKey="amount" nameKey="name"
              // Paj = samma ring utan hål. Ringen är förvalet (lättare att
              // jämföra sektorernas vinklar när mitten inte drar blicken),
              // pajen finns för den som helt enkelt läser den formen bättre.
              innerRadius={variant === 'pie' ? 0 : 68} outerRadius={102}
              paddingAngle={data.length > 1 && variant !== 'pie' ? 2 : 0} stroke="none"
              isAnimationActive={false}
            >
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      )}
      {/* Legendraderna hör till alla tre formerna: ringen och pajen visar
          bara proportionen, och stapelaxeln bara storleksordningen — de
          exakta kronorna och andelarna står här. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        {data.map(d => (
          <div
            key={d.name}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', padding: '6px', borderRadius: '6px', transition: 'background-color 0.12s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {/* Rund prick (inte fyrkant) — samma legendmarkör som resten av
                arket använder, se InlineLegend. */}
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatSEK(d.amount)}</span>
            {/* "<1%" istället för "0%": en post med ett verkligt belopp (t.ex.
                Personal 295 kr av 264 273 kr) fick tidigare siffran 0% bredvid
                sig, vilket läser som "ingenting" om en rad som faktiskt finns
                — och som dessutom syns i ringen. */}
            <span style={{ color: 'var(--text-muted)', fontWeight: 500, width: '38px', textAlign: 'right' }}>{formatSharePct(d.amount, total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Topp-kostnadskonton som en rankad lista med horisontella barer — en
 * finmaskigare, kontospecifik komplettering till CostBreakdownDonut ovans
 * fyra breda hinkar: "vart tar pengarna vägen, konto för konto" istället
 * för bara "vilken bred kategori". Byggd i vanlig HTML/CSS precis som
 * BalanceSheetTable/donutens legend ovan, inte recharts — en ren
 * ranking-lista har inget att vinna på ett SVG-koordinatsystem.
 * Återanvänder samma COST_CATEGORY_COLORS/COST_BG som donuten ovan (fanns
 * sedan tidigare, aldrig konsumerade) så de två panelerna hör ihop
 * visuellt trots att de grupperar kostnaderna helt olika. */
export function CostRankingList({ rows, total }) {
  const { palette } = useReportDisplay();
  const top = rows.slice(0, 5);
  const max = top.length ? top[0].amount : 0;
  const restTotal = total - top.reduce((s, r) => s + r.amount, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {top.map((r, i) => (
        <div key={r.code}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px', marginBottom: '5px' }}>
            <span style={{ color: 'var(--text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.code} {r.name}</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatSEK(r.amount)}</span>
          </div>
          <div style={{ height: '10px', borderRadius: '999px', background: palette.costWash, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '999px', width: `${max ? (r.amount / max) * 100 : 0}%`, background: palette.costRamp[i % palette.costRamp.length] }} />
          </div>
        </div>
      ))}
      {rows.length > top.length && (
        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
          + {rows.length - top.length} till konto, {formatSEK(restTotal)} totalt
        </p>
      )}
    </div>
  );
}

/** Nyckeltalen som ringar. Kundönskemål: panelen skulle bli bättre — den
 * gamla versionen ritade tre koncentriska ringar och en legend under, och
 * hade två problem som båda handlar om samma sak, att ringarna inte var
 * jämförbara med varandra:
 *   1. Tre mått med HELT olika rimliga nivåer (en vinstmarginal på 20 % är
 *      bra, en soliditet på 20 % är svag) delade samma 0–100-skala, så en
 *      läsare uppmuntrades att jämföra tre ringar som inte hör ihop.
 *   2. Den innersta ringen var alltid kortast i omkrets, så samma procent
 *      SÅG mindre ut längst in — en ren synvilla ur geometrin.
 *
 * Nu får varje nyckeltal en EGEN ring i egen storlek, med värdet i mitten
 * och en kort förklaring under. Måtten står bredvid varandra i stället för
 * inuti varandra, vilket är sant mot vad de är: tre fristående mått, inte
 * tre delar av en helhet.
 *
 * Skalan är fortfarande klippt vid 100 %: kassalikviditet kan mycket väl
 * vara 212 %, men en ring som varvar mer än ett varv läser fel (den ser ut
 * som 12 %). Ringen visar därför "minst fullt" och den exakta siffran står
 * i mitten, där den inte kan missförstås. */
export function KeyFigureGauge({ figures }) {
  const rows = (figures || []).filter(f => f.value != null);
  if (!rows.length) return <EmptyState text="Saknar underlag för nyckeltal." />;
  const size = 108;
  const center = size / 2;
  const radius = center - 9;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="kpi-gauge-row" style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
      {rows.map(f => {
        const pct = Math.max(0, Math.min(f.value, 100));
        // Ett mått som saknar underlag (t.ex. soliditet utan eget kapital)
        // ritas som en tom ring med "—" i mitten i stället för en ring på
        // 0 %, som läser som "mätt, och resultatet blev noll".
        const missing = !Number.isFinite(f.value);
        return (
          <div key={f.label} style={{ flex: '1 1 130px', minWidth: 0, textAlign: 'center' }}>
            <div style={{ position: 'relative', width: size, height: size, margin: '0 auto 10px' }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${f.label}: ${f.display}`}>
                <g transform={`rotate(-90 ${center} ${center})`}>
                  <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--bg-muted)" strokeWidth="10" />
                  {!missing && pct > 0 && (
                    <circle
                      cx={center} cy={center} r={radius} fill="none" stroke={f.color} strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${(circumference * pct) / 100} ${circumference}`}
                    />
                  )}
                </g>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15.5px', fontWeight: 800, color: missing ? 'var(--text-muted)' : 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {missing ? '—' : f.display}
              </div>
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>{f.label}</div>
            {f.help && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '3px' }}>{f.help}</div>
            )}
            {/* Värdet står i ringen, men procenttalet självt säger inget om
                huruvida ringen är klippt. Den som ligger över 100 % får det
                utskrivet i stället för att undra varför ringen är full. */}
            {!missing && f.value > 100 && (
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>ringen visar 100 %</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
// Kundönskemål (Sida 14c, uppföljning: alla rapporter ska matcha Företags-
// översiktens ark-look): levde tidigare i sitt EGET rundade/kantade kort
// (border-radius, border, egen bakgrund) — dubblerade SheetPanel:s kort
// runt sig, ett kort inuti ett kort. `title` togs bort ur den här
// komponenten av samma skäl — SheetPanel:s egen rubrikrad äger rubriken
// nu, ingen anropare skickar längre in en egen.
export function BalanceSheetTable({ rows, total }) {
  return (
    <div>
      {rows.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Inga bokförda saldon</div>
      ) : rows.map(r => (
        <div
          key={r.code}
          style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)', fontSize: '13.5px', transition: 'background-color 0.12s ease' }}
        >
          <span style={{ color: 'var(--text-main)' }}>{r.name}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{formatSEK(r.amount)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
        <span>Summa</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatSEK(total)}</span>
      </div>
    </div>
  );
}

/** Rapportkortets generiska ram — sektionsrubrik + valfri undertext, samma
 * "kräm"-kort som redan etablerats för varje flik (Sida 14c). Delad här så
 * varje rapport i ReportDetail.jsx inte behöver upprepa samma
 * bakgrund/padding/skugga-stil för sig. */
// `actions` (valfri): en högerjusterad kontroll bredvid titeln — hittills
// bara ChartFormatToggle (Företagsöversikten), men skriven generellt så
// ett framtida rapportkort kan lägga en egen knapp/väljare där utan att
// själv bygga om hela rubrikraden. Bakåtkompatibel: alla befintliga 11
// rapportvyer som inte skickar `actions` renderas pixel-för-pixel
// oförändrade (samma villkor/marginaler som innan för title/subtitle).
// `headline` (valfri): kortets EGET nyckeltal, högerjusterat på rubrikraden
// — `{ label, value }`, t.ex. `{ label: 'jan–sep', value: '571 800 kr' }`.
// Kundgenomgång (jämförelse mot Oxceeds företagsöversikt, som gör exakt
// detta i varje panel): deras kort svarar på "hur mycket?" innan man ens
// hunnit läsa diagrammet, medan våra bara hade en rubrik + en förklarande
// mening och tvingade läsaren att tolka en axel för att få ut ett tal.
// Talet står i samma sans som resten, med proportionella siffror (se
// KpiCard-kommentaren om tabular-nums) och periodetiketten som en dämpad
// eyebrow före — aldrig i seriens färg, den identiteten bär diagrammet.
export function ReportSection({ title, subtitle, headline, actions, children }) {
  const hasHeader = title || actions || headline;
  return (
    <div style={{ background: 'var(--bg-cream, #faf9f5)', border: '1px solid var(--bg-cream-border, #ede9de)', borderRadius: '18px', padding: '26px 28px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      {hasHeader && (
        <div className="sheet-panel-head" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: subtitle ? '5px' : '18px' }}>
          {title && <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{title}</div>}
          {headline && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginLeft: 'auto' }}>
              {headline.label && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{headline.label}</span>}
              <span style={{ fontSize: '17px', fontWeight: 800, color: headline.accent || 'var(--text-main)', letterSpacing: '-0.02em' }}>{headline.value}</span>
            </div>
          )}
          {actions}
        </div>
      )}
      {subtitle && <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.55, maxWidth: '62ch' }}>{subtitle}</p>}
      {children}
    </div>
  );
}

/** Enkel dataframställningstabell — Rad/Benämning/Belopp-mönstret som
 * redan används för INK2R (Taxes.jsx) och nu återanvänds rakt av för
 * Huvudbok/Momsrapport/Fakturarapporter/Lönerapporter, istället för att
 * varje rapport bygger sin egen `<table>` från grunden.
 *
 * Kodgranskning: MEDVETET inte samma komponent som listsidornas
 * `ListTable` (shared/ListTable.jsx), trots det överlappande kontraktet
 * (columns/rows/rowKey/render) — inte en glömd andra kopia. Två faktiska
 * skillnader gör en sammanslagning fel just nu:
 *   1. `footer` (summeringsrad) och `emphasize` (fetstil totalrad) finns
 *      bara här — ListTable saknar båda, och 11 rapportvyer i
 *      ReportDetail.jsx beror på dem.
 *   2. Inget eget kort/border/skugga här (bara `overflowX:auto`) —
 *      ReportSection ovan lägger redan på kortet runt om, till skillnad
 *      från ListTable som ALLTID renderar sitt eget. Att återanvända
 *      ListTable rakt av hade gett rapportsidorna kort-i-kort.
 * Att bygga ihop dem kräver att ListTable själv får footer/emphasize-stöd
 * OCH ett sätt att stänga av sin egen kortram — värt att göra, men en egen
 * förändring att verifiera mot alla 11 rapportvyer, inte en bieffekt av
 * den här kodgranskningen. */
export function DataTable({ columns, rows, rowKey, footer }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map(c => (
              <th key={c.key} style={{ textAlign: c.align || 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, width: c.width }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row, i) : i} style={{ borderBottom: '1px solid var(--border-light)' }}>
              {columns.map(c => (
                <td key={c.key} style={{ textAlign: c.align || 'left', padding: '8px 10px', color: c.emphasize ? 'var(--text-main)' : 'var(--text-secondary)', fontWeight: c.emphasize ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
                  {c.render ? c.render(row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr style={{ background: 'var(--bg-muted)', fontWeight: 800 }}>
              {footer.map((f, i) => (
                <td key={i} style={{ textAlign: columns[i]?.align || 'left', padding: '10px' }}>{f}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
