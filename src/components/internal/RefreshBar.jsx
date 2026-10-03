import React from 'react';

/** "Uppdaterad 15:42:10 · Uppdatera" under rubriken i varje /internal-flik. */
export default function RefreshBar({ updatedAt, refreshing, onRefresh, style }) {
  const time = updatedAt
    ? updatedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'rgba(232,236,233,0.45)', marginTop: '-14px', marginBottom: '20px', ...style }}>
      <span>{refreshing && !time ? 'Hämtar…' : time ? `Uppdaterad ${time}, uppdateras var 30:e sekund` : ''}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(232,236,233,0.8)', borderRadius: '7px', padding: '3px 10px', fontSize: '12px', fontWeight: 600, cursor: refreshing ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.6 : 1 }}
      >
        {refreshing ? 'Uppdaterar…' : 'Uppdatera'}
      </button>
    </div>
  );
}
