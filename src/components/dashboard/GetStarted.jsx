import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { Check, ChevronRight, Upload, FileText, Receipt, Users, Landmark, Building2, UsersRound } from '../icons';

// Kom igång för ett nytt konto (2026-11-10). Ersätter tre saker som
// tidigare låg om varandra på startsidan: Kom igång-raderna i Att göra, den
// tomma grafen med 0 kr-rutor och "Har du bokfört någon annanstans innan?".
//
// Tanken:
// - Valet (från noll / flyttar in) görs i registreringen (OnboardingFlow,
//   steget Start). Här visas valet bara om det saknas.
// - Första kortet är redan klart (kontot finns), så det aldrig börjar på noll.
// - Korten bockas av av sig själva när datan finns, aldrig för hand.
// - Varje kort säger vad man vinner, inte bara vad man ska göra.
// - Nästa steg är framhävt; ett nyss klart steg ger ett kort "Snyggt"-besked,
//   så att framstegen känns (ingen konfetti, användarens val 2026-11-10).
// - Valet sparas per företag i webbläsaren och på kontot (Dashboard.jsx).
const STORE_PREFIX = 'bokix_getstarted_';

export function readGetStarted(companyId) {
  try { return JSON.parse(localStorage.getItem(STORE_PREFIX + companyId) || 'null') || {}; } catch { return {}; }
}
function writeGetStarted(companyId, state) {
  try { localStorage.setItem(STORE_PREFIX + companyId, JSON.stringify(state)); } catch { /* privat läge, inte kritiskt */ }
}

// Ska ytan synas? Bara för konton som svarat på steget Start i registreringen
// (OnboardingFlow), alltså nya konton. Konton som fanns innan får den aldrig.
// eslint-disable-next-line no-unused-vars
export function shouldShowGetStarted(state, _opts) {
  return Boolean(state.path) && !state.dismissed;
}

// Färg per steg: appens statusfärger, som redan har en ljus och en mörk variant.
const TONES = {
  green: { bg: 'var(--status-green-bg)', fg: 'var(--status-green-text)' },
  blue: { bg: 'var(--status-blue-bg)', fg: 'var(--status-blue-text)' },
  amber: { bg: 'var(--status-amber-bg)', fg: 'var(--status-amber-text)' },
  pink: { bg: 'var(--status-pink-bg)', fg: 'var(--status-pink-text)' },
};

export function buildSteps(path, { t, company, verifications, expenses, invoices, contacts, employees, bankTransactions, hiddenNavIds, payrollIncluded = true }) {
  const s = (k) => t(`dashboard.getStarted.${k}`);
  const account = { id: 'account', icon: Check, tone: 'green', title: s('stepAccount'), detail: company?.name || '', done: true };
  if (path === 'move') {
    return [
      account,
      { id: 'sie', icon: Upload, tone: 'green', title: s('moveSie'), detail: s('moveSieDetail'), done: verifications.length > 0, action: 'sie', min: 5 },
      { id: 'contacts', icon: Users, tone: 'blue', title: s('moveContacts'), detail: s('moveContactsDetail'), done: contacts.length > 0, tab: 'contacts', min: 3 },
      // Anställda bara för den som betalar för lön (Med personal, utils/plans.js).
      payrollIncluded && !hiddenNavIds.includes('payroll') && { id: 'employees', icon: UsersRound, tone: 'pink', title: s('moveEmployees'), detail: s('moveEmployeesDetail'), done: employees.length > 0, tab: 'payroll', min: 5 },
      !hiddenNavIds.includes('bank') && { id: 'bank', icon: Landmark, tone: 'amber', title: s('moveBank'), detail: s('moveBankDetail'), done: bankTransactions.length > 0, tab: 'bank', min: 3 },
      { id: 'invoices', icon: FileText, tone: 'blue', title: s('moveInvoices'), detail: s('moveInvoicesDetail'), done: invoices.length > 0, tab: 'invoices', min: 2 },
    ].filter(Boolean);
  }
  return [
    account,
    { id: 'company', icon: Building2, tone: 'blue', title: s('newCompany'), detail: s('newCompanyDetail'), done: Boolean(company?.orgNr && company?.address && (company?.bankgiro || company?.plusgiro || company?.iban)), tab: 'company', min: 1 },
    { id: 'receipt', icon: Receipt, tone: 'amber', title: s('newReceipt'), detail: s('newReceiptDetail'), done: expenses.length > 0, tab: 'expenses', min: 1 },
    { id: 'invoice', icon: FileText, tone: 'green', title: s('newInvoice'), detail: s('newInvoiceDetail'), done: invoices.length > 0, tab: 'invoices', openAction: { type: 'new_invoice' }, min: 2 },
    // Bara för den som betalar för lön (Med personal).
    payrollIncluded && !hiddenNavIds.includes('payroll') && { id: 'employee', icon: UsersRound, tone: 'pink', title: s('newEmployee'), detail: s('newEmployeeDetail'), done: employees.length > 0, tab: 'payroll', min: 3 },
  ].filter(Boolean);
}

