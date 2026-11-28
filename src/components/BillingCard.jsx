import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, Check, Lock } from './icons';
import { subscriptionCardAction, openBillingPortal } from '../stripeApi';
import { t } from '../i18n';

// Betalkortet i appen (2026-11-27, efter Bokios Betalningsinställningar):
// kortet som abonnemanget dras från, och byte av kort direkt på sidan med
// Stripes eget kortfält (kortnumret når aldrig Bokix). Utan publik Stripe-
// nyckel (VITE_STRIPE_PUBLISHABLE_KEY) öppnas Stripes portal som förut.

const PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const BRAND_NAME = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro', discover: 'Discover' };

let stripePromise = null;
const getStripe = () => {
  if (!PK) return null;
  stripePromise ||= import('@stripe/stripe-js').then(m => m.loadStripe(PK));
  return stripePromise;
};

export const inAppCardChange = Boolean(PK);

// Chipet: guld med kontaktytor, ritat som SVG så att det ser ut som ett riktigt chip.
const CHIP = (
  <svg className="bc-chip" viewBox="0 0 40 30" aria-hidden="true">
    <defs>
      <linearGradient id="bc-chip-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6e3a1" /><stop offset=".45" stopColor="#d9b45a" /><stop offset="1" stopColor="#a8822f" />
      </linearGradient>
    </defs>
    <rect x=".5" y=".5" width="39" height="29" rx="5.5" fill="url(#bc-chip-g)" stroke="rgba(0,0,0,.25)" />
    <g fill="none" stroke="rgba(80,55,10,.55)" strokeWidth="1">
      <path d="M0 10.5h12.5M0 19.5h12.5M27.5 10.5H40M27.5 19.5H40" />
      <path d="M12.5 4.5v21M27.5 4.5v21" />
      <rect x="12.5" y="8" width="15" height="14" rx="3" />
      <path d="M20 0v8M20 22v8" />
    </g>
  </svg>
);

const LINK_MARK = (
  <span className="bc-mk-link">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#00d66f" /><path d="M10 7.5l4.5 4.5-4.5 4.5" fill="none" stroke="#0b120e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    link
  </span>
);

// Märket uppe till höger: enkla ritade märken, inte de officiella logotyperna.
function BrandMark({ brand }) {
  if (brand === 'visa') return <span className="bc-mk-visa">VISA</span>;
  if (brand === 'mastercard') return <span className="bc-mk-circles bc-mk-mc"><i /><i /></span>;
  if (brand === 'maestro') return <span className="bc-mk-circles bc-mk-maestro"><i /><i /></span>;
  if (brand === 'amex') return <span className="bc-mk-amex"><b>AMERICAN</b><b>EXPRESS</b></span>;
  if (brand === 'discover') return <span className="bc-mk-discover">DISC<b />VER</span>;
  return <span className="bc-mk-card" />;
}

// Går kortet ut denna eller nästa månad?
function expiresSoon(month, year) {
  if (!month || !year) return false;
  const now = new Date();
  const months = (Number(year) - now.getFullYear()) * 12 + (Number(month) - (now.getMonth() + 1));
  return months <= 1;
}

export function CardTile({ card }) {
  if (!card) return null;
  // Link (Stripes sparade betalning): ingen kortsiffra, bara maskerad e-post.
  if (card.brand === 'link') {
    return (
      <div className="bc-card bc-card--link" aria-label="Link">
        <div className="bc-card-top">{CHIP}<span className="bc-card-brand">{LINK_MARK}</span></div>
        <div className="bc-card-num bc-card-num--email">{t('billingCard.linkSaved')}</div>
        <div className="bc-card-foot"><span>{card.email || ''}</span><span /></div>
      </div>
    );
  }
  const exp = card.expMonth && card.expYear ? `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}` : '';
  const soon = expiresSoon(card.expMonth, card.expYear);
  const brandClass = BRAND_NAME[card.brand] ? card.brand : 'card';
  const num = card.brand === 'amex' ? `•••• •••••• •${card.last4}` : `•••• •••• •••• ${card.last4}`;
  return (
    <div className={`bc-card bc-card--${brandClass}`} aria-label={`${BRAND_NAME[card.brand] || t('billingCard.card')} •••• ${card.last4}`}>
      <div className="bc-card-top">
        {CHIP}
        <span className="bc-card-brand" aria-hidden="true"><BrandMark brand={card.brand} /></span>
      </div>
      <div className="bc-card-num">{num}</div>
      <div className="bc-card-foot">
        {card.via === 'link'
          ? <span className="bc-via">{t('billingCard.viaLink')}</span>
          : <span>{BRAND_NAME[card.brand] || t('billingCard.card')}</span>}
        {exp && <span className={soon ? 'bc-exp-warn' : undefined}><small>{soon ? t('billingCard.expiresSoon') : t('billingCard.validThru')}</small> {exp}</span>}
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
        const el = elements.create('payment', { layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never', link: 'never' } });
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
