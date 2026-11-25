import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, ArrowRight, Check, Info } from './icons';
import Drawer from './Drawer';
import { runBookkeepingCheck } from '../utils/bookkeepingCheck';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import './workspace.css';

// Kontrollera bokföringen (2026-11-21), raden överst i Verifikationer. Logiken och
// vad varje kontroll tittar på står i utils/bookkeepingCheck.js. Rättar inget
// själv, varje fynd har en förklaring och en väg dit det rättas.

const fmtKr = (v) => `${numberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v) || 0)} kr`;

const LEVEL = {
  error: { Icon: AlertCircle, color: 'var(--danger, #c0392b)', bg: 'color-mix(in srgb, var(--danger, #c0392b) 12%, transparent)' },
  warn: { Icon: AlertTriangle, color: '#b7791f', bg: 'color-mix(in srgb, #d69e2e 14%, transparent)' },
  ok: { Icon: CheckCircle2, color: 'var(--primary, #15803d)', bg: 'color-mix(in srgb, var(--primary, #15803d) 12%, transparent)' },
};

// Vart knappen leder för varje kontroll.
const TARGET = { receivables: 'invoices', payables: 'supplier_invoices', old_bank: 'bank' };

function describe(c) {
  const k = (key, p) => t(`ui.bk_${c.id}_${key}`, p);
  if (c.level === 'ok') return { title: k('ok_title'), text: '' };
  switch (c.id) {
    case 'receivables':
    case 'payables':
      // Beloppen visas som tre rutor (Figures), texten är bara orsaken.
      return { title: k('title'), text: t('ui.bk_ledger_hint') };
    case 'negative_money':
      return { title: k('title'), text: k('text', { list: c.items.map(i => `${i.account} ${fmtKr(i.amount)}`).join(', ') }) };
    default:
      return { title: k('title', { n: c.count }), text: k('text', { n: c.count }) };
  }
}

// Bokfört, obetalda fakturor och skillnaden som tre rutor (2026-11-22),
// i stället för en lång mening med tre belopp.
function Figures({ check }) {
  const account = check.id === 'receivables' ? '1510' : '2440';
  return (
    <dl className="bkc-figs2">
      <div><dt>{t('ui.bk_fig_booked', { account })}</dt><dd>{fmtKr(check.booked)}</dd></div>
      <div><dt>{t('ui.bk_fig_open', { n: check.openCount })}</dt><dd>{fmtKr(check.expected)}</dd></div>
      <div className="is-diff"><dt>{t('ui.bk_fig_diff')}</dt><dd><span>{fmtKr(Math.abs(check.diff))}</span></dd></div>
    </dl>
  );
}

// Ringen överst (2026-11-22, idé från grundarens Lovable-skiss): hur många av
// kontrollerna som stämmer.
function Ring({ ok, total, level }) {
  const r = 26; const c = 2 * Math.PI * r; const pct = total ? ok / total : 1;
  return (
    <span className={`bkc-ring is-${level}`} aria-hidden="true">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="bkc-ring-bg" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="bkc-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 32 32)" />
      </svg>
      <b>{ok}/{total}</b>
    </span>
  );
}

function FineList({ fine }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`bkc-fine2${open ? ' is-open' : ''}`}>
      <button type="button" className="bkc-fine2-head" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span className="bkc-fine2-ic" aria-hidden="true"><Check size={16} /></span>
        <strong>{fine.length === 1 ? t('ui.bk_fine_one') : t('ui.bk_fine_many', { n: fine.length })}</strong>
        <ChevronDown size={18} className="bkc-fine2-chev" />
      </button>
      {open && (
        <ul>
          {fine.map(c => <li key={c.id}><CheckCircle2 size={15} aria-hidden="true" />{describe(c).title}</li>)}
        </ul>
      )}
    </section>
  );
}

function IssueCard({ check, onOpenVerification, onNavigate }) {
  const [open, setOpen] = useState(check.level === 'error');
  const { Icon } = LEVEL[check.level];
  const { title, text } = describe(check);
  const hasItems = check.items.some(i => i.verificationId || i.date);
  const target = TARGET[check.id];
  const ledger = check.id === 'receivables' || check.id === 'payables';
  return (
    <article className={`bkc-issue is-${check.level}`}>
      <header className="bkc-issue-head">
        <span className="bkc-issue-icon" aria-hidden="true"><Icon size={16} /></span>
        <h4>{title}</h4>
      </header>
      {ledger && <Figures check={check} />}
      {text && <p className="bkc-issue-text">{text}</p>}
      {(hasItems || target) && (
        <div className="bkc-issue-actions">
          {target && <button type="button" className="bkc-btn" onClick={() => onNavigate?.(target)}>{t(`ui.bk_go_${target}`)}<ArrowRight size={15} /></button>}
          {hasItems && (
            <button type="button" className="bkc-btn" aria-expanded={open} onClick={() => setOpen(v => !v)}>
              {open ? t('ui.bk_hide') : (check.items.some(i => i.verificationId) ? t('ui.bk_show_vers', { n: Math.min(check.count, check.items.length) }) : t('ui.bk_show', { n: Math.min(check.count, check.items.length) }))}
              <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
          )}
        </div>
      )}
      {open && hasItems && (
        <div className="bkc-items">
          {check.items.map((i, idx) => (
            <button
              key={`${i.verificationId || i.date}-${idx}`}
              type="button"
              className="bkc-item"
              disabled={!i.verificationId}
              onClick={() => i.verificationId && onOpenVerification?.(i.verificationId)}
            >
              <span className="bkc-item-ver">{i.ver || ''}</span>
              <span className="bkc-item-date">{i.date}</span>
              <span className="bkc-item-text">{i.others ? `${i.text} (${i.others.join(', ')})` : i.text}</span>
              <span className="bkc-item-amt">{i.amount != null ? fmtKr(i.amount) : ''}</span>
            </button>
          ))}
          {check.count > check.items.length && <div className="bkc-items-more">{t('ui.bk_more', { n: check.count - check.items.length })}</div>}
        </div>
      )}
    </article>
  );
}

