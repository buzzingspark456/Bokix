import React from 'react';
import { CheckCircle2, ChevronRight } from '../icons';
import { t } from '../../i18n';

/**
 * Ett steg i taget (Årsbokslut, Årsredovisning). Till vänster stegen i en
 * lista, till höger det valda steget. På telefon blir listan en rad med
 * numrerade punkter ovanför steget.
 *
 * steps: [{ id, title, done }]. current: valt stegs id. children: stegets innehåll.
 */
export default function StepFlow({ steps, current, onSelect, children }) {
  const index = Math.max(0, steps.findIndex(s => s.id === current));
  return (
    <div className="stepflow">
      <ol className="stepflow-rail" aria-label={t('stepFlow.steps')}>
        {steps.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`stepflow-item${s.id === current ? ' active' : ''}${s.done ? ' done' : ''}`}
              aria-current={s.id === current ? 'step' : undefined}
              onClick={() => onSelect(s.id)}
            >
              <span className="stepflow-mark">{s.done ? <CheckCircle2 size={15} /> : i + 1}</span>
              <span className="stepflow-title">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="stepflow-panel">
        <div className="stepflow-count">{t('stepFlow.stepOf', { n: index + 1, total: steps.length })}</div>
        {children}
      </div>
    </div>
  );
}

/** Knappraden längst ner i ett steg: Tillbaka och Nästa steg. */
export function StepNav({ steps, current, onSelect, nextLabel, children }) {
  const i = steps.findIndex(s => s.id === current);
  const prev = steps[i - 1];
  const next = steps[i + 1];
  return (
    <div className="stepflow-nav">
      {prev ? <button type="button" className="agi-btn" onClick={() => onSelect(prev.id)}>{t('stepFlow.back')}</button> : <span />}
      <div className="fp-actions">
        {children}
        {next && <button type="button" className="agi-btn primary" onClick={() => onSelect(next.id)}>{nextLabel || t('stepFlow.next')} <ChevronRight size={15} /></button>}
      </div>
    </div>
  );
}
