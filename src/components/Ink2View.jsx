import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, FileText, AlertTriangle } from './icons';
import { INK2S_ROWS, computeInk2s, suggestInk2s, resolveInk2sValues } from '../utils/ink2s';
import { computeInk2rResultat } from '../utils/ink2rResultat';
import { downloadInk2rSru } from '../utils/sruExport';
import { previewInk2Pdf } from '../utils/ink2Pdf';
import { downloadFilledSkv2002 } from '../utils/skvBlankett';
import { previousFiscalYear } from '../utils/annualReport';
import { incomeDeclarationDueDate, daysFromToday } from '../utils/declarationDeadlines';
import { detectOrgType } from '../utils/orgType';
import { t, dateLocale } from '../i18n';

const SKV_EFILE = 'https://sso.skatteverket.se/fv_ext/fv_web/login.do';
const kr = (v) => `${new Intl.NumberFormat('sv-SE').format(Math.round(v || 0))} kr`;
const daysText = (n) => (n < 0 ? t('ui.forsenad') : n === 0 ? t('ui.idag_2') : n === 1 ? t('ui.imorgon') : t('ui.om_dagar', { daysLeft: n }));

// Inkomstdeklaration 2 som ett arbetsflöde: överst status och knappar,
// sedan tre delar (bokföringen, skatten, inlämningen) och sist detaljerna.
// INK2S förifylls ur bokföringen (ink2s.js: suggestInk2s) och allt följer
// med i SRU-filen (sruExport.js). Sparas per räkenskapsår i company.ink2s,
// "kontrollerad" i company.ink2Checked och "inlämnad" i taxFilings (ink:år),
// samma nyckel som Översikten.
export default function Ink2View({
  company, fy, verifications = [], ink2r, ink2rResultat, isLocked, sruMissing = [], warnings = [],
  setCompanyInfo, onNavigateToTab, onOpenYearEnd, scheduleDetails,
}) {
  const scheduleRef = useRef(null);
  const adjRef = useRef(null);
  const fyKey = fy.key;

  // Förra årets underskott (4.16) blir årets 4.14a, om det deklarerades i Bokix.
  const previousUnderskott = useMemo(() => {
    const prev = previousFiscalYear(fy, company);
    const hasPrev = verifications.some(v => v.date >= prev.start && v.date <= prev.end);
    if (!hasPrev) return 0;
    const prevResult = computeInk2rResultat(verifications, { start: prev.start, end: prev.end }).total;
    const prevSuggest = suggestInk2s({ verifications, fy: prev }).suggestions;
    return computeInk2s(resolveInk2sValues(company?.ink2s?.[prev.key], prevSuggest), prevResult).underskott;
  }, [verifications, fy, company]);

  const suggestion = useMemo(() => suggestInk2s({ verifications, fy, previousUnderskott }), [verifications, fy, previousUnderskott]);
  const saved = company?.ink2s?.[fyKey] || {};
  const values = resolveInk2sValues(saved, suggestion.suggestions);
  const ink2s = computeInk2s(values, ink2rResultat.total);

  const update = (patch) => setCompanyInfo?.(prev => ({ ...prev, ...patch(prev) }));
  const setValue = (key, raw) => update(prev => ({ ink2s: { ...(prev.ink2s || {}), [fyKey]: { ...(prev.ink2s?.[fyKey] || {}), [key]: raw } } }));
  const taxChecked = Boolean(company?.ink2Checked?.[fyKey]);
  const setChecked = (on) => update(prev => ({ ink2Checked: { ...(prev.ink2Checked || {}), [fyKey]: on ? new Date().toISOString() : undefined } }));
  const filedKey = `ink:${fyKey}`;
  const filedAt = company?.taxFilings?.[filedKey]?.at || null;
  const toggleFiled = () => update(prev => {
    const next = { ...(prev.taxFilings || {}) };
    if (next[filedKey]) delete next[filedKey]; else next[filedKey] = { at: new Date().toISOString() };
    return { taxFilings: next };
  });

  const hasBooks = ink2r.rows.length > 0;
  const booksOk = hasBooks && ink2r.balanced;
  const sruReady = booksOk && sruMissing.length === 0;
  const allReady = isLocked && booksOk && taxChecked && sruMissing.length === 0;
  const left = [!booksOk, !taxChecked, sruMissing.length > 0].filter(Boolean).length;
  const prefilled = Object.keys(suggestion.suggestions).length;

  const due = incomeDeclarationDueDate({ orgType: detectOrgType(company?.orgNr), fyEnd: fy.end });
  const daysLeft = due ? daysFromToday(due) : null;
  const fmtDue = due ? new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(due) : '';

  const status = filedAt ? t('ink2Ui.stFiled', { date: new Date(filedAt).toLocaleDateString('sv-SE') })
    : !isLocked ? t('ink2Ui.stLock')
    : left === 0 ? t('ink2Ui.stReady')
    : left === 1 ? t('ink2Ui.stAlmost')
    : t('ink2Ui.stLeft', { n: left });
  const tone = filedAt || allReady ? 'done' : daysLeft != null && daysLeft < 0 ? 'late' : 'warn';

  const downloadSru = () => downloadInk2rSru(company, ink2r, ink2rResultat.rows, { start: fy.start, end: fy.end }, ink2s);
  const previewPdf = () => previewInk2Pdf({ company, fyLabel: fy.label, ink2r, resultRows: ink2rResultat.rows, ink2s });
  // Skatteverkets egen blankett, ifylld (utils/skvBlankett.js).
  const [officialBusy, setOfficialBusy] = useState(false);
  const [officialError, setOfficialError] = useState('');
  const downloadOfficial = async () => {
    setOfficialBusy(true); setOfficialError('');
    try { await downloadFilledSkv2002({ company, fy, ink2r, resultRows: ink2rResultat.rows, ink2s }); }
    catch (err) { setOfficialError(err.message || t('ink2Ui.officialError')); }
    finally { setOfficialBusy(false); }
  };
  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const Pill = ({ kind }) => {
    const map = { done: ['ok', t('ink2Ui.pillDone')], check: ['warn', t('ink2Ui.pillCheck')], missing: ['late', t('ink2Ui.pillMissing')], wait: ['mute', t('ink2Ui.pillWaiting')] };
    const [cls, label] = map[kind];
    return <span className={`agi-pill ${cls}`}>{label}</span>;
  };

  const groups = [];
  INK2S_ROWS.forEach(def => {
    let g = groups.find(x => x.title === def.group);
    if (!g) { g = { title: def.group, rows: [] }; groups.push(g); }
    g.rows.push(def);
  });

  return (
    <div className="fp-page ink2v">
      {/* Status och huvudknappar */}
      <section className={`fp-strip ${tone}`}>
        <div>
          <div className="fp-strip-title">{(filedAt || allReady) && <CheckCircle2 size={18} />}{t('ink2Ui.title', { label: fy.label })}</div>
          <div className="fp-strip-sub">
            <strong>{status}</strong>
            {!filedAt && due ? <> · {t('ink2Ui.due', { date: fmtDue })} ({daysText(daysLeft)})</> : null}
          </div>
          <div className="fp-hint" style={{ marginTop: '6px' }}>{t('ink2Ui.lead')}</div>
        </div>
        <div className="fp-actions">
          {!isLocked && onOpenYearEnd ? (
            <button type="button" className="agi-btn primary" onClick={onOpenYearEnd}>{t('ink2Ui.lockBtn')}</button>
          ) : (
            <button type="button" className={`agi-btn${allReady && !filedAt ? ' primary' : ''}`} onClick={downloadSru} disabled={!sruReady}>
              <Download size={15} /> {t('ink2Ui.sru')}
            </button>
          )}
          {allReady && (
            <button type="button" className="agi-btn" onClick={toggleFiled}>
              {filedAt ? t('ink2Ui.undoFiled') : <><CheckCircle2 size={15} /> {t('ink2Ui.markFiled')}</>}
            </button>
          )}
        </div>
      </section>

      {warnings.length > 0 && (
        <div className="fp-warn" role="status">
          {warnings.map(w => <div key={w}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{w}</span></div>)}
        </div>
      )}

      {/* Tre delar */}
      <div className="ink2v-cards">
        <div className="ink2v-card">
          <div className="ink2v-card-head"><span>{t('ink2Ui.books')}</span><Pill kind={!hasBooks ? 'missing' : booksOk ? 'done' : 'check'} /></div>
          <p>{!hasBooks ? t('ink2Ui.booksNone', { label: fy.label }) : booksOk ? t('ink2Ui.booksOk') : t('ink2Ui.booksDiff', { amount: kr(Math.abs(ink2r.difference)) })}</p>
          <button type="button" className="ink2v-link" onClick={() => scrollTo(scheduleRef)}>{t('ink2Ui.booksBtn')}</button>
        </div>
        <div className="ink2v-card">
          <div className="ink2v-card-head"><span>{t('ink2Ui.tax')}</span><Pill kind={taxChecked ? 'done' : 'check'} /></div>
          <p>{taxChecked ? t('ink2Ui.taxOk') : prefilled ? t('ink2Ui.taxPrefilled', { n: prefilled }) : t('ink2Ui.taxTodo')}</p>
          <button type="button" className="ink2v-link" onClick={() => scrollTo(adjRef)}>{t('ink2Ui.taxBtn')}</button>
        </div>
        <div className="ink2v-card">
          <div className="ink2v-card-head"><span>{t('ink2Ui.filing')}</span><Pill kind={filedAt || allReady ? 'done' : sruMissing.length ? 'missing' : 'wait'} /></div>
          <p>{sruMissing.length ? t('ink2Ui.filingMissing', { fields: sruMissing.join(', ') }) : allReady ? t('ink2Ui.filingOk') : t('ink2Ui.filingWait')}</p>
          <div className="ink2v-card-actions">
            <button type="button" className="agi-btn" onClick={downloadOfficial} disabled={!hasBooks || officialBusy}><FileText size={14} /> {officialBusy ? t('ink2Ui.officialBusy') : t('ink2Ui.official')}</button>
            <button type="button" className="agi-btn" onClick={previewPdf} disabled={!hasBooks}>{t('ink2Ui.pdf')}</button>
            {sruMissing.length > 0 && onNavigateToTab
              ? <button type="button" className="agi-btn" onClick={() => onNavigateToTab('settings')}>{t('ink2Ui.settingsBtn')}</button>
              : <button type="button" className="agi-btn" onClick={downloadSru} disabled={!sruReady}><Download size={14} /> SRU</button>}
            <a className={`agi-btn${allReady && !filedAt ? ' primary' : ''}`} href={SKV_EFILE} target="_blank" rel="noopener noreferrer">{t('ink2Ui.skv')} <ExternalLink size={13} /></a>
          </div>
          {officialError && <div className="fp-hint bad">{officialError}</div>}
        </div>
      </div>

      {/* Detaljer: INK2R */}
      <section className="fp-section" ref={scheduleRef}>
        <h3 className="fp-title" style={{ marginBottom: '2px' }}>{t('ink2Ui.scheduleTitle')}</h3>
        <div className="fp-hint" style={{ marginTop: 0, marginBottom: '14px' }}>{t('ink2Ui.scheduleSub')}</div>
        {scheduleDetails}
      </section>

      {/* Detaljer: INK2S. En centrerad kolumn: summering överst, sedan varje
          rad med blankettens tecken (+ läggs till, − dras av) och sist det
          skattemässiga resultatet. */}
      <section className="fp-section" ref={adjRef}>
        <div className="ink2v-adj">
          <h3 className="fp-title" style={{ marginBottom: '2px' }}>{t('ink2Ui.adjTitle')}</h3>
          <div className="fp-hint" style={{ marginTop: 0, marginBottom: '16px' }}>{t('ink2Ui.adjSub')}</div>

          <div className="ink2v-sum">
            <div>
              <span>{ink2s.arsResultatForlust ? t('ink2Ui.result42') : t('ink2Ui.result41')}</span>
              <strong>{kr(Math.abs(ink2rResultat.total))}</strong>
            </div>
            <div className="op">{ink2s.adjustments < 0 ? '−' : '+'}</div>
            <div>
              <span>{t('ink2Ui.adjustments')}</span>
              <strong>{kr(Math.abs(ink2s.adjustments))}</strong>
            </div>
            <div className="op">=</div>
            <div className="res">
              <span>{ink2s.underskott ? t('ink2Ui.underskott') : t('ink2Ui.overskott')}</span>
              <strong>{kr(ink2s.underskott || ink2s.overskott)}</strong>
            </div>
          </div>

          {groups.map(g => (
            <div key={g.title} className="ink2v-group">
              <div className="ink2v-group-title">{g.title}</div>
              {g.rows.map(def => {
                const sug = suggestion.suggestions[def.key];
                const own = saved[def.key];
                const usingSuggestion = sug != null && (own === undefined || own === null || own === '');
                const shown = usingSuggestion ? sug : (own ?? '');
                const hasValue = Number(shown) !== 0 && shown !== '';
                const from = suggestion.accounts[def.key]?.map(a => a.account).join(', ');
                return (
                  <div key={def.key} className={`ink2v-row${hasValue ? ' filled' : ''}`}>
                    <span className="ink2v-no">{def.row}</span>
                    <span className="ink2v-label">
                      {def.label}
                      {sug != null && (
                        <small className="ink2v-sug">
                          {usingSuggestion ? t('ink2Ui.suggested') : <button type="button" className="ink2v-link" onClick={() => setValue(def.key, '')}>{t('ink2Ui.useSuggestion')} ({kr(sug)})</button>}
                          {def.key === '4.6a' && suggestion.rate != null ? ` · ${t('ink2Ui.fundsNote', { funds: kr(suggestion.fundsAtStart), rate: String(suggestion.rate).replace('.', ',') })}` : from ? ` · ${t('ink2Ui.fromAccounts', { list: from })}` : ''}
                        </small>
                      )}
                    </span>
                    <span className={`ink2v-sign s${def.sign === '+' ? 'p' : def.sign === '-' ? 'm' : 'b'}`} aria-hidden="true">{def.sign === '-' ? '−' : def.sign}</span>
                    <span className="ink2v-amount">
                      <input
                        type="number" inputMode="decimal" step="1" min={def.sign === '±' ? undefined : 0}
                        className={`fp-input ink2v-input${usingSuggestion ? ' suggested' : ''}`}
                        value={shown}
                        placeholder="–"
                        disabled={Boolean(filedAt)}
                        onChange={e => setValue(def.key, e.target.value)}
                        aria-label={`${def.row} ${def.label}`}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          <div className="ink2v-row total">
            <span className="ink2v-no">{ink2s.underskott ? '4.16' : '4.15'}</span>
            <span className="ink2v-label">{t('ink2Ui.taxableResult')}: {ink2s.underskott ? t('ink2Ui.underskott') : t('ink2Ui.overskott')}</span>
            <span className="ink2v-sign" aria-hidden="true">=</span>
            <span className="ink2v-amount">{kr(ink2s.underskott || ink2s.overskott)}</span>
          </div>

          <div className="fp-foot" style={{ justifyContent: 'center' }}>
            {taxChecked
              ? <button type="button" className="agi-btn" onClick={() => setChecked(false)} disabled={Boolean(filedAt)}>{t('ink2Ui.undoChecked')}</button>
              : <button type="button" className="agi-btn primary" onClick={() => setChecked(true)}><CheckCircle2 size={15} /> {t('ink2Ui.confirmChecked')}</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
