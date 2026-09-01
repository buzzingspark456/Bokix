import React, { useMemo, useId } from 'react';
import {
  HelpCircle, ArrowUpRight, ArrowDownRight, Inbox, BarChart2,
  // Aliasade — krockar annars med recharts-komponenterna av samma namn
  // som redan importeras nedan (ikoner, inte diagram).
  LineChart as LineChartIcon, AreaChart as AreaChartIcon,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

// Delade presentationsdelar för Rapport och analys — flyttade hit oförändrade
// från Reports.jsx (Sida 14c) när sidan byggdes om till en rapportportal
// (Sida 14c, uppföljning: 14 namngivna rapporter) så att både listsidan
// (Reports.jsx) och den nya detaljvyn (ReportDetail.jsx) delar EXAKT
// samma kort/diagram-stil istället för att en tredje, avvikande stil
// smyger sig in i detaljvyn.

export const REVENUE = '#639922';
export const EXPENSE = '#E24B4A';
export const COST_LIGHT = '#e0527a';
export const COST_DARK = '#c8305a';
export const COST_BG = '#fbe7ed';
export const COST_CATEGORY_COLORS = [COST_DARK, COST_LIGHT, '#ec7ca0', '#f4b8d0'];

export function thinLabels(labels, isMobile) {
  if (!isMobile || labels.length <= 6) return labels;
  const interval = Math.ceil(labels.length / 6);
  return labels.map((l, i) => (i % interval === 0 ? l : ''));
}

export const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(val || 0);
export const fmtDate = (d) => new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(d instanceof Date ? d : new Date(d));
export const fmtMonthYear = (d) => new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(d);
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function formatDelta(current, previous, invert = false) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return { text: 'Ingen bokföring under samma period förra året', good: null };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rising = pct >= 0;
  const good = invert ? !rising : rising;
  return { text: `${rising ? '+' : ''}${pct.toFixed(0)}% mot samma period föregående år`, good };
}

