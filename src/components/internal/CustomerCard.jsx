import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink } from '../icons';
import { adminGet } from './adminApi';
import { Pill, SUBSCRIPTION_STATUS } from './AdminList';
import { dateTimeFormat } from '../../utils/intlCache';

// Kundkortet i /internal: allt om ett konto på ett ställe (api/admin,
// resource 'customer'). Öppnas från Översikt och Användare. Bara läsning;
// avstängning finns kvar i listan under Användare.

const fmtDate = (iso) => (iso ? dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—');
const fmtDateTime = (iso) => (iso ? dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');
const VAT_PERIOD = { monthly: 'Månadsvis', quarterly: 'Kvartalsvis', yearly: 'En gång per år' };
const EVENT_LABEL = { ocr_error: 'Kvittoläsning', client_error: 'Appen kraschade', login_slow: 'Långsam inloggning' };

function fiscalYearText(s) {
  if (s.firstFiscalYear?.start && s.firstFiscalYear?.end) return `Första året ${s.firstFiscalYear.start} – ${s.firstFiscalYear.end}, sedan från ${String(s.fiscalYear || '').slice(5) || '01-01'}`;
  const md = String(s.fiscalYear || '').slice(5);
  return !md || md === '01-01' ? 'Kalenderår' : `Börjar ${md}`;
}

const CSS = `
  .cc-back { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); z-index: 300; }
  .cc { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); background: var(--bg-page); z-index: 301; display: flex; flex-direction: column; box-shadow: -12px 0 40px rgba(0,0,0,0.18); animation: ccIn 0.18s ease; }
  @keyframes ccIn { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  .cc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px; background: var(--bg-card); border-bottom: 1px solid var(--border); }
  .cc-title { font-size: 18px; font-weight: 800; color: var(--text-main); overflow-wrap: anywhere; }
  .cc-sub { font-size: 13px; color: var(--text-muted); margin-top: 3px; }
  .cc-close { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .cc-body { flex: 1; overflow-y: auto; padding: 16px 20px 32px; display: flex; flex-direction: column; gap: 14px; }
  .cc-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
  .cc-card-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
  .cc-kv { display: flex; justify-content: space-between; gap: 14px; padding: 7px 0; font-size: 13.5px; border-top: 1px solid var(--border-light); }
  .cc-kv:first-of-type { border-top: none; }
  .cc-kv > span:first-child { color: var(--text-secondary); }
  .cc-kv > span:last-child { color: var(--text-main); font-weight: 600; text-align: right; overflow-wrap: anywhere; }
  .cc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .cc-num { background: var(--bg-muted); border-radius: 10px; padding: 10px 12px; }
  .cc-num b { display: block; font-size: 20px; font-weight: 800; color: var(--text-main); }
  .cc-num span { font-size: 12px; color: var(--text-muted); }
  .cc-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .cc-link { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--accent-text); text-decoration: none; text-transform: none; letter-spacing: 0; }
  .cc-warn { color: var(--status-amber-text) !important; }
  .cc-event { font-size: 12.5px; padding: 8px 0; border-top: 1px solid var(--border-light); color: var(--text-secondary); white-space: pre-line; overflow-wrap: anywhere; }
  .cc-event:first-of-type { border-top: none; }
  .cc-muted { font-size: 13px; color: var(--text-muted); }
  @media (max-width: 760px) {
    .cc { width: 100vw; }
    .cc-head { padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px 14px; }
    .cc-body { padding: 14px 16px calc(env(safe-area-inset-bottom, 0px) + 28px); }
    .cc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
`;

const Kv = ({ label, value, warn = false }) => (
  <div className="cc-kv"><span>{label}</span><span className={warn ? 'cc-warn' : undefined}>{value}</span></div>
);

function CompanyBlock({ c }) {
  const s = c.settings;
  const u = c.usage;
  return (
    <>
      <div className="cc-card">
        <div className="cc-card-title">{c.name || 'Företag utan namn'}</div>
        <Kv label="Org.nr" value={c.orgNr || '—'} />
        <Kv label="Bolagsform" value={c.orgType || '—'} />
        <Kv label="Momsregistrerat" value={s.vatRegistered === null ? 'Inte svarat' : s.vatRegistered ? 'Ja' : 'Nej'} warn={s.vatRegistered === null} />
        {s.vatRegistered !== false && <Kv label="Momsperiod" value={`${VAT_PERIOD[s.vatPeriod] || '—'}${s.vatPeriodConfirmed ? '' : ' (inte bekräftad)'}`} warn={!s.vatPeriodConfirmed} />}
        <Kv label="F-skatt på fakturan" value={`${s.fSkatt || 'Ingen text'}${s.fSkattConfirmed ? '' : ' (inte bekräftad)'}`} warn={!s.fSkattConfirmed} />
        <Kv label="Räkenskapsår" value={fiscalYearText(s)} />
        <Kv label="Guiden för nya konton" value={s.setupDone ? 'Klar' : s.needsSetup ? 'Inte gjord' : 'Fanns inte när kontot skapades'} />
        <div className="cc-pills">
          {c.integrations.stripe && <Pill tone="blue">Stripe kopplat</Pill>}
          {c.integrations.zettle && <Pill tone="blue">Zettle kopplat</Pill>}
          {c.integrations.ownEmailDomain && <Pill tone="green">Egen e-postdomän</Pill>}
          {c.members.map(m => <Pill key={m.email} tone="gray">{m.role === 'viewer' ? 'Läser' : 'Redigerar'}: {m.email}{m.status === 'pending' ? ' (inbjuden)' : ''}</Pill>)}
        </div>
      </div>
      <div className="cc-card">
        <div className="cc-card-title">Användning · {c.name || 'företaget'}</div>
        <div className="cc-grid">
          {[
            [u.verifications, 'verifikationer'], [u.sentInvoices, `fakturor skickade${u.invoices > u.sentInvoices ? ` (+${u.invoices - u.sentInvoices} utkast)` : ''}`], [u.receipts, 'kvitton'],
            [u.supplierInvoices, 'leverantörsfakturor'], [u.customers, 'kunder'], [u.employees, 'anställda'],
          ].map(([n, label]) => <div key={label} className="cc-num"><b>{n}</b><span>{label}</span></div>)}
        </div>
        <Kv label="Senast bokförda datum" value={u.lastBookedDate || '—'} />
      </div>
    </>
  );
}

export default function CustomerCard({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    adminGet({ resource: 'customer', id: userId })
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err.message); });
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelled = true; window.removeEventListener('keydown', onKey); };
  }, [userId]);

  const a = data?.account;
  return (
    <>
      <style>{CSS}</style>
      <div className="cc-back" onClick={onClose} />
      <aside className="cc" role="dialog" aria-modal="true" aria-label="Kundkort">
        <div className="cc-head">
          <div style={{ minWidth: 0 }}>
            <div className="cc-title">{a?.email || 'Kundkort'}</div>
            {a && <div className="cc-sub">{[a.name, `kund sedan ${fmtDate(a.createdAt)}`].filter(Boolean).join(' · ')}</div>}
            {a && (
              <div className="cc-pills">
                {a.uf && <Pill tone="green">UF</Pill>}
                {a.isAdmin && <Pill tone="blue">Admin</Pill>}
                {a.suspended && <Pill tone="red">Avstängd</Pill>}
                {!a.emailConfirmed && <Pill tone="amber">E-post obekräftad</Pill>}
              </div>
            )}
          </div>
          <button type="button" className="cc-close" onClick={onClose} aria-label="Stäng"><X size={18} /></button>
        </div>

        <div className="cc-body">
          {error && <div style={{ color: 'var(--status-red-text)', fontSize: '13.5px' }}>{error}</div>}
          {!data && !error && <div className="cc-muted">Hämtar…</div>}
          {data && (
            <>
              <div className="cc-card">
                <div className="cc-card-title">Aktivitet</div>
                <Kv label="Senast inloggad" value={fmtDateTime(a.lastSignInAt)} />
                <Kv label="Inloggningar senaste 30 dagarna" value={data.logins.last30Days} />
                <Kv label="Senast sparat något" value={fmtDateTime(a.lastSavedAt)} />
                {data.logins.recent[0] && <Kv label="Senaste enhet" value={data.logins.recent[0].device} />}
              </div>

              {data.subscriptions.length === 0 && <div className="cc-card"><div className="cc-card-title">Prenumeration</div><div className="cc-muted">Ingen prenumeration.</div></div>}
              {data.subscriptions.map((sub, i) => {
                const st = SUBSCRIPTION_STATUS[sub.status] || { label: sub.status, tone: 'gray' };
                return (
                  <div key={i} className="cc-card">
                    <div className="cc-card-title">
                      <span>Prenumeration{sub.companyName ? ` · ${sub.companyName}` : ''}</span>
                      {sub.stripeUrl && <a className="cc-link" href={sub.stripeUrl} target="_blank" rel="noopener noreferrer">Öppna i Stripe <ExternalLink size={13} /></a>}
                    </div>
                    <div style={{ marginBottom: '6px' }}><Pill tone={st.tone}>{st.label}</Pill>{sub.cancelAtPeriodEnd && <> <Pill tone="amber">Avslutas vid periodens slut</Pill></>}</div>
                    <Kv label="Plan" value={sub.planName ? `${sub.planName}${sub.price ? ` · ${sub.price} kr` : ''}` : '—'} />
                    {sub.status === 'trialing' && <Kv label="Provperioden slutar" value={fmtDate(sub.trialEndsAt)} />}
                    {sub.currentPeriodEnd && <Kv label="Nuvarande period slutar" value={fmtDate(sub.currentPeriodEnd)} />}
                    <Kv label="Startad" value={fmtDate(sub.createdAt)} />
                  </div>
                );
              })}

              {data.companies.length === 0 && <div className="cc-card"><div className="cc-card-title">Företag</div><div className="cc-muted">Inget företag upplagt än.</div></div>}
              {data.companies.map(c => <CompanyBlock key={c.id || c.name} c={c} />)}

              <div className="cc-card">
                <div className="cc-card-title">Senaste fel</div>
                {data.errors.length === 0
                  ? <div className="cc-muted">Inga fel loggade för kontot.</div>
                  : data.errors.map((e, i) => <div key={i} className="cc-event"><b>{EVENT_LABEL[e.kind] || e.kind}</b> · {fmtDateTime(e.created_at)}{'\n'}{String(e.detail || '').split('\n').filter(l => !l.startsWith('Konto:')).slice(0, 2).join('\n')}</div>)}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
