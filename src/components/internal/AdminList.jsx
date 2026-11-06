import React from 'react';

// ── Radlistan i /internal (Översikt, Betalningar, Användare, Statussidan) ─
// En rad per konto: rund initial, namn och företag, statusetiketter och
// datum. På dator ligger allt på en rad; på telefon staplas raden i stället
// för en tabell som måste scrollas i sidled. Stilen ligger i internalStyles.js.

const TONES = {
  green: { bg: 'var(--status-green-bg)', fg: 'var(--status-green-text)' },
  blue: { bg: 'var(--status-blue-bg)', fg: 'var(--status-blue-text)' },
  amber: { bg: 'var(--status-amber-bg)', fg: 'var(--status-amber-text)' },
  red: { bg: 'var(--status-red-bg)', fg: 'var(--status-red-text)' },
  gray: { bg: 'var(--status-gray-bg)', fg: 'var(--status-gray-text)' },
};

export function Pill({ tone = 'gray', children }) {
  const t = TONES[tone] || TONES.gray;
  return <span className="ixl-pill" style={{ background: t.bg, color: t.fg }}>{children}</span>;
}

export function AdminList({ title, count, empty, children }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <div className="ixl">
      {title && (
        <div className="ixl-head">
          <span className="ixl-title">{title}</span>
          {count != null && <span className="ixl-count">{count}</span>}
        </div>
      )}
      {rows.length ? rows : empty ? <div className="ixl-empty">{empty}</div> : null}
    </div>
  );
}

/**
 * En rad. `meta` är en lista med [etikett, värde]; `pills` etiketter under
 * namnet. Utan `initial` blir raden en enklare rad utan rund ikon.
 */
export function AdminRow({ initial, primary, secondary, pills, meta = [], action, muted = false, onClick }) {
  const plain = initial === undefined;
  return (
    <div
      className={`ixl-row${plain ? ' plain' : ''}${muted ? ' muted' : ''}${onClick ? ' clickable' : ''}`}
      {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } } : {})}
    >
      {!plain && <span className="ixl-avatar" aria-hidden="true">{initial || '?'}</span>}
      {/* Etiketterna står på namnraden: en rad är två rader hög, inte tre. */}
      <div className="ixl-main">
        <div className="ixl-primary-line">
          <span className="ixl-primary">{primary}</span>
          {pills && <span className="ixl-pills">{pills}</span>}
        </div>
        {secondary && <div className="ixl-secondary">{secondary}</div>}
      </div>
      <div className="ixl-meta">
        {meta.filter(Boolean).map(([label, value], i) => <span key={i}>{label && <span className="ixl-meta-label">{label} </span>}{value}</span>)}
      </div>
      <div className="ixl-action" onClick={e => e.stopPropagation()}>{action}</div>
    </div>
  );
}

export const SUBSCRIPTION_STATUS = {
  trialing: { label: 'Provperiod', tone: 'blue' },
  active: { label: 'Aktiv', tone: 'green' },
  past_due: { label: 'Betalning misslyckad', tone: 'amber' },
  unpaid: { label: 'Obetald', tone: 'amber' },
  incomplete: { label: 'Ofullständig', tone: 'amber' },
  incomplete_expired: { label: 'Utgången', tone: 'gray' },
  canceled: { label: 'Uppsagd', tone: 'gray' },
};

export function SubscriptionPill({ status }) {
  if (!status) return <Pill>Ingen prenumeration</Pill>;
  const s = SUBSCRIPTION_STATUS[status] || { label: status, tone: 'gray' };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}
