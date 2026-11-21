import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from './icons';
import { Panel } from './shared/Workspace';
import { runBookkeepingCheck } from '../utils/bookkeepingCheck';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import './workspace.css';

// Kontrollera bokföringen (2026-11-21), fliken under Bokföring. Logiken och
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
      return { title: k('title'), text: k('text', { booked: fmtKr(c.booked), expected: fmtKr(c.expected), n: c.openCount, diff: fmtKr(Math.abs(c.diff)) }) };
    case 'negative_money':
      return { title: k('title'), text: k('text', { list: c.items.map(i => `${i.account} ${fmtKr(i.amount)}`).join(', ') }) };
    default:
      return { title: k('title', { n: c.count }), text: k('text', { n: c.count }) };
  }
}

function CheckRow({ check, onOpenVerification, onNavigate }) {
  const [open, setOpen] = useState(check.level === 'error');
  const { Icon, color, bg } = LEVEL[check.level];
  const { title, text } = describe(check);
  const hasItems = check.level !== 'ok' && check.items.some(i => i.verificationId || i.date);
  const target = check.level !== 'ok' ? TARGET[check.id] : null;
  return (
    <div className="bkc-row" style={{ borderTop: '1px solid var(--border-light)', padding: '14px 0' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 999, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 650, color: 'var(--text-main)', fontSize: 14.5 }}>{title}</div>
          {text && <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5, maxWidth: 680 }}>{text}</p>}
          {(hasItems || target) && (
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              {hasItems && (
                <button type="button" onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  {open ? t('ui.bk_hide') : t('ui.bk_show', { n: Math.min(check.count, check.items.length) })}
                </button>
              )}
              {target && (
                <button type="button" onClick={() => onNavigate?.(target)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {t(`ui.bk_go_${target}`)}
                </button>
              )}
            </div>
          )}
          {open && hasItems && (
            <div style={{ marginTop: 10, border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
              {check.items.map((i, idx) => (
                <button
                  key={`${i.verificationId || i.date}-${idx}`}
                  type="button"
                  disabled={!i.verificationId}
                  onClick={() => i.verificationId && onOpenVerification?.(i.verificationId)}
                  style={{ display: 'grid', gridTemplateColumns: '64px 92px 1fr auto', gap: 10, width: '100%', textAlign: 'left', padding: '9px 12px', background: idx % 2 ? 'transparent' : 'var(--bg-subtle, transparent)', border: 'none', borderTop: idx ? '1px solid var(--border-light)' : 'none', cursor: i.verificationId ? 'pointer' : 'default', fontSize: 13, color: 'var(--text-main)' }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{i.ver || ''}</span>
                  <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{i.date}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.others ? `${i.text} (${i.others.join(', ')})` : i.text}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{i.amount != null ? fmtKr(i.amount) : ''}</span>
                </button>
              ))}
              {check.count > check.items.length && (
                <div style={{ padding: '8px 12px', fontSize: 12.5, color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)' }}>{t('ui.bk_more', { n: check.count - check.items.length })}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookkeepingCheck({ verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt, onOpenVerification, onNavigate }) {
  const result = useMemo(
    () => runBookkeepingCheck({ verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt }),
    [verifications, invoices, expenses, vatPeriods, bankTransactions, vatExempt],
  );
  const issues = result.checks.filter(c => c.level !== 'ok');
  const fine = result.checks.filter(c => c.level === 'ok');
  const summary = issues.length === 0
    ? t('ui.bk_all_ok')
    : t(issues.length === 1 ? 'ui.bk_issues_one' : 'ui.bk_issues', { n: issues.length });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Panel title={t('ui.bk_title')} sub={summary}>
        <div style={{ padding: '0 2px' }}>
          {issues.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, margin: '0 0 6px' }}>{t('ui.bk_all_ok_text')}</p>
          )}
          {issues.map(c => <CheckRow key={c.id} check={c} onOpenVerification={onOpenVerification} onNavigate={onNavigate} />)}
        </div>
      </Panel>
      {fine.length > 0 && (
        <Panel title={t('ui.bk_fine_title')}>
          <div style={{ padding: '0 2px' }}>
            {fine.map(c => <CheckRow key={c.id} check={c} />)}
          </div>
        </Panel>
      )}
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 4px', maxWidth: 680 }}>{t('ui.bk_footer')}</p>
    </div>
  );
}
