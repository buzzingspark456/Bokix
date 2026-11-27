import React, { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Check, Lock } from './icons';
import { fetchPaymentIssue, retrySubscriptionPayment, openBillingPortal } from '../stripeApi';
import { t } from '../i18n';

// Banner när Bokix-abonnemanget inte går att dra (2026-11-27). Lugn, inte
// skrikig: en smal list överst med vad som hänt, vad som händer härnäst och
// två val, Försök igen (drar kortet direkt) och Byt kort (Stripes portal).
// Själva spärren ligger i databasen och servern (src/utils/paymentAccess.js),
// bannern är bara det kunden ser.

const fmtDay = (ms) => (ms ? new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long' }).format(new Date(ms)) : '');
const BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro' };

export default function PaymentBanner({ access, companyId = null, shared = false, onPaid }) {
  const [issue, setIssue] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'error'|'ok', text }
  const [done, setDone] = useState(false);

  const failing = access?.failing || access?.level === 'read';
  useEffect(() => {
    if (!failing || shared) return undefined;
    let alive = true;
    fetchPaymentIssue(companyId).then(r => { if (alive) setIssue(r || null); }).catch(() => {});
    return () => { alive = false; };
  }, [failing, shared, companyId]);

  if (!failing || done) return null;

  const readOnly = access.level === 'read';
  if (shared) {
    return (
      <div className="pay-banner is-read" role="status">
        <span className="pay-banner-ico"><Lock size={17} /></span>
        <div className="pay-banner-text">
          <b>{t('payBanner.sharedTitle')}</b>
          <span>{t('payBanner.sharedText')}</span>
        </div>
      </div>
    );
  }

  const info = issue?.issue || null;
  const card = issue?.card || null;
  const cardText = card ? `${BRANDS[card.brand] || card.brand || ''} •••• ${card.last4}`.trim() : null;
  const requiresAction = Boolean(info?.requiresAction);

  const retry = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await retrySubscriptionPayment(companyId);
      if (r?.ok) {
        setMessage({ tone: 'ok', text: t('payBanner.paid') });
        setTimeout(() => { setDone(true); onPaid?.(); }, 1600);
      } else if (r?.requiresAction && r?.hostedUrl) {
        window.location.href = r.hostedUrl;
      } else {
        setMessage({ tone: 'error', text: r?.reason || t('payBanner.declined') });
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const changeCard = async () => {
    setBusy(true);
    setMessage(null);
    try {
      window.location.href = await openBillingPortal(companyId);
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
      setBusy(false);
    }
  };

  const title = readOnly ? t('payBanner.readTitle') : requiresAction ? t('payBanner.actionTitle') : t('payBanner.failedTitle');
  const parts = [];
  if (cardText) parts.push(info?.declineReason ? `${cardText}: ${info.declineReason}` : cardText);
  else if (info?.declineReason) parts.push(info.declineReason);
  if (readOnly) parts.push(t('payBanner.readText', { date: fmtDay(access.lockAt) }));
  else if (requiresAction) parts.push(t('payBanner.actionText'));
  else {
    if (info?.nextAttempt) parts.push(t('payBanner.nextAttempt', { date: fmtDay(Date.parse(info.nextAttempt)) }));
    if (access.readOnlyAt) parts.push(t('payBanner.readOnlyFrom', { date: fmtDay(access.readOnlyAt) }));
  }

  return (
    <div className={`pay-banner${readOnly ? ' is-read' : ''}${message?.tone === 'ok' ? ' is-ok' : ''}`} role="alert">
      <span className="pay-banner-ico">{message?.tone === 'ok' ? <Check size={17} /> : readOnly ? <Lock size={17} /> : <AlertTriangle size={17} />}</span>
      <div className="pay-banner-text">
        <b>{message?.tone === 'ok' ? message.text : title}</b>
        {message?.tone === 'error'
          ? <span className="pay-banner-err">{message.text}</span>
          : message?.tone !== 'ok' && <span>{parts.join(' · ')}</span>}
      </div>
      {message?.tone !== 'ok' && (
        <div className="pay-banner-actions">
          {requiresAction && info?.hostedUrl
            ? <a className="pay-banner-btn is-primary" href={info.hostedUrl}>{t('payBanner.confirm')}</a>
            : <button type="button" className="pay-banner-btn is-primary" onClick={retry} disabled={busy}>{busy ? t('payBanner.trying') : t('payBanner.retry')}</button>}
          <button type="button" className="pay-banner-btn" onClick={changeCard} disabled={busy}><CreditCard size={14} /> {t('payBanner.changeCard')}</button>
        </div>
      )}
    </div>
  );
}
