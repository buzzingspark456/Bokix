import React, { useState, useRef, useEffect, useContext } from 'react';
import { Search, RefreshCw, SlidersHorizontal, Plus, MoreHorizontal, PlayCircle } from '../icons';
import { GuideContext } from './GuideContext';
import { t } from '../../i18n';

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
  padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: '13px',
  fontWeight: active ? 700 : 500,
  color: active ? 'var(--text-main)' : 'var(--text-secondary)',
  background: 'none',
  borderBottom: active ? '3px solid var(--accent)' : '3px solid transparent',
  marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '6px',
});

// Piller-varianten (`tabs.variant: 'pills'`). Till för sidor med så många
// flikar att den vanliga understruket-raden inte får plats på en skärmbredd
// — Inställningar har åtta. Kundfeedback: "de sista flikarna ligger utanför
// skärmen, man måste skrolla i sidled för att se dem". Understrukna flikar
// KAN inte radbryta (två understrykningslinjer under varandra läses som två
// skilda kontroller), men pillren kan: de bär sin egen ram och sin egen
// bakgrund, så en andra rad ser ut precis som den första. Alla flikar syns
// därmed samtidigt, både på bred skärm och på telefon.
const tabPillStyle = (active) => ({
  padding: '7px 14px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
  fontWeight: active ? 700 : 600,
  color: active ? '#fff' : 'var(--text-secondary)',
  background: active ? 'var(--accent)' : 'var(--bg-muted)',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '6px',
  whiteSpace: 'nowrap',
});

/**
 * Delad sidhuvud-toolbar för samtliga listsidor.
 *
 * @param {string} title - Sidrubrik, t.ex. "Kunder".
 * @param {string} [subtitle] - Undertext under rubriken, t.ex. "12 kunder" eller en fast beskrivning.
 * @param {Array<{key?, label, icon?, onClick, variant?: 'primary'|'secondary', title?, disabled?, dataTour?: string}>} [actions]
 *   `dataTour` (optional): satt som data-tour-attribut på knappen — så produktrundturen
 *   (utils/productTour.js) kan peka på en RIKTIG knapp, t.ex. "Ny verifikation", istället
 *   för att bara beskriva den utifrån.
 *   - Renderas i given ordning. Konvention: sekundära knappar (Exportera/Importera) FÖRST,
 *     primärknappen (Ny kund/Ny anställd, grön) SIST längst till höger.
 * @param {{items: Array<{id, label, badge?: number}>, activeId, onChange, variant?: 'underline'|'pills'}} [tabs]
 *   - Flikrad under sidhuvudet, alltid med samma avstånd och samma
 *     understrykningsstil (3px grön, aktiv flik).
 *   - `variant: 'pills'`: rundade knappar som RADBRYTER i stället för att skrollas
 *     i sidled. Bara för sidor med fler flikar än vad som får plats på en rad
 *     (Inställningar, åtta stycken) — annars gäller understrykningen.
 * @param {React.ReactNode} [children] - Extra rad mellan sidhuvud och flikar, t.ex. en importstatus-banner.
 */
