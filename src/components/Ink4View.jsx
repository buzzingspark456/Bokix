import React, { useMemo, useState } from 'react';
import { Download, AlertTriangle, CheckCircle2 } from './icons';
import StepFlow, { StepNav } from './shared/StepFlow';
import { computeInk4r, computeInk4rResultat, computeInk4s, computeInk4du, INK4S_ROWS, INK4S_INFO_ROWS } from '../utils/ink4';
import { suggestInk2s } from '../utils/ink2s';
import { downloadInk4Sru } from '../utils/sruExport';
import { validatePartners } from '../utils/partners';
import { formatKr } from '../utils/annualReportPdf';
import { t } from '../i18n';

/**
 * Inkomstdeklaration 4 för handels- och kommanditbolag, flik i Skatt och
 * bokslut. Bilagorna INK4R, INK4S och INK4DU räknas fram (utils/ink4.js) och
 * laddas ned som SRU-fil; själva INK4 fylls i Skatteverkets e-tjänst. Det
 * användaren fyller i sparas per räkenskapsår i company.ink4[fyKey].
 */
export default function Ink4View({ company, fy, verifications = [], accounts = [], setCompanyInfo, sruMissing = [], onOpenPartners }) {
  const saved = company?.ink4?.[fy.key] || {};
  const setPart = (part, key, value) => setCompanyInfo?.(prev => {
    const year = prev.ink4?.[fy.key] || {};
    return { ...prev, ink4: { ...(prev.ink4 || {}), [fy.key]: { ...year, [part]: { ...(year[part] || {}), [key]: value } } } };
  });

  const period = useMemo(() => ({ start: fy.start, end: fy.end }), [fy.start, fy.end]);
  const ink4r = useMemo(() => computeInk4r(verifications, accounts, fy.end), [verifications, accounts, fy.end]);
  const res = useMemo(() => computeInk4rResultat(verifications, period), [verifications, period]);
  // Förslag ur bokföringen: ej avdragsgilla kostnader och skattefria intäkter
  // (samma konton som INK2S, där raderna heter 4.3c och 4.5c).
  const suggestions = useMemo(() => {
    const s = suggestInk2s({ verifications, fy: period }).suggestions;
    return { ...(s['4.3c'] ? { '4.3b': s['4.3c'] } : {}), ...(s['4.5c'] ? { '4.5b': s['4.5c'] } : {}) };
  }, [verifications, period]);
  const values = useMemo(() => {
    const out = {};
    for (const def of INK4S_ROWS) {
      const v = saved.values?.[def.key];
      out[def.key] = v !== undefined && v !== null && v !== '' ? Number(v) || 0 : (suggestions[def.key] || 0);
    }
    return out;
  }, [saved.values, suggestions]);
  const ink4s = useMemo(() => computeInk4s(values, res.total), [values, res.total]);
  const partners = useMemo(() => company?.partners || [], [company?.partners]);
  const partnerErrors = validatePartners(partners);
  const delagare = useMemo(() => computeInk4du(verifications, partners, period, ink4s), [verifications, partners, period, ink4s]);
  const missingPnr = delagare.filter(d => d.personnummer.replace(/\D/g, '').length < 10);
  const answers = saved.answers || {};

  const filedKey = `ink4:${fy.key}`;
  const filedAt = company?.taxFilings?.[filedKey]?.at || null;
  const toggleFiled = () => setCompanyInfo?.(prev => {
    const next = { ...(prev.taxFilings || {}) };
    if (next[filedKey]) delete next[filedKey]; else next[filedKey] = { at: new Date().toISOString() };
    return { ...prev, taxFilings: next };
  });

  const blockers = [
    ...(!ink4r.balanced ? [t('ink4.notBalanced', { amount: formatKr(Math.abs(ink4r.difference)) })] : []),
    ...partnerErrors,
    ...(missingPnr.length ? [t('ink4.missingPnr', { names: missingPnr.map(d => d.partner.name || '?').join(', ') })] : []),
    ...(sruMissing.length ? [t('ink4.missingCompany', { fields: sruMissing.join(', ') })] : []),
  ];
  const canDownload = blockers.length === 0;
  const download = () => {
    if (!canDownload) return;
    downloadInk4Sru(company, { ink4r, ink4rResultat: res, ink4s, info: saved.info || {}, answers, delagare }, period);
  };

  const flow = [
    { id: 'schema', title: t('ink4.stepSchema'), short: t('stepFlow.short.schema'), done: ink4r.balanced },
    { id: 'adjust', title: t('ink4.stepAdjust'), short: t('stepFlow.short.adjust'), done: answers.consultant !== undefined && answers.audited !== undefined },
    { id: 'partners', title: t('ink4.stepPartners'), short: t('stepFlow.short.partners'), done: partnerErrors.length === 0 && missingPnr.length === 0 },
    { id: 'send', title: t('ink4.stepSend'), short: t('stepFlow.short.send'), done: Boolean(filedAt) },
  ];
  const [step, setStep] = useState(() => flow.find(s => !s.done)?.id || 'send');
  const groups = [...new Set(INK4S_ROWS.map(r => r.group))];

  const Table = ({ rows, signed = false }) => (
    <div className="ink4-table">
      {rows.map(r => (
        <div key={r.row} className="ink4-tr">
          <span className="ink4-row">{r.row}</span>
          <span className="ink4-label">{r.label}</span>
          <span className="ink4-amount">{signed || r.polarity !== 'cost' ? '' : '−'}{formatKr(r.amount)} kr</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fp-page">
      <style>{`
        .ink4-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 18px; }
        .ink4-tr { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 12px; align-items: baseline; padding: 9px 14px; border-top: 1px solid var(--border-light); font-size: 13.5px; }
        .ink4-tr:first-child { border-top: 0; }
        .ink4-row { font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
        .ink4-label { color: var(--text-main); min-width: 0; }
        .ink4-amount { font-weight: 700; color: var(--text-main); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ink4-h { font-size: 14px; font-weight: 700; margin: 4px 0 10px; color: var(--text-main); }
        .ink4-adj { display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 10px 16px; align-items: center; margin-bottom: 8px; font-size: 13.5px; }
        .ink4-total { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 14px; border-radius: 10px; background: var(--bg-muted); margin: 14px 0 18px; font-weight: 700; }
        .ink4-total strong { font-size: 18px; font-variant-numeric: tabular-nums; }
        .ink4-q { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid var(--border-light); font-size: 13.5px; }
        .ink4-seg { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; padding: 3px; gap: 2px; }
        .ink4-seg button { border: none; background: transparent; padding: 6px 14px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
        .ink4-seg button[aria-pressed="true"] { background: var(--bg-card); color: var(--text-main); box-shadow: 0 1px 2px rgba(0,0,0,0.12); }
        .ink4-du { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(4, minmax(0, 1fr)); gap: 10px; padding: 10px 14px; border-top: 1px solid var(--border-light); font-size: 13.5px; align-items: baseline; }
        .ink4-du.head { font-size: 11.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em; border-top: 0; }
        .ink4-du span:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
        @media (max-width: 700px) {
          .ink4-adj { grid-template-columns: minmax(0, 1fr); }
          .ink4-du { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
          .ink4-du.head { display: none; }
        }
      `}</style>

      <section className={`fp-strip ${filedAt ? 'done' : ''}`}>
        <div>
          <div className="fp-strip-title">{filedAt && <CheckCircle2 size={18} />}{t('ink4.title', { label: fy.label })}</div>
          <div className="fp-strip-sub">{filedAt ? t('ink4.filed', { date: new Date(filedAt).toLocaleDateString('sv-SE') }) : t('ink4.sub')}</div>
        </div>
        <div className="fp-actions">
          <button type="button" className="agi-btn" onClick={download} disabled={!canDownload} title={canDownload ? undefined : blockers[0]}>
            <Download size={15} /> {t('ink4.download')}
          </button>
        </div>
      </section>

      <div className="fp-stats" aria-label={t('ink4.keyFigures')}>
        {[
          [t('ink4.result'), res.total],
          [ink4s.underskott ? t('ink4.deficit') : t('ink4.surplus'), ink4s.underskott ? -ink4s.underskott : ink4s.overskott],
          [t('ink4.closingCapital'), ink4r.rows.find(r => r.row === '2.23')?.amount || 0],
          [t('ink4.partners'), null],
        ].map(([label, value]) => (
          <div key={label} className="fp-stat">
            <div className="fp-stat-label">{label}</div>
            <div className="fp-stat-value">{value === null ? partners.length : `${formatKr(value)} kr`}</div>
          </div>
        ))}
      </div>

      <StepFlow steps={flow} current={step} onSelect={setStep}>
        {step === 'schema' && (
          <>
            <h3 className="stepflow-h">{t('ink4.stepSchema')}</h3>
            <p className="stepflow-text">{t('ink4.schemaText')}</p>
            {!ink4r.balanced && (
              <div className="fp-warn" role="status"><div><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{t('ink4.notBalanced', { amount: formatKr(Math.abs(ink4r.difference)) })}</span></div></div>
            )}
            <div className="ink4-h">{t('ink4.balance')}</div>
            <Table rows={ink4r.rows} signed />
            <div className="ink4-h">{t('ink4.income')}</div>
            <Table rows={res.rows} />
            <StepNav steps={flow} current={step} onSelect={setStep} />
          </>
        )}

        {step === 'adjust' && (
          <>
            <h3 className="stepflow-h">{t('ink4.stepAdjust')}</h3>
            <p className="stepflow-text">{t('ink4.adjustText')}</p>
            {groups.map(g => (
              <div key={g} style={{ marginBottom: 14 }}>
                <div className="ink4-h">{g}</div>
                {INK4S_ROWS.filter(r => r.group === g).map(def => (
                  <label key={def.key} className="ink4-adj">
                    <span>{def.key.replace(/^(\d\.\d+)([a-d])$/, '$1 $2')} {def.label}{suggestions[def.key] && (saved.values?.[def.key] === undefined || saved.values?.[def.key] === '') ? <em style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}> · {t('ink4.suggested')}</em> : null}</span>
                    <input type="number" className="fp-input" value={saved.values?.[def.key] ?? (suggestions[def.key] || '')} placeholder="0" onChange={e => setPart('values', def.key, e.target.value === '' ? '' : Number(e.target.value))} />
                  </label>
                ))}
              </div>
            ))}
            <div className="ink4-total"><span>{ink4s.underskott ? t('ink4.deficitRow') : t('ink4.surplusRow')}</span><strong>{formatKr(ink4s.underskott || ink4s.overskott)} kr</strong></div>
            <div className="ink4-h">{t('ink4.info')}</div>
            {INK4S_INFO_ROWS.map(def => (
              <label key={def.key} className="ink4-adj">
                <span>{def.key} {def.label}</span>
                <input type="number" className="fp-input" value={saved.info?.[def.key] ?? ''} placeholder="0" onChange={e => setPart('info', def.key, e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
            ))}
            {[['consultant', t('ink4.qConsultant')], ['audited', t('ink4.qAudited')]].map(([key, label]) => (
              <div key={key} className="ink4-q">
                <span>{label}</span>
                <span className="ink4-seg" role="group" aria-label={label}>
                  {[[true, t('ink4.yes')], [false, t('ink4.no')]].map(([val, text]) => (
                    <button key={text} type="button" aria-pressed={answers[key] === val} onClick={() => setPart('answers', key, val)}>{text}</button>
                  ))}
                </span>
              </div>
            ))}
            <StepNav steps={flow} current={step} onSelect={setStep} />
          </>
        )}

        {step === 'partners' && (
          <>
            <h3 className="stepflow-h">{t('ink4.stepPartners')}</h3>
            <p className="stepflow-text">{t('ink4.partnersText')}</p>
            {(partnerErrors.length > 0 || missingPnr.length > 0) && (
              <div className="fp-warn" role="status">
                {[...partnerErrors, ...(missingPnr.length ? [t('ink4.missingPnr', { names: missingPnr.map(d => d.partner.name || '?').join(', ') })] : [])].map(w => (
                  <div key={w}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{w}</span></div>
                ))}
              </div>
            )}
            {delagare.length > 0 && (
              <div className="ink4-table">
                <div className="ink4-du head"><span>{t('ink4.partner')}</span><span>{t('ink4.surplus')}</span><span>{t('ink4.deficit')}</span><span>{t('ink4.contributions')}</span><span>{t('ink4.withdrawals')}</span></div>
                {delagare.map(d => (
                  <div key={d.partner.id} className="ink4-du">
                    <span><strong>{d.partner.name}</strong> · {Number(d.partner.sharePct) || 0} %<br /><small style={{ color: 'var(--text-muted)' }}>{d.personnummer || t('ink4.noPnr')}</small></span>
                    <span>{formatKr(d.overskott)}</span><span>{formatKr(d.underskott)}</span><span>{formatKr(d.tillskott)}</span><span>{formatKr(d.uttag)}</span>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="agi-btn" onClick={onOpenPartners}>{t('ink4.editPartners')}</button>
            <StepNav steps={flow} current={step} onSelect={setStep} />
          </>
        )}

        {step === 'send' && (
          <>
            <h3 className="stepflow-h">{t('ink4.stepSend')} {filedAt && <span className="agi-pill ok">{t('ui.klar')}</span>}</h3>
            {blockers.length > 0 && (
              <div className="fp-warn" role="status">
                {blockers.map(w => <div key={w}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{w}</span></div>)}
              </div>
            )}
            <ol className="fp-steps" style={{ gridTemplateColumns: '1fr' }}>
              <li><span className="fp-step-mark">1</span><div>{t('ink4.send1')}<small>{t('ink4.send1Sub')}</small></div></li>
              <li><span className="fp-step-mark">2</span><div>{t('ink4.send2')}<small>{t('ink4.send2Sub')}</small></div></li>
              <li className={filedAt ? 'done' : ''}><span className="fp-step-mark">{filedAt ? <CheckCircle2 size={14} /> : 3}</span><div>{t('ink4.send3')}<small>{t('ink4.send3Sub')}</small></div></li>
            </ol>
            <div className="fp-actions">
              <button type="button" className="agi-btn primary" onClick={download} disabled={!canDownload}><Download size={15} /> {t('ink4.download')}</button>
              <button type="button" className="agi-btn" onClick={toggleFiled}>{filedAt ? t('ink4.undoFiled') : <><CheckCircle2 size={15} /> {t('ink4.markFiled')}</>}</button>
            </div>
            <StepNav steps={flow} current={step} onSelect={setStep} />
          </>
        )}
      </StepFlow>
    </div>
  );
}
