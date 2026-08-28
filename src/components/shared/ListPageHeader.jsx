import React from 'react';
import { Search, RefreshCw } from 'lucide-react';

// Sida 43: en enda delad sidhuvud-komponent för alla listsidor (Kunder,
// Offerter, Fakturering, Utgifter, Projekt, Granskning, Bokföring,
// Anställda och lön, Rapport och analys, Skatt och bokslut, Inställningar).
// Måtten här är låsta utifrån den sida som redan kändes mest konsekvent
// (Anställda och lön / Kunder) — ändra INTE ett enskilt värde i en enskild
// sida, ändra här så alla sidor följer med.

// h-9. Sökfält och knappar delar exakt denna höjd (satt explicit via
// `height`, inte bara padding) så de alltid blir pixel-lika oavsett
// font-metrics — det var själva bugg-orsaken till att de drev isär innan.
const ROW_HEIGHT = '36px';

export function listHeaderButtonStyle(variant = 'secondary') {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    height: ROW_HEIGHT, padding: '0 16px', boxSizing: 'border-box',
    border: variant === 'primary' ? 'none' : '1px solid var(--border)',
    borderRadius: '5px',
    background: variant === 'primary' ? 'var(--accent)' : 'none',
    color: variant === 'primary' ? 'white' : 'var(--text-secondary)',
    fontWeight: variant === 'primary' ? 700 : 600,
    fontSize: '13px',
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  };
}

export const listSearchInputStyle = {
  height: ROW_HEIGHT, boxSizing: 'border-box',
  padding: '0 12px 0 36px',
  border: '1px solid var(--border)', borderRadius: '8px',
  fontSize: '14px', outline: 'none', width: '260px',
  background: 'var(--bg-card)', color: 'var(--text-main)',
};

// Samma h-9 som listSearchInputStyle/listHeaderButtonStyle, men utan
// vänsterpaddingen för sökikonen — för filterradens övriga fält
// (datumväljare, dropdowns) så HELA filterraden delar exakt samma höjd,
// inte bara sökfältet för sig.
export const listFilterFieldStyle = {
  height: ROW_HEIGHT, boxSizing: 'border-box',
  padding: '0 10px',
  border: '1px solid var(--border)', borderRadius: '8px',
  fontSize: '13px', outline: 'none', fontFamily: 'inherit',
  background: 'var(--bg-card)', color: 'var(--text-main)',
};

const tabButtonStyle = (active) => ({
  padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: '13px',
  fontWeight: active ? 700 : 500,
  color: active ? 'var(--text-main)' : 'var(--text-secondary)',
  background: 'none',
  borderBottom: active ? '3px solid var(--accent)' : '3px solid transparent',
  marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '6px',
});

/**
 * Delad sidhuvud-toolbar för samtliga listsidor.
 *
 * @param {string} title - Sidrubrik, t.ex. "Kunder".
 * @param {string} [subtitle] - Undertext under rubriken, t.ex. "12 kunder" eller en fast beskrivning.
 * @param {Array<{key?, label, icon?, onClick, variant?: 'primary'|'secondary', title?, disabled?}>} [actions]
 *   - Renderas i given ordning. Konvention: sekundära knappar (Exportera/Importera) FÖRST,
 *     primärknappen (Ny kund/Ny anställd, grön) SIST längst till höger.
 * @param {{items: Array<{id, label, badge?: number}>, activeId, onChange}} [tabs]
 *   - Flikrad under sidhuvudet, alltid med samma avstånd (marginTop 12px) och samma
 *     understrykningsstil (3px grön, aktiv flik).
 * @param {React.ReactNode} [children] - Extra rad mellan sidhuvud och flikar, t.ex. en importstatus-banner.
 */
export default function ListPageHeader({ title, subtitle, actions = [], tabs, children }) {
  const hasTabs = tabs && tabs.items?.length > 0;
  return (
    <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 20px', paddingBottom: hasTabs ? 0 : '16px', flexShrink: 0 }}>
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 0', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          {/* Kundfeedback ("luft i sidhuvudet", samma princip som Startsidan):
              2px kändes hopklämt mellan rubrik och undertext — 6px (samma
              rytm som Dashboard.jsx:s hälsningsrader) ger läsbar andrum
              utan att blåsa upp den kompakta verktygsrads-höjden här. */}
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{title}</h1>
          {subtitle && <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        {actions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {actions.map((a, i) => a.type === 'note' ? (
              <span key={a.key ?? i} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {a.label} {a.value && <strong style={{ color: 'var(--text-main)' }}>{a.value}</strong>}
              </span>
            ) : (
              <button
                key={a.key ?? a.label ?? i}
                type="button"
                onClick={a.onClick}
                title={a.title}
                disabled={a.disabled}
                style={{ ...listHeaderButtonStyle(a.variant), ...(a.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null) }}
              >
                {a.icon && <a.icon size={14} />} {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {children}

      {tabs && tabs.items?.length > 0 && (
        <div style={{ display: 'flex', gap: 0, marginTop: '12px' }}>
          {tabs.items.map(t => (
            <button key={t.id} type="button" onClick={() => tabs.onChange(t.id)} style={tabButtonStyle(tabs.activeId === t.id)}>
              {t.icon && <t.icon size={14} />}
              {t.label}{typeof t.badge === 'number' && t.badge > 0 ? ` · ${t.badge}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sökfältsraden som sitter i innehållsytan under sidhuvudet (listläget),
 * samma gap ner till tabellen (marginBottom 20px) och samma höjd på
 * sökfältet som sidhuvudets knappar (ROW_HEIGHT).
 */
export function ListSearchRow({ value, onChange, placeholder, right }) {
  return (
    <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input type="text" placeholder={placeholder} value={value} onChange={onChange} style={listSearchInputStyle} />
      </div>
      {right}
    </div>
  );
}

/**
 * Filterrad för sidor med mer än ett sökfält (Bokföring/Verifikationer är
 * facit-sidan den här är byggd utifrån) — alla fält (sökfält, datumväljare,
 * dropdowns) på EN rad i samma h-9-höjd, och en andra rad direkt under med
 * en vänsterjusterad "Rensa"-knapp + en högerjusterad, levande antalsräknare
 * i linje med den. Sidor med bara ETT sökfält använder `ListSearchRow`
 * istället — den här är till för filterKOMBINATIONER, inte ett enda fält.
 *
 * @param {React.ReactNode} children - filterfälten, i den ordning de ska visas.
 *   Sökfältet (om något) skickas in färdigbyggt av anroparen (samma
 *   `listSearchInputStyle`+sökikon-mönster som `ListSearchRow`), övriga
 *   fält använder `listFilterFieldStyle`.
 * @param {() => void} [onClear] - visar "Rensa"-knappen när satt.
 * @param {number} [count] - den levande antalsräknaren, t.ex. `filteredVers.length`.
 * @param {string} [countLabel] - t.ex. "verifikationer".
 */
export function ListFilterBar({ children, onClear, count, countLabel }) {
  const hasSecondRow = Boolean(onClear) || count != null;
  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: hasSecondRow ? '10px' : 0 }}>
        {children}
      </div>
      {hasSecondRow && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {onClear ? (
            <button type="button" onClick={onClear} style={listHeaderButtonStyle('secondary')}>
              <RefreshCw size={14} /> Rensa
            </button>
          ) : <span />}
          {count != null && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{count} {countLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
