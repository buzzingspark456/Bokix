import React from 'react';
import { Building2 } from '../icons';
import AnchoredDropdown from './AnchoredDropdown';

// Träfflistan som faller ut under ett namnfält efter en sökning i
// företagsregistret (useCompanyLookup). Delad mellan Kunder/Leverantörer och
// formulären där man lägger upp sitt eget företag. Ligger i en portal
// (AnchoredDropdown) så den aldrig klipps av en scrollande modal.
const dropdownStyle = { borderRadius: '8px', boxShadow: '0 8px 24px rgba(17,24,39,0.14)' };
const itemStyle = {
  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
  padding: '9px 12px', border: 'none', borderTop: '1px solid var(--border)', background: 'transparent',
  cursor: 'pointer', fontFamily: 'inherit', minWidth: 0,
};
const iconStyle = {
  width: '28px', height: '28px', borderRadius: '7px', background: 'var(--bg-muted)',
  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const nameStyle = { fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const metaStyle = { fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

const formatOrg = (n) => (/^\d{10}$/.test(n || '') ? `${n.slice(0, 6)}-${n.slice(6)}` : (n || '—'));

export default function CompanyLookupResults({ results, onPick, anchorRef }) {
  return (
    <AnchoredDropdown
      anchorRef={anchorRef}
      open={results.length > 0}
      maxHeight={260}
      className="company-lookup-dropdown"
      style={dropdownStyle}
    >
      {results.map(c => (
        <button key={c.orgNumber || c.name} type="button" onClick={() => onPick(c)} className="company-lookup-result" style={itemStyle}>
          <div style={iconStyle}><Building2 size={14} /></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={nameStyle}>{c.name}</div>
            <div style={metaStyle}>{formatOrg(c.orgNumber)}{c.city ? ` · ${c.city}` : ''}</div>
          </div>
        </button>
      ))}
    </AnchoredDropdown>
  );
}
