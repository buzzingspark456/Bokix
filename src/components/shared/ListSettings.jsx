import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings2 } from '../icons';
import { t } from '../../i18n';

// Listans inställningar (2026-11-24), samma panel som artikellistan: knappar
// för sidans vanligaste åtgärder (import, export, ny), synliga kolumner,
// radstorlek, sidbredd och rader per sida. Valen sparas per webbläsare och
// lista (bara bekvämlighet).
export const PAGE_SIZES = [25, 50, 100, 0];

export function useListPrefs(storageKey, defaultCols) {
  const load = () => {
    const base = { cols: { ...defaultCols }, density: 'normal', width: 'wide', pageSize: 50 };
    try {
      const v = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (v && typeof v === 'object') {
        return {
          cols: { ...defaultCols, ...(v.cols || {}) },
          density: v.density === 'compact' ? 'compact' : 'normal',
          width: v.width === 'narrow' ? 'narrow' : 'wide',
          pageSize: PAGE_SIZES.includes(v.pageSize) ? v.pageSize : 50,
        };
      }
    } catch { /* privat läge */ }
    return base;
  };
  const [prefs, setPrefs] = useState(load);
  const update = (patch) => setPrefs(prev => {
    const next = { ...prev, ...patch, cols: { ...prev.cols, ...(patch.cols || {}) } };
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* privat läge */ }
    return next;
  });
  return [prefs, update];
}

export function ListSettingsButton({ onClick, className = '' }) {
  return (
    <button type="button" className={`ar-gear ${className}`} onClick={onClick} title={t('artSet.title')} aria-label={t('artSet.title')}>
      <Settings2 size={16} />
    </button>
  );
}

/**
 * actions: [{ key, label, icon: Icon, onClick, disabled? }]
 * columns: [{ key, label, icon: Icon }]
 * listOptions: false när sidan inte är en lista, då visas bara åtgärderna.
 * showPerPage: false när listan inte delas upp i sidor (t.ex. lönekörningarna).
 * note: en rad information överst, t.ex. nästa verifikationsnummer.
 * sections: [{ key, title, options: [[value, label]], value, onChange }] egna val
 *   i samma knappstil som radstorleken (t.ex. Lista/Grupperat i Bokföring).
 */
export default function ListSettings({ open, onClose, actions = [], columns = [], prefs, onChange, showWidth = true, listOptions = true, showPerPage = true, note = null, sections = [] }) {
  if (!open) return null;
  // I en portal (2026-11-25): Smal sidbredd centrerade annars panelen med sidan.
  return createPortal(
    <div className="ar-set-overlay" onClick={onClose}>
      <aside className="ar-set" onClick={e => e.stopPropagation()} aria-label={t('artSet.title')}>
        <div className="ar-set-head">
          <h2>{t('artSet.title')}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        {note && <div className="ar-set-sec ar-set-note">{note}</div>}
        {actions.length > 0 && (
          <div className="ar-set-sec ar-set-btns">
            {actions.map(({ key, label, icon: Icon, onClick, disabled }) => (
              <button key={key} type="button" disabled={disabled} onClick={() => { onClose(); onClick(); }}>{Icon && <Icon size={14} />} {label}</button>
            ))}
          </div>
        )}
        {columns.length > 0 && (
          <div className="ar-set-sec">
            <h3>{t('artSet.columns')}</h3>
            {columns.map(({ key, label, icon: Icon }) => (
              <label key={key} className="ar-switch">
                <span className="ar-switch-label">{Icon && <Icon size={16} aria-hidden="true" />}{label}</span>
                <input type="checkbox" checked={Boolean(prefs.cols[key])} onChange={e => onChange({ cols: { [key]: e.target.checked } })} />
                <i aria-hidden="true" />
              </label>
            ))}
          </div>
        )}
        {sections.map(sec => (
          <div key={sec.key} className="ar-set-sec">
            <h3>{sec.title}</h3>
            <div className="ar-set-seg">
              {sec.options.map(([v, label]) => (
                <button key={String(v)} type="button" className={sec.value === v ? 'on' : ''} onClick={() => sec.onChange(v)}>{label}</button>
              ))}
            </div>
          </div>
        ))}
        {listOptions && (<>
        <div className={`ar-set-sec${showWidth ? ' ar-set-two' : ''}`}>
          <div>
            <h3>{t('artSet.rowSize')}</h3>
            <div className="ar-set-seg">
              {[['compact', t('artSet.compact')], ['normal', t('artSet.normal')]].map(([k, label]) => (
                <button key={k} type="button" className={prefs.density === k ? 'on' : ''} onClick={() => onChange({ density: k })}>{label}</button>
              ))}
            </div>
          </div>
          {showWidth && (
            <div>
              <h3>{t('artSet.width')}</h3>
              <div className="ar-set-seg">
                {[['narrow', t('artSet.narrow')], ['wide', t('artSet.wide')]].map(([k, label]) => (
                  <button key={k} type="button" className={prefs.width === k ? 'on' : ''} onClick={() => onChange({ width: k })}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        {showPerPage && (
        <div className="ar-set-sec">
          <h3>{t('artSet.perPage')}</h3>
          <div className="ar-set-seg">
            {PAGE_SIZES.map(n => (
              <button key={n} type="button" className={prefs.pageSize === n ? 'on' : ''} onClick={() => onChange({ pageSize: n })}>{n || t('artReg.perPageAll')}</button>
            ))}
          </div>
        </div>
        )}
        </>)}
      </aside>
    </div>,
    document.body,
  );
}
