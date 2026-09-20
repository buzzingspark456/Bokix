import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Check, Pencil } from '../icons';
import { accountMatches, groupAccountsByClass } from '../../utils/accountSearch';

// ── Kontoväljaren i kvittovyn ───────────────────────────────────────────
// Kundfeedback: kontot som avläsningen föreslog kunde vara fel, och för att
// byta det fick man först ta bort det och sedan hitta fram listan. Den här
// väljaren ligger därför INLINE, direkt under fältet, i stället för en
// flytande ruta som ska hitta plats ovanför eller under tangentbordet:
//
//  - Inget valt: sökfält och kontolistan syns direkt. Listan är scrollbar och
//    söker i hela kontoplanen så fort man skriver.
//  - Valt konto: en rad med kontot och en tydlig "Byt konto"-knapp. Ett tryck
//    öppnar samma sök/lista, utan att kontot behöver tas bort först.
//
// Avläsningen lägger inte längre in ett konto den bara gissat: då är fältet
// tomt och listan öppen (se Expenses.jsx), så det är användaren som väljer.
// En regel som träffat (leverantören, ett ord på kvittot) visas som ETT
// förslag överst, som man bekräftar med ett tryck. Det skrivs aldrig in själv.

const GROUP_ORDER = ['5-6', '4', '7', '1', '8', '2', '3'];

