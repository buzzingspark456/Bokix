import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, CARD_BORDER } from './marketingTokens';
import { PageMeta } from '../../utils/seo';
import Turnstile from '../Turnstile';

// Intresseanmälan för Handel (2026-11-28): en kort sida med det vi behöver
// för att höra av oss när Handel släpps. Skickas som ett kontaktmeddelande
// (api/contact.js) med ämnet "Intresse: Handel", så den hamnar i inkorgen
// och i /internal precis som andra meddelanden.

const CHANNELS = ['Butik', 'E-handel', 'Butik och e-handel', 'Grossist eller annat'];
const ARTICLES = ['Under 100', '100–1 000', 'Över 1 000', 'Vet inte än'];

const inputStyle = {
  display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '15px',
  border: `1.5px solid ${CARD_BORDER}`, borderRadius: '10px', background: 'var(--mkt-card-bg)', color: INK,
  fontFamily: 'inherit', outline: 'none',
};
const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 600, color: INK, marginBottom: '7px' };
const opt = { fontWeight: 400, color: 'var(--mkt-muted)' };

export default function TradeInterestPage() {
  const empty = { company: '', orgNr: '', firstName: '', lastName: '', email: '', phone: '', channel: '', articles: '', system: '', message: '' };
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');
  const captchaRef = useRef(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      let captchaToken = null;
      try { captchaToken = await captchaRef.current?.execute(); } catch { throw new Error('Säkerhetskontrollen blev inte klar. Ladda om sidan och försök igen.'); }
      const lines = [
        'Intresseanmälan för Handel',
        `Företag: ${form.company.trim()}`,
        form.orgNr.trim() && `Org.nr: ${form.orgNr.trim()}`,
        `Namn: ${form.firstName.trim()} ${form.lastName.trim()}`,
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
        body: JSON.stringify({ name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(), email: form.email.trim(), topic: 'Intresse: Handel', message: lines, captchaToken: captchaToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte skicka anmälan.');
      setStatus('sent');
      setForm(empty);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Något gick fel. Försök igen om en stund.');
    } finally {
      setCaptchaRound(r => r + 1);
    }
  }

  const field = (id, label, props = {}, optional = false) => (
    <div>
      <label style={labelStyle} htmlFor={`ti-${id}`}>{label}{optional && <span style={opt}> (valfritt)</span>}</label>
      <input id={`ti-${id}`} name={id} className="ti-input" style={inputStyle} value={form[id]} onChange={e => update(id, e.target.value)} required={!optional} {...props} />
    </div>
  );
  const choices = (id, label, list) => (
    <div style={{ marginBottom: '18px' }}>
      <span style={labelStyle}>{label}</span>
      <div className="ti-chips" role="radiogroup" aria-label={label}>
        {list.map(v => (
          <button key={v} type="button" role="radio" aria-checked={form[id] === v} className={form[id] === v ? 'on' : undefined} onClick={() => update(id, form[id] === v ? '' : v)}>{v}</button>
        ))}
      </div>
    </div>
  );

  return (
    <MarketingLayout>
      <PageMeta title="Handel kommer snart: anmäl intresse | Bokix" description="Order, lager, inköp och prissättning i samma app som bokföringen. Anmäl intresse så hör vi av oss när Handel släpps." path="/handel-intresse" noindex />
      <style>{`
        .ti-wrap { max-width: 640px; margin: 0 auto; }
        .ti-input:focus { border-color: ${INK} !important; }
        .ti-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
        .ti-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .ti-chips button { padding: 9px 14px; border-radius: 999px; border: 1.5px solid ${CARD_BORDER}; background: var(--mkt-card-bg); color: ${INK}; font: 600 14px inherit; font-family: inherit; cursor: pointer; }
        .ti-chips button.on { border-color: ${BRAND.green}; background: color-mix(in srgb, ${BRAND.green} 12%, transparent); color: var(--mkt-accent-green-fg, ${BRAND.green}); }
        .ti-list { list-style: none; padding: 0; margin: 22px 0 0; display: grid; gap: 8px; text-align: left; }
        .ti-list li { display: flex; gap: 10px; font-size: 15px; color: ${INK_SOFT}; }
        .ti-list li::before { content: ''; flex-shrink: 0; width: 8px; height: 8px; margin-top: 7px; border-radius: 50%; background: ${BRAND.green}; }
        .ti-submit:disabled { opacity: .6; cursor: not-allowed; }
        @media (max-width: 560px) { .ti-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section style={{ padding: '140px 24px 40px', background: 'var(--mkt-page-bg)' }}>
        <Reveal className="ti-wrap" style={{ textAlign: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: `color-mix(in srgb, ${BRAND.green} 12%, transparent)`, color: 'var(--mkt-accent-green-fg)', fontSize: 13, fontWeight: 700 }}>Kommer snart</span>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(34px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '14px 0 0', lineHeight: 1.12 }}>Handel</h1>
          <p style={{ fontSize: 17, color: INK_SOFT, lineHeight: 1.6, margin: '14px 0 0' }}>För dig som säljer varor. Allt i Team, och order, lager och inköp i samma app som bokföringen. 349 kr/mån.</p>
          <ul className="ti-list" style={{ maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            <li>Order, delleverans och restorder</li>
            <li>Artiklar och lager som dras automatiskt</li>
            <li>Inköpsorder till leverantörer</li>
            <li>Prissättning med marginalmål</li>
            <li>Orderbekräftelse och följesedel</li>
          </ul>
        </Reveal>
      </section>

      <section style={{ padding: '24px 24px 110px', background: 'var(--mkt-page-bg)' }}>
        <div className="ti-wrap">
          {status === 'sent' ? (
            <div style={{ textAlign: 'center', padding: '28px', border: `1px solid ${CARD_BORDER}`, borderRadius: 16, background: 'var(--mkt-card-bg)' }}>
              <h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: INK, margin: '0 0 10px' }}>Tack, du står på listan</h2>
              <p style={{ fontSize: 15, color: INK_SOFT, lineHeight: 1.65, margin: '0 0 18px' }}>Vi hör av oss till din e-post när Handel släpps. Vill du börja med bokföringen redan nu går det bra, du byter till Handel när den finns.</p>
              <Link to="/priser" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>Se priserna</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: 'clamp(20px, 4vw, 32px)', border: `1px solid ${CARD_BORDER}`, borderRadius: 18, background: 'var(--mkt-card-bg)' }}>
              <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: '0 0 18px' }}>Anmäl intresse</h2>
              <div className="ti-grid">
                {field('company', 'Företagets namn', { autoComplete: 'organization' })}
                {field('orgNr', 'Org.nr', { inputMode: 'numeric' }, true)}
              </div>
              <div className="ti-grid">
                {field('firstName', 'Förnamn', { autoComplete: 'given-name' })}
                {field('lastName', 'Efternamn', { autoComplete: 'family-name' })}
              </div>
              <div className="ti-grid">
                {field('email', 'E-post', { type: 'email', autoComplete: 'email' })}
                {field('phone', 'Telefon', { type: 'tel', autoComplete: 'tel' }, true)}
              </div>
              {choices('channel', 'Var säljer ni?', CHANNELS)}
              {choices('articles', 'Ungefär hur många artiklar?', ARTICLES)}
              <div style={{ marginBottom: 18 }}>
                {field('system', 'Vilket program använder ni i dag?', { placeholder: 't.ex. Fortnox, Shopify, Excel' }, true)}
              </div>
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle} htmlFor="ti-message">Något mer vi borde veta?<span style={opt}> (valfritt)</span></label>
                <textarea id="ti-message" name="message" rows={4} className="ti-input" style={{ ...inputStyle, resize: 'vertical' }} value={form.message} onChange={e => update('message', e.target.value)} />
              </div>
              {status === 'error' && <p role="alert" style={{ fontSize: 14, color: BRAND.redText, margin: '0 0 18px', lineHeight: 1.55 }}>{errorMsg} Du kan också mejla <a href="mailto:support@bokix.se" style={{ color: INK, fontWeight: 600 }}>support@bokix.se</a>.</p>}
              <Turnstile key={captchaRound} ref={captchaRef} onDemand />
              <button type="submit" disabled={status === 'sending'} className="ti-submit" style={{ width: '100%', padding: '14px 28px', background: BRAND.green, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                {status === 'sending' ? 'Skickar …' : 'Anmäl intresse'}
              </button>
              <p style={{ fontSize: 12.5, color: 'var(--mkt-muted)', margin: '12px 0 0', textAlign: 'center' }}>Vi använder uppgifterna bara för att höra av oss om Handel. <Link to="/privacy" style={{ color: 'inherit' }}>Integritetspolicy</Link></p>
            </form>
          )}
        </div>
      </section>
    </MarketingLayout>
  );
}
