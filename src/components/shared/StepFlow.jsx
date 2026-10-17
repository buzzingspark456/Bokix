import React from 'react';
import { Check, ChevronRight } from '../icons';
import { t } from '../../i18n';

/**
 * Ett steg i taget (Årsbokslut, Årsredovisning, INK4), som Bokio och
 * Årsredovisning Online: en stegrad överst med korta namn, bara det valda
 * stegets innehåll i ett kort i mitten, och Tillbaka/Nästa steg längst ner
 * (StepNav). Förut stod alla steg med långa rubriker som en lista bredvid,
 * och det kändes som en checklista i stället för en guide (2026-10-17).
 *
 * steps: [{ id, title, short, done }]. short är namnet i stegraden (ett ord
 * eller två), title stegets rubrik. current: valt stegs id.
 */
export default function StepFlow({ steps, current, onSelect, children }) {
  const index = Math.max(0, steps.findIndex(s => s.id === current));
  return (
    <div className="stepflow">
      <ol className="stepflow-steps" aria-label={t('stepFlow.steps')}>
        {steps.map((s, i) => (
          <li key={s.id} className={`stepflow-step${i === index ? ' active' : ''}${s.done ? ' done' : ''}${i < index ? ' passed' : ''}`}>
            <button
              type="button"
              className="stepflow-stepbtn"
              aria-current={i === index ? 'step' : undefined}
              title={s.title}
              onClick={() => onSelect(s.id)}
            >
              <span className="stepflow-dot" aria-hidden="true">{s.done && i !== index ? <Check size={15} /> : i + 1}</span>
              <span className="stepflow-label">{s.short || s.title}</span>
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
