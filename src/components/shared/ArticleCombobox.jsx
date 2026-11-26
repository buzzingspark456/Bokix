import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n';
import { numberFormat } from '../../utils/intlCache';

// Textfält med artikelregistret som förslag (2026-11-23): sök på benämning
// eller artikelnummer, välj med pil + Enter eller klick. Fritext går också,
// raden behöver inte vara en artikel. Listan ritas i en portal med fast
// position, så att den inte klipps av radernas behållare.
const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const MAX = 8;

export function matchArticles(articles, query, max = MAX) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const a of articles || []) {
    const name = String(a.description || '').toLowerCase();
    const num = String(a.articleNumber || '').toLowerCase();
    let score = -1;
    if (num && num === q) score = 0;
    else if (num.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (name.split(/[\s,./-]+/).some(w => w.startsWith(q))) score = 3;
    else if (name.includes(q) || num.includes(q)) score = 4;
    else if (q.split(/\s+/).every(part => name.includes(part))) score = 5;
    if (score >= 0) scored.push([score, a]);
  }
  return scored.sort((x, y) => x[0] - y[0] || String(x[1].description).localeCompare(String(y[1].description), 'sv')).slice(0, max).map(([, a]) => a);
}

export default function ArticleCombobox({ articles = [], value, onChange, onPick, placeholder, style, className, required, inputProps = {}, simple = false }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const listId = useId();
  const hits = useMemo(() => (open ? matchArticles(articles, value) : []), [open, articles, value]);
  const show = open && hits.length > 0 && rect;
  // Kundernas datalist: samma element så länge registret är detsamma, så att
  // React inte jämför alla artiklar vid varje tangent.
  const dlOptions = useMemo(() => (simple ? articles.map((a, i) => <option key={a.id || `${a.description}-${i}`} value={a.description}>{a.description}</option>) : null), [simple, articles]);

  const place = () => { const r = inputRef.current?.getBoundingClientRect(); if (r) setRect({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 320) }); };
  useEffect(() => {
    if (!open) return undefined;
    place();
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); };
  }, [open]);
  useEffect(() => { setActive(0); }, [value]);

  const pick = (a) => { onPick?.(a); setOpen(false); };
  // Kunderna har kvar webbläsarens egen lista tills sökningen släpps (bara admin än).
  if (simple) {
    return (
      <>
        <input type="text" list={`${listId}-dl`} placeholder={placeholder} style={style} className={className} value={value} required={required} onChange={e => onChange(e.target.value)} {...inputProps} />
        <datalist id={`${listId}-dl`}>{dlOptions}</datalist>
      </>
    );
  }
  const onKeyDown = (e) => {
    if (!show) { if (e.key === 'ArrowDown' && articles.length) { setOpen(true); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown') { setActive(i => Math.min(i + 1, hits.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setActive(i => Math.max(i - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter') { pick(hits[active]); e.preventDefault(); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={Boolean(show)}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        style={style}
        className={className}
        value={value}
        required={required}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        {...inputProps}
      />
      {show && createPortal(
        <ul id={listId} role="listbox" className="acb-list" style={{ left: rect.left, top: rect.top, width: rect.width }}>
          {hits.map((a, i) => (
            <li key={a.id || `${a.description}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'on' : ''}
              onMouseDown={e => { e.preventDefault(); pick(a); }} onMouseEnter={() => setActive(i)}>
              <span className="acb-main">
                <strong>{a.description}</strong>
                <small>{[a.articleNumber, a.type === 'vara' ? t('articleImport.goods') : t('articleImport.service')].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="acb-price">{fmt(a.unitPrice)} kr<small>/{a.unit || 'st'}</small></span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