export function KpiCard({ label, value, help, delta, accent, icon: Icon, iconBg, gradient }) {
  const bold = !!gradient;
  return (
    <div
      style={{
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
      <div style={{ fontSize: '23px', fontWeight: 800, color: bold ? '#fff' : (accent || 'var(--text-main)'), letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: delta ? '6px' : 0, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {delta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: bold ? 'rgba(255,255,255,0.9)' : (delta.good === null ? 'var(--text-muted)' : delta.good ? 'var(--status-green-text)' : 'var(--status-red-text)') }}>
          {delta.good !== null && (delta.good ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
          {delta.text}
        </div>
      )}
    </div>
  );
}

export function TabHeadline({ label, value, accent, delta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{label}</span>
      <span style={{ fontSize: '32px', fontWeight: 800, color: accent || 'var(--text-main)', lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
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
export function ChartTooltip({ active, payload, label, valueFormatter = formatSEK }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(p => p.value != null && p.name !== undefined);
  if (!rows.length) return null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.09)', fontSize: '12.5px', minWidth: '160px' }}>
      {label && <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', fontSize: '13px' }}>{label}</div>}
      {rows.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
          </div>
          <strong style={{ color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{valueFormatter(p.value)}</strong>
        </div>
      ))}
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
  const tickData = useMemo(() => {
    const labels = thinLabels(data.map(d => d.label), isMobile);
    return data.map((d, i) => ({ ...d, label: labels[i] }));
  }, [data, isMobile]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={tickData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => formatSEK(v).replace(/\s?kr$/, '')} width={54} />
        <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
        <Bar dataKey="resultat" radius={[4, 4, 0, 0]} barSize={18} name="Resultat">
          {tickData.map((d, i) => <Cell key={i} fill={d.resultat >= 0 ? REVENUE : EXPENSE} />)}
        </Bar>
        <Line dataKey="prevResultat" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="4 3" dot={false} name="Föregående period" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashflowLineChart({ data, isMobile }) {
  const tickData = useMemo(() => {
    const labels = thinLabels(data.map(d => d.label), isMobile);
    return data.map((d, i) => ({ ...d, label: labels[i] }));
  }, [data, isMobile]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={tickData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => formatSEK(v).replace(/\s?kr$/, '')} width={54} />
        <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
        <Line dataKey="balance" stroke="var(--accent)" strokeWidth={2.5} dot={false} name="Saldo" />
        <Line dataKey="prevBalance" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="4 3" dot={false} name="Föregående period" />
      </LineChart>
    </ResponsiveContainer>
  );
}

const CHART_FORMAT_ICONS = { bar: BarChart2, line: LineChartIcon, area: AreaChartIcon };
const CHART_FORMAT_LABELS = { bar: 'Stapel', line: 'Linje', area: 'Yta' };

/** Diagramformat-växlare (Stapel/Linje/Yta) för ett rapportkorts header —
 * kundönskemål efter Företagsöversiktens första version: kunna VÄLJA typ
 * av graf för en serie, inte bara få en fast vy. Rent presentationsval,
 * inget nytt tal räknas fram — `TrendChart` nedan konsumerar `value` och
 * ritar om exakt samma data i den valda formen.
 * `formats`: vilken delmängd som är meningsfull för just den serien (t.ex.
 * Omsättning och resultat erbjuder alla tre, en ren procentserie som
 * Marginalutveckling bara linje/yta — en "marginal-stapel" per månad läses
 * sämre än en trend, se choosing-a-form-resonemanget i dataviz-skillen). */
export function ChartFormatToggle({ value, onChange, formats = ['bar', 'line', 'area'] }) {
  return (
    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-muted)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)', flexShrink: 0 }}>
      {formats.map(f => {
        const Icon = CHART_FORMAT_ICONS[f];
        return (
          <button key={f} onClick={() => onChange(f)} title={CHART_FORMAT_LABELS[f]} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 9px', borderRadius: '5px', border: 'none', cursor: 'pointer',
            fontSize: '11.5px', fontWeight: value === f ? 600 : 400,
            background: value === f ? 'var(--bg-card)' : 'transparent',
            color: value === f ? 'var(--text-main)' : 'var(--text-muted)',
            boxShadow: value === f ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}>
            <Icon size={12} />
            {CHART_FORMAT_LABELS[f]}
          </button>
        );
      })}
    </div>
  );
}

/** Generell trendgraf som kan rita SAMMA data som Stapel, Linje eller
 * gradientfylld Yta (styrt av `format`, se ChartFormatToggle ovan) — ersätter
 * de tidigare fast-formaterade CashflowAreaChart/MarginTrendChart (togs bort
 * här; bara Företagsöversikten konsumerade dem, se ReportDetail.jsx) med EN
 * komponent istället för en nästan-identisk kopia per diagramformat.
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
  // 54 (inte 48) som standard — matchar ResultBarChart/CashflowLineChart
  // ovan: en SEK-formatterad axel ("125 000") behöver mer bredd än en
  // procentaxel. Marginalutveckling (ReportDetail.jsx) skickar 48 uttryckligen,
  // precis som gamla MarginTrendChart gjorde — annars klipps kronbelopp av.
  yAxisWidth = 54,
  height = 220, isMobile,
}) {
  const gradientId = useId();
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

  const ChartTag = format === 'area' ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartTag data={tickData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        {format === 'area' && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={singleColor} stopOpacity={0.30} />
              <stop offset="95%" stopColor={singleColor} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        {axesAndTooltip}
        {format === 'area'
          ? <Area type="monotone" dataKey={dataKey} name={name} stroke={singleColor} strokeWidth={2.5} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 5 }} connectNulls={false} />
          : <Line type="monotone" dataKey={dataKey} name={name} stroke={singleColor} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} connectNulls={false} />}
        {prevLine}
      </ChartTag>
    </ResponsiveContainer>
  );
}

export function CostBreakdownDonut({ categories, total }) {
  const data = categories.map((c, i) => ({ ...c, color: COST_CATEGORY_COLORS[i % COST_CATEGORY_COLORS.length] }));
  return (
    <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ width: '220px', height: '220px', flexShrink: 0, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Totalt</span>
          <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{formatSEK(total)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '200px' }}>
        {data.map(d => (
          <div
            key={d.name}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', padding: '4px 6px', borderRadius: '6px', transition: 'background-color 0.12s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-main)', fontWeight: 600, flex: 1 }}>{d.name}</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatSEK(d.amount)}</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500, width: '38px', textAlign: 'right' }}>{total ? Math.round(d.amount / total * 100) : 0}%</span>
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
          <div style={{ height: '8px', borderRadius: '999px', background: COST_BG, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '999px', width: `${max ? (r.amount / max) * 100 : 0}%`, background: COST_CATEGORY_COLORS[i % COST_CATEGORY_COLORS.length] }} />
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

export function BalanceSheetTable({ title, rows, total }) {
  return (
    <div style={{ flex: 1, minWidth: '260px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>{title}</div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Inga bokförda saldon</div>
        ) : rows.map(r => (
          <div
            key={r.code}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '13.5px', transition: 'background-color 0.12s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span style={{ color: 'var(--text-main)' }}>{r.name}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{formatSEK(r.amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-muted)', fontWeight: 800, fontSize: '14px' }}>
          <span>Summa</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatSEK(total)}</span>
        </div>
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
export function ReportSection({ title, subtitle, actions, children }) {
  return (
    <div style={{ background: 'var(--bg-cream, #faf9f5)', border: '1px solid var(--bg-cream-border, #ede9de)', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: subtitle ? '4px' : '16px' }}>
          {title && <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{title}</div>}
          {actions}
        </div>
      )}
      {subtitle && <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>{subtitle}</p>}
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
