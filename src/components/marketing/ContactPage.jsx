import React, { useState } from 'react';
import { Mail, LifeBuoy, CreditCard, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT_CYCLE } from './marketingTokens';
import { PageMeta } from '../../utils/seo';

// Ämnesval i formuläret — samma tre ärendetyper som tidigare bara var
// mailto-genvägar, nu förifyllda dropdown-värden istället. "Övrigt" täcker
// allt som inte passar in i de tre.
const TOPICS = [
  { icon: LifeBuoy, value: 'Support', desc: 'Tekniska frågor, buggar, eller hjälp att komma igång.' },
  { icon: CreditCard, value: 'Fakturering & pris', desc: 'Frågor om din prenumeration, betalning eller uppsägning.' },
  { icon: ShieldCheck, value: 'Säkerhet & integritet', desc: 'Frågor om GDPR, dina rättigheter eller hur din data hanteras.' },
  { icon: Mail, value: 'Övrigt', desc: 'Något annat vi kan hjälpa till med.' },
];

const CONTACT_INBOX = 'alwakiabdullah1@gmail.com';

// Bygger själva mejlets HTML-kropp av formulärfälten — enkel och läsbar i
// vilken mejlklient som helst, inget beroende av externa mallmotorer.
function buildEmailHtml({ name, email, topic, message }) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #0f172a; line-height: 1.6;">
      <h2 style="margin: 0 0 16px;">Nytt meddelande från kontaktformuläret</h2>
      <p style="margin: 0 0 4px;"><strong>Namn:</strong> ${esc(name)}</p>
      <p style="margin: 0 0 4px;"><strong>E-post:</strong> ${esc(email)}</p>
      <p style="margin: 0 0 16px;"><strong>Ämne:</strong> ${esc(topic)}</p>
      <p style="margin: 0 0 8px;"><strong>Meddelande:</strong></p>
      <p style="white-space: pre-wrap; margin: 0; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">${esc(message)}</p>
    </div>
  `;
}

const inputStyle = {
  display: 'block',
  width: '100%',
  padding: '12px 14px',
  fontSize: '14.5px',
  fontFamily: 'inherit',
  color: INK,
  background: 'var(--mkt-card-bg)',
  border: `1.5px solid ${CARD_BORDER}`,
  borderRadius: '10px',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 700,
  color: INK_SOFT,
  marginBottom: '7px',
};

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', topic: TOPICS[0].value, message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending') return;

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();
    // Inget eget "fyll i"-kontrollmeddelande här längre — fälten är redan
    // markerade required och formuläret har inte noValidate, så webbläsarens
    // egen inbyggda valideringsbubbla stoppar submit innan den ens når hit.

    setStatus('sending');
    setErrorMsg('');
    try {
      // Återanvänder e-postrutten som redan skickar fakturor/offerter — den
      // bryr sig bara om to/subject/html/replyTo, inte vilket "dokument"
      // det är (se api/email/send-invoice.js). Undviker en ny Vercel-
      // serverless-function ovanpå Hobby-planens 12-gräns (se commit
      // "Fix: Vercel Hobby-planens grans pa 12 serverless functions").
      const res = await fetch('/api/email/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: CONTACT_INBOX,
          subject: `Kontaktformulär (${form.topic}) — ${name}`,
          html: buildEmailHtml({ name, email, topic: form.topic, message }),
          replyTo: email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kunde inte skicka meddelandet.');

      setStatus('sent');
      setForm({ name: '', email: '', topic: TOPICS[0].value, message: '' });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Något gick fel. Försök igen om en stund.');
    }
  }

  return (
    <MarketingLayout>
      <PageMeta
        title="Kontakta oss | Bokix"
        description="Frågor om Bokix — support, fakturering eller säkerhet? Skriv till oss, en riktig person läser och svarar direkt på din e-post. Inget säljteam, inget callcenter."
        path="/kontakt"
      />
      <style>{`
        .contact-input:focus { border-color: ${BRAND.green} !important; box-shadow: 0 0 0 3px ${BRAND.greenLight} !important; }
        .contact-topic-btn { transition: all 0.15s; cursor: pointer; }
        .contact-topic-btn:hover { border-color: ${BRAND.green} !important; }
        .contact-submit-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 25px -5px rgba(61,122,46,0.4); }
        .contact-submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        @keyframes contactSpin { to { transform: rotate(360deg); } }
        .contact-spin { animation: contactSpin 0.8s linear infinite; }
      `}</style>

      <section style={{ padding: '150px 24px 60px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ width: 60, height: 60, borderRadius: '17px', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Mail size={26} color="white" />
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.16 }}>
            Kontakta oss
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.75 }}>
            Inget säljteam, inget callcenter. Skriv till oss här nedan, en riktig person läser och svarar direkt på din e-post.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '40px 24px 110px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', padding: 'clamp(24px, 5vw, 40px)', boxShadow: CARD_SHADOW }}>
            {status === 'sent' ? (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                  <CheckCircle2 size={28} color={BRAND.greenDark} />
                </div>
                <h2 style={{ fontFamily: SERIF, fontSize: '20px', fontWeight: 700, color: INK, marginBottom: '8px' }}>Meddelandet är skickat</h2>
                <p style={{ fontSize: '14.5px', color: MUTED, lineHeight: 1.6, marginBottom: '22px' }}>
                  Tack! Vi hör av oss till dig på din e-postadress så snart vi kan.
                </p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="lp-btn-secondary"
                  style={{ padding: '10px 20px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '10px', fontWeight: 700, fontSize: '13.5px', color: INK_SOFT, cursor: 'pointer' }}
                >
                  Skicka ett till meddelande
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-row-2" style={{ display: 'grid', gap: '16px', marginBottom: '18px' }}>
                  <div>
                    <label style={labelStyle} htmlFor="contact-name">Namn</label>
                    <input
                      id="contact-name" name="name" type="text" autoComplete="name" className="contact-input" style={inputStyle}
                      placeholder="Ditt namn" value={form.name} onChange={(e) => update('name', e.target.value)} required
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="contact-email">E-post</label>
                    <input
                      id="contact-email" name="email" type="email" autoComplete="email" className="contact-input" style={inputStyle}
                      placeholder="din@epost.se" value={form.email} onChange={(e) => update('email', e.target.value)} required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={labelStyle}>Ämne</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {TOPICS.map((t, i) => {
                      const active = form.topic === t.value;
                      const accent = ACCENT_CYCLE[i % 3];
                      return (
                        <button
                          key={t.value} type="button" onClick={() => update('topic', t.value)}
                          className="contact-topic-btn"
                          title={t.desc}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                            border: `1.5px solid ${active ? accent.fg : CARD_BORDER}`,
                            background: active ? accent.soft : 'var(--mkt-card-bg)',
                            borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                            color: active ? accent.fg : INK_SOFT, textAlign: 'left',
                          }}
                        >
                          <t.icon size={15} style={{ flexShrink: 0 }} />
                          <span>{t.value}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <label style={labelStyle} htmlFor="contact-message">Meddelande</label>
                  <textarea
                    id="contact-message" name="message" rows={5} className="contact-input"
                    style={{ ...inputStyle, resize: 'vertical', minHeight: '110px', fontFamily: 'inherit' }}
                    placeholder="Skriv din fråga eller ditt meddelande här..."
                    value={form.message} onChange={(e) => update('message', e.target.value)} required
                  />
                </div>

                {status === 'error' && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: BRAND.redBg, borderRadius: '10px', marginBottom: '18px' }}>
                    <AlertCircle size={17} color={BRAND.redText} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <p style={{ fontSize: '13.5px', color: BRAND.redText, margin: 0, lineHeight: 1.5 }}>
                      {errorMsg}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="lp-btn-primary contact-submit-btn"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                    width: '100%', padding: '14px 20px', background: BRAND.green, color: 'white',
                    border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '15px',
                  }}
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 size={17} className="contact-spin" /> Skickar...
                    </>
                  ) : (
                    <>
                      <Mail size={17} /> Skicka meddelande
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
