import React, { useState, useEffect, useRef } from 'react';

/**
 * Generisk sökbar combobox mot en lista av { id, name, ... }.
 * Delas mellan Verifikationer (motpart/projekt) och Kontakter/Leverantörer
 * (standardkonto) så att det bara finns en implementation att underhålla.
 *
 * `onCreateNew(name)` är valfri — anges den visas en "Skapa ny: …"-rad sist
 * i förslagslistan så länge det som skrivits inte redan matchar en post
 * exakt, så man kan skapa en ny motpart utan att lämna formuläret.
 */
export function EntitySearch({ value, onChange, items, placeholder, renderMeta, onCreateNew, createLabel = 'Skapa ny', inputStyle }) {
  const selected = items?.find(c => c.id === value);
  const [q, setQ] = useState(selected?.name || '');
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => { setQ(selected?.name || ''); }, [value]); // eslint-disable-line

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const matches = q.length >= 1
    ? (items || []).filter(c => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10)
    : (items || []).slice(0, 10);

  const trimmedQ = q.trim();
  const hasExactMatch = matches.some(c => c.name.toLowerCase() === trimmedQ.toLowerCase());
  const showCreateRow = onCreateNew && trimmedQ.length >= 1 && !hasExactMatch;

  const handleCreate = () => {
    onCreateNew(trimmedQ);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)', ...inputStyle }}
      />
      {open && (matches.length > 0 || showCreateRow) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '260px', maxHeight: '220px', overflowY: 'auto' }}>
          {matches.map(c => (
            <div
              key={c.id}
              onMouseDown={() => { onChange(c.id); setQ(c.name); setOpen(false); }}
              style={{ padding: '7px 10px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <span style={{ color: 'var(--text-main)' }}>{c.name}</span>
              {renderMeta && <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>{renderMeta(c)}</span>}
            </div>
          ))}
          {showCreateRow && (
            <div
              onMouseDown={handleCreate}
              style={{ padding: '7px 10px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <span>+</span><span>{createLabel}: "{trimmedQ}"</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PartySearch({ value, onChange, contacts, onCreateNew, createLabel }) {
  return <EntitySearch value={value} onChange={onChange} items={contacts} placeholder="Sök kund eller leverantör..." renderMeta={c => c.type === 'supplier' ? 'Leverantör' : 'Kund'} onCreateNew={onCreateNew} createLabel={createLabel} />;
}

export function ProjectSearch({ value, onChange, projects }) {
  return <EntitySearch value={value} onChange={onChange} items={projects} placeholder="Sök projekt..." />;
}

/** Sökbar kontocombobox mot kontoplanen (kod + namn). `compact` ger den täta
 * stilen som används i verifikationsradernas kontokolumn. */
export function AccountSearch({ value, onChange, accounts, placeholder = 'Konto...', compact = false }) {
  const preset = value ? accounts?.find(a => a.code === value) : null;
  const [q, setQ] = useState(preset ? `${preset.code} – ${preset.name}` : (value || ''));
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const acc = value ? accounts?.find(a => a.code === value) : null;
    setQ(acc ? `${acc.code} – ${acc.name}` : (value || ''));
  }, [value]); // eslint-disable-line

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const matches = q.length >= 1
    ? (accounts || []).filter(a => a.code.startsWith(q) || a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10)
    : [];

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={compact
          ? { width: '100%', padding: '4px 6px', border: '1px solid var(--text-muted)', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--bg-card)', color: 'var(--text-main)' }
          : { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)' }}
      />
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '260px', maxHeight: '200px', overflowY: 'auto' }}>
          {matches.map(a => (
            <div
              key={a.code}
              onMouseDown={() => { onChange(a.code, a.name); setQ(`${a.code} – ${a.name}`); setOpen(false); }}
              style={{ padding: '7px 10px', cursor: 'pointer', fontSize: compact ? '12px' : '13px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '8px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <span style={{ fontWeight: 700, color: 'var(--text-main)', minWidth: 46 }}>{a.code}</span>
              <span style={{ color: 'var(--text-main)' }}>{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
