import React from 'react';

/** "Uppdaterad 15:42:10 · Uppdatera" under rubriken i varje /internal-flik. */
export default function RefreshBar({ updatedAt, refreshing, onRefresh, style }) {
  const time = updatedAt
    ? updatedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '-14px', marginBottom: '20px', ...style }}>
      <span>{refreshing && !time ? 'Hämtar…' : time ? `Uppdaterad ${time}, uppdateras var 30:e sekund` : ''}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '7px', padding: '3px 10px', fontSize: '12px', fontWeight: 600, cursor: refreshing ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.6 : 1 }}
      >
        {refreshing ? 'Uppdaterar…' : 'Uppdatera'}
      </button>
    </div>
  );
}