const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export default function GetStarted({ companyId, state, onChange, data, onOpenTab, onOpenAction, onImportSie, onStartTour }) {
  const { t } = useTranslation();
  const s = (k, v) => t(`dashboard.getStarted.${k}`, v);
  const save = (next) => { writeGetStarted(companyId, next); onChange(next); };

  // Utan svar från registreringen (äldre konton) blir det Kom igång; länken
  // längst ner byter till Flytta in.
  const path = state.path || 'new';
  const skipped = state.skipped || [];
  const steps = path ? buildSteps(path, { t, ...data }) : [];
  const isDone = (st) => st.done || skipped.includes(st.id);
  const doneCount = steps.filter(isDone).length;
  const total = steps.length;
  const next = steps.find(st => !isDone(st));
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  // Ett steg som blivit klart sedan förra gången: ett kort "Snyggt".
  // Räknas mot förra besökets antal i webbläsaren, så det syns när man
  // kommer tillbaka till startsidan efter att ha gjort steget.
  const seenKey = `${STORE_PREFIX}${companyId}_seen`;
  const [celebrate, setCelebrate] = useState(false);
  const close = () => save({ ...state, dismissed: true, dismissedAt: Date.now() });
  const [confirmHide, setConfirmHide] = useState(false);
  useEffect(() => {
    if (!path) return undefined;
    let seen = NaN;
    try { seen = Number(localStorage.getItem(seenKey)); } catch { /* inget */ }
    try { localStorage.setItem(seenKey, String(doneCount)); } catch { /* inget */ }
    if (Number.isFinite(seen) && seen > 0 && doneCount > seen && !reducedMotion()) {
      setCelebrate(true);
      const id = setTimeout(() => setCelebrate(false), 2800);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [doneCount, path, seenKey]);

  const isMove = path === 'move';
  const open = (st) => {
    if (st.action === 'sie') onImportSie();
    else if (st.openAction && onOpenAction) onOpenAction(st.openAction, st.tab);
    else if (st.tab) onOpenTab(st.tab);
  };

  // ── Allt klart ──
  if (!next) {
    return (
      <section className="gs-card gs-done">
        <span className="gs-done-icon"><Check size={24} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="gs-title">{isMove ? s('allDoneMove') : s('allDoneNew')}</h2>
          <p className="gs-sub">{s('allDoneDetail')}</p>
        </div>
        <button type="button" className="gs-primary" onClick={close}>{s('close')}</button>
      </section>
    );
  }

  const left = total - doneCount;
  const cheer = celebrate ? (left === 1 ? s('cheerOneLeft') : s('cheerMany', { n: left })) : null;

  return (
    <section className="gs-card" aria-labelledby="gs-title">
      <div className="gs-head">
        <div style={{ minWidth: 0 }}>
          <h2 id="gs-title" className="gs-title">{isMove ? s('titleMove') : s('titleNew')}</h2>
          <p className={`gs-sub${cheer ? ' gs-cheer' : ''}`} aria-live="polite">{cheer || (isMove ? s('leadMove') : s('leadNew'))}</p>
        </div>
        <div className="gs-progress">
          <span className="gs-pct">{pct}<small>%</small></span>
          <span className="gs-pct-label">{s('progress', { done: doneCount, total })}</span>
        </div>
      </div>
      <div className="gs-track" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>

      {/* Kort, alltid tre per rad, samma för Kom igång och Flytta in. */}
      <ol className={total === 4 ? 'gs-grid gs-grid-four' : 'gs-grid'}>
        {steps.map(st => {
          const done = isDone(st);
          const current = st.id === next.id;
          const wasSkipped = done && !st.done && skipped.includes(st.id);
          const tone = TONES[st.tone] || TONES.green;
          const Icon = st.icon;
          return (
            <li key={st.id} className={['gs-tcard', done && 'done', current && 'current'].filter(Boolean).join(' ')}>
              <div className="gs-tcard-top">
                <span className="gs-tile" style={done ? undefined : { background: tone.bg, color: tone.fg }}>
                  {done ? <Check size={18} /> : <Icon size={18} />}
                </span>
                {current && <span className="gs-badge">{s('nextBadge')}</span>}
                {done && <span className="gs-badge gs-badge-done">{wasSkipped ? s('skipped') : s('doneBadge')}</span>}
                {!done && st.min ? <span className="gs-min">{s('aboutMin', { n: st.min })}</span> : null}
              </div>
              <h3 className="gs-tcard-title">{st.title}</h3>
              {st.detail && <p className="gs-tcard-detail">{st.detail}</p>}
              {!done && (
                <div className="gs-tcard-actions">
                  <button type="button" className={current ? 'gs-primary' : 'gs-secondary'} onClick={() => open(st)}>
                    {current ? s('start') : s('open')} <ChevronRight size={14} />
                  </button>
                  {isMove && st.id !== 'sie' && (
                    <button type="button" className="gs-skip" onClick={() => save({ ...state, skipped: [...skipped, st.id] })}>{s('skip')}</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {isMove && <p className="gs-note">{s('moveNote')}</p>}
      <div className="gs-foot">
        <span className="gs-foot-links">
          <button type="button" className="gs-skip" onClick={() => save({ ...state, path: isMove ? 'new' : 'move' })}>
            {isMove ? s('switchToNew') : s('switchToMove')}
          </button>
          {onStartTour && <button type="button" className="gs-skip" onClick={onStartTour}>{s('tour')}</button>}
        </span>
        {confirmHide ? (
          <span className="gs-confirm" role="group" aria-label={s('hideConfirm')}>
            <span>{s('hideConfirm')}</span>
            <button type="button" className="gs-secondary" onClick={() => setConfirmHide(false)}>{s('cancel')}</button>
            <button type="button" className="gs-danger" onClick={close}>{s('hide')}</button>
          </span>
        ) : (
          <button type="button" className="gs-skip" onClick={() => setConfirmHide(true)}>{s('hide')}</button>
        )}
      </div>
    </section>
  );
}
