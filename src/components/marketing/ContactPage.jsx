import React, { useRef, useState } from 'react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, CARD_BORDER } from './marketingTokens';
import { PageMeta } from '../../utils/seo';
import Turnstile from '../Turnstile';

// Ämnen i formuläret. `value` måste finnas i ALLOWED_TOPICS i api/contact.js,
// annars sparas meddelandet som "Övrigt". `label` är det besökaren ser.
const TOPICS = [
  { value: 'Support', label: 'Hjälp med Bokix' },
  { value: 'Felrapport', label: 'Något fungerar inte' },
  { value: 'Fakturering & pris', label: 'Prenumeration och betalning' },
  { value: 'Säkerhet & integritet', label: 'Personuppgifter och säkerhet' },
  { value: 'Övrigt', label: 'Något annat' },
];

const inputStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  fontSize: '15px',
  fontFamily: 'inherit',
  color: INK,
  background: 'var(--mkt-page-bg)',
  border: `1.5px solid ${CARD_BORDER}`,
  borderRadius: '10px',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const labelStyle = {
  display: 'block',
  fontSize: '13.5px',
  fontWeight: 600,
  color: INK,
  marginBottom: '7px',
};

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', topic: TOPICS[0].value, message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');
  const captchaRef = useRef(null);
  const [captchaRound, setCaptchaRound] = useState(0);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending') return;

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();
    // Fälten är required och formuläret har inte noValidate, så webbläsarens
    // egen valideringsbubbla stoppar submit innan den ens når hit.

    setStatus('sending');
    setErrorMsg('');
    try {
      // Cloudflare Turnstile precis innan utskicket (som bokningen): osynlig
      // kontroll, en ruta visas bara om Cloudflare vill ha ett klick.
      // Returnerar null om Turnstile inte är inställt (se Turnstile.jsx).
      let captchaToken = null;
      try { captchaToken = await captchaRef.current?.execute(); } catch { throw new Error('Säkerhetskontrollen blev inte klar. Ladda om sidan och försök igen. Har du en annonsblockerare, pausa den för bokix.se.'); }

      // Egen rutt (api/contact.js), INTE /api/email/send-invoice: den kräver
      // inloggad session, vilket en anonym besökare aldrig har. Mottagare och
      // e-postens HTML byggs på servern.
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, topic: form.topic, message, captchaToken: captchaToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte skicka meddelandet.');

      setStatus('sent');
      setForm({ name: '', email: '', topic: TOPICS[0].value, message: '' });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Något gick fel. Försök igen om en stund.');
    } finally {
      // En reCAPTCHA-token är engångsbruk; utan reset() skulle ett andra
      // försök skicka samma förbrukade token och alltid misslyckas.
      setCaptchaRound(r => r + 1);
    }
  }

  return (
    <MarketingLayout>
      <PageMeta
        title="Kontakta Bokix: support och frågor"
        description="Kontakta Bokix om support, fakturering och pris, säkerhet och integritet, eller något annat. Skriv några rader här så svarar vi på din e-post."
        path="/kontakt"
      />
      <style>{`
        .ct-wrap { max-width: 620px; margin: 0 auto; }
        .ct-a { color: ${INK}; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
        .contact-input:focus { border-color: ${INK} !important; }
        .contact-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      {/* Samma vita, lugna stil som policysidorna (kundönskemål 2026-09-29):
          inga ikoner, inga toningar, inga färgade ämnesknappar. */}
      <section style={{ padding: '140px 24px 56px', background: 'var(--mkt-page-bg)', borderBottom: '1px solid var(--mkt-border-soft)' }}>
        <Reveal style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(34px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: 0, lineHeight: 1.12 }}>
            Kontakta oss
          </h1>
        </Reveal>
      </section>

      <section style={{ padding: '48px 24px 110px', background: 'var(--mkt-page-bg)' }}>
        <div className="ct-wrap">
          <div>
            {status === 'sent' ? (
              <div>
                <h2 style={{ fontFamily: SERIF, fontSize: '24px', fontWeight: 700, color: INK, margin: '0 0 10px' }}>Tack, vi har fått ditt meddelande</h2>
                <p style={{ fontSize: '15px', color: INK_SOFT, lineHeight: 1.65, margin: '0 0 22px' }}>
                  Vi svarar till e-postadressen du angav så snart vi kan.
                </p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  style={{ padding: '11px 20px', background: 'transparent', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '10px', fontWeight: 600, fontSize: '14px', color: INK, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Skriv ett nytt meddelande
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-row-2" style={{ display: 'grid', gap: '16px', marginBottom: '18px' }}>
                  <div>
                    <label style={labelStyle} htmlFor="contact-name">Namn</label>
                    <input
                      id="contact-name" name="name" type="text" autoComplete="name" className="contact-input" style={inputStyle}
                      value={form.name} onChange={(e) => update('name', e.target.value)} required
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="contact-email">E-post</label>
                    <input
                      id="contact-email" name="email" type="email" autoComplete="email" className="contact-input" style={inputStyle}
                      value={form.email} onChange={(e) => update('email', e.target.value)} required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={labelStyle} htmlFor="contact-topic">Vad gäller det?</label>
                  <select
                    id="contact-topic" name="topic" className="contact-input" style={{ ...inputStyle, cursor: 'pointer' }}
                    value={form.topic} onChange={(e) => update('topic', e.target.value)}
                  >
                    {TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <label style={labelStyle} htmlFor="contact-message">Meddelande</label>
                  <textarea
                    id="contact-message" name="message" rows={7} className="contact-input"
                    style={{ ...inputStyle, resize: 'vertical', minHeight: '150px' }}
                    value={form.message} onChange={(e) => update('message', e.target.value)} required
                  />
                </div>

                {status === 'error' && (
                  <p role="alert" style={{ fontSize: '14px', color: BRAND.redText, margin: '0 0 18px', lineHeight: 1.55 }}>
                    {errorMsg} Du kan också mejla <a className="ct-a" href="mailto:info@bokix.se">info@bokix.se</a>.
                  </p>
                )}

                {/* Osynlig: körs av handleSubmit precis innan utskicket. */}
                <Turnstile key={captchaRound} ref={captchaRef} onDemand />

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="contact-submit-btn"
                  style={{
                    padding: '13px 28px', background: BRAND.green, color: '#fff',
                    border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '15px',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {status === 'sending' ? 'Skickar…' : 'Skicka'}
                </button>
              </form>
            )}
            <p style={{ fontSize: '14.5px', color: INK_SOFT, margin: '32px 0 0', paddingTop: '22px', borderTop: '1px solid var(--mkt-border-soft)' }}>
              Du kan också mejla <a className="ct-a" href="mailto:info@bokix.se">info@bokix.se</a>.
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
