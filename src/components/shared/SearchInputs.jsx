import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ListTree } from 'lucide-react';
import { accountMatches, groupAccountsByClass } from '../../utils/accountSearch';
import AnchoredDropdown, { useDismissOnOutsideClick } from './AnchoredDropdown';

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
  const inputRef = useRef();
  const listRef = useRef();

  useEffect(() => { setQ(selected?.name || ''); }, [value]); // eslint-disable-line

  // Listan ligger i en portal (AnchoredDropdown) och är därför inte ett barn
  // till `ref` i DOM:en — utan listRef i kontrollen räknas ett klick i
  // listan som ett klick utanför, och valet hinner aldrig registreras.
  useDismissOnOutsideClick(open, () => setOpen(false), ref, listRef);

  // Ingen `.slice(0, 10)` längre: listan är scrollbar och tio träffar var
  // en godtycklig gräns som tyst dolde resten av projekten/kontakterna.
  const matches = q.length >= 1
    ? (items || []).filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    : (items || []);

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
        ref={inputRef}
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)', ...inputStyle }}
      />
      <AnchoredDropdown
        anchorRef={inputRef}
        panelRef={listRef}
        open={open && (matches.length > 0 || showCreateRow)}
        minWidth={260}
        maxHeight={280}
      >
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
              style={{ padding: '7px 10px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-text)', fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <span>+</span><span>{createLabel}: "{trimmedQ}"</span>
            </div>
          )}
      </AnchoredDropdown>
    </div>
  );
}

/**
 * Fritextfält med en SYNLIG förslagslista — för värden som sparas som text,
 * inte som ett id (leverantörsnamn på ett kvitto, till exempel).
 *
 * Ersätter <input list="..."> plus <datalist>. Den inbyggda datalisten ser
 * bra ut i dokumentationen och nästan ingenting i verkligheten: den visar
 * inget när fältet får fokus, öppnar sig olika i varje webbläsare, går inte
 * att stila, och på mobil syns den knappt alls. Kundens iakttagelse var
 * kort och korrekt: "man kan inte se något i Leverantör".
 *
 * Den här listan öppnas när fältet får fokus, visar allt man skrivit förut
 * och filtrerar medan man skriver. Man kan fortfarande skriva vad som helst
 * — förslagen är en genväg, inte ett tvång.
 */
export function TextSuggestInput({ value, onChange, suggestions = [], placeholder, disabled, style, emptyHint }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const inputRef = useRef();
  const listRef = useRef();

  useDismissOnOutsideClick(open, () => setOpen(false), ref, listRef);

  const q = String(value || '').trim().toLowerCase();
  // Med tomt fält visas allt (det är hela poängen — man ska SE vad som
  // finns). Med text filtreras listan, och en exakt träff är inget förslag
  // värt att visa: den står redan i fältet.
  const matches = (suggestions || [])
    .filter(s => (q ? s.toLowerCase().includes(q) : true))
    .filter(s => s.toLowerCase() !== q);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={value || ''}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)', ...style }}
      />
      <AnchoredDropdown
        anchorRef={inputRef}
        panelRef={listRef}
        open={open && !disabled && (matches.length > 0 || Boolean(emptyHint && !suggestions.length))}
        minWidth={220}
        maxHeight={260}
      >
        {matches.map(s => (
          <div
            key={s}
            onMouseDown={() => { onChange(s); setOpen(false); }}
            style={{ padding: '8px 11px', cursor: 'pointer', fontSize: '13.5px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-light)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            {s}
          </div>
        ))}
        {emptyHint && !suggestions.length && (
          <div style={{ padding: '9px 11px', fontSize: '12.5px', color: 'var(--text-muted)' }}>{emptyHint}</div>
        )}
      </AnchoredDropdown>
    </div>
  );
}

export function PartySearch({ value, onChange, contacts, onCreateNew, createLabel }) {
  return <EntitySearch value={value} onChange={onChange} items={contacts} placeholder="Sök kund eller leverantör..." renderMeta={c => c.type === 'supplier' ? 'Leverantör' : 'Kund'} onCreateNew={onCreateNew} createLabel={createLabel} />;
}

