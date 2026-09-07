import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout, { Reveal, FOOTER_LEGAL } from './MarketingLayout';
import { SERIF, INK, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { AuroraLayer } from './aurora';
import { PageMeta } from '../../utils/seo';

// Shared shell for the four legal pages (Privacy/Terms/Cookies/PUB) —
// same header/footer/dark-mode as the rest of the marketing site instead
// of a standalone white page, and one signature accent color per page
// instead of the flat gray they had before.

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

export function PolicyLayout({ icon: Icon, title, intro, accent, path, metaTitle, metaDescription, updated, children }) {
  return (
    <MarketingLayout>
      <PageMeta title={metaTitle} description={metaDescription} path={path} />

      <section style={{ padding: '150px 24px 56px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[[`color-mix(in srgb, ${accent.fg} 18%, transparent)`, '6% -8%'], ['rgba(14,165,233,0.10)', '96% 106%']]}
        />
        <Reveal style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ width: 56, height: 56, borderRadius: '16px', background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon size={26} color={accent.fg} />
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>{title}</h1>
          <p style={{ fontSize: '13.5px', color: MUTED, marginBottom: intro ? '20px' : 0 }}>
            Senast uppdaterad: <time dateTime={updated}>{formatUpdated(updated)}</time>
          </p>
          {intro && <p style={{ fontSize: '16.5px', color: 'var(--mkt-ink-soft)', lineHeight: 1.7 }}>{intro}</p>}
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: 'min(88vw, 820px)', margin: '0 auto' }}>
          <div style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '24px', padding: 'clamp(26px, 5vw, 56px)', boxShadow: CARD_SHADOW }}>
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
        </Reveal>
      </section>
    </MarketingLayout>
  );
}

export function PolicySection({ n, title, first, children }) {
  return (
    <div style={{ marginTop: first ? 0 : '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <span style={{ width: 30, height: 30, borderRadius: '9px', background: 'var(--mkt-ivory)', color: INK, fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
        <h2 style={{ fontSize: '19px', fontWeight: 700, color: INK, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ paddingLeft: '42px' }}>{children}</div>
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
          <tr>{head.map((h) => <th key={h} style={{ textAlign: 'left', padding: '9px 12px', background: 'var(--mkt-ivory)', color: INK, fontWeight: 700, borderBottom: `2px solid ${CARD_BORDER}` }}>{h}</th>)}</tr>
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

export function PolicyCallout({ tone = 'good', children }) {
  const color = tone === 'good' ? ACCENT.green : ACCENT.red;
  return (
    <div style={{ margin: '16px 0', padding: '16px 20px', background: color.soft, border: `1px solid color-mix(in srgb, ${color.fg} 30%, transparent)`, borderRadius: '14px' }}>
      <p style={{ margin: 0, lineHeight: 1.75, color: color.fg, fontSize: '14.5px', fontWeight: 600 }}>{children}</p>
    </div>
  );
}
