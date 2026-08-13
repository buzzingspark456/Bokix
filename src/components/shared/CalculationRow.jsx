import React from 'react';

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(v || 0);

/**
 * Generisk beräkningsrad (label, formel, resultat) — samma mönster
 * upprepas identiskt för varje steg i en anställds lönebreakdown, så det
 * byggs en gång här istället för unik hårdkodad HTML per rad/anställd.
 */
export default function CalculationRow({ label, formula, result }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ minWidth: '220px', fontWeight: 600, fontSize: '13px', color: '#374151' }}>{label}</div>
      <div style={{ flex: 1, fontSize: '12.5px', color: '#9ca3af', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{formula}</div>
      {result !== null && result !== undefined && (
        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#111', whiteSpace: 'nowrap' }}>{fmt(result)} kr</div>
      )}
    </div>
  );
}