export default function AccountInlinePicker({ value, onChange, accounts: allAccounts = [], quick = [], suggestion = null, invalid = false }) {
  // En importerad kontoplan kan ha samma kod två gånger. Listan behåller en
  // rad per kod (den aktiva om det finns en), annars får React dubbla nycklar
  // och lämnar kvar rader som inte längre hör till sökningen.
  const accounts = useMemo(() => {
    const byCode = new Map();
    allAccounts.forEach(a => {
      const prev = byCode.get(a.code);
      if (!prev || (!(prev.active || prev.system) && (a.active || a.system))) byCode.set(a.code, a);
    });
    return [...byCode.values()];
  }, [allAccounts]);
  const selected = value ? accounts.find(a => a.code === value) : null;
  const [open, setOpen] = useState(!value);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  // Fokus (och därmed tangentbordet på telefon) flyttas bara hit när man själv
  // tryckt på "Byt konto", inte varje gång listan visas av sig själv.
  const focusOnOpen = useRef(false);

  // Kontot sätts utifrån (avläsningen, ett snabbval): visa det som valt. Tas
  // det bort utifrån: visa listan igen.
  useEffect(() => {
    setOpen(!value);
    setQuery('');
    setShowAll(false);
  }, [value]);

  useEffect(() => {
    if (open && focusOnOpen.current) {
      focusOnOpen.current = false;
      inputRef.current?.focus({ preventScroll: true });
      rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [open]);

  // Tomt fält visar bara de konton företaget faktiskt använder, annars
  // dränks de i hela planen. Skriver man något söks hela planen, så inget
  // konto är oåtkomligt. "Visa alla konton" öppnar hela planen utan sökning.
  // Reservfall: en kontoplan där inget konto har `active` satt visar allt.
  const activeAccounts = useMemo(() => accounts.filter(a => a.active || a.system), [accounts]);
  const basePool = activeAccounts.length > 0 ? activeAccounts : accounts;
  const trimmed = query.trim();
  const matches = useMemo(() => {
    if (trimmed) return accounts.filter(a => accountMatches(a, trimmed));
    return showAll ? accounts : basePool;
  }, [accounts, basePool, trimmed, showAll]);
  // Ett kvitto är oftast en kostnad, så kostnadsklasserna (5–6, 4, 7) står
  // överst och tillgångar, skulder och intäkter längre ned, fortfarande sökbara.
  const groups = useMemo(() => {
    const rank = (key) => { const i = GROUP_ORDER.indexOf(key); return i === -1 ? GROUP_ORDER.length : i; };
    return [...groupAccountsByClass(matches)].sort((x, y) => rank(x.key) - rank(y.key));
  }, [matches]);
  const flat = useMemo(() => groups.flatMap(g => g.rows), [groups]);
  const indexOf = useMemo(() => new Map(flat.map((a, i) => [a.code, i])), [flat]);

  useEffect(() => { setHighlight(0); }, [trimmed, showAll]);

  const pick = (a) => {
    onChange(a.code, a.name);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (trimmed && flat[highlight]) pick(flat[highlight]); }
    else if (e.key === 'Escape' && value) { e.preventDefault(); setOpen(false); setQuery(''); }
  };

  // Håller den markerade raden synlig vid piltangenter.
  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector('.acp-row[data-hl="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  if (!open && selected) {
    return (
      <div ref={rootRef} className="acp acp-selected">
        <button
          type="button"
          className="acp-current"
          onClick={() => { focusOnOpen.current = true; setOpen(true); }}
          aria-label={`Byt konto, nu ${selected.code} ${selected.name}`}
        >
          <span className="acp-code">{selected.code}</span>
          <span className="acp-name">{selected.name}</span>
          <span className="acp-change"><Pencil size={13} /> Byt konto</span>
        </button>
      </div>
    );
  }

  // Ett valt konto som inte finns i kontoplanen (importerat/borttaget) visas
  // ändå, med bara koden, så man ser vad som faktiskt är satt.
  if (!open && value && !selected) {
    return (
      <div ref={rootRef} className="acp acp-selected">
        <button type="button" className="acp-current" onClick={() => { focusOnOpen.current = true; setOpen(true); }}>
          <span className="acp-code">{value}</span>
          <span className="acp-name" style={{ color: 'var(--text-muted)' }}>Finns inte i kontoplanen</span>
          <span className="acp-change"><Pencil size={13} /> Byt konto</span>
        </button>
      </div>
    );
  }

  const canShowMore = !trimmed && !showAll && basePool.length < accounts.length;

  const suggested = suggestion ? accounts.find(a => a.code === suggestion.code) : null;
  const suggestionNote = suggestion?.source === 'supplier' ? 'Utifrån leverantören' : suggestion?.source === 'keyword' ? 'Utifrån texten på kvittot' : 'Utifrån kvittot';

  return (
    <div ref={rootRef} className={`acp acp-open${invalid ? ' acp-invalid' : ''}`}>
      {suggested && (
        <button type="button" className="acp-suggest" onClick={() => pick(suggested)}>
          <span className="acp-suggest-top">
            <span className="acp-suggest-tag">Förslag</span>
            <span className="acp-suggest-note">{suggestionNote}. Kontrollera att det stämmer.</span>
          </span>
          <span className="acp-suggest-main">
            <span className="acp-code">{suggested.code}</span>
            <span className="acp-name">{suggested.name}</span>
            <span className="acp-suggest-use">Använd</span>
          </span>
        </button>
      )}
      <div className="acp-search">
        <Search size={15} className="acp-search-ico" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Sök konto, t.ex. 6110 eller kontorsmaterial"
          aria-label="Sök konto"
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="acp-clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Rensa sökning">
            <X size={14} />
          </button>
        )}
      </div>

      {quick.length > 0 && !trimmed && (
        <div className="acp-quick">
          <span className="acp-quick-label">Snabbval</span>
          {quick.map(q => (
            <button key={q.code} type="button" className="rc-chip" onClick={() => onChange(q.code, q.name)} title={q.name}>
              {q.code}{q.name ? ` ${q.name}` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="acp-list" role="listbox" aria-label="Konton">
        {flat.length === 0 && (
          <div className="acp-empty">Inget konto matchar &quot;{trimmed}&quot;. Prova ett kontonummer (t.ex. 5410) eller ett ord ur namnet.</div>
        )}
        {groups.map(g => (
          <div key={g.key}>
            <div className="acp-group">{g.label}</div>
            {g.rows.map(a => {
              const idx = indexOf.get(a.code);
              const isSel = a.code === value;
              return (
                <button
                  key={a.code}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  data-hl={idx === highlight && trimmed ? '1' : undefined}
                  className={`acp-row${isSel ? ' acp-row-sel' : ''}${idx === highlight && trimmed ? ' acp-row-hl' : ''}`}
                  onClick={() => pick(a)}
                >
                  <span className="acp-code">{a.code}</span>
                  <span className="acp-name">{a.name}</span>
                  {isSel && <Check size={15} className="acp-check" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="acp-foot">
        <span>{trimmed ? `${flat.length} träffar` : `${flat.length} av ${accounts.length} konton`}</span>
        <span className="acp-foot-actions">
          {canShowMore && <button type="button" className="rc-link" onClick={() => setShowAll(true)}>Visa alla konton</button>}
          {showAll && !trimmed && <button type="button" className="rc-link" onClick={() => setShowAll(false)}>Visa bara vanliga</button>}
          {value && <button type="button" className="rc-link" onClick={() => { setOpen(false); setQuery(''); }}>Avbryt</button>}
        </span>
      </div>
    </div>
  );
}