export function ProjectSearch({ value, onChange, projects }) {
  return <EntitySearch value={value} onChange={onChange} items={projects} placeholder="Sök projekt..." />;
}

// ── Kontoväljaren ───────────────────────────────────────────────────────
// Kundrapport: i leverantörsfakturans "Kontering" gick det inte att SE
// några konton alls. Två orsaker, båda åtgärdade här:
//
//  1. Listan visades bara när något var inskrivet (`q.length >= 1`). Ett
//     tomt fält gav en tom lista — man var tvungen att redan veta vad man
//     letade efter för att få se något att välja bland.
//  2. Förslagslistan låg `position: absolute` inuti formuläret. I
//     konteringstabellen sitter raderna i en `overflow-x: auto`-behållare
//     (SupplierInvoices.jsx), som klipper bort allt som sticker ut —
//     listan ritades alltså, men utanför den synliga ytan. Den renderas
//     nu i en portal med fasta koordinater, så ingen förälder kan klippa
//     den, oavsett vilken sida den används på.
//
// Utöver det: hela kontoplanen går att bläddra i via en egen ruta
// (AccountPickerModal), piltangenter + Enter väljer, och sökningen tar
// både kontonummer och ord ur namnet.

// Klasser och matchningsregel bor i utils/accountSearch.js — samma logik
// används av kontoplansfliken under Bokföring, och ligger där för att kunna
// testas utan React (vitest kör bara .test.js i node-miljö).


const accountLabel = (a) => (a ? `${a.code} – ${a.name}` : '');

/**
 * Hela kontoplanen i en egen ruta: sökfält högst upp, kontona grupperade
 * per BAS-klass under. För den som inte vet vad kontot heter och behöver
 * bläddra i stället för att gissa — kundönskemålet bakom den här ändringen.
 *
 * z-index 1100 är medvetet HÖGRE än .modal-overlay (1000, index.css):
 * rutan öppnas oftast från ett formulär som självt är en modal
 * (leverantörsfaktura, utgift), och skulle annars hamna under den.
 */
