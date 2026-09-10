import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { BRAND } from '../../../utils/brandColors';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, CARD_SHADOW_SM, ACCENT } from '../marketingTokens';
import { AuroraLayer } from '../aurora';
import { PageMeta, JsonLd, SITE_URL } from '../../../utils/seo';
import { TOOLS, TOOLS_HUB_PATH } from './toolsConfig';

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

/** Stilar som behöver mediafrågor (kan inte uttryckas som inline-style) —
 * scopade till .bx-tool-* så de aldrig kan läcka ut i den inloggade
 * appens egna klasser. Renderas en gång per verktygssida, samma mönster
 * som MarketingStyles i MarketingLayout.jsx. */
function ToolStyles() {
  return (
    <style>{`
      .bx-tool-grid { display: grid; grid-template-columns: 1fr 0.85fr; gap: 0; align-items: stretch; }
      .bx-tool-related { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
      .bx-tool-faq { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px 32px; }
      .bx-tool-input:focus { outline: none; border-color: var(--mkt-accent-green-fg); box-shadow: 0 0 0 3px var(--mkt-accent-green-soft); }
      .bx-tool-seg:hover { border-color: var(--mkt-accent-green-fg); }
      @media (max-width: 860px) {
        .bx-tool-grid { grid-template-columns: 1fr; }
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
    <label style={{ display: 'block', marginBottom: '18px' }}>
      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '7px' }}>{label}</span>
      <span style={{ position: 'relative', display: 'block' }}>
        {children}
        {suffix && (
          <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '13.5px', fontWeight: 600, color: MUTED, pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </span>
      {hint && <span style={{ display: 'block', fontSize: '12.5px', color: MUTED, marginTop: '6px', lineHeight: 1.5 }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  width: '100%', padding: '13px 46px 13px 14px', fontSize: '16px', fontWeight: 600,
  color: INK, background: 'var(--mkt-page-bg)', border: `1.5px solid ${CARD_BORDER}`,
  borderRadius: '11px', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
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
export function ToolSegmented({ options, value, onChange, accent = ACCENT.green }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            className={active ? '' : 'bx-tool-seg'}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            style={{
              flex: '1 1 auto', minWidth: '96px', padding: '11px 14px', borderRadius: '11px', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700, textAlign: 'center',
              background: active ? accent.soft : 'var(--mkt-page-bg)',
              color: active ? accent.fg : INK_SOFT,
              border: `1.5px solid ${active ? accent.fg : CARD_BORDER}`,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            {opt.label}
            {opt.hint && <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, opacity: 0.8, marginTop: '2px' }}>{opt.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** En rad i resultatpanelen. `strong` för summaraden, `muted` för
 * mellansteg som inte är svaret men förklarar hur man kom dit. */
export function ToolResultRow({ label, value, unit = 'kr', strong, muted, decimals = 0, note }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px',
      padding: strong ? '14px 0 0' : '7px 0',
      borderTop: strong ? '1px solid rgba(255,255,255,0.18)' : 'none',
      marginTop: strong ? '10px' : 0,
    }}>
      <span style={{ fontSize: strong ? '14.5px' : '13.5px', fontWeight: strong ? 700 : 500, color: muted ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.8)', lineHeight: 1.45 }}>
        {label}
        {note && <span style={{ display: 'block', fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{note}</span>}
      </span>
      <span style={{ fontSize: strong ? '22px' : '15px', fontWeight: strong ? 800 : 700, color: 'white', whiteSpace: 'nowrap', letterSpacing: strong ? '-0.02em' : 0 }}>
        {typeof value === 'number' ? formatKr(value, decimals) : value}
        {unit && <span style={{ fontSize: strong ? '13px' : '11.5px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginLeft: '4px' }}>{unit}</span>}
      </span>
    </div>
  );
}

/** Den mörka resultatpanelen till höger om fälten. Mörk med flit: den är
 * sidans svar, och ska gå att hitta med blicken direkt även om man
 * scrollat förbi rubriken. Samma djupgröna ton som sidfoten. */
export function ToolResultPanel({ title, children, footnote }) {
  return (
    // I MÖRKT läge ligger kortets egen bakgrund nära panelens djupgröna
    // ton — utan den tunna kanten flöt de två halvorna ihop till en enda yta.
    <div style={{ background: '#0e2018', padding: 'clamp(24px, 4vw, 32px)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', borderLeft: '1px solid rgba(255,255,255,0.09)' }}>
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundImage: 'linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16)' }} />
      <h2 style={{ fontSize: '12.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>{title}</h2>
      <div style={{ flex: 1 }}>{children}</div>
      {footnote && (
        <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: '20px 0 0', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {steps.map((s, i) => (
        <li key={s.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <span style={{ width: 26, height: 26, borderRadius: '8px', background: 'var(--mkt-ivory)', border: `1px solid ${CARD_BORDER}`, color: INK, fontSize: '12.5px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
          <div>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: INK, marginBottom: '3px' }}>{s.title}</div>
            <div style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.65 }}>{s.body}</div>
            {s.formula && (
              <code style={{ display: 'inline-block', marginTop: '7px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12.5px', background: 'var(--mkt-ivory)', border: `1px solid ${CARD_BORDER}`, padding: '5px 10px', borderRadius: '7px', color: INK }}>
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
    <div style={{ background: accent.soft, border: `1px solid color-mix(in srgb, ${accent.fg} 25%, transparent)`, borderRadius: '14px', padding: '18px 20px', margin: '24px 0 0' }}>
      {title && <div style={{ fontSize: '13.5px', fontWeight: 700, color: accent.fg, marginBottom: '6px' }}>{title}</div>}
      <div style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7 }}>{children}</div>
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
  const accent = ACCENT[tool.accentKey] || ACCENT.green;
  const Icon = tool.icon;
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
      <section style={{ padding: '140px 24px 44px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer stops={[[`color-mix(in srgb, ${accent.fg} 16%, transparent)`, '4% -6%'], ['rgba(14,165,233,0.10)', '97% 104%']]} />
        <Reveal style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <Link to={TOOLS_HUB_PATH} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 15px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, fontSize: '12.5px', fontWeight: 700, color: accent.fg, marginBottom: '20px', textDecoration: 'none' }}>
            <ArrowLeft size={13} /> Gratis verktyg
          </Link>
          <div style={{ width: 54, height: 54, borderRadius: '16px', background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Icon size={25} color={accent.fg} />
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.6vw, 46px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.15 }}>
            {tool.title}
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.7, margin: 0 }}>{intro}</p>
        </Reveal>
      </section>

      {/* ── Räknaren ── */}
      <section style={{ padding: '0 24px', background: 'var(--mkt-page-bg)', position: 'relative', marginTop: '-4px' }}>
        <Reveal scale className="bx-tool-grid" style={{
          maxWidth: '900px', margin: '0 auto', background: 'var(--mkt-card-bg)',
          border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', overflow: 'hidden', boxShadow: CARD_SHADOW,
        }}>
          <div style={{ padding: 'clamp(24px, 4vw, 34px)' }}>{calculator}</div>
          {result}
        </Reveal>
      </section>

      {/* ── Så räknar vi ── */}
      <section style={{ padding: '64px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, color: INK, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            Så räknar vi
          </h2>
          <p style={{ fontSize: '15px', color: MUTED, margin: '0 0 26px', lineHeight: 1.65 }}>
            Ingen svart låda. Varje steg går att räkna efter för hand.
          </p>
          <ToolSteps steps={steps} />
          {children}
        </Reveal>
      </section>

      {/* ── Frågor och svar ── */}
      {faq?.length > 0 && (
        <section style={{ padding: '56px 24px 20px', background: 'var(--mkt-page-bg)' }}>
          <Reveal style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, color: INK, margin: '0 0 26px', letterSpacing: '-0.01em' }}>
              Vanliga frågor
            </h2>
            <div className="bx-tool-faq">
              {faq.map(item => (
                <div key={item.q}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: '0 0 7px' }}>{item.q}</h3>
                  <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{item.a}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* ── Andra verktyg ── */}
      <section style={{ padding: '56px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: MUTED, margin: '0 0 16px' }}>
            Fler gratisverktyg
          </h2>
          <div className="bx-tool-related">
            {related.map(t => {
              const a = ACCENT[t.accentKey] || ACCENT.green;
              const TIcon = t.icon;
              return (
                <Link key={t.slug} to={t.path} className="lp-card-hover" style={{
                  display: 'flex', gap: '13px', alignItems: 'center', textDecoration: 'none',
                  background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '14px',
                  padding: '15px 17px', boxShadow: CARD_SHADOW_SM,
                }}>
                  <span style={{ width: 34, height: 34, borderRadius: '10px', background: a.soft, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TIcon size={16} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 700, color: INK }}>{t.title}</span>
                    <span style={{ display: 'block', fontSize: '12.5px', color: MUTED }}>{t.short}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* ── Avslut ── */}
      <section style={{ padding: '70px 24px 90px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: '900px', margin: '0 auto', background: IVORY, border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', padding: 'clamp(28px, 5vw, 44px)', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3.2vw, 30px)', fontWeight: 700, color: INK, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
            Slipp räkna det här för hand
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, lineHeight: 1.65, margin: '0 auto 26px', maxWidth: '520px' }}>
            I Bokix räknas det här automatiskt, på riktiga siffror ur din egen bokföring — och bokförs på rätt konton direkt. 30 dagar att testa, ingen bindningstid på månadsplanen.
          </p>
          <div className="lp-cta-group" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Prova gratis
            </button>
            <Link to="/funktioner" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Se alla funktioner <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
