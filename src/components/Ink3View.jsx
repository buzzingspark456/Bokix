import React, { useMemo, useState } from 'react';
import { Download, AlertTriangle, CheckCircle2 } from './icons';
import StepFlow, { StepNav } from './shared/StepFlow';
import {
  computeInk3r, computeInk3rResultat, computeInk3Taxable, computeInk3s, suggestInk3suf, fillTaxableFromBooked, ink3Forms,
  INK3R_RESULT_ROWS, INK3_INCOME_ROWS, INK3S_ROWS, INK3S_INFO_ROWS, INK3SUF_PURPOSES, INK3SUF_ROWS,
} from '../utils/ink3';
import { downloadInk3Sru, sruPeriod } from '../utils/sruExport';
import { formatKr } from '../utils/annualReportPdf';
import { t } from '../i18n';

/**
 * Inkomstdeklaration 3 för ideella föreningar, flik i Skatt och bokslut.
 * Vilka bilagor som lämnas beror på svaren i första steget (ink3Forms):
 * INK3SUF för en allmännyttig förening, INK3R + INK3S när det finns
 * skattepliktig verksamhet. Det användaren fyller i sparas per räkenskapsår
 * i company.ink3[fyKey].
 */
export default function Ink3View({ company, fy, verifications = [], accounts = [], setCompanyInfo, sruMissing = [] }) {
  const saved = company?.ink3?.[fy.key] || {};
  const setPart = (part, key, value) => setCompanyInfo?.(prev => {
    const year = prev.ink3?.[fy.key] || {};
    return { ...prev, ink3: { ...(prev.ink3 || {}), [fy.key]: { ...year, [part]: { ...(year[part] || {}), [key]: value } } } };
  });
  const setSuf = (key, value) => setPart('suf', key, value);
  const setSufNested = (group, key, value) => setPart('suf', group, { ...(saved.suf?.[group] || {}), [key]: value });

  const org = saved.org || {};
  const forms = ink3Forms(org);
  const isFoundation = org.entity === 'foundation';
  const orgAnswered = org.entity !== undefined && org.publicBenefit !== undefined && (org.publicBenefit === false || org.taxableActivity !== undefined);

  const period = useMemo(() => ({ start: fy.start, end: fy.end }), [fy.start, fy.end]);
  const asOf = useMemo(() => new Date(`${fy.end}T23:59:59`), [fy.end]);
  const ink3r = useMemo(() => computeInk3r(verifications, accounts, asOf), [verifications, accounts, asOf]);
  const res = useMemo(() => computeInk3rResultat(verifications, period, accounts, saved.accountRows || {}), [verifications, period, accounts, saved.accountRows]);
  const taxableInput = useMemo(() => (forms.rs ? saved.taxable || {} : {}), [forms.rs, saved.taxable]);
  const taxable = useMemo(() => computeInk3Taxable(res.rows, taxableInput), [res.rows, taxableInput]);
  const values = useMemo(() => {
    const out = {};
    for (const def of INK3S_ROWS) out[def.key] = Number(saved.values?.[def.key]) || 0;
    return out;
  }, [saved.values]);
  const ink3s = useMemo(() => computeInk3s(values, taxable.total), [values, taxable.total]);
  const sufSuggest = useMemo(() => suggestInk3suf(verifications, period, res.rows, taxableInput), [verifications, period, res.rows, taxableInput]);
  const sufValues = useMemo(() => {
    const out = {};
    for (const def of INK3SUF_ROWS) {
      const v = saved.suf?.values?.[def.key];
      out[def.key] = v !== undefined && v !== null && v !== '' ? Number(v) || 0 : (sufSuggest[def.key] || 0);
    }
    return out;
  }, [saved.suf?.values, sufSuggest]);
  const answers = saved.answers || {};
  const purposes = saved.suf?.purposes || {};
  const sruP = sruPeriod(fy.end);

  const filedKey = `ink3:${fy.key}`;
  const filedAt = company?.taxFilings?.[filedKey]?.at || null;
  const toggleFiled = () => setCompanyInfo?.(prev => {
    const next = { ...(prev.taxFilings || {}) };
    if (next[filedKey]) delete next[filedKey]; else next[filedKey] = { at: new Date().toISOString() };
    return { ...prev, taxFilings: next };
  });

  const nothingToFile = orgAnswered && !forms.rs && !forms.suf;
  const blockers = [
    ...(!orgAnswered ? [t('ink3.answerFirst')] : []),
    ...(nothingToFile ? [t('ink3.foundationSus')] : []),
    ...(forms.rs && !ink3r.balanced ? [t('ink4.notBalanced', { amount: formatKr(Math.abs(ink3r.difference)) })] : []),
    ...(forms.suf && !INK3SUF_PURPOSES.some(p => purposes[p.key]) ? [t('ink3.noPurpose')] : []),
    ...(sruMissing.length ? [t('ink4.missingCompany', { fields: sruMissing.join(', ') })] : []),
  ];
  const canDownload = blockers.length === 0;
  const download = () => {
    if (!canDownload) return;
    downloadInk3Sru(company, {
      forms, ink3r, ink3rResultat: res, taxable, ink3s, info: saved.info || {}, answers,
      suf: { ...(saved.suf || {}), values: sufValues },
    }, period);
  };

  const flow = [
    { id: 'org', title: t('ink3.stepOrg'), short: t('ink3.shortOrg'), done: orgAnswered },
    ...(forms.rs ? [
      { id: 'schema', title: t('ink3.stepSchema'), short: t('stepFlow.short.schema'), done: ink3r.balanced },
      { id: 'adjust', title: t('ink3.stepAdjust'), short: t('stepFlow.short.adjust'), done: answers.consultant !== undefined && answers.audited !== undefined },
    ] : []),
    ...(forms.suf ? [{ id: 'suf', title: t('ink3.stepSuf'), short: t('ink3.shortSuf'), done: INK3SUF_PURPOSES.some(p => purposes[p.key]) }] : []),
    { id: 'send', title: t('ink4.stepSend'), short: t('stepFlow.short.send'), done: Boolean(filedAt) },
  ];
  const [stepState, setStep] = useState(() => flow.find(s => !s.done)?.id || 'send');
  const step = flow.some(s => s.id === stepState) ? stepState : 'org';

  const Seg = ({ label, value, options, onChange }) => (
    <div className="ink3-q">
      <span>{label}</span>
      <span className="ink3-seg" role="group" aria-label={label}>
        {options.map(([val, text]) => (
          <button key={text} type="button" aria-pressed={value === val} onClick={() => onChange(val)}>{text}</button>
        ))}
      </span>
    </div>
  );
  const yesNo = [[true, t('ink4.yes')], [false, t('ink4.no')]];
  const numberInput = (value, onChange, label, placeholder = '0') => (
    <input type="number" className="fp-input" aria-label={label} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
  );
  const bookedRow = (row) => res.rows.find(r => r.row === row);
  const formsText = [forms.rs && 'INK3R, INK3S', forms.suf && 'INK3SUF'].filter(Boolean).join(' och ');

  return (
    <div className="fp-page">
      <style>{`
        .ink3-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 18px; }
        .ink3-tr { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 12px; align-items: baseline; padding: 9px 14px; border-top: 1px solid var(--border-light); font-size: 13.5px; }
        .ink3-tr.res { grid-template-columns: 44px minmax(0, 1fr) 110px 130px; align-items: center; }
        .ink3-tr.head { font-size: 11.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em; }
        .ink3-tr:first-child { border-top: 0; }
        .ink3-row { font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
        .ink3-label { color: var(--text-main); min-width: 0; }
        .ink3-amount { font-weight: 700; color: var(--text-main); font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
        .ink3-h { font-size: 14px; font-weight: 700; margin: 4px 0 10px; color: var(--text-main); }
        .ink3-adj { display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 10px 16px; align-items: center; margin-bottom: 8px; font-size: 13.5px; }
        .ink3-acc { display: grid; grid-template-columns: minmax(0, 1fr) auto 200px; gap: 10px 16px; align-items: center; padding: 8px 14px; border-top: 1px solid var(--border-light); font-size: 13.5px; }
        .ink3-acc:first-child { border-top: 0; }
        .ink3-total { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 14px; border-radius: 10px; background: var(--bg-muted); margin: 14px 0 18px; font-weight: 700; }
        .ink3-total strong { font-size: 18px; font-variant-numeric: tabular-nums; }
        .ink3-q { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid var(--border-light); font-size: 13.5px; }
        .ink3-seg { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; padding: 3px; gap: 2px; }
        .ink3-seg button { border: none; background: transparent; padding: 6px 14px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
        .ink3-seg button[aria-pressed="true"] { background: var(--bg-card); color: var(--text-main); box-shadow: 0 1px 2px rgba(0,0,0,0.12); }
        .ink3-checks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin-bottom: 14px; font-size: 13.5px; }
        .ink3-checks label { display: flex; gap: 8px; align-items: flex-start; }
        .ink3-muted { color: var(--text-muted); font-style: normal; }
        @media (max-width: 700px) {
          .ink3-adj, .ink3-checks { grid-template-columns: minmax(0, 1fr); }
          .ink3-tr.res { grid-template-columns: 36px minmax(0, 1fr) 110px; }
          .ink3-tr.res > :nth-child(4) { grid-column: 2 / -1; }
          .ink3-tr.head > :nth-child(4) { display: none; }
          .ink3-acc { grid-template-columns: minmax(0, 1fr) auto; }
          .ink3-acc select { grid-column: 1 / -1; }
        }
      `}</style>

      <section className={`fp-strip ${filedAt ? 'done' : ''}`}>
        <div>
          <div className="fp-strip-title">{filedAt && <CheckCircle2 size={18} />}{t('ink3.title', { label: fy.label })}</div>
          <div className="fp-strip-sub">{filedAt ? t('ink4.filed', { date: new Date(filedAt).toLocaleDateString('sv-SE') }) : t('ink3.sub')}</div>
        </div>
        <div className="fp-actions">
          <button type="button" className="agi-btn" onClick={download} disabled={!canDownload} title={canDownload ? undefined : blockers[0]}>
            <Download size={15} /> {t('ink4.download')}
          </button>
        </div>
      </section>

      <div className="fp-stats" aria-label={t('ink4.keyFigures')}>
        {[
          [t('ink4.result'), `${formatKr(res.total)} kr`],
          [t('ink3.taxableResult'), forms.rs ? `${formatKr(taxable.total)} kr` : '–'],
          [ink3s.underskott ? t('ink4.deficit') : t('ink4.surplus'), forms.rs ? `${formatKr(ink3s.underskott ? -ink3s.underskott : ink3s.overskott)} kr` : '–'],
          [t('ink3.forms'), orgAnswered ? (formsText || '–') : '–'],
        ].map(([label, value]) => (
          <div key={label} className="fp-stat">
            <div className="fp-stat-label">{label}</div>
            <div className="fp-stat-value" style={label === t('ink3.forms') ? { whiteSpace: 'normal', fontSize: 15, lineHeight: 1.3 } : undefined}>{value}</div>
          </div>
        ))}
      </div>

      <StepFlow steps={flow} current={step} onSelect={setStep}>
        {step === 'org' && (
          <>
            <h3 className="stepflow-h">{t('ink3.stepOrg')}</h3>
            <p className="stepflow-text">{t('ink3.orgText')}</p>
            <Seg label={t('ink3.qEntity')} value={org.entity} options={[['association', t('ink3.association')], ['foundation', t('ink3.foundation')]]} onChange={v => setPart('org', 'entity', v)} />
            <Seg label={t('ink3.qPublicBenefit')} value={org.publicBenefit} options={yesNo} onChange={v => setPart('org', 'publicBenefit', v)} />
            <p className="stepflow-text" style={{ marginTop: 4 }}><small>{t('ink3.publicBenefitHelp')}</small></p>
            {org.publicBenefit === true && (
              <>
                <Seg label={t('ink3.qTaxable')} value={org.taxableActivity} options={yesNo} onChange={v => setPart('org', 'taxableActivity', v)} />
                <p className="stepflow-text" style={{ marginTop: 4 }}><small>{t('ink3.taxableHelp')}</small></p>
              </>
            )}
            {orgAnswered && (
              <div className="ink3-total"><span>{t('ink3.formsToFile')}</span><strong style={{ fontSize: 15 }}>{formsText || '–'}</strong></div>
            )}
            {nothingToFile && (
              <div className="fp-warn" role="status"><div><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{t('ink3.foundationSus')}</span></div></div>
            )}
            {isFoundation && forms.rs && <p className="stepflow-text"><small>{t('ink3.foundationNote')}</small></p>}
            <StepNav steps={flow} current={step} onSelect={setStep} />
          </>
        )}

        {step === 'schema' && (
          <>
            <h3 className="stepflow-h">{t('ink3.stepSchema')}</h3>
            <p className="stepflow-text">{t('ink3.schemaText')}</p>
            {!ink3r.balanced && (
              <div className="fp-warn" role="status"><div><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{t('ink4.notBalanced', { amount: formatKr(Math.abs(ink3r.difference)) })}</span></div></div>
            )}
            <div className="ink3-h">{t('ink4.balance')}</div>
            <div className="ink3-table">
              {ink3r.rows.map(r => (
                <div key={r.row} className="ink3-tr">
                  <span className="ink3-row">{r.row}</span><span className="ink3-label">{r.label}</span><span className="ink3-amount">{formatKr(r.amount)} kr</span>
                </div>
              ))}
            </div>

            <div className="ink3-h">{t('ink4.income')}</div>
            <div className="ink3-table">
              <div className="ink3-tr res head"><span /><span /><span style={{ textAlign: 'right' }}>{t('ink3.colBooked')}</span><span>{t('ink3.colTaxable')}</span></div>
              {INK3R_RESULT_ROWS.filter(def => bookedRow(def.row) || taxableInput[def.row]).map(def => (
                <div key={def.row} className="ink3-tr res">
                  <span className="ink3-row">{def.row}</span>
                  <span className="ink3-label">{def.label}</span>
                  <span className="ink3-amount">{formatKr(bookedRow(def.row)?.amount || 0)} kr</span>
                  {def.taxable || def.taxablePlus
                    ? numberInput(saved.taxable?.[def.row], v => setPart('taxable', def.row, v), `${def.row} ${t('ink3.colTaxable')}`, t('ink3.colTaxable'))
                    : <span className="ink3-muted">{t('ink3.alwaysFree')}</span>}
                </div>
              ))}
            </div>
            <div className="fp-actions" style={{ marginBottom: 14 }}>
              <button type="button" className="agi-btn" style={{ whiteSpace: 'normal', textAlign: 'left', height: 'auto' }} onClick={() => setCompanyInfo?.(prev => {
                const year = prev.ink3?.[fy.key] || {};
                return { ...prev, ink3: { ...(prev.ink3 || {}), [fy.key]: { ...year, taxable: fillTaxableFromBooked(res.rows) } } };
              })}>{t('ink3.fillTaxable')}</button>
            </div>
            <p className="stepflow-text"><small>{org.publicBenefit ? t('ink3.taxableTextPublic') : t('ink3.taxableTextOther')}</small></p>
            <div className="ink3-total"><span>{taxable.total < 0 ? t('ink3.adjustedLoss') : t('ink3.adjustedProfit')}</span><strong>{formatKr(Math.abs(taxable.total))} kr</strong></div>

            {res.incomeAccounts.length > 0 && (
              <>
                <div className="ink3-h">{t('ink3.incomeAccounts')}</div>
                <p className="stepflow-text">{t('ink3.incomeAccountsText')}</p>
                <div className="ink3-table">
                  {res.incomeAccounts.map(acc => (
                    <div key={acc.code} className="ink3-acc">
                      <span><strong>{acc.code}</strong> {acc.name}</span>
                      <span className="ink3-amount">{formatKr(acc.amount)} kr</span>
                      <select className="fp-input" aria-label={`${acc.code} ${t('ink3.row')}`} value={acc.row} onChange={e => setPart('accountRows', acc.code, e.target.value === acc.suggested ? undefined : e.target.value)}>
                        {INK3_INCOME_ROWS.map(row => (
                          <option key={row} value={row}>{row} {INK3R_RESULT_ROWS.find(r => r.row === row).label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </>
            )}
            <StepNav steps={flow} current={step} onSelect={setStep} />
          </>
        )}

        {step === 'adjust' && (
          <>
            <h3 className="stepflow-h">{t('ink3.stepAdjust')}</h3>
            <p className="stepflow-text">{t('ink3.adjustText')}</p>
            <div className="ink3-adj"><span>7.1 / 7.2 {t('ink3.fromSchema')}</span><strong style={{ textAlign: 'right' }}>{formatKr(taxable.total)} kr</strong></div>
            {INK3S_ROWS.map(def => (
              <label key={def.key} className="ink3-adj">
                <span>{def.key.replace(/^(\d\.\d+)([a-d])$/, '$1 $2')} {def.label}</span>
                {numberInput(saved.values?.[def.key], v => setPart('values', def.key, v), def.label)}
              </label>
            ))}
            <div className="ink3-total"><span>{ink3s.underskott ? t('ink3.deficitRow') : t('ink3.surplusRow')}</span><strong>{formatKr(ink3s.underskott || ink3s.overskott)} kr</strong></div>
            <div className="ink3-h">{t('ink4.info')}</div>
            {INK3S_INFO_ROWS.filter(def => !def.from || sruP >= def.from).map(def => (
              <label key={def.key} className="ink3-adj">
                <span>{def.key} {def.label}</span>
                {numberInput(saved.info?.[def.key], v => setPart('info', def.key, v), def.label)}
              </label>
            ))}
            <Seg label={t('ink4.qConsultant')} value={answers.consultant} options={yesNo} onChange={v => setPart('answers', 'consultant', v)} />
            <Seg label={t('ink4.qAudited')} value={answers.audited} options={yesNo} onChange={v => setPart('answers', 'audited', v)} />
            <StepNav steps={flow} current={step} onSelect={setStep} />
          </>
        )}

        {step === 'suf' && (
          <>
            <h3 className="stepflow-h">{t('ink3.stepSuf')}</h3>
            <p className="stepflow-text">{t('ink3.sufText')}</p>
            <div className="ink3-h">{t('ink3.purpose')}</div>
            <div className="ink3-checks">
              {INK3SUF_PURPOSES.map(p => (
                <label key={p.key}>
                  <input type="checkbox" checked={Boolean(purposes[p.key])} onChange={e => setSufNested('purposes', p.key, e.target.checked)} />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
            {purposes.other && (
              <label className="ink3-adj">
                <span>{t('ink3.otherPurpose')}</span>
                <input type="text" className="fp-input" maxLength={36} value={saved.suf?.otherPurpose || ''} onChange={e => setSuf('otherPurpose', e.target.value)} />
              </label>
            )}
            <div className="ink3-h">{t('ink3.property')}</div>
            <p className="stepflow-text"><small>{t('ink3.propertyText')}</small></p>
            <label className="ink3-adj"><span>{t('ink3.rentedPct')}</span>{numberInput(saved.suf?.rentedPct, v => setSuf('rentedPct', v), t('ink3.rentedPct'))}</label>
            <label className="ink3-adj"><span>{t('ink3.rentedSqm')}</span>{numberInput(saved.suf?.rentedSqm, v => setSuf('rentedSqm', v), t('ink3.rentedSqm'))}</label>
            {[['income', t('ink3.freeIncome')], ['cost', t('ink3.freeCost')]].map(([group, title]) => (
              <div key={group} style={{ marginTop: 10 }}>
                <div className="ink3-h">{title}</div>
                {INK3SUF_ROWS.filter(r => r.group === group).map(def => {
                  const own = saved.suf?.values?.[def.key];
                  const suggested = sufSuggest[def.key] && (own === undefined || own === '');
                  return (
                    <label key={def.key} className="ink3-adj">
                      <span>{def.key} {def.label}{suggested ? <em className="ink3-muted"> · {t('ink4.suggested')}</em> : null}</span>
                      {numberInput(own ?? (sufSuggest[def.key] || ''), v => setSufNested('values', def.key, v), def.label)}
                    </label>
                  );
                })}
              </div>
            ))}
            <p className="stepflow-text"><small>{t('ink3.sufCheck')}</small></p>
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
              <li><span className="fp-step-mark">1</span><div>{t('ink4.send1')}<small>{t('ink3.send1Sub', { forms: formsText || '–' })}</small></div></li>
              <li><span className="fp-step-mark">2</span><div>{t('ink3.send2')}<small>{forms.rs
                ? (ink3s.underskott ? t('ink3.send2Deficit', { amount: formatKr(ink3s.underskott) }) : t('ink3.send2Surplus', { amount: formatKr(ink3s.overskott) }))
                : t('ink3.send2SufOnly')}</small></div></li>
              <li className={filedAt ? 'done' : ''}><span className="fp-step-mark">{filedAt ? <CheckCircle2 size={14} /> : 3}</span><div>{t('ink4.send3')}<small>{t('ink3.send3Sub')}</small></div></li>
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