export function AccountPickerModal({ accounts = [], initialQuery = '', onPick, onClose }) {
  const [q, setQ] = useState(initialQuery);
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = (accounts || []).filter(a => accountMatches(a, q));
  const groups = groupAccountsByClass(filtered);

  const rowStyle = {
    display: 'flex', gap: '12px', alignItems: 'baseline', width: '100%',
    padding: '9px 16px', background: 'none', border: 'none', borderRadius: 0,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: '13px',
    color: 'var(--text-main)',
  };

  const renderRow = (a) => (
    <button
      key={a.code}
      type="button"
      onClick={() => { onPick(a.code, a.name); onClose(); }}
      style={rowStyle}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-muted)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      <span style={{ fontWeight: 700, minWidth: '46px', flexShrink: 0 }}>{a.code}</span>
      <span>{a.name}</span>
    </button>
  );

  return createPortal(
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px',
      }}
    >
      <div
        role="dialog"
        aria-label="Kontoplan"
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '560px', maxHeight: 'min(78vh, 680px)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 18px 12px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>Kontoplan</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {filtered.length} av {accounts.length} konton
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Stäng" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '0 18px 12px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '30px', top: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Sök kontonummer eller namn..."
            style={{
              width: '100%', boxSizing: 'border-box', height: '36px', padding: '0 12px 0 34px',
              border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13.5px',
              fontFamily: 'inherit', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border-light)' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '28px 18px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
              Inget konto matchar "{q}". Sök på kontonummer (t.ex. 5410) eller ett ord ur namnet.
            </div>
          )}
          {groups.map(g => (
            <div key={g.key}>
              <div style={{
                position: 'sticky', top: 0, zIndex: 1, padding: '8px 16px',
                background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-light)',
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>
                {g.key === 'other' ? g.label : `${g.key} · ${g.label}`}
              </div>
              {g.rows.map(renderRow)}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Sökbar kontocombobox mot kontoplanen (kod + namn).
 *
 * `compact` ger den täta stilen som används i verifikationsradernas
 * kontokolumn. Listan visas även när fältet är tomt — man ska kunna öppna
 * fältet och SE vad som finns, inte behöva veta det i förväg — och
 * knappen till höger öppnar hela kontoplanen (AccountPickerModal).
 */
export function AccountSearch({ value, onChange, accounts, placeholder = 'Konto...', compact = false }) {
  const selected = value ? (accounts || []).find(a => a.code === value) : null;
  const [q, setQ] = useState(selected ? accountLabel(selected) : (value || ''));
  const [open, setOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef();
  const inputRef = useRef();
  const listRef = useRef();

  useEffect(() => {
    const acc = value ? (accounts || []).find(a => a.code === value) : null;
    setQ(acc ? accountLabel(acc) : (value || ''));
  }, [value]); // eslint-disable-line

  useDismissOnOutsideClick(open, () => setOpen(false), wrapRef, listRef);

  // Står den valda etiketten kvar i fältet är det inte en sökning, det är
  // ett val — visa hela listan i stället för det enda konto som "matchar".
  const isPristineSelection = Boolean(selected) && q === accountLabel(selected);
  const query = isPristineSelection ? '' : q;
  const matches = (accounts || []).filter(a => accountMatches(a, query));

  useEffect(() => { setHighlight(0); }, [q]);

  const pick = (a) => {
    onChange(a.code, a.name);
    setQ(accountLabel(a));
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && matches[highlight]) { e.preventDefault(); pick(matches[highlight]); }
  };

  const inputStyle = compact
    ? { width: '100%', padding: '4px 26px 4px 6px', border: '1px solid var(--text-muted)', borderRadius: '3px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--bg-card)', color: 'var(--text-main)' }
    : { width: '100%', padding: '9px 32px 9px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)' };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
        onFocus={e => { setOpen(true); e.target.select(); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={inputStyle}
      />
      {/* Knappen finns i VARJE kontofält, inte bara i något enstaka
          formulär: samma väg in till kontoplanen oavsett var man står. */}
      <button
        type="button"
        onClick={() => { setOpen(false); setShowPicker(true); }}
        title="Visa hela kontoplanen"
        aria-label="Visa hela kontoplanen"
        style={{
          position: 'absolute', right: compact ? '3px' : '6px', top: '50%', transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: compact ? '20px' : '24px', height: compact ? '20px' : '24px',
          padding: 0, background: 'none', border: 'none', borderRadius: '5px',
          cursor: 'pointer', color: 'var(--text-muted)',
        }}
      >
        <ListTree size={compact ? 13 : 15} />
      </button>

      <AnchoredDropdown
        anchorRef={inputRef}
        panelRef={listRef}
        open={open}
        minWidth={280}
        maxHeight={340}
        onMouseDown={e => e.preventDefault()}
        style={{ overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {matches.length === 0 && (
              <div style={{ padding: '12px 12px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Inget konto matchar. Prova ett kontonummer eller ett ord ur namnet.
              </div>
            )}
            {matches.map((a, i) => (
              <div
                key={a.code}
                onMouseDown={() => pick(a)}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  padding: '7px 10px', cursor: 'pointer', fontSize: compact ? '12px' : '13px',
                  borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '8px',
                  background: i === highlight ? 'var(--bg-muted)' : 'none',
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--text-main)', minWidth: 46 }}>{a.code}</span>
                <span style={{ color: 'var(--text-main)' }}>{a.name}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setOpen(false); setShowPicker(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
              padding: '9px 12px', background: 'var(--bg-muted)', border: 'none',
              borderTop: '1px solid var(--border-light)', cursor: 'pointer',
              fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit',
            }}
          >
            <ListTree size={14} /> Visa hela kontoplanen ({(accounts || []).length} konton)
          </button>
      </AnchoredDropdown>

      {showPicker && (
        <AccountPickerModal
          accounts={accounts || []}
          initialQuery={isPristineSelection ? '' : q}
          onPick={(code, name) => { onChange(code, name); setQ(`${code} – ${name}`); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