// Samma innehåll i panelen från höger (dator) och i raden på telefon.
export default function BookkeepingCheck({ verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt, onOpenVerification, onNavigate }) {
  const result = useMemo(
    () => runBookkeepingCheck({ verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt }),
    [verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt],
  );
  const issues = result.checks.filter(c => c.level !== 'ok');
  const fine = result.checks.filter(c => c.level === 'ok');
  const level = result.errors ? 'error' : result.warnings ? 'warn' : 'ok';
  const headline = issues.length === 0 ? t('ui.bk_all_ok') : t(issues.length === 1 ? 'ui.bk_issues_one' : 'ui.bk_issues', { n: issues.length });

  return (
    <div className="bkc">
      <div className={`bkc-summary2 is-${level}`}>
        <Ring ok={fine.length} total={result.checks.length} level={level} />
        <div className="bkc-summary-text">
          <strong>{headline.replace(/\.$/, '')}</strong>
          <span>{issues.length === 0 ? t('ui.bk_all_ok_text') : t('ui.bk_checks_ok', { ok: fine.length, total: result.checks.length })}</span>
        </div>
      </div>

      {issues.map(c => <IssueCard key={c.id} check={c} onOpenVerification={onOpenVerification} onNavigate={onNavigate} />)}

      {fine.length > 0 && <FineList fine={fine} />}
      <p className="bkc-foot"><Info size={14} aria-hidden="true" />{t('ui.bk_footer')}</p>
    </div>
  );
}

// Raden överst i Verifikationer (2026-11-21). Kontroll är ingen egen flik,
// den visar läget på en rad och fäller ut kontrollen när man vill se mer.
export function BookkeepingCheckBar(props) {
  const { verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt } = props;
  const [open, setOpen] = useState(false);
  const result = useMemo(
    () => runBookkeepingCheck({ verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt }),
    [verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt],
  );
  const issues = result.checks.filter(c => c.level !== 'ok').length;
  const level = result.errors ? 'error' : result.warnings ? 'warn' : 'ok';
  const { Icon, color } = LEVEL[level];
  const label = issues === 0 ? t('ui.bk_bar_ok') : t(issues === 1 ? 'ui.bk_bar_one' : 'ui.bk_bar_many', { n: issues });
  return (
    <div className="bkc-bar" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="bkc-bar-btn"
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13.5, color: 'var(--text-main)' }}
      >
        <Icon size={16} style={{ color, flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontWeight: 600 }}>{t('ui.bk_tab')}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
          {open ? t('ui.bk_hide') : t('ui.bk_bar_show')}
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
      </button>
      {open && (
        <div className="bkc-bar-body" style={{ padding: '4px 20px 18px' }}>
          <BookkeepingCheck {...props} />
        </div>
      )}
    </div>
  );
}

// Datorn (2026-11-21): en liten knapp i sidhuvudet bredvid Nästa, och
// kontrollen öppnas i en panel från höger. Listan flyttas inte ner. På
// telefonen används raden ovan (BookkeepingCheckBar) i stället.
export function BookkeepingCheckButton(props) {
  const { verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt, onOpenVerification, onNavigate } = props;
  const [open, setOpen] = useState(false);
  const result = useMemo(
    () => runBookkeepingCheck({ verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt }),
    [verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt],
  );
  const issues = result.checks.filter(c => c.level !== 'ok').length;
  const level = result.errors ? 'error' : result.warnings ? 'warn' : 'ok';
  const { Icon, color } = LEVEL[level];
  const title = issues === 0 ? t('ui.bk_bar_ok') : t(issues === 1 ? 'ui.bk_bar_one' : 'ui.bk_bar_many', { n: issues });
  return (
    <>
      <button
        type="button"
        className="bkc-head-btn"
        onClick={() => setOpen(true)}
        title={`${t('ui.bk_tab')}: ${title}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <Icon size={15} style={{ color }} aria-hidden="true" />
        {t('ui.bk_tab')}
        {issues > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: color, color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{issues}</span>}
      </button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title={t('ui.bk_title')} width="600px">
        <BookkeepingCheck
          {...props}
          onOpenVerification={(id) => { setOpen(false); onOpenVerification?.(id); }}
          onNavigate={(tab) => { setOpen(false); onNavigate?.(tab); }}
        />
      </Drawer>
    </>
  );
}
