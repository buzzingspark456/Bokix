import React from 'react';
import { Check, ChevronRight } from '../icons';
import { t } from '../../i18n';

/**
 * Ett steg i taget (Årsbokslut, Årsredovisning, INK4). Bara det valda steget
 * visas, med "Steg 2 av 7" och en stegindikator utan rubriker ovanför; man
 * går vidare och tillbaka med StepNav längst ner. Förut stod alla steg som
 * en lista bredvid, och det kändes som en checklista i stället för en guide
 * (2026-10-17).
 *
 * steps: [{ id, title, done }]. current: valt stegs id. children: stegets innehåll.
 */
export default function StepFlow({ steps, current, onSelect, children }) {
  const index = Math.max(0, steps.findIndex(s => s.id === current));
  return (
    <div className="stepflow">
      <div className="stepflow-panel">
        <div className="stepflow-top">
          <ol className="stepflow-steps" aria-label={t('stepFlow.steps')}>
            {steps.map((s, i) => (
              <li key={s.id} className={`stepflow-step${i === index ? ' active' : ''}${s.done ? ' done' : ''}${i < index ? ' passed' : ''}`}>
                <button
                  type="button"
                  className="stepflow-dot"
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={`${i + 1}. ${s.title}`}
                  title={s.title}
                  onClick={() => onSelect(s.id)}
                >
                  {s.done && i !== index ? <Check size={14} /> : i + 1}
                </button>
              </li>
            ))}
          </ol>
          <div className="stepflow-count">{t('stepFlow.stepOf', { n: index + 1, total: steps.length })}</div>
        </div>
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
