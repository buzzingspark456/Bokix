import React from 'react';
import { t } from '../../i18n';

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(v || 0);

/**
 * Generisk beräkningsrad (label, formel, resultat) — samma mönster
 * upprepas identiskt för varje steg i en anställds lönebreakdown, så det
 * byggs en gång här istället för unik hårdkodad HTML per rad/anställd.
 */
export default function CalculationRow({ label, formula, result }) {
  return (
    <div className="calc-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) minmax(0, 1fr) auto', columnGap: '16px', alignItems: 'baseline', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>{label}</div>
      <div className="calc-row-formula" style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }}>{formula}</div>
      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {result !== null && result !== undefined ? `${fmt(result)} ${t('ui.kr')}` : ''}
      </div>
    </div>
  );
}