export default function ListPageHeader({ title, subtitle, actions = [], tabs, children }) {
  const hasTabs = tabs && tabs.items?.length > 0;
  // Se hur: filmen för sidan (App.jsx sätter GuideContext, utils/pageGuides.js).
  const guide = useContext(GuideContext);
  const pills = Boolean(hasTabs && tabs.variant === 'pills');
  // Telefon: flikraden är en rad man sveper i sidled (index.css). Den valda
  // fliken skrollas fram så den aldrig står gömd bakom kanten. Bara raden
  // själv flyttas, aldrig sidan (scrollIntoView hade kunnat skrolla sidan).
  const tabsRef = useRef(null);
  const activeTabId = hasTabs ? tabs.activeId : null;
  useEffect(() => {
    const row = tabsRef.current;
    const btn = row?.querySelector('[aria-current="page"]');
    if (!row || !btn || row.scrollWidth <= row.clientWidth) return;
    const left = row.scrollLeft + btn.getBoundingClientRect().left - row.getBoundingClientRect().left;
    const target = left - (row.clientWidth - btn.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeTabId]);
  return (
    <div className="list-page-header" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 20px', paddingBottom: hasTabs ? 0 : '12px', flexShrink: 0 }}>
      <div className="page-header-row page-header-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 0', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          {/* Kundfeedback ("luft i sidhuvudet", samma princip som Startsidan):
              2px kändes hopklämt mellan rubrik och undertext — 6px (samma
              rytm som Dashboard.jsx:s hälsningsrader) ger läsbar andrum
              utan att blåsa upp den kompakta verktygsrads-höjden här. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>{title}</h1>
            {guide?.guides?.length > 0 && (
              <button type="button" className="lph-guide" onClick={guide.open} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', border: 'none', borderRadius: '999px', background: 'var(--bg-muted)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <PlayCircle size={14} /> {t('ui.se_hur')}
              </button>
            )}
          </div>
          {subtitle && <p className="page-header-subtitle" style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        {actions.length > 0 && (
          // `page-header-actions`: på telefon läggs knapparna på en egen rad
          // och delar bredden i stället för att ligga kvar på rubrikraden och
          // skjuta ut över kanten (kundfeedback: "Importera transaktioner"
          // var avklippt på mobilen). Klass, inte inline style, eftersom
          // regeln behöver en mediafråga — se index.css.
          //
          // Som i en app på telefon: en "Ny …"-knapp (primär med plusikon)
          // blir en rund flytande knapp nere till höger (page-fab), och de
          // sekundära knapparna (exportera, guide m.m.) flyttar in bakom en
          // "⋯"-knapp (lph-more) i stället för att fylla sidhuvudet. På
          // datorn syns allt som förut.
          <div className={'page-header-actions' + (actions.filter(a => a.type !== 'note').length > 1 ? ' page-header-actions--many' : '')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {actions.map((a, i) => a.type === 'note' ? (
              <span key={a.key ?? i} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {a.label} {a.value && <strong style={{ color: 'var(--text-main)' }}>{a.value}</strong>}
              </span>
            ) : (
              <button
                key={a.key ?? a.label ?? i}
                type="button"
                className={a.variant === 'primary' ? (a.icon === Plus ? 'page-fab' : undefined) : 'lph-secondary'}
                data-tour={a.dataTour}
                onClick={a.onClick}
                title={a.title}
                disabled={a.disabled}
                style={{ ...listHeaderButtonStyle(a.variant), ...(a.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : null) }}
              >
                {a.icon && <a.icon size={14} />} {a.label}
              </button>
            ))}
            {actions.some(a => a.type !== 'note' && a.variant !== 'primary') && (
              <MoreActions actions={[
                ...actions.filter(a => a.type !== 'note' && a.variant !== 'primary'),
                // Telefon: Se hur ligger i ⋯-menyn i stället för bredvid rubriken.
                ...(guide?.guides?.length > 0 ? [{ key: 'guide', label: t('ui.se_hur'), icon: PlayCircle, onClick: guide.open, phoneOnly: true }] : []),
              ]} />
            )}
          </div>
        )}
      </div>

      {children}

      {hasTabs && (
        <div
          ref={tabsRef}
          className={'page-header-tabs' + (pills ? ' page-header-tabs--pills' : '') + (tabs.wrap ? ' page-header-tabs--wrap' : '')}
          style={{ display: 'flex', gap: pills ? '7px' : 0, marginTop: pills ? '8px' : '6px', paddingBottom: pills ? '12px' : 0 }}
        >
          {tabs.items.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => tabs.onChange(t.id)}
              aria-current={tabs.activeId === t.id ? 'page' : undefined}
              style={pills ? tabPillStyle(tabs.activeId === t.id) : tabButtonStyle(tabs.activeId === t.id)}
            >
              {t.icon && <t.icon size={14} />}
              {t.shortLabel
                ? <><span className="tab-label-long">{t.label}</span><span className="tab-label-short">{t.shortLabel}</span></>
                : t.label}{typeof t.badge === 'number' && t.badge > 0 ? ` · ${t.badge}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// "⋯"-knappen: sidans sekundära knappar. På telefon i en bottenpanel, i
// halvskärm på dator som en meny under knappen (profile-dropdown, se
// index.css). Dold på bred dator, där knapparna syns direkt.
function MoreActions({ actions }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="lph-more-wrap">
      <button type="button" className="lph-more topbar-icon-btn" aria-label={t('shared.moreActions')} aria-expanded={open} onClick={() => setOpen(true)}>
        <MoreHorizontal size={22} />
      </button>
      {open && (
        <>
          <div className="mobile-dropdown-backdrop" onClick={() => setOpen(false)} />
          {/* Klick utanför stänger menyn även på dator (halvskärm). */}
          <div className="lph-more-backdrop" onClick={() => setOpen(false)} />
          <div className="profile-dropdown lph-more-sheet" role="menu">
            {actions.map((a, i) => (
              <button
                key={a.key ?? a.label ?? i}
                type="button"
                role="menuitem"
                className={a.phoneOnly ? 'lph-more-phone' : undefined}
                disabled={a.disabled}
                onClick={() => { setOpen(false); a.onClick?.(); }}
              >
                {a.icon && <a.icon size={14} />} {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
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
 * @param {number} [pageSize] - tillsammans med `onPageSizeChange`: en "visa N åt gången"-väljare
 *   (kundönskemål: "en knapp där man kan se femton, trettio, femtio") i samma rad som räknaren.
 *   Sidan äger själv `pageSize`-state:t och skär av sin egen `rows`-array innan den skickas till
 *   ListTable — den här komponenten vet inget om paginering, bara om att RITA väljaren.
 * @param {(n: number|'all') => void} [onPageSizeChange]
 * @param {Array<number>} [pageSizeOptions] - default PAGE_SIZE_OPTIONS.
 */
export const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

// collapsed (standard): filtren ligger bakom Filter-knappen även på stor skärm (2026-11-08,
// Verifikationer: "ska inte synas förrän man trycker på Filter").
export function ListFilterBar({ children, onClear, count, countLabel, pageSize, onPageSizeChange, pageSizeOptions = PAGE_SIZE_OPTIONS, activeFilters = 0, collapsed = true }) {
  const [open, setOpen] = useState(false);
  const hasPageSize = pageSize != null && onPageSizeChange;
  const hasSecondRow = Boolean(onClear) || count != null || hasPageSize;
  // Första barnet är sökfältet och ligger alltid framme. Resten (datum,
  // serier, månader, vy) döljs bakom en Filter-knapp på telefon, så att
  // listan inte trycks ned under fem rader kontroller. På dator är allt
  // som förut: omslagen är display: contents och påverkar inte layouten.
  const items = React.Children.toArray(children);
  const [first, ...rest] = items;
  const hasMore = rest.length > 0 || Boolean(onClear) || hasPageSize;
  // Utan Rensa-knapp står antalet och Visa-väljaren på sökfältets rad på
  // datorn, i stället för ensamma på en egen rad (2026-11-05: mer av listan
  // syns). Telefonen har kvar sin rad bakom Filter.
  const inline = !onClear && (count != null || hasPageSize);
  const right = (inRow) => (
      <div className={inRow ? 'lfb-inline' : undefined} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
        {count != null && (
          <span className="lfb-count" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{count} {countLabel}</span>
        )}
        {hasPageSize && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('shared.filterBar.show')}
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{ ...listFilterFieldStyle, height: '28px', padding: '0 8px', fontSize: '12px' }}
            >
              {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
              <option value="all">{t('shared.filterBar.all')}</option>
            </select>
          </label>
        )}
      </div>
  );
  return (
    <div className={'lfb' + (collapsed ? ' lfb--collapsed' : '')} data-open={open ? 'true' : 'false'} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
      <div className="lfb-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: hasSecondRow && !inline ? '8px' : 0 }}>
        <div className="lfb-primary">{first}</div>
        {hasMore && (
          <button type="button" className="lfb-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            <SlidersHorizontal size={16} />
            {t('shared.filterBar.filter')}
            {activeFilters > 0 && <span className="lfb-toggle-badge">{activeFilters}</span>}
          </button>
        )}
        <div className="lfb-more">{rest}</div>
        {inline && right(true)}
      </div>
      {count != null && <div className="lfb-count-line">{count} {countLabel}</div>}
      {hasSecondRow && (
        <div className={'lfb-second' + (inline ? ' lfb-second--phone' : '')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          {onClear ? (
            <button type="button" onClick={onClear} style={{ ...listHeaderButtonStyle('secondary'), height: '30px', padding: '0 12px' }}>
              <RefreshCw size={14} /> {t('shared.filterBar.clear')}
            </button>
          ) : <span />}
          {right(false)}
        </div>
      )}
    </div>
  );
}
