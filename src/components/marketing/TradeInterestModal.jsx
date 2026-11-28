import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../../utils/brandColors';
import { SERIF, INK, INK_SOFT, CARD_BORDER } from './marketingTokens';
import { Check, X } from '../icons';
import Turnstile from '../Turnstile';

// Intresseanmälan för Handel som ett fönster på prissidan (2026-11-28).
// Skickas som ett kontaktmeddelande (api/contact.js) med ämnet "Intresse:
// Handel", så den hamnar i inkorgen och i /internal.

const CHANNELS = ['Butik', 'E-handel', 'Butik och e-handel', 'Grossist eller annat'];
const ARTICLES = ['Under 100', '100–1 000', 'Över 1 000', 'Vet inte än'];
const EMPTY = { company: '', orgNr: '', firstName: '', lastName: '', email: '', phone: '', channel: '', articles: '', system: '', message: '' };

export default function TradeInterestModal({ open, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [more, setMore] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');
  const captchaRef = useRef(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const firstRef = useRef(null);
  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => firstRef.current?.focus(), 50);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      let captchaToken = null;
      try { captchaToken = await captchaRef.current?.execute(); } catch { throw new Error('Säkerhetskontrollen blev inte klar. Ladda om sidan och försök igen.'); }
      const name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      const lines = [
        'Intresseanmälan för Handel',
        `Företag: ${form.company.trim()}`,
        form.orgNr.trim() && `Org.nr: ${form.orgNr.trim()}`,
        `Namn: ${name}`,
        `E-post: ${form.email.trim()}`,
        form.phone.trim() && `Telefon: ${form.phone.trim()}`,
        form.channel && `Säljer via: ${form.channel}`,
        form.articles && `Antal artiklar: ${form.articles}`,
        form.system.trim() && `Program i dag: ${form.system.trim()}`,
        form.message.trim() && `\nMeddelande:\n${form.message.trim()}`,
      ].filter(Boolean).join('\n');
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: form.email.trim(), topic: 'Intresse: Handel', message: lines, captchaToken: captchaToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte skicka anmälan.');
      setStatus('sent');
      setForm(EMPTY);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Något gick fel. Försök igen om en stund.');
    } finally {
      setCaptchaRound(r => r + 1);
    }
  }

  const input = (id, label, props = {}, optional = false, ref = null) => (
    <label className="tim-field">
      <span className="tim-label">{label}{optional && <em> (valfritt)</em>}</span>
      <input ref={ref} className="tim-input" name={id} value={form[id]} onChange={e => update(id, e.target.value)} required={!optional} {...props} />
    </label>
  );
  const chips = (id, label, list) => (
    <div className="tim-field">
      <span className="tim-label">{label}<em> (valfritt)</em></span>
      <div className="tim-chips" role="radiogroup" aria-label={label}>
        {list.map(v => (
          <button key={v} type="button" role="radio" aria-checked={form[id] === v} className={form[id] === v ? 'on' : undefined} onClick={() => update(id, form[id] === v ? '' : v)}>{v}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="tim-overlay" role="dialog" aria-modal="true" aria-labelledby="tim-title" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        .tim-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(8, 18, 12, .55); backdrop-filter: blur(4px); animation: tim-fade .18s ease; }
        .tim-sheet { position: relative; width: 100%; max-width: 560px; max-height: calc(100vh - 40px); overflow-y: auto; border-radius: 22px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); box-shadow: 0 30px 80px rgba(0, 0, 0, .35); padding: clamp(22px, 4vw, 34px); animation: tim-rise .22s cubic-bezier(.2, .8, .2, 1); }
        @keyframes tim-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tim-rise { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .tim-overlay, .tim-sheet { animation: none; } }
        .tim-x { position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; border-radius: 50%; border: 0; background: transparent; color: ${INK_SOFT}; display: grid; place-items: center; cursor: pointer; }
        .tim-x:hover { background: rgba(127, 127, 127, .14); }
        .tim-title { font-family: ${SERIF}; font-size: clamp(24px, 3.4vw, 30px); font-weight: 700; letter-spacing: -.02em; color: ${INK}; margin: 0 40px 6px 0; line-height: 1.15; }
        .tim-lead { font-size: 15px; color: ${INK_SOFT}; line-height: 1.55; margin: 0 0 20px; }
        .tim-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .tim-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
        .tim-grid .tim-field { margin-bottom: 0; }
        .tim-label { font-size: 13.5px; font-weight: 650; color: ${INK}; }
        .tim-label em { font-style: normal; font-weight: 400; color: var(--mkt-muted); }
        .tim-input { width: 100%; box-sizing: border-box; padding: 11px 13px; font: 15px inherit; font-family: inherit; color: ${INK}; background: var(--mkt-page-bg); border: 1.5px solid ${CARD_BORDER}; border-radius: 11px; outline: none; transition: border-color .15s ease; }
        .tim-input:focus { border-color: ${BRAND.green}; }
        textarea.tim-input { resize: vertical; min-height: 80px; }
        .tim-chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .tim-chips button { padding: 8px 13px; border-radius: 999px; border: 1.5px solid ${CARD_BORDER}; background: transparent; color: ${INK}; font: 600 13.5px inherit; font-family: inherit; cursor: pointer; }
        .tim-chips button.on { border-color: ${BRAND.green}; background: color-mix(in srgb, ${BRAND.green} 12%, transparent); color: var(--mkt-accent-green-fg, ${BRAND.green}); }
        .tim-more { display: inline-flex; align-items: center; gap: 6px; margin: 4px 0 14px; padding: 0; border: 0; background: none; color: var(--mkt-accent-green-fg, ${BRAND.green}); font: 650 14px inherit; font-family: inherit; cursor: pointer; }
        .tim-submit { width: 100%; margin-top: 6px; padding: 14px; border: 0; border-radius: 12px; background: ${BRAND.green}; color: #fff; font: 700 15.5px inherit; font-family: inherit; cursor: pointer; }
        .tim-submit:disabled { opacity: .6; cursor: default; }
        .tim-small { font-size: 12.5px; color: var(--mkt-muted); text-align: center; margin: 12px 0 0; }
        .tim-small a { color: inherit; }
        .tim-err { font-size: 14px; color: ${BRAND.redText}; margin: 0 0 12px; }
        .tim-done { text-align: center; padding: 10px 0 4px; }
        .tim-done-ic { width: 56px; height: 56px; margin: 0 auto 14px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, ${BRAND.green} 14%, transparent); color: ${BRAND.green}; }
        @media (max-width: 520px) { .tim-grid { grid-template-columns: 1fr; } .tim-overlay { align-items: flex-end; padding: 0; } .tim-sheet { border-radius: 22px 22px 0 0; max-height: 92vh; } }
      `}</style>
      <div className="tim-sheet">
        <button type="button" className="tim-x" onClick={onClose} aria-label="Stäng"><X size={18} /></button>
        {status === 'sent' ? (
          <div className="tim-done">
            <div className="tim-done-ic"><Check size={26} strokeWidth={3} /></div>
            <h2 id="tim-title" className="tim-title" style={{ margin: '0 0 8px' }}>Tack, du står på listan</h2>
            <p className="tim-lead" style={{ margin: '0 0 20px' }}>Vi hör av oss när Handel släpps. Vill du komma igång med bokföringen redan nu går det bra, du byter till Handel när den finns.</p>
            <button type="button" className="tim-submit" onClick={onClose}>Klart</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 id="tim-title" className="tim-title">Anmäl intresse för Handel</h2>
            <p className="tim-lead">Order, lager och inköp i samma app som bokföringen. Lämna dina uppgifter så hör vi av oss när Handel släpps.</p>
            <div className="tim-grid">
              {input('company', 'Företagets namn', { autoComplete: 'organization' }, false, firstRef)}
              {input('email', 'E-post', { type: 'email', autoComplete: 'email' })}
            </div>
            <div className="tim-grid">
              {input('firstName', 'Förnamn', { autoComplete: 'given-name' })}
              {input('lastName', 'Efternamn', { autoComplete: 'family-name' })}
            </div>
            {!more ? (
              <button type="button" className="tim-more" onClick={() => setMore(true)}>+ Berätta mer om er (valfritt)</button>
            ) : (
              <>
                <div className="tim-grid">
                  {input('phone', 'Telefon', { type: 'tel', autoComplete: 'tel' }, true)}
                  {input('orgNr', 'Org.nr', { inputMode: 'numeric' }, true)}
                </div>
                {chips('channel', 'Var säljer ni?', CHANNELS)}
                {chips('articles', 'Ungefär hur många artiklar?', ARTICLES)}
                {input('system', 'Program ni använder i dag', { placeholder: 't.ex. Fortnox, Shopify, Excel' }, true)}
                <label className="tim-field">
                  <span className="tim-label">Något mer vi borde veta?<em> (valfritt)</em></span>
                  <textarea className="tim-input" rows={3} value={form.message} onChange={e => update('message', e.target.value)} />
                </label>
              </>
            )}
            {status === 'error' && <p role="alert" className="tim-err">{errorMsg}</p>}
            <Turnstile key={captchaRound} ref={captchaRef} onDemand />
            <button type="submit" className="tim-submit" disabled={status === 'sending'}>{status === 'sending' ? 'Skickar …' : 'Anmäl intresse'}</button>
            <p className="tim-small">Vi använder uppgifterna bara för att höra av oss om Handel. <Link to="/privacy">Integritetspolicy</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
