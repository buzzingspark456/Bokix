import React, { useState } from 'react';
import { CheckCircle2, Lock, ChevronRight, RotateCcw } from './icons';
import StepFlow, { StepNav } from './shared/StepFlow';
import { t } from '../i18n';

/**
 * Årsbokslutet som en guide, ett steg i taget (StepFlow). Stegen och deras
 * status räknas i Taxes.jsx (allSteps); här visas de och sista steget låser
 * året. Status jämförs på svenska ('Klar', 'Pågår') som i Taxes.jsx.
 */
export default function YearEndWizard({
  fyLabel, steps, isLocked, lockedAt, canLock, partnersReady, yearResult, fmt,
  onToggleManual, onOpenStep, onLock, onGoPartners, nextFiling, notices, orgNote,
}) {
  const flow = [
    ...steps.map(s => ({ ...s, done: s.status === 'Klar' })),
    { id: 'lock', title: t('yearEndWizard.lockTitle'), short: t('stepFlow.short.lock'), done: isLocked },
  ];
  const firstOpen = flow.find(s => !s.done)?.id ?? 'lock';
  const [current, setCurrent] = useState(firstOpen);
  const step = flow.find(s => s.id === current) || flow[0];
  const doneCount = steps.filter(s => s.status === 'Klar').length;
  const remaining = steps.filter(s => s.status !== 'Klar');
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 100;

  const statusPill = (status) => (
    <span className={`agi-pill ${status === 'Klar' ? 'ok' : status === 'Pågår' ? 'warn' : 'mute'}`} style={status !== 'Klar' && status !== 'Pågår' ? { paddingLeft: '10px', background: 'var(--bg-muted)' } : undefined}>
      {status === 'Klar' ? t('ui.klar') : status === 'Pågår' ? t('ui.pagar') : t('ui.ej_paborjad')}
    </span>
  );

  return (
    <div className="fp-page">
      <section className={`fp-strip ${isLocked ? 'done' : ''}`}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="fp-strip-title">{isLocked && <Lock size={17} />}{t('ui.arsbokslut')} {fyLabel}</div>
          <div className="fp-strip-sub">
            {isLocked
              ? t('yearEndWizard.locked', { date: lockedAt ? new Date(lockedAt).toLocaleDateString('sv-SE') : '' })
              : t('yearEndWizard.progress', { done: doneCount, total: steps.length })}
          </div>
          {!isLocked && <div className="ye-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>}
        </div>
        {isLocked && nextFiling && (
          <div className="fp-actions">
            <button type="button" className="agi-btn primary" onClick={nextFiling.onClick}>{nextFiling.label} <ChevronRight size={15} /></button>
          </div>
        )}
      </section>

      {notices}

      <StepFlow steps={flow} current={step.id} onSelect={setCurrent}>
        {step.id !== 'lock' ? (
          <>
            <h3 className="stepflow-h">{step.title} {statusPill(step.status)}</h3>
            {step.hint && <p className="stepflow-text">{step.hint}</p>}
            <div className="fp-actions">
              {step.kind === 'manual' && !isLocked && (
                step.status === 'Klar'
                  ? <button type="button" className="agi-btn" onClick={() => onToggleManual(step.key)}><RotateCcw size={14} /> {t('yearEndWizard.undoDone')}</button>
                  : <button type="button" className="agi-btn primary" onClick={() => onToggleManual(step.key)}><CheckCircle2 size={15} /> {t('yearEndWizard.markDone')}</button>
              )}
              {(step.tab || step.section) && step.status !== 'Klar' && (
                <button type="button" className={`agi-btn${step.kind === 'manual' ? '' : ' primary'}`} onClick={() => onOpenStep(step)}>{t('yearEndWizard.open')} <ChevronRight size={15} /></button>
              )}
            </div>
            <StepNav steps={flow} current={step.id} onSelect={setCurrent} />
          </>
        ) : (
          <>
            <h3 className="stepflow-h">{t('yearEndWizard.lockTitle')} {isLocked && <span className="agi-pill ok">{t('ui.klar')}</span>}</h3>
            <p className="stepflow-text">{isLocked ? t('yearEndWizard.lockedText') : t('yearEndWizard.lockText')}</p>
            <div className="stepflow-result">
              {isLocked ? t('ui.bokfort_resultat') : t('ui.beraknat_resultat')}
              <strong style={{ color: yearResult >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>{fmt(yearResult)}</strong>
            </div>
            {!isLocked && remaining.length > 0 && (
              <div>
                <div className="fp-hint" style={{ marginTop: 0, marginBottom: '6px' }}>{t('yearEndWizard.remaining')}</div>
                <div className="stepflow-left">
                  {remaining.map(s => (
                    <button key={s.id} type="button" className="ink2v-link" onClick={() => setCurrent(s.id)}>{s.title}</button>
                  ))}
                </div>
              </div>
            )}
            {!isLocked && !partnersReady && (
              <div className="fp-hint bad" style={{ marginTop: 0 }}>
                {t('ui.lagg_in_delagarna_och_deras_andelar_innan_du_las')}{' '}
                <button type="button" className="ink2v-link" style={{ color: 'inherit' }} onClick={onGoPartners}>{t('ui.ga_till_delagare')}</button>
              </div>
            )}
            {!isLocked && (
              <div className="fp-actions">
                <button type="button" className="agi-btn primary" onClick={onLock} disabled={!canLock} style={!canLock ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}>
                  <Lock size={15} /> {t('ui.las_rakenskapsar_och_skapa_bokslut')}
                </button>
              </div>
            )}
            {isLocked && nextFiling && (
              <div className="fp-actions">
                <button type="button" className="agi-btn primary" onClick={nextFiling.onClick}>{nextFiling.label} <ChevronRight size={15} /></button>
              </div>
            )}
            <StepNav steps={flow} current={step.id} onSelect={setCurrent} />
          </>
        )}
      </StepFlow>

      {orgNote && <section className="fp-section" style={{ borderBottom: 'none' }}>{orgNote}</section>}
    </div>
  );
}
