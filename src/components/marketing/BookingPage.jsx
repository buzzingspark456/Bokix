import React, { useEffect, useMemo, useState } from 'react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, CARD_BORDER, CARD_SHADOW } from './marketingTokens';
import { PageMeta } from '../../utils/seo';
import Turnstile from '../Turnstile';
import {
  BOOKING_TIMES, BOOKING_MINUTES, BOOKING_MODES, bookableDays, slotKey, formatSlot, bookingIcs,
} from '../../utils/demoBooking';

// Egen bokning av en genomgång, i stället för Googles inbäddade
// bokningskalender. Tre steg i samma kort: välj dag och tid, fyll i
// uppgifter, klart. Bokningen landar i admin-panelens Inkorg och som mejl
// (api/contact.js, kind: 'booking'); den som bokar får en bekräftelse med
// kalenderfil. Tider och regler i utils/demoBooking.js.

const WEEKDAYS = ['mån', 'tis', 'ons', 'tors', 'fre', 'lör', 'sön'];

function monthKey(date) { return date.slice(0, 7); }

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const s = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Rutor för en månad, måndag först. null = tom ruta före den 1:a.
function monthCells(key) {
  const [y, m] = key.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= count; d++) cells.push(`${key}-${String(d).padStart(2, '0')}`);
  return cells;
}

function dayLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  const s = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function downloadIcs(slot, mode) {
  const blob = new Blob([bookingIcs({ slot, mode })], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'genomgang-bokix.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BookingPage() {
  const days = useMemo(() => bookableDays(), []);
  const months = useMemo(() => [...new Set(days.map(monthKey))], [days]);
  const [monthIdx, setMonthIdx] = useState(0);
  const [taken, setTaken] = useState([]);
  const [mode, setMode] = useState('video');
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [step, setStep] = useState('pick'); // pick | details | done
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', note: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaRound, setCaptchaRound] = useState(0);

  const loadTaken = () => fetch('/api/contact', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : { taken: [] }))
    .then(d => setTaken(Array.isArray(d.taken) ? d.taken : []))
    .catch(() => {});

  useEffect(() => { loadTaken(); }, []);

  const freeTimes = (d) => BOOKING_TIMES.filter(t => !taken.includes(slotKey(d, t)));
  const isOpen = (d) => days.includes(d) && freeTimes(d).length > 0;
  const slot = date && time ? slotKey(date, time) : null;
  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const pickDate = (d) => { setDate(d); setTime(null); setError(''); };

  async function submit(e) {
    e.preventDefault();
    if (sending || !slot) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'booking', slot, mode, ...form, captchaToken: captchaToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.taken) {
        await loadTaken();
        setTime(null);
        setStep('pick');
        setError(data.error);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Det gick inte att boka. Försök igen.');
      setStep('done');
    } catch (err) {
      setError(err.message || 'Det gick inte att boka. Försök igen.');
    } finally {
      setSending(false);
      setCaptchaToken('');
      setCaptchaRound(n => n + 1);
    }
  }

  const month = months[monthIdx] || months[0];

  return (
    <MarketingLayout>
      <PageMeta
        title="Boka en genomgång | Bokix"
        description="Boka en kostnadsfri genomgång av Bokix, 30 minuter via video eller telefon. Välj dag och tid direkt på sidan."
        path="/boka-genomgang"
      />
      <style>{`
        .bk-card { display: grid; grid-template-columns: 290px 1fr; background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 22px; box-shadow: ${CARD_SHADOW}; overflow: hidden; }
        .bk-side { padding: 30px 28px; border-right: 1px solid var(--mkt-border-soft); }
        .bk-main { padding: 30px 32px 32px; min-height: 440px; }
        .bk-pick { display: grid; grid-template-columns: 1fr 200px; gap: 30px; }
        .bk-seg { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 12px; background: var(--mkt-page-bg); border: 1px solid var(--mkt-border-soft); }
        .bk-seg button { padding: 9px 6px; border: none; border-radius: 9px; background: transparent; color: ${INK_SOFT}; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: background .15s, color .15s, box-shadow .15s; }
        .bk-seg button[aria-pressed="true"] { background: var(--mkt-card-bg); color: ${INK}; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
        .bk-nav { width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--mkt-border-soft); background: transparent; color: ${INK}; font: inherit; font-size: 17px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
        .bk-nav:disabled { opacity: .3; cursor: default; }
        .bk-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .bk-wd { text-align: center; font-size: 11.5px; font-weight: 600; color: ${MUTED}; text-transform: uppercase; letter-spacing: .04em; padding-bottom: 6px; }
        .bk-day { aspect-ratio: 1; max-height: 48px; width: 100%; border: none; border-radius: 50%; background: transparent; font: inherit; font-size: 14.5px; color: ${MUTED}; opacity: .45; cursor: default; }
        .bk-day.open { opacity: 1; color: var(--mkt-accent-green-fg); font-weight: 700; background: var(--mkt-accent-green-soft); cursor: pointer; transition: transform .12s, background .15s; }
        .bk-day.open:hover { transform: scale(1.06); }
        .bk-day.sel { background: ${BRAND.green}; color: #fff; }
        .bk-times { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .bk-time { padding: 11px 8px; border-radius: 10px; border: 1.5px solid ${CARD_BORDER}; background: transparent; color: ${INK}; font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer; transition: border-color .15s, background .15s, color .15s; }
        .bk-time:hover { border-color: ${BRAND.green}; }
        .bk-time.sel { background: ${BRAND.green}; border-color: ${BRAND.green}; color: #fff; }
        .bk-btn { padding: 13px 24px; background: ${BRAND.green}; color: #fff; border: none; border-radius: 11px; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
        .bk-btn:disabled { opacity: .55; cursor: not-allowed; }
        .bk-link { background: none; border: none; padding: 0; font: inherit; font-size: 13.5px; font-weight: 600; color: ${INK}; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
        .bk-input { display: block; width: 100%; box-sizing: border-box; padding: 12px 14px; font: inherit; font-size: 15px; color: ${INK}; background: var(--mkt-page-bg); border: 1.5px solid ${CARD_BORDER}; border-radius: 10px; outline: none; transition: border-color .15s; }
        .bk-input:focus { border-color: ${INK}; }
        .bk-label { display: block; font-size: 13.5px; font-weight: 600; color: ${INK}; margin-bottom: 7px; }
        .bk-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .bk-fade { animation: bkFade .25s ease; }
        @keyframes bkFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (max-width: 860px) {
          .bk-card { grid-template-columns: 1fr; }
          .bk-side { border-right: none; border-bottom: 1px solid var(--mkt-border-soft); padding: 22px 20px; }
          .bk-main { padding: 22px 20px 26px; min-height: 0; }
          .bk-pick { grid-template-columns: 1fr; gap: 22px; }
          .bk-times { grid-template-columns: repeat(3, 1fr); }
          .bk-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <section style={{ padding: '140px 24px 40px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(34px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 14px', lineHeight: 1.12 }}>
            Boka en genomgång
          </h1>
          <p style={{ fontSize: '16.5px', color: INK_SOFT, lineHeight: 1.65, margin: 0 }}>
            {BOOKING_MINUTES} minuter med oss, via video eller telefon. Vi visar Bokix och svarar på det du undrar över. Kostnadsfritt.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '16px 16px 110px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: '940px', margin: '0 auto' }}>
          {step === 'done' ? (
            <div className="bk-card bk-fade" style={{ gridTemplateColumns: '1fr' }}>
              <div style={{ padding: 'clamp(28px, 6vw, 56px)', textAlign: 'center', maxWidth: '560px', margin: '0 auto' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: BRAND.green, marginBottom: '14px' }}>Bokat</div>
                <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 700, color: INK, margin: '0 0 12px', lineHeight: 1.2 }}>
                  Vi ses {formatSlot(slot)}
                </h2>
                <p style={{ fontSize: '15.5px', color: INK_SOFT, lineHeight: 1.65, margin: '0 0 28px' }}>
                  {mode === 'phone' ? `Vi ringer dig på ${form.phone}.` : 'Vi mejlar en länk till videomötet innan dess.'}{' '}
                  En bekräftelse är på väg till {form.email}.
                </p>
                <button type="button" className="bk-btn" onClick={() => downloadIcs(slot, mode)}>Lägg till i kalendern</button>
              </div>
            </div>
          ) : (
            <div className="bk-card">
              <aside className="bk-side">
                <h2 style={{ fontFamily: SERIF, fontSize: '23px', fontWeight: 700, color: INK, margin: '0 0 4px', lineHeight: 1.25 }}>Genomgång av Bokix</h2>
                <div style={{ fontSize: '14.5px', color: INK_SOFT, marginBottom: '24px' }}>{BOOKING_MINUTES} minuter</div>

                <div className="bk-label">Hur vill du ses?</div>
                <div className="bk-seg" role="group" aria-label="Mötesform">
                  {Object.entries(BOOKING_MODES).map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>
                  ))}
                </div>

                {slot && (
                  <div className="bk-fade" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--mkt-border-soft)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: MUTED, marginBottom: '4px' }}>Vald tid</div>
                    <div style={{ fontSize: '15.5px', fontWeight: 700, color: INK, lineHeight: 1.4 }}>{dayLabel(date)}</div>
                    <div style={{ fontSize: '15px', color: INK_SOFT }}>kl. {time}–{addMinutes(time, BOOKING_MINUTES)}</div>
                    {step === 'details' && (
                      <button type="button" className="bk-link" style={{ marginTop: '10px' }} onClick={() => setStep('pick')}>Ändra tid</button>
                    )}
                  </div>
                )}
              </aside>

              <div className="bk-main">
                {step === 'pick' ? (
                  <div className="bk-pick bk-fade">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                        <h3 style={{ fontSize: '17px', fontWeight: 700, color: INK, margin: 0 }}>{month ? monthLabel(month) : ''}</h3>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" className="bk-nav" aria-label="Föregående månad" disabled={monthIdx === 0} onClick={() => setMonthIdx(i => i - 1)}>‹</button>
                          <button type="button" className="bk-nav" aria-label="Nästa månad" disabled={monthIdx >= months.length - 1} onClick={() => setMonthIdx(i => i + 1)}>›</button>
                        </div>
                      </div>
                      <div className="bk-grid">
                        {WEEKDAYS.map(w => <div key={w} className="bk-wd">{w}</div>)}
                        {month && monthCells(month).map((d, i) => (
                          d === null ? <div key={`e${i}`} /> : (
                            <button
                              key={d}
                              type="button"
                              disabled={!isOpen(d)}
                              aria-label={dayLabel(d)}
                              aria-pressed={date === d}
                              className={`bk-day${isOpen(d) ? ' open' : ''}${date === d ? ' sel' : ''}`}
                              onClick={() => pickDate(d)}
                            >
                              {Number(d.slice(8))}
                            </button>
                          )
                        ))}
                      </div>
                      {error && <div style={{ color: 'var(--mkt-accent-red-fg)', fontSize: '13.5px', marginTop: '16px' }}>{error}</div>}
                    </div>

                    <div>
                      {date ? (
                        <>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: INK, marginBottom: '12px' }}>{dayLabel(date)}</div>
                          <div className="bk-times bk-fade" key={date}>
                            {freeTimes(date).map(t => (
                              <button key={t} type="button" className={`bk-time${time === t ? ' sel' : ''}`} onClick={() => setTime(t)}>{t}</button>
                            ))}
                          </div>
                          <button type="button" className="bk-btn" style={{ width: '100%', marginTop: '14px' }} disabled={!time} onClick={() => { setError(''); setStep('details'); }}>
                            Nästa
                          </button>
                        </>
                      ) : (
                        <div style={{ fontSize: '14px', color: MUTED, paddingTop: '52px', lineHeight: 1.6 }}>Välj en dag för att se lediga tider.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <form className="bk-fade" onSubmit={submit}>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: INK, margin: '0 0 20px' }}>Dina uppgifter</h3>
                    <div className="bk-row">
                      <div>
                        <label className="bk-label" htmlFor="bk-name">Namn</label>
                        <input id="bk-name" className="bk-input" required autoComplete="name" value={form.name} onChange={e => update('name', e.target.value)} />
                      </div>
                      <div>
                        <label className="bk-label" htmlFor="bk-company">Företag</label>
                        <input id="bk-company" className="bk-input" autoComplete="organization" placeholder="Valfritt" value={form.company} onChange={e => update('company', e.target.value)} />
                      </div>
                    </div>
                    <div className="bk-row">
                      <div>
                        <label className="bk-label" htmlFor="bk-email">E-post</label>
                        <input id="bk-email" type="email" className="bk-input" required autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} />
                      </div>
                      <div>
                        <label className="bk-label" htmlFor="bk-phone">Telefon</label>
                        <input id="bk-phone" type="tel" className="bk-input" autoComplete="tel" required={mode === 'phone'} placeholder={mode === 'phone' ? '' : 'Valfritt'} value={form.phone} onChange={e => update('phone', e.target.value)} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '18px' }}>
                      <label className="bk-label" htmlFor="bk-note">Något särskilt du vill att vi tittar på?</label>
                      <textarea id="bk-note" className="bk-input" rows={3} placeholder="Valfritt" style={{ resize: 'vertical', minHeight: '90px' }} value={form.note} onChange={e => update('note', e.target.value)} />
                    </div>
                    <Turnstile key={captchaRound} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
                    {error && <div style={{ color: 'var(--mkt-accent-red-fg)', fontSize: '13.5px', margin: '10px 0 0' }}>{error}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '18px', flexWrap: 'wrap' }}>
                      <button type="submit" className="bk-btn" disabled={sending}>{sending ? 'Bokar…' : 'Boka tiden'}</button>
                      <button type="button" className="bk-link" onClick={() => setStep('pick')}>Tillbaka</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </Reveal>
      </section>
    </MarketingLayout>
  );
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
