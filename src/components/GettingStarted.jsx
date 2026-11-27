import React, { useState } from 'react';
import { Check, ChevronRight, X, Minus } from './icons';
import { t } from '../i18n';

// Kom igång som panel (2026-11-27, efter Bokios lista som grundaren gillade).
// Stegen är desamma som den befintliga Kom igång-listan (dashboard/GetStarted.jsx,
// buildSteps: väg Från noll eller Flytta in, plan och dolda flikar räknas in),
// bara visade som en panel: nere till höger på dator, kan fällas ihop till en
// liten knapp; ett kort överst på startsidan på telefon. Stäng = samma som
// Dölj i den gamla listan.

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* privat läge */ } },
};

export default function GettingStarted({ companyId, companyName, steps, isDone = (s) => s.done, onGo, onClose, onTour, title, subtitle }) {
  const miniKey = `bokix.komIgang.mini.${companyId || 'default'}`;
  const [mini, setMini] = useState(() => store.get(miniKey) === '1');
  const done = steps.filter(isDone).length;
  if (!steps.length || done === steps.length) return null;
  const setMinimized = (v) => { setMini(v); store.set(miniKey, v ? '1' : null); };
  const next = steps.find(s => !isDone(s));

  if (mini) {
    return (
      <button type="button" className="kig-pill" onClick={() => setMinimized(false)} aria-label={t('gettingStarted.open')}>
        <span className="kig-pill-ring" style={{ '--p': done / steps.length }}><b>{done}</b></span>
        <span>{t('gettingStarted.short')}</span>
        <small>{done}/{steps.length}</small>
      </button>
    );
  }

  return (
    <section className="kig" aria-label={title}>
      <div className="kig-band">
        <header className="kig-head">
          <div>
            {companyName && <span className="kig-company"><i aria-hidden="true">{companyName.trim().charAt(0).toUpperCase()}</i>{companyName}</span>}
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <span className="kig-head-actions">
            <button type="button" className="kig-icon kig-min" onClick={() => setMinimized(true)} title={t('gettingStarted.minimize')} aria-label={t('gettingStarted.minimize')}><Minus size={16} /></button>
            {onClose && <button type="button" className="kig-icon" onClick={onClose} title={t('gettingStarted.close')} aria-label={t('gettingStarted.close')}><X size={16} /></button>}
          </span>
        </header>
        <div className="kig-meter">
          <div className="kig-progress" aria-hidden="true"><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
          <span className="kig-count">{t('gettingStarted.count', { done, total: steps.length })}</span>
        </div>
      </div>
      <ol className="kig-steps">
        {steps.map((s, i) => {
          const ok = isDone(s);
          const isNext = next?.id === s.id;
          return (
            <li key={s.id}>
              <button type="button" className={`kig-step${ok ? ' is-done' : ''}${isNext ? ' is-next' : ''}`} onClick={() => onGo?.(s)}>
                <span className="kig-num" aria-label={ok ? t('gettingStarted.done') : String(i + 1)}>{ok ? <Check size={16} /> : i + 1}</span>
                <span className="kig-text">
                  <b>{s.title}</b>
                  {isNext && s.detail && <small>{s.detail}</small>}
                </span>
                <ChevronRight size={16} />
              </button>
            </li>
          );
        })}
      </ol>
      {onTour && (
        <footer className="kig-foot">
          <button type="button" onClick={onTour}>{t('gettingStarted.tour')}</button>
        </footer>
      )}
    </section>
  );
}
