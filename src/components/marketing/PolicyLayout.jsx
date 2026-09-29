import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout, { Reveal, FOOTER_LEGAL } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, CARD_BORDER } from './marketingTokens';
import { PageMeta } from '../../utils/seo';

// Delat skal för de fyra juridiksidorna (Privacy/Terms/Cookies/PUB), med
// samma sidhuvud, sidfot och mörka läge som resten av marknadssajten.
// Helt vitt och utan färger eller ikoner (kundönskemål 2026-09-29).

// Länkarna till de andra policysidorna kommer från sidfotens egen lista
// (MarketingLayout.jsx) — se kommentaren där.
const POLICY_LINKS = FOOTER_LEGAL;

// `updated` är datumet policyn FAKTISKT ändrades, satt som en konstant i
// respektive sida och bumpad för hand när texten ändras. Här stod tidigare
// `new Date()`, vilket betydde att varje policy påstod sig vara uppdaterad
// exakt idag, varje dag — ett datum som är fel varje gång det spelar roll,
// och just det datum både Villkoren och Integritetspolicyn hänvisar till i
// sina egna ändringsavsnitt ("Datumet högst upp på sidan visar när ...").
function formatUpdated(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function PolicyLayout({ title, path, metaTitle, metaDescription, updated, children }) {
  return (
    <MarketingLayout>
      <PageMeta title={metaTitle} description={metaDescription} path={path} />

      {/* Vit, lugn topp (kundönskemål 2026-09-29): ingen färgyta, ingen
          ikon och ingen ingress. Rubriken och datumet räcker. */}
      <section style={{ padding: '140px 24px 64px', background: 'var(--mkt-page-bg)', borderBottom: '1px solid var(--mkt-border-soft)' }}>
        <Reveal style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>{title}</h1>
          <p style={{ fontSize: '13.5px', color: INK_SOFT, margin: 0 }}>
            Senast uppdaterad: <time dateTime={updated}>{formatUpdated(updated)}</time>
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '48px 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div>
            {children}
          </div>

          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <Link to="/" style={{ color: INK, fontWeight: 700, textDecoration: 'none', fontSize: '14.5px' }}>&larr; Tillbaka till startsidan</Link>
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              {POLICY_LINKS.filter((l) => l.to !== path).map((l) => (
                <Link key={l.to} to={l.to} style={{ color: MUTED, fontWeight: 600, textDecoration: 'none', fontSize: '13.5px' }}>{l.label}</Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export function PolicySection({ n, title, first, children }) {
  return (
    <div style={{ marginTop: first ? 0 : '40px' }}>
      <h2 style={{ fontSize: '19px', fontWeight: 700, color: INK, margin: '0 0 14px' }}>{n}. {title}</h2>
      <div>{children}</div>
    </div>
  );
}

export const policyP = { marginBottom: '14px', lineHeight: 1.8, color: 'var(--mkt-ink-soft)', fontSize: '15px' };
export const policyLi = { marginBottom: '8px', lineHeight: 1.75, color: 'var(--mkt-ink-soft)', fontSize: '15px' };
export const policyUl = { margin: '0 0 16px', paddingLeft: '20px' };

export function PolicyTable({ head, rows }) {
  return (
    <div style={{ overflowX: 'auto', margin: '14px 0 20px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', minWidth: '480px' }}>
        <thead>
          <tr>{head.map((h) => <th key={h} style={{ textAlign: 'left', padding: '9px 12px', color: INK, fontWeight: 700, borderBottom: `2px solid ${CARD_BORDER}` }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j} style={{ padding: '9px 12px', borderBottom: `1px solid ${CARD_BORDER}`, color: 'var(--mkt-ink-soft)', verticalAlign: 'top' }}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PolicyCode({ children }) {
  return <code style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12.5px', background: 'var(--mkt-ivory)', padding: '2px 6px', borderRadius: '4px', color: INK }}>{children}</code>;
}

// Neutral ruta utan färg (kundönskemål 2026-09-29).
export function PolicyCallout({ children }) {
  return (
    <div style={{ margin: '16px 0', padding: '2px 0 2px 18px', borderLeft: `3px solid ${INK}` }}>
      <p style={{ margin: 0, lineHeight: 1.75, color: INK, fontSize: '15px', fontWeight: 600 }}>{children}</p>
    </div>
  );
}
