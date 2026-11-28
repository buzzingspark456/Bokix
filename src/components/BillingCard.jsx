import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, Check, Lock } from './icons';
import { subscriptionCardAction, openBillingPortal } from '../stripeApi';
import { t } from '../i18n';

// Betalkortet i appen (2026-11-27, efter Bokios Betalningsinställningar):
// kortet som abonnemanget dras från, och byte av kort direkt på sidan med
// Stripes eget kortfält (kortnumret når aldrig Bokix). Utan publik Stripe-
// nyckel (VITE_STRIPE_PUBLISHABLE_KEY) öppnas Stripes portal som förut.

const PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const BRAND_LABEL = { visa: 'VISA', mastercard: 'Mastercard', amex: 'AMEX', maestro: 'Maestro', discover: 'Discover' };
const BRAND_NAME = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro', discover: 'Discover' };

let stripePromise = null;
const getStripe = () => {
  if (!PK) return null;
  stripePromise ||= import('@stripe/stripe-js').then(m => m.loadStripe(PK));
  return stripePromise;
};

export const inAppCardChange = Boolean(PK);

export function CardTile({ card }) {
  if (!card) return null;
  const exp = card.expMonth && card.expYear ? `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}` : '';
  return (
    <div className={`bc-card bc-card--${card.brand || 'card'}`} aria-label={`${BRAND_NAME[card.brand] || t('billingCard.card')} •••• ${card.last4}`}>
      <div className="bc-card-top">
        <span className="bc-chip" aria-hidden="true" />
        <span className="bc-card-brand">{BRAND_LABEL[card.brand] || <CreditCard size={20} />}</span>
      </div>
      <div className="bc-card-num">•••• •••• •••• {card.last4}</div>
      <div className="bc-card-foot">
        <span>{BRAND_NAME[card.brand] || t('billingCard.card')}</span>
        {exp && <span><small>{t('billingCard.validThru')}</small> {exp}</span>}
      </div>
    </div>
  );
}

// Formuläret med Stripes kortfält. onDone({ card, paid, payError }).
export function CardChangeForm({ companyId = null, onDone, onCancel, payNow = false }) {
  const boxRef = useRef(null);
  const ctx = useRef(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [stripe, setup] = await Promise.all([getStripe(), subscriptionCardAction('card-setup', companyId)]);
        if (!alive || !stripe || !boxRef.current) return;
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const elements = stripe.elements({
          clientSecret: setup.clientSecret,
          locale: 'sv',
          appearance: {
            theme: dark ? 'night' : 'stripe',
            variables: { colorPrimary: '#0b6329', borderRadius: '10px', fontFamily: 'Inter, system-ui, sans-serif', fontSizeBase: '15px' },
          },
          fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' }],
        });
        const el = elements.create('payment', { layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } });
        el.on('ready', () => alive && setReady(true));
        el.mount(boxRef.current);
        ctx.current = { stripe, elements, el };
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => { alive = false; try { ctx.current?.el?.destroy(); } catch { /* inget */ } };
  }, [companyId]);

  const save = async () => {
    if (!ctx.current) return;
    setBusy(true);
    setError('');
    try {
      const { stripe, elements } = ctx.current;
      const { error: err, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required', confirmParams: { return_url: window.location.href } });
      if (err) throw new Error(err.message || t('billingCard.failed'));
      const r = await subscriptionCardAction('card-save', companyId, { setup_intent_id: setupIntent.id });
      onDone?.(r);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="bc-form">
      <div ref={boxRef} className="bc-element" />
      {!ready && !error && <div className="bc-wait">{t('billingCard.loading')}</div>}
      {error && <div className="bc-err">{error}</div>}
      <div className="bc-form-foot">
        <span className="bc-secure"><Lock size={12} /> {t('billingCard.secure')}</span>
        <span className="bc-form-actions">
          {onCancel && <button type="button" className="bc-btn" onClick={onCancel} disabled={busy}>{t('ui.avbryt')}</button>}
          <button type="button" className="bc-btn is-primary" onClick={save} disabled={!ready || busy}>
            {busy ? t('billingCard.saving') : payNow ? t('billingCard.saveAndPay') : t('billingCard.save')}
          </button>
        </span>
      </div>
    </div>
  );
}

// Inställningar → Prenumeration → Betalningsuppgifter.
export default function BillingCard({ companyId = null, onPaid }) {
  const [card, setCard] = useState(undefined); // undefined = laddar, null = inget kort
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    subscriptionCardAction('card-info', companyId).then(r => alive && setCard(r?.card || null)).catch(() => alive && setCard(null));
    return () => { alive = false; };
  }, [companyId]);

  const change = async () => {
    setNote(null);
    if (inAppCardChange) { setEditing(true); return; }
    setBusy(true);
    try { window.location.href = await openBillingPortal(companyId); } catch (err) { setNote({ tone: 'error', text: err.message }); setBusy(false); }
  };

  return (
    <div className="bc">
      {card === undefined
        ? <div className="bc-card bc-card--loading" aria-busy="true" />
        : card ? <CardTile card={card} /> : <div className="bc-empty">{t('billingCard.none')}</div>}
      {note && <div className={note.tone === 'error' ? 'bc-err' : 'bc-ok'}>{note.tone === 'ok' && <Check size={14} />} {note.text}</div>}
      {editing ? (
        <CardChangeForm
          companyId={companyId}
          onCancel={() => setEditing(false)}
          onDone={(r) => {
            setEditing(false);
            if (r?.card) setCard(r.card);
            setNote(r?.payError ? { tone: 'error', text: t('billingCard.savedButDeclined', { reason: r.payError }) } : { tone: 'ok', text: t('billingCard.saved') });
            if (r?.paid) onPaid?.();
          }}
        />
      ) : (
        <button type="button" className="bc-btn" onClick={change} disabled={busy}><CreditCard size={14} /> {card ? t('billingCard.change') : t('billingCard.add')}</button>
      )}
    </div>
  );
}
