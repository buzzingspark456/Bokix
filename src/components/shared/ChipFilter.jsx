import React from 'react';

// Filterknappar som blir en rullgardin när raden är för smal (2026-11-24).
// Samma utseende i Artiklar, Lager och Prissättning; CSS:en (.cf-*) väljer
// med en container query vilken av de två som syns, så att verktygsraden
// aldrig bryts på två rader.
// items: [[id, label, count, tone?]], tone: 'low' | 'out'
export default function ChipFilter({ items, value, onChange, label }) {
  return (
    <>
      <div className="ar-chips cf-chips" role="tablist" aria-label={label}>
        {items.map(([id, text, n, tone]) => (
          <button key={id} type="button" role="tab" aria-selected={value === id}
            className={`ar-chip${value === id ? ' on' : ''}${tone ? ` is-${tone}` : ''}`}
            onClick={() => onChange(id)}>
            {text}{n != null && <span>{n}</span>}
          </button>
        ))}
      </div>
      <select className="ar-select cf-select" value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
        {items.map(([id, text, n]) => <option key={id} value={id}>{n != null ? `${text} (${n})` : text}</option>)}
      </select>
    </>
  );
}
