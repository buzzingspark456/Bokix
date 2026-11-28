import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Lock, X, CreditCard } from './icons';
import { fetchPaymentIssue, retrySubscriptionPayment, openBillingPortal } from '../stripeApi';
import { t } from '../i18n';
import { CardChangeForm, inAppCardChange } from './BillingCard';

// Misslyckad betalning för Bokix-abonnemanget (2026-11-27).
// - PaymentBanner: en kort röd påminnelse överst. Försök igen tar en till
//   Inställningar → Prenumeration, krysset påminner i morgon igen.
// - PaymentFixCard: kortet på prenumerationssidan, där man gör försöket:
//   vad som hände, Försök igen (drar kortet direkt) och Byt kort (Stripes portal).
// Själva spärren ligger i databasen och servern (src/utils/paymentAccess.js).

const fmtLong = (ms) => (ms ? new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long' }).format(new Date(ms)) : '');
const fmtShort = (ms) => (ms ? new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(ms)) : '');
const BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro' };

const isFailing = (access) => Boolean(access?.failing || access?.level === 'read');

export default function PaymentBanner({ access, companyId = null, shared = false, onOpen }) {
  const today = new Date().toISOString().slice(0, 10);
  const snoozeKey = `bokix.payBanner.snooze.${companyId || 'default'}`;
  const [snoozed, setSnoozed] = useState(() => { try { return localStorage.getItem(snoozeKey) === today; } catch { return false; } });
  const snooze = () => { setSnoozed(true); try { localStorage.setItem(snoozeKey, today); } catch { /* privat läge */ } };

  if (!isFailing(access) || snoozed) return null;
  const readOnly = access.level === 'read';

  if (shared) {
    return (
      <div className="pay-banner is-read" role="status">
        <span className="pay-banner-ico" aria-hidden="true"><Lock size={14} /></span>
        <span className="pay-banner-text"><b>{t('payBanner.sharedTitle')}</b></span>
        <span className="pay-banner-actions">
          <button type="button" className="pay-banner-x" onClick={snooze} title={t('payBanner.snooze')} aria-label={t('payBanner.snooze')}><X size={14} /></button>
        </span>
      </div>
    );
  }

  const note = readOnly
    ? t('payBanner.readShort', { date: fmtShort(access.lockAt) })
    : (access.readOnlyAt ? t('payBanner.readOnlyShort', { date: fmtShort(access.readOnlyAt) }) : '');
  return (
    <div className={`pay-banner${readOnly ? ' is-read' : ''}`} role="alert">
      <span className="pay-banner-ico" aria-hidden="true">{readOnly ? <Lock size={14} /> : <AlertTriangle size={14} />}</span>
      <span className="pay-banner-text">
        <b>{readOnly ? t('payBanner.readTitle') : t('payBanner.failedTitle')}</b>
        {note && <span>{note}</span>}
      </span>
      <span className="pay-banner-actions">
        <button type="button" className="pay-banner-btn is-primary" onClick={onOpen}>{t('payBanner.retry')}</button>
        <button type="button" className="pay-banner-x" onClick={snooze} title={t('payBanner.snooze')} aria-label={t('payBanner.snooze')}><X size={14} /></button>
      </span>
    </div>
  );
}

export function PaymentFixCard({ access, companyId = null, onPaid }) {
  const [issue, setIssue] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'error'|'ok', text }
  const [changing, setChanging] = useState(false);
  const failing = isFailing(access);
  useEffect(() => {
    if (!failing) return undefined;
    let alive = true;
    fetchPaymentIssue(companyId).then(r => {
      if (!alive) return;
      setIssue(r || null);
      // Betalt enligt Stripe (servern har redan rättat databasen): läs om läget,
      // så försvinner rutan, notisen och den röda pricken.
      if (r && ['active', 'trialing'].includes(r.status)) onPaid?.();
    }).catch(() => {});
    return () => { alive = false; };
  }, [failing, companyId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (message?.tone !== 'ok') return undefined;
    const id = setTimeout(() => setHidden(true), 4000);
    return () => clearTimeout(id);
  }, [message]);
  if (hidden) return null;
  if (issue && ['active', 'trialing'].includes(issue.status) && message?.tone !== 'ok') return null;
  if (!failing && message?.tone !== 'ok') return null;

  const info = issue?.issue || null;
  const card = issue?.card || null;
  const requiresAction = Boolean(info?.requiresAction);
  const readOnly = access?.level === 'read';
  const cardText = card ? `${BRANDS[card.brand] || card.brand || ''} •••• ${card.last4}`.trim() : null;

  const retry = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await retrySubscriptionPayment(companyId);
      if (r?.ok) {
        setMessage({ tone: 'ok', text: t('payBanner.paid') });
        onPaid?.();
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
    setMessage(null);
    // Byt kort direkt här när Stripes kortfält finns, annars Stripes portal.
    if (inAppCardChange) { setChanging(true); return; }
    setBusy(true);
    try {
      window.location.href = await openBillingPortal(companyId);
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
      setBusy(false);
    }
  };

  if (message?.tone === 'ok') {
    return (
      <div className="pay-fix is-ok" role="status">
        <span className="pay-fix-ico"><Check size={18} /></span>
        <div className="pay-fix-body"><b>{message.text}</b></div>
      </div>
    );
  }

  const reason = info?.declineReason || null;
  const title = readOnly ? t('payBanner.readTitle') : requiresAction ? t('payBanner.actionTitle') : t('payBanner.failedTitle');
  const lead = readOnly ? t('payBanner.leadRead') : requiresAction ? t('payBanner.actionText')
    : access.readOnlyAt ? t('payBanner.leadFailedUntil', { date: fmtLong(access.readOnlyAt) }) : t('payBanner.leadFailed');

  return (
    <section className="pay-fix" role="alert">
      <header className="pay-fix-head">
        <span className="pay-fix-ico">{readOnly ? <Lock size={18} /> : <AlertTriangle size={18} />}</span>
        <div className="pay-fix-titles">
          <h3>{title}</h3>
          <p>{lead}</p>
        </div>
      </header>

      {(cardText || reason) && (
        <div className="pay-fix-reason">
          <CreditCard size={15} />
          <span>{cardText && <b>{cardText}</b>}{cardText && reason ? ' · ' : ''}{reason}</span>
        </div>
      )}

      {message?.tone === 'error' && <div className="pay-fix-err">{message.text}</div>}

      {changing ? (
        <CardChangeForm
          companyId={companyId}
          payNow
          onCancel={() => setChanging(false)}
          onDone={(r) => {
            setChanging(false);
            if (r?.paid) { setMessage({ tone: 'ok', text: t('payBanner.paid') }); onPaid?.(); }
            else setMessage({ tone: 'error', text: r?.payError ? t('billingCard.savedButDeclined', { reason: r.payError }) : t('billingCard.saved') });
          }}
        />
      ) : (
        <div className="pay-fix-actions">
          {requiresAction && info?.hostedUrl
            ? <a className="pay-fix-btn is-primary" href={info.hostedUrl}>{t('payBanner.confirm')}</a>
            : <button type="button" className="pay-fix-btn is-primary" onClick={retry} disabled={busy}>{busy ? t('payBanner.trying') : t('payBanner.retry')}</button>}
          <button type="button" className="pay-fix-btn" onClick={changeCard} disabled={busy}>{t('payBanner.changeCard')}</button>
          <span className="pay-fix-note"><Lock size={12} /> {t('billingCard.secure')}</span>
        </div>
      )}
    </section>
  );
}
