import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check } from '../../icons';
import { BRAND } from '../../../utils/brandColors';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, ACCENT } from '../marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../../utils/seo';
import { TOOLS, TOOLS_HUB_PATH } from './toolsConfig';
import { dateTimeFormat } from '../../../utils/intlCache';

// ── Gemensamt skal för alla fria verktyg (/verktyg/*) ───────────────────
// Samma roll som PolicyLayout.jsx har för de fyra juridiska sidorna: ett
// halvdussin verktyg som var för sig hade blivit lika många lite olika
// sidor, med samma rubriknivåer, samma resultatpanel och samma "så räknar
// vi"-block skrivet om och om igen. Här ligger allt utom själva räknaren.
//
// Varför verktygen finns alls: de är den enda sorts innehåll som är
// användbart för någon som INTE är kund ännu, utan att vara reklam. En
// besökare som sökt "räkna ut moms baklänges" får svaret på tre sekunder,
// utan konto, utan mejladress — och ser på köpet att företaget bakom kan
// sitt område. Det är därför varje verktyg avslutas med en ärlig koppling
// till vad appen gör med samma siffra, aldrig med en dold vägg.

// Talformatering: svensk lokal (tusentalsavgränsare = tunt mellanslag),
// och alltid genom EN funktion så en resultatrad aldrig kan visa
// "1234.5" på en sida och "1 234,50" på en annan.
export function formatKr(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('sv-SE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** "17 augusti 2026" — samma långa svenska datumform på båda
 * deadline-verktygen (momsdatum, arsredovisning-deadline) i stället för
 * att varje sida formaterar datum för sig. */
export function formatDateSv(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Stilar som behöver mediafrågor (kan inte uttryckas som inline-style) —
 * scopade till .bx-tool-* så de aldrig kan läcka ut i den inloggade
 * appens egna klasser. Renderas en gång per verktygssida, samma mönster
 * som MarketingStyles i MarketingLayout.jsx. */
function ToolStyles() {
  return (
    <style>{`
      /* Resultatytan följer sidans tema: ljus yta med mörk text i ljust
         läge, en nyans mörkare än kortet i mörkt. Verktygssidorna färgar
         sin text i resultatet med --tr-* i stället för fast vitt. */
      #lp-root { --tr-bg: #f5f6f3; --tr-ink: #1c2420; --tr-ink-soft: #2f3a33; --tr-soft: #4a554d; --tr-muted: #6b7568; --tr-line: #e3e6df; --tr-inner: #ffffff; --tr-panel: radial-gradient(120% 90% at 100% 0%, oklch(94.5% 0.055 150) 0%, oklch(97.2% 0.03 150) 45%, oklch(98.6% 0.012 150) 100%); --tr-panel-line: oklch(90% 0.035 150); --tr-total: oklch(45% 0.15 148); }
      html[data-theme="dark"] #lp-root { --tr-bg: #122117; --tr-ink: #eef3ea; --tr-ink-soft: #d5e0cf; --tr-soft: #b4c3ad; --tr-muted: #8fa088; --tr-line: #2a3d2c; --tr-inner: #17281c; --tr-panel: radial-gradient(120% 90% at 100% 0%, oklch(33% 0.075 150) 0%, oklch(25% 0.045 152) 50%, oklch(21% 0.03 155) 100%); --tr-panel-line: oklch(34% 0.045 150); --tr-total: oklch(82% 0.16 145); }
      .bx-tool-stage { position: relative; max-width: 1040px; margin: 0 auto; }
      .bx-tool-stage::before { content: ''; position: absolute; inset: -40px -60px; z-index: 0; pointer-events: none; filter: blur(50px); opacity: 0.55;
        background: radial-gradient(40% 50% at 78% 40%, oklch(88% 0.08 150 / 0.7), transparent 70%), radial-gradient(35% 45% at 20% 70%, oklch(88% 0.06 220 / 0.6), transparent 70%); }
      html[data-theme="dark"] #lp-root .bx-tool-stage::before { opacity: 0.35; background: radial-gradient(40% 50% at 78% 40%, oklch(45% 0.1 150 / 0.7), transparent 70%), radial-gradient(35% 45% at 20% 70%, oklch(40% 0.08 220 / 0.6), transparent 70%); }
      .bx-tool-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1.08fr 0.92fr; gap: 0; align-items: stretch; }
      .bx-tool-related { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 28px; }
      .bx-tool-related a { border-top: 1px solid var(--mkt-card-border); }
      .bx-tool-related a:hover .bx-tool-related-title { color: var(--mkt-accent-green-fg); }
      .bx-tool-faq { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 40px; }
      .bx-tool-faq > div { border-top: 1px solid var(--mkt-card-border); padding: 20px 0 22px; }
      .bx-tool-input:hover { border-color: var(--mkt-btn-border); }
      .bx-tool-input:focus { outline: none; border-color: var(--mkt-accent-green-fg); box-shadow: 0 0 0 4px var(--mkt-accent-green-soft); }
      .bx-tool-seg { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 4px; padding: 4px; border-radius: 14px; background: var(--tr-bg); border: 1px solid var(--tr-line); margin-bottom: 22px; }
      .bx-tool-seg button { border: none; border-radius: 10px; padding: 10px 12px; cursor: pointer; font-family: inherit; text-align: center; background: transparent; color: var(--mkt-ink-soft); transition: background 0.15s, color 0.15s, box-shadow 0.15s; }
      .bx-tool-seg button:hover { color: var(--mkt-ink); }
      .bx-tool-seg button[aria-pressed="true"] { background: var(--mkt-card-bg); color: var(--mkt-accent-green-fg); box-shadow: 0 1px 2px rgba(28,36,32,0.08), 0 2px 8px -2px rgba(28,36,32,0.1); }
      html[data-theme="dark"] #lp-root .bx-tool-seg button[aria-pressed="true"] { background: #23382a; box-shadow: none; }
      @media (max-width: 860px) {
        .bx-tool-grid { grid-template-columns: 1fr; }
        .bx-tool-result { border-left: none !important; border-top: 1px solid var(--tr-panel-line); }
        .bx-tool-related, .bx-tool-faq { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

/** Inmatningsrad: etikett, fält, valfri enhet till höger och valfri
 * hjälptext under. `suffix` ligger INUTI fältets ram (inte som en egen
 * kolumn) så "kr"/"%" läses som en del av talet, inte som en etikett. */
export function ToolField({ label, hint, suffix, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '22px' }}>
      <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: INK, marginBottom: '8px' }}>{label}</span>
      <span style={{ position: 'relative', display: 'block' }}>
        {children}
        {suffix && (
          <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', fontWeight: 500, color: MUTED, pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </span>
      {hint && <span style={{ display: 'block', fontSize: '13px', color: MUTED, marginTop: '7px', lineHeight: 1.5 }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  width: '100%', padding: '15px 50px 15px 16px', fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em',
  color: INK, background: 'var(--mkt-card-bg)', border: '1px solid var(--mkt-border-soft)',
  borderRadius: '12px', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

/** Sifferfält. `type="text"` med inputMode="decimal" i stället för
 * `type="number"`: number-fältet i Chrome/Safari ändrar värdet när man
 * råkar skrolla över det, och avvisar svenska decimalkommatecken tyst.
 * Här tas båda skiljetecknen emot och normaliseras i onChange. */
export function ToolNumber({ value, onChange, placeholder, ...rest }) {
  return (
    <input
      className="bx-tool-input"
      type="text"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={e => {
        // Tillåt tomt fält under skrivandet (annars går det inte att
        // radera en siffra), och acceptera både "1234,50" och "1234.50".
        const raw = e.target.value.replace(/\s/g, '').replace(',', '.');
        if (raw === '' || /^\d*\.?\d*$/.test(raw)) onChange(raw);
      }}
      style={inputStyle}
      {...rest}
    />
  );
}

/** Datumfält — samma ram som ToolNumber, men webbläsarens egen datumväljare. */
export function ToolDate({ value, onChange }) {
  return (
    <input
      className="bx-tool-input"
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, paddingRight: '14px' }}
    />
  );
}

/** Segmenterad väljare (2–3 alternativ) — tydligare än en <select> när
 * valet påverkar hela resultatet, och lika bra med tangentbord eftersom
 * varje alternativ är en riktig knapp. */
export function ToolSegmented({ options, value, onChange }) {
  return (
    <div className="bx-tool-seg" role="group">
      {options.map(opt => (
        <button key={String(opt.value)} type="button" onClick={() => onChange(opt.value)} aria-pressed={opt.value === value}>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>{opt.label}</span>
          {opt.hint && <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 400, color: MUTED, marginTop: '2px', lineHeight: 1.35 }}>{opt.hint}</span>}
        </button>
      ))}
    </div>
  );
}

/** En rad i resultatpanelen. `strong` för summaraden, `muted` för
 * mellansteg som inte är svaret men förklarar hur man kom dit. `checked`
 * är EGEN, opt-in (ingen av de andra sju verktygen som delar den här
 * komponenten sätter den, så de påverkas inte): en liten grön bock efter
 * värdet, bara för fält där det faktiskt LÄSTS AV med tillförsikt — inte
 * en gissning och inte "—"/"Okänd". Kundönskemål, från samma
 * referensbild som strålen i ReceiptFlow.jsx: varje avläst fält ska synas
 * bekräftat för sig, inte bara stå där. */
export function ToolResultRow({ label, value, unit = 'kr', strong, muted, decimals = 0, note, checked }) {
  const shown = typeof value === 'number' ? formatKr(value, decimals) : value;
  if (strong) {
    // Svaret: egen rad med stort tal, så det syns på en gång.
    return (
      <div style={{ marginTop: '14px', paddingTop: '18px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--tr-soft)', marginBottom: '4px' }}>
          {label}
          {note && <span style={{ display: 'block', fontSize: '12px', color: 'var(--tr-muted)', fontWeight: 400 }}>{note}</span>}
        </div>
        <div style={{ fontSize: 'clamp(32px, 4.2vw, 42px)', fontWeight: 700, color: 'var(--tr-total)', letterSpacing: '-0.03em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          {shown}
          {unit && <span style={{ fontSize: '18px', fontWeight: 500, color: 'var(--tr-muted)', marginLeft: '6px', letterSpacing: 0 }}>{unit}</span>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '10px 0', borderBottom: '1px solid var(--tr-line)' }}>
      <span style={{ fontSize: '14px', color: muted ? 'var(--tr-muted)' : 'var(--tr-soft)', lineHeight: 1.45 }}>
        {label}
        {note && <span style={{ display: 'block', fontSize: '12px', color: 'var(--tr-muted)' }}>{note}</span>}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '7px' }}>
        <span style={{ fontSize: '15.5px', fontWeight: 600, color: muted ? 'var(--tr-soft)' : 'var(--tr-ink)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {shown}
          {unit && <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--tr-muted)', marginLeft: '4px' }}>{unit}</span>}
        </span>
        {checked && (
          <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--mkt-accent-green-soft)', flexShrink: 0 }}>
            <Check size={10} strokeWidth={3.5} color="var(--mkt-accent-green-fg)" />
          </span>
        )}
      </span>
    </div>
  );
}

/** Den mörka resultatpanelen till höger om fälten. Mörk med flit: den är
 * sidans svar, och ska gå att hitta med blicken direkt även om man
 * scrollat förbi rubriken. Samma djupgröna ton som sidfoten. */
export function ToolResultPanel({ title, children, footnote }) {
  return (
    <div className="bx-tool-result" style={{ '--tr-line': 'var(--tr-panel-line)', background: 'var(--tr-panel)', padding: 'clamp(26px, 4vw, 40px)', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--tr-panel-line)' }}>
      <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--tr-soft)', margin: '0 0 6px' }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--tr-total)' }} />{title}
      </h2>
      <div style={{ flex: 1 }}>{children}</div>
      {footnote && (
        <p style={{ fontSize: '12px', color: 'var(--tr-muted)', lineHeight: 1.6, margin: '24px 0 0' }}>
          {footnote}
        </p>
      )}
    </div>
  );
}

/** "Så räknar vi"-blocket — numrerade steg med formeln utskriven. Det som
 * skiljer ett verktyg man litar på från en svart låda. */
export function ToolSteps({ steps }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {steps.map((s, i) => (
        <li key={s.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--tr-bg)', border: '1px solid var(--tr-line)', color: INK_SOFT, fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: INK, marginBottom: '4px', paddingTop: '3px' }}>{s.title}</div>
            <div style={{ fontSize: '15px', color: INK_SOFT, lineHeight: 1.65 }}>{s.body}</div>
            {s.formula && (
              <code style={{ display: 'inline-block', marginTop: '10px', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: '13px', background: 'var(--tr-bg)', border: '1px solid var(--tr-line)', padding: '7px 12px', borderRadius: '9px', color: INK }}>
                {s.formula}
              </code>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Faktaruta för lagkrav/undantag som besökaren behöver veta men som inte
 * hör hemma i själva räknaren. */
export function ToolNote({ tone = 'neutral', title, children }) {
  const accent = tone === 'warn' ? ACCENT.red : ACCENT.blue;
  return (
    <div style={{ background: 'var(--tr-bg)', border: '1px solid var(--tr-line)', borderLeft: `3px solid ${accent.fg}`, borderRadius: '12px', padding: '18px 22px', margin: '32px 0 0' }}>
      {title && <div style={{ fontSize: '15px', fontWeight: 600, color: INK, marginBottom: '6px' }}>{title}</div>}
      <div style={{ fontSize: '14.5px', color: INK_SOFT, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

/**
 * Skalet varje verktygssida renderar sitt innehåll i.
 *
 * `tool`      — posten ur toolsConfig.js (titel, ikon, accent, path).
 * `intro`     — en mening under H1:an, samma roll som på övriga sidor.
 * `calculator`— själva räknaren (fälten). Resultatpanelen skickas separat
 *               som `result` så skalet kan lägga dem sida vid sida på
 *               desktop och staplade på mobil, utan att varje verktyg
 *               behöver upprepa griden.
 * `steps`     — "Så räknar vi"-punkterna.
 * `faq`       — [{ q, a }]. Renderas som text OCH som FAQPage-schema, av
 *               samma skäl som LandingPage.jsx bygger sitt FAQ_SCHEMA ur
 *               samma lista: aldrig en dubblett som kan glida isär.
 * `children`  — valfritt extra innehåll under "Så räknar vi".
 */
export default function ToolShell({ tool, metaTitle, metaDescription, intro, calculator, result, steps, faq, children }) {
  const navigate = useNavigate();
  const related = TOOLS.filter(t => t.slug !== tool.slug);

  // SoftwareApplication-schema för själva verktyget (inte för Bokix som
  // produkt — Organization-schemat i MarketingLayout täcker företaget).
  // "isAccessibleForFree" är det fält som faktiskt gör skillnad i
  // sökresultatet: det är hela löftet på sidan.
  const toolSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${tool.title} — Bokix`,
    url: `${SITE_URL}${tool.path}`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Webbläsare',
    isAccessibleForFree: true,
    inLanguage: 'sv-SE',
    description: tool.description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' },
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
  };

  const faqSchema = faq?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  } : null;

  return (
    <MarketingLayout>
      <PageMeta title={metaTitle} description={metaDescription} path={tool.path} />
      <JsonLd data={toolSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      <ToolStyles />

      {/* ── Rubrik ── */}
      <section style={{ padding: 'clamp(112px, 14vw, 136px) 24px 40px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '1040px', margin: '0 auto' }}>
          <Link to={TOOLS_HUB_PATH} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 500, color: MUTED, marginBottom: '18px', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Gratis verktyg
          </Link>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(34px, 5vw, 54px)', fontWeight: 700, letterSpacing: '-0.02em', color: INK, margin: '0 0 14px', lineHeight: 1.08 }}>
            {tool.title}
          </h1>
          <p style={{ fontSize: 'clamp(16px, 1.6vw, 18px)', color: MUTED, lineHeight: 1.6, margin: 0, maxWidth: '640px' }}>{intro}</p>
        </Reveal>
      </section>

      {/* ── Räknaren ── */}
      <section style={{ padding: '0 24px', background: 'var(--mkt-page-bg)' }}>
        <div className="bx-tool-stage">
        <Reveal className="bx-tool-grid" style={{
          background: 'var(--mkt-card-bg)',
          border: '1px solid var(--tr-line)', borderRadius: '24px', overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(20,40,28,0.04), 0 30px 60px -32px rgba(20,60,35,0.28)',
        }}>
          <div style={{ padding: 'clamp(26px, 4vw, 40px)' }}>{calculator}</div>
          {result}
        </Reveal>
        </div>
      </section>

      {/* ── Så räknar vi ── */}
      <section style={{ padding: 'clamp(64px, 8vw, 96px) 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 3.2vw, 34px)', fontWeight: 700, color: INK, margin: '0 0 8px', letterSpacing: '-0.015em' }}>
            Så räknar vi
          </h2>
          <p style={{ fontSize: '16px', color: MUTED, margin: '0 0 32px', lineHeight: 1.65 }}>
            Ingen svart låda. Varje steg går att räkna efter för hand.
          </p>
          <ToolSteps steps={steps} />
          {children}
        </Reveal>
      </section>

      {/* ── Frågor och svar ── */}
      {faq?.length > 0 && (
        <section style={{ padding: 'clamp(56px, 7vw, 88px) 24px 20px', background: 'var(--mkt-page-bg)' }}>
          <Reveal style={{ maxWidth: '1040px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 3.2vw, 34px)', fontWeight: 700, color: INK, margin: '0 0 18px', letterSpacing: '-0.015em' }}>
              Vanliga frågor
            </h2>
            <div className="bx-tool-faq">
              {faq.map(item => (
                <div key={item.q}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: INK, margin: '0 0 8px' }}>{item.q}</h3>
                  <p style={{ fontSize: '15px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{item.a}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* ── Andra verktyg ── */}
      <section style={{ padding: 'clamp(56px, 7vw, 88px) 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '1040px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 3.2vw, 34px)', fontWeight: 700, color: INK, margin: '0 0 18px', letterSpacing: '-0.015em' }}>
            Fler gratisverktyg
          </h2>
          <div className="bx-tool-related">
            {related.map(t => {
              return (
                <Link key={t.slug} to={t.path} style={{
                  display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '16px 0',
                }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="bx-tool-related-title" style={{ display: 'block', fontSize: '15.5px', fontWeight: 600, color: INK, transition: 'color 0.15s' }}>{t.title}</span>
                    <span style={{ display: 'block', fontSize: '13.5px', color: MUTED, marginTop: '2px' }}>{t.short}</span>
                  </span>
                  <ArrowRight size={15} color="var(--mkt-muted)" style={{ flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* ── Avslut ── */}
      <section style={{ padding: 'clamp(64px, 8vw, 96px) 24px clamp(72px, 9vw, 110px)', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '1040px', margin: '0 auto', background: 'var(--tr-bg)', border: '1px solid var(--tr-line)', borderRadius: '24px', padding: 'clamp(32px, 6vw, 60px)', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 3.6vw, 38px)', fontWeight: 700, color: INK, margin: '0 0 12px', letterSpacing: '-0.015em' }}>
            Slipp räkna det här för hand
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, lineHeight: 1.65, margin: '0 auto 26px', maxWidth: '520px' }}>
            I Bokix räknas det här automatiskt, på riktiga siffror ur din egen bokföring — och bokförs på rätt konton direkt. 30 dagar att testa, ingen bindningstid på månadsplanen.
          </p>
          <div className="lp-cta-group" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Prova gratis
            </button>
            <Link to="/funktioner" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: '1px solid var(--mkt-border-soft)', borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Se alla funktioner <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
