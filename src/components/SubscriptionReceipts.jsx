import React, { useEffect, useState } from 'react';
import { Download, ChevronRight, X, ExternalLink } from './icons';
import { getSubscriptionInvoices } from '../stripeApi';
import BokixWordmark from './shared/BokixWordmark';
import { t, getLanguage } from '../i18n';

// Kvitton för Bokix-abonnemanget (2026-11-27): listan syns direkt, och ett
// klick öppnar kvittot i appen (logga, nummer, period, rader, summa och
// status) med Ladda ner PDF. Ett namn, Kvitton, i stället för fakturor och kvitton.

const SHOWN = 6;
const money = (ore, currency = 'sek') => new Intl.NumberFormat(getLanguage() === 'en' ? 'en-GB' : 'sv-SE', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: ore % 100 ? 2 : 0 }).format((ore || 0) / 100);
const day = (sec) => (sec ? new Date(sec * 1000).toLocaleDateString(getLanguage() === 'en' ? 'en-GB' : 'sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const monthLabel = (sec) => {
  const s = new Date(sec * 1000).toLocaleDateString(getLanguage() === 'en' ? 'en-GB' : 'sv-SE', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function ReceiptView({ inv, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const paid = inv.status === 'paid';
  const total = paid ? inv.amount_paid : inv.amount_due;
  // Rabatt (kampanjkod) och tillgodo som drogs av, så att raderna går ihop med det som betalades.
  const discount = inv.subtotal != null && inv.total != null ? Math.max(0, inv.subtotal - inv.total) : 0;
  const credit = inv.total != null ? Math.max(0, inv.total - inv.amount_due) : 0;
  return (
    <div className="sr-overlay" role="dialog" aria-modal="true" aria-label={t('receipts.receipt')} onClick={onClose}>
      <div className="sr-sheet" onClick={e => e.stopPropagation()}>
        <button type="button" className="sr-x" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        <div className="sr-paper">
          <div className="sr-top">
            <BokixWordmark height={26} />
            <span className={`sr-stamp${paid ? ' is-paid' : ''}`}>{paid ? t('receipts.paid') : t('receipts.unpaid')}</span>
          </div>
          <h3 className="sr-h">{t('receipts.receipt')}{inv.number ? ` ${inv.number}` : ''}</h3>
          <dl className="sr-meta">
            <div><dt>{t('receipts.date')}</dt><dd>{day(inv.paid_at || inv.created)}</dd></div>
            {inv.period_start && inv.period_end && <div><dt>{t('receipts.period')}</dt><dd>{day(inv.period_start)} – {day(inv.period_end)}</dd></div>}
          </dl>
          <ul className="sr-lines">
            {(inv.lines?.length ? inv.lines : [{ description: t('receipts.subscription'), amount: total }]).map((l, i) => (
              <li key={i}><span>{l.description || t('receipts.subscription')}</span><b>{money(l.amount, inv.currency)}</b></li>
            ))}
          </ul>
          {discount > 0 && <div className="sr-sub"><span>{t('receipts.discount')}</span><span>−{money(discount, inv.currency)}</span></div>}
          {credit > 0 && <div className="sr-sub"><span>{t('receipts.credit')}</span><span>−{money(credit, inv.currency)}</span></div>}
          <div className="sr-total"><span>{paid ? t('receipts.totalPaid') : t('receipts.totalDue')}</span><b>{money(total, inv.currency)}</b></div>
          <p className="sr-note">{t('receipts.noVat')}</p>
        </div>
        <div className="sr-actions">
          {inv.invoice_pdf && <a className="sr-btn is-primary" href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer"><Download size={15} /> {t('receipts.downloadPdf')}</a>}
          {inv.hosted_invoice_url && <a className="sr-btn" href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> {paid ? t('receipts.openStripe') : t('receipts.payStripe')}</a>}
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionReceipts({ companyId, enabled = true }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    setList(null); setError(''); setAll(false);
    if (!enabled) { setList([]); return undefined; }
    getSubscriptionInvoices(companyId)
      .then(r => { if (alive) setList(r || []); })
      .catch(err => { if (alive) { setError(err.message || t('receipts.loadFailed')); setList([]); } });
    return () => { alive = false; };
  }, [companyId, enabled]);

  const shown = all ? (list || []) : (list || []).slice(0, SHOWN);
  return (
    <div className="sr">
      <div className="sr-head">
        <h4>{t('receipts.title')}</h4>
        {list && list.length > 0 && <span>{t('receipts.count', { n: list.length })}</span>}
      </div>
      {list === null && <div className="sr-skel" aria-busy="true"><i /><i /><i /></div>}
      {error && <div className="sr-err">{error}</div>}
      {list && !error && list.length === 0 && <div className="sr-empty">{t('receipts.empty')}</div>}
      {list && list.length > 0 && (
        <ul className="sr-list">
          {shown.map(inv => {
            const paid = inv.status === 'paid';
            return (
              <li key={inv.id}>
                <button type="button" className="sr-row" onClick={() => setOpen(inv)}>
                  <span className="sr-row-main">
                    <b>{monthLabel(inv.created)}</b>
                    <small>{day(inv.paid_at || inv.created)}{inv.number ? ` · ${inv.number}` : ''}</small>
                  </span>
                  <span className={`sr-pill${paid ? ' is-paid' : ''}`}>{paid ? t('receipts.paid') : t('receipts.unpaid')}</span>
                  <span className="sr-row-amt">{money(paid ? inv.amount_paid : inv.amount_due, inv.currency)}</span>
                  <ChevronRight size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list && list.length > SHOWN && !all && <button type="button" className="sr-more" onClick={() => setAll(true)}>{t('receipts.showAll', { n: list.length })}</button>}
      {open && <ReceiptView inv={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
