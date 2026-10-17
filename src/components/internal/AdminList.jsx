import React from 'react';

// ── Radlistan i /internal (Betalningar, Användare) ──────────────────────
// En rad per konto i appens stil: rund ikon med initial, e-post och
// företag/nivå, statusetiketter i appens statusfärger och datum. På dator
// ligger allt på en rad; på telefon staplas raden (namn och etikett överst,
// datum och knapp under) i stället för en tabell som måste scrollas i sidled.

const TONES = {
  green: { bg: 'var(--status-green-bg)', fg: 'var(--status-green-text)' },
  blue: { bg: 'var(--status-blue-bg)', fg: 'var(--status-blue-text)' },
  amber: { bg: 'var(--status-amber-bg)', fg: 'var(--status-amber-text)' },
  red: { bg: 'var(--status-red-bg)', fg: 'var(--status-red-text)' },
  gray: { bg: 'var(--status-gray-bg)', fg: 'var(--status-gray-text)' },
};

const CSS = `
  .ixl { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
  .ixl-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border); }
  .ixl-title { font-size: 15px; font-weight: 700; color: var(--text-main); }
  .ixl-count { font-size: 12.5px; color: var(--text-muted); font-weight: 600; }
  .ixl-row { display: grid; grid-template-columns: 38px minmax(0, 1.6fr) minmax(0, 1fr) 132px; gap: 14px; align-items: center; padding: 13px 20px; }
  .ixl-row + .ixl-row { border-top: 1px solid var(--border-light); }
  .ixl-row:hover { background: var(--bg-muted); }
  .ixl-row.muted .ixl-main, .ixl-row.muted .ixl-avatar { opacity: 0.55; }
  .ixl-avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; background: var(--status-green-bg); color: var(--status-green-text); text-transform: uppercase; }
  .ixl-main { min-width: 0; }
  .ixl-primary { font-size: 14px; font-weight: 700; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ixl-secondary { font-size: 12.5px; color: var(--text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ixl-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .ixl-pill { padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
  .ixl-meta { font-size: 12.5px; color: var(--text-secondary); line-height: 1.6; min-width: 0; }
  .ixl-meta span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ixl-meta .ixl-meta-label { display: inline; color: var(--text-muted); font-weight: 500; }
  .ixl-action { display: flex; justify-content: flex-end; }
  .ixl-empty { padding: 28px 20px; text-align: center; font-size: 13.5px; color: var(--text-muted); }
  .ixl-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer; white-space: nowrap; }
  .ixl-btn.danger { color: var(--status-red-text); }
  .ixl-btn.ok { color: var(--accent-text); }
  @media (max-width: 760px) {
    .ixl-head { padding: 12px 14px; }
    .ixl-row { grid-template-columns: 38px minmax(0, 1fr); gap: 4px 12px; padding: 14px; align-items: start; }
    .ixl-avatar { grid-row: span 3; }
    .ixl-meta, .ixl-action { grid-column: 2; }
    .ixl-meta span { white-space: normal; }
    .ixl-action { justify-content: flex-start; margin-top: 6px; }
    .ixl-btn { height: 36px; }
  }
`;

export function Pill({ tone = 'gray', children }) {
  const t = TONES[tone] || TONES.gray;
  return <span className="ixl-pill" style={{ background: t.bg, color: t.fg }}>{children}</span>;
}

export function AdminList({ title, count, empty, children }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <div className="ixl">
      <style>{CSS}</style>
      {title && (
        <div className="ixl-head">
          <span className="ixl-title">{title}</span>
          {count != null && <span className="ixl-count">{count}</span>}
        </div>
      )}
      {rows.length ? rows : <div className="ixl-empty">{empty}</div>}
    </div>
  );
}

/** En rad. `meta` är en lista med [etikett, värde]; `pills` etiketter under namnet. */
export function AdminRow({ initial, primary, secondary, pills, meta = [], action, muted = false }) {
  return (
    <div className={`ixl-row${muted ? ' muted' : ''}`}>
      <span className="ixl-avatar" aria-hidden="true">{initial || '?'}</span>
      <div className="ixl-main">
        <div className="ixl-primary">{primary}</div>
        {secondary && <div className="ixl-secondary">{secondary}</div>}
        {pills && <div className="ixl-pills">{pills}</div>}
      </div>
      <div className="ixl-meta">
        {meta.filter(Boolean).map(([label, value]) => <span key={label}><span className="ixl-meta-label">{label}</span> {value}</span>)}
      </div>
      <div className="ixl-action">{action}</div>
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
