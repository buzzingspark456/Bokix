import React, { useEffect, useMemo, useState } from 'react';
import { Download, AlertTriangle, CheckCircle2 } from './icons';
import { computeAnnualReport, previousFiscalYear, annualReportDeadline, agmDeadline, averageEmployees } from '../utils/annualReport';
import { formatKr, downloadAnnualReportPdf } from '../utils/annualReportPdf';
import { activeFiscalYear } from '../utils/fiscalYear';
import { daysFromToday } from '../utils/declarationDeadlines';
import { t, dateLocale } from '../i18n';
import StepFlow, { StepNav } from './shared/StepFlow';

const fmtDate = (iso) => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`));
const daysText = (n) => (n < 0 ? t('ui.forsenad') : n === 0 ? t('ui.idag_2') : n === 1 ? t('ui.imorgon') : t('ui.om_dagar', { daysLeft: n }));

/**
 * Årsredovisning för aktiebolag (K2), flik i Skatt och bokslut. Siffrorna
 * räknas i utils/annualReport.js, PDF:en byggs i utils/annualReportPdf.js.
 * Det användaren fyller i sparas per räkenskapsår i company.annualReports.
 *
 * Ordningen följer lagen: bokslutet låses, styrelsen (och vd) skriver under
 * (ÅRL 2 kap. 7 §), årsstämman hålls inom sex månader (ABL 7 kap. 10 §) och
 * årsredovisningen skickas till Bolagsverket inom sju månader (ÅRL 8 kap. 3 §).
 */
export default function AnnualReport({ company, verifications = [], accounts = [], payrollRuns = [], setCompanyInfo }) {
  // Förvalt: det senast avslutade räkenskapsåret. Det pågående året går att
  // välja för en förhandsvisning.
  const current = useMemo(() => activeFiscalYear(company), [company]);
  const previous = useMemo(() => previousFiscalYear(current, company), [current, company]);
  // Förra året visas bara om det finns bokföring i det (ett nystartat bolag
  // har ingen årsredovisning för året innan det fanns).
  const hasPrevious = verifications.some(v => v.date >= previous.start && v.date <= previous.end);
  const years = hasPrevious ? [previous, current] : [current];
  const [yearKey, setYearKey] = useState(years[0].key);
  const fy = years.find(y => y.key === yearKey) || years[0];

  const saved = company?.annualReports?.[fy.key] || {};
  const suggestedEmployees = useMemo(() => averageEmployees(payrollRuns, fy), [payrollRuns, fy]);
  const details = { employeesAverage: suggestedEmployees, ...saved };
  const setField = (field, value) => {
    setCompanyInfo?.(prev => ({
      ...prev,
      annualReports: { ...(prev.annualReports || {}), [fy.key]: { ...(prev.annualReports?.[fy.key] || {}), [field]: value } },
    }));
  };

  const report = useMemo(
    () => computeAnnualReport({ verifications, accounts, company, fy, details, employeesAverage: suggestedEmployees }),
    // details byggs om varje rendering; saved är det som faktiskt ändras.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verifications, accounts, company, fy.key, saved, suggestedEmployees],
  );
  const [busy, setBusy] = useState(false);
  // Valt steg i guiden; null = första steget som inte är klart.
  const [arStep, setArStep] = useState(null);
  const download = async () => {
    setBusy(true);
    try {
      downloadAnnualReportPdf({ company, report, details }, `Arsredovisning-${(company?.name || 'bolaget').replace(/[^\wåäöÅÄÖ-]+/g, '-')}-${fy.key.replace('/', '-')}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  // Inskickad markeras här och i Översikten (samma nyckel i taxFilings).
  const filedKey = `ar:${fy.key}`;
  const filedAt = company?.taxFilings?.[filedKey]?.at || null;
  const toggleFiled = () => setCompanyInfo?.(prev => {
    const next = { ...(prev.taxFilings || {}) };
    if (next[filedKey]) delete next[filedKey]; else next[filedKey] = { at: new Date().toISOString() };
    return { ...prev, taxFilings: next };
  });

  const deadline = annualReportDeadline(fy.end);
  const agmBy = agmDeadline(fy.end);
  const ended = fy.end < new Date().toISOString().slice(0, 10);
  const locked = Boolean(company?.lockedFiscalYears?.[fy.key]);
  const daysLeft = daysFromToday(new Date(`${deadline}T00:00:00`));
  const inc = report.income.keyFigures;
  const dividend = Number(details.dividend) || 0;
  const overLimit = dividend > Math.max(0, report.disposition.available) + 0.005;

  const tone = filedAt ? 'done' : !ended ? '' : daysLeft < 0 ? 'late' : 'warn';

  // Ett steg i taget (StepFlow). Varningarna om styrelsen och utdelningen
  // visas inte överst längre: de syns som ett steg som inte är klart.
  const filled = (v) => Boolean(v && String(v).trim());
  const flow = [
    { id: 'report', title: t('yearEndUi.report'), done: filled(details.business) && filled(details.seat) },
    { id: 'disposition', title: t('yearEndUi.disposition'), done: !overLimit },
    { id: 'sign', title: t('yearEndUi.signatures'), done: filled(details.boardMembers) && filled(details.signPlace) },
    { id: 'send', title: t('arWizard.sendTitle'), done: Boolean(filedAt) },
  ];
  // Första steget som inte är klart väljs en gång när sidan öppnas, sedan
  // byter bara användaren steg (annars hoppade guiden vidare mitt i skrivandet).
  const firstOpenStep = flow.find(x => !x.done)?.id || 'send';
  useEffect(() => { if (arStep === null) setArStep(firstOpenStep); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const step = flow.find(s => s.id === (arStep || firstOpenStep)) || flow[0];
  const boardWarning = t('ui.fyll_i_styrelsens_ledamoter_de_skriver_under_ars');
  const dividendWarningStart = t('ui.foreslagen_utdelning_kr_ar_storre_an_det_fria_eg', { v0: '§§', v1: '§§' }).split('§§')[0];
  const otherWarnings = report.warnings.filter(w => w !== boardWarning && !(dividendWarningStart && w.startsWith(dividendWarningStart)));

  return (
    <div className="fp-page">
      <section className={`fp-strip ${tone}`}>
        <div>
          <div className="fp-strip-title">{filedAt && <CheckCircle2 size={18} />}{t('yearEndUi.arTitle', { label: fy.label })}</div>
          <div className="fp-strip-sub">
            {filedAt
              ? t('yearEndUi.arFiled', { date: new Date(filedAt).toLocaleDateString('sv-SE') })
              : !ended
                ? t('yearEndUi.arPreview')
                : <>{t('yearEndUi.arDue', { date: fmtDate(deadline) })} · <strong>{daysText(daysLeft)}</strong></>}
          </div>
        </div>
        <div className="fp-actions">
          <button type="button" className="agi-btn" onClick={download} disabled={busy}>
            <Download size={15} /> {busy ? t('yearEndUi.creating') : t('yearEndUi.download')}
          </button>
        </div>
      </section>

      {years.length > 1 && <div className="filter-pills fp-pills" role="tablist" aria-label={t('ui.rakenskapsar')}>
        {years.map(y => (
          <button key={y.key} type="button" role="tab" aria-selected={y.key === fy.key} className={`filter-pill${y.key === fy.key ? ' active' : ''}`} onClick={() => setYearKey(y.key)}>{y.label}</button>
        ))}
      </div>}

      {otherWarnings.length > 0 && (
        <div className="fp-warn" role="status">
          {otherWarnings.map(w => (
            <div key={w}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{w}</span></div>
          ))}
        </div>
      )}

      <div className="fp-stats" aria-label={t('yearEndUi.keyFigures')}>
        {[
          [t('ui.nettoomsattning'), report.income.netSales.current],
          [t('ui.arets_resultat'), report.yearResult],
          [t('ui.balansomslutning'), report.balance.totalAssets],
          [t('ui.soliditet'), report.overview[0]?.solidity == null ? '–' : `${Math.round(report.overview[0].solidity)} %`],
        ].map(([label, value]) => (
          <div key={label} className="fp-stat">
            <div className="fp-stat-label">{label}</div>
            <div className="fp-stat-value">{typeof value === 'number' ? `${formatKr(value)} kr` : value}</div>
          </div>
        ))}
      </div>

      <StepFlow steps={flow} current={step.id} onSelect={setArStep}>
        {step.id === 'report' && (
          <>
            <h3 className="stepflow-h">{t('yearEndUi.report')}</h3>
            <p className="stepflow-text">{t('arWizard.reportText')}</p>
            <div className="fp-fields">
              <div>
                <label className="fp-label">{t('ui.verksamheten')}</label>
                <textarea rows={3} className="fp-input" style={{ resize: 'vertical' }} value={details.business || ''} onChange={e => setField('business', e.target.value)} placeholder={t('ui.bolaget_bedriver_konsultverksamhet_inom_it')} />
              </div>
              <div className="fp-grid-2">
                <div>
                  <label className="fp-label">{t('ui.sate')}</label>
                  <input className="fp-input" value={details.seat || ''} onChange={e => setField('seat', e.target.value)} placeholder={t('ui.stockholm')} />
                </div>
                <div>
                  <label className="fp-label">{t('ui.medelantal_anstallda')}</label>
                  <input type="number" min="0" className="fp-input" value={details.employeesAverage ?? ''} onChange={e => setField('employeesAverage', e.target.value === '' ? '' : Number(e.target.value))} />
                  <div className="fp-hint">{t('yearEndUi.suggested', { n: suggestedEmployees })}</div>
                </div>
              </div>
              <div>
                <label className="fp-label">{t('ui.vasentliga_handelser_under_aret_valfritt')}</label>
                <textarea rows={2} className="fp-input" style={{ resize: 'vertical' }} value={details.events || ''} onChange={e => setField('events', e.target.value)} placeholder={t('ui.till_exempel_nya_kontor_stora_kunder_eller_foran')} />
              </div>
            </div>
            <StepNav steps={flow} current={step.id} onSelect={setArStep} />
          </>
        )}

        {step.id === 'disposition' && (
          <>
            <h3 className="stepflow-h">{t('yearEndUi.disposition')}</h3>
            <p className="stepflow-text">{t('yearEndUi.available', { amount: formatKr(report.disposition.available) })}</p>
            <div className="fp-fields" style={{ maxWidth: '420px' }}>
              <div>
                <label className="fp-label">{t('ui.foreslagen_utdelning_kr')}</label>
                <input type="number" min="0" className="fp-input" value={details.dividend ?? ''} onChange={e => setField('dividend', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
                {/* ABL 17 kap. 3 §: bara fritt eget kapital får delas ut. */}
                <div className={`fp-hint${overLimit ? ' bad' : ''}`}>
                  {overLimit
                    ? t('yearEndUi.overLimit', { amount: formatKr(Math.max(0, report.disposition.available)) })
                    : t('yearEndUi.carried', { amount: formatKr(report.disposition.carriedForward) })}
                </div>
              </div>
            </div>
            <StepNav steps={flow} current={step.id} onSelect={setArStep} />
          </>
        )}

        {step.id === 'sign' && (
          <>
            <h3 className="stepflow-h">{t('yearEndUi.signatures')}</h3>
            <p className="stepflow-text">{t('arWizard.signText')}</p>
            <div className="fp-fields">
              <div>
                <label className="fp-label">{t('ui.styrelsens_ledamoter')}</label>
                <textarea rows={3} className="fp-input" style={{ resize: 'vertical' }} value={details.boardMembers || ''} onChange={e => setField('boardMembers', e.target.value)} placeholder={t('ui.anna_andersson_bo_berg')} />
                <div className="fp-hint">{t('arWizard.onePerLine')}</div>
              </div>
              <div className="fp-grid-2">
                <div>
                  <label className="fp-label">{t('ui.ort_for_underskrift')}</label>
                  <input className="fp-input" value={details.signPlace || ''} onChange={e => setField('signPlace', e.target.value)} placeholder={t('ui.stockholm')} />
                </div>
                <div>
                  <label className="fp-label">{t('ui.arsstammans_datum')}</label>
                  <input type="date" className="fp-input" value={details.agmDate || ''} onChange={e => setField('agmDate', e.target.value)} />
                  <div className="fp-hint">{t('arWizard.agmBy', { date: fmtDate(agmBy) })}</div>
                </div>
              </div>
            </div>
            <StepNav steps={flow} current={step.id} onSelect={setArStep} />
          </>
        )}

        {step.id === 'send' && (
          <>
            <h3 className="stepflow-h">{t('arWizard.sendTitle')} {filedAt && <span className="agi-pill ok">{t('ui.klar')}</span>}</h3>
            {!ended && <p className="stepflow-text">{t('yearEndUi.arPreview')}</p>}
            <ol className="fp-steps" style={{ gridTemplateColumns: '1fr' }}>
              <li className={locked ? 'done' : ''}>
                <span className="fp-step-mark">{locked ? <CheckCircle2 size={14} /> : 1}</span>
                <div>{locked ? t('yearEndUi.stepLockDone') : t('yearEndUi.stepLock')}</div>
              </li>
              <li>
                <span className="fp-step-mark">2</span>
                <div>{t('arWizard.download')}<small>{t('yearEndUi.stepSignSub')}</small></div>
              </li>
              <li>
                <span className="fp-step-mark">3</span>
                <div>{t('yearEndUi.stepAgm')}<small>{t('yearEndUi.stepAgmSub', { date: fmtDate(agmBy) })}</small></div>
              </li>
              <li className={filedAt ? 'done' : ''}>
                <span className="fp-step-mark">{filedAt ? <CheckCircle2 size={14} /> : 4}</span>
                <div>{t('yearEndUi.stepSend')}<small>{t('yearEndUi.stepSendSub', { date: fmtDate(deadline) })}</small></div>
              </li>
            </ol>
            <div className="fp-actions">
              <button type="button" className="agi-btn primary" onClick={download} disabled={busy}>
                <Download size={15} /> {busy ? t('yearEndUi.creating') : t('yearEndUi.download')}
              </button>
              {ended && (locked || filedAt) && (
                <button type="button" className="agi-btn" onClick={toggleFiled}>
                  {filedAt ? t('yearEndUi.undoSent') : <><CheckCircle2 size={15} /> {t('yearEndUi.markSent')}</>}
                </button>
              )}
            </div>
            <StepNav steps={flow} current={step.id} onSelect={setArStep} />
          </>
        )}
      </StepFlow>
    </div>
  );
}
