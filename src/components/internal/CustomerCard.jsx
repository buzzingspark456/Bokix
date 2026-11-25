import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, ShieldOff, RotateCcw } from '../icons';
import { adminGet, adminPost } from './adminApi';
import { Pill, SUBSCRIPTION_STATUS } from './AdminList';
import { Card, Kv, Notice } from './ui';
import { dateTimeFormat } from '../../utils/intlCache';

// Kundkortet i /internal: allt om ett konto på ett ställe (api/admin,
// resource 'customer'). Öppnas från Översikt och Användare. Läsning, och
// längst ned att stänga av eller återaktivera kontot (flyttat hit från
// listan 2026-11-06, så att knappen inte står på varje rad).

const fmtDate = (iso) => (iso ? dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—');
const fmtDateTime = (iso) => (iso ? dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');
const VAT_PERIOD = { monthly: 'Månadsvis', quarterly: 'Kvartalsvis', yearly: 'En gång per år' };
const EVENT_LABEL = { ocr_error: 'Kvittoläsning', vision_error: 'Kvittoläsning (Vision)', client_error: 'Appen kraschade', login_slow: 'Långsam inloggning' };

function fiscalYearText(s) {
  if (s.firstFiscalYear?.start && s.firstFiscalYear?.end) return `Första året ${s.firstFiscalYear.start} – ${s.firstFiscalYear.end}, sedan från ${String(s.fiscalYear || '').slice(5) || '01-01'}`;
  const md = String(s.fiscalYear || '').slice(5);
  return !md || md === '01-01' ? 'Kalenderår' : `Börjar ${md}`;
}

// Ett obekräftat eller obesvarat val markeras med en gul prick.
const warn = (yes) => (yes ? 'amber' : undefined);

function CompanyBlock({ c }) {
  const s = c.settings;
  const u = c.usage;
  return (
    <>
      <Card title={c.name || 'Företag utan namn'}>
        <Kv label="Org.nr" value={c.orgNr || '—'} />
        <Kv label="Bolagsform" value={c.orgType || '—'} />
        <Kv label="Momsregistrerat" value={s.vatRegistered === null ? 'Inte svarat' : s.vatRegistered ? 'Ja' : 'Nej'} tone={warn(s.vatRegistered === null)} />
        {s.vatRegistered !== false && <Kv label="Momsperiod" value={`${VAT_PERIOD[s.vatPeriod] || '—'}${s.vatPeriodConfirmed ? '' : ' (inte bekräftad)'}`} tone={warn(!s.vatPeriodConfirmed)} />}
        <Kv label="F-skatt på fakturan" value={`${s.fSkatt || 'Ingen text'}${s.fSkattConfirmed ? '' : ' (inte bekräftad)'}`} tone={warn(!s.fSkattConfirmed)} />
        <Kv label="Räkenskapsår" value={fiscalYearText(s)} />
        <Kv label="Guiden för nya konton" value={s.setupDone ? 'Klar' : s.needsSetup ? 'Inte gjord' : 'Fanns inte när kontot skapades'} />
        {(c.integrations.stripe || c.integrations.zettle || c.integrations.ownEmailDomain || c.members.length > 0) && (
          <div className="cc-pills">
            {c.integrations.stripe && <Pill tone="blue">Stripe kopplat</Pill>}
            {c.integrations.zettle && <Pill tone="blue">Zettle kopplat</Pill>}
            {c.integrations.ownEmailDomain && <Pill tone="green">Egen e-postdomän</Pill>}
            {c.members.map(m => <Pill key={m.email}>{m.role === 'viewer' ? 'Läser' : 'Redigerar'}: {m.email}{m.status === 'pending' ? ' (inbjuden)' : ''}</Pill>)}
          </div>
        )}
      </Card>
      <Card title={`Användning${c.name ? ` · ${c.name}` : ''}`}>
        <div className="cc-grid">
          {[
            [u.verifications, 'verifikationer'], [u.sentInvoices, `fakturor skickade${u.invoices > u.sentInvoices ? ` (+${u.invoices - u.sentInvoices} utkast)` : ''}`], [u.receipts, 'kvitton'],
            [u.supplierInvoices, 'leverantörsfakturor'], [u.customers, 'kunder'], [u.employees, 'anställda'],
          ].map(([n, label]) => <div key={label} className="cc-num"><b>{n}</b><span>{label}</span></div>)}
        </div>
        <Kv label="Senast bokförda datum" value={u.lastBookedDate || '—'} />
      </Card>
    </>
  );
}

export default function CustomerCard({ userId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    adminGet({ resource: 'customer', id: userId })
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err.message); });
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => { cancelled = true; window.removeEventListener('keydown', onKey); };
  }, [userId, reloadKey]);

  const toggleSuspend = async () => {
    const a = data?.account;
    if (!a) return;
    const verb = a.suspended ? 'återaktivera' : 'stänga av';
    if (!window.confirm(`Vill du ${verb} kontot ${a.email}?`)) return;
    setBusy(true);
    try {
      await adminPost({ resource: 'users', action: a.suspended ? 'unsuspend' : 'suspend', userId });
      setReloadKey(k => k + 1);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const a = data?.account;
  return (
    <>
      <div className="cc-back" onClick={onClose} />
      <aside className="cc" role="dialog" aria-modal="true" aria-label="Kundkort" tabIndex={-1} ref={panelRef}>
        <div className="cc-head">
          <div style={{ minWidth: 0 }}>
            <div className="cc-title">{a?.email || 'Kundkort'}</div>
            {a && <div className="cc-sub">{[a.name, `kund sedan ${fmtDate(a.createdAt)}`].filter(Boolean).join(' · ')}</div>}
            {a && (a.uf || a.isAdmin || a.suspended || !a.emailConfirmed) && (
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
          {error && <Notice tone="red">{error}</Notice>}
          {!data && !error && <div className="ix-loading">Hämtar…</div>}
          {data && (
            <>
              <Card title="Aktivitet">
                <Kv label="Senast inloggad" value={fmtDateTime(a.lastSignInAt)} />
                <Kv label="Inloggningar senaste 30 dagarna" value={data.logins.last30Days} />
                <Kv label="Senast sparat något" value={fmtDateTime(a.lastSavedAt)} />
                {data.logins.recent[0] && <Kv label="Senaste enhet" value={data.logins.recent[0].device} />}
              </Card>

              {data.subscriptions.length === 0 && <Card title="Prenumeration"><div className="ix-muted">Ingen prenumeration.</div></Card>}
              {data.subscriptions.map((sub, i) => {
                const st = SUBSCRIPTION_STATUS[sub.status] || { label: sub.status, tone: 'gray' };
                return (
                  <Card
                    key={i}
                    title={`Prenumeration${sub.companyName ? ` · ${sub.companyName}` : ''}`}
                    actions={sub.stripeUrl && <a className="ix-link" href={sub.stripeUrl} target="_blank" rel="noopener noreferrer">Öppna i Stripe <ExternalLink size={13} /></a>}
                  >
                    <div className="cc-pills" style={{ marginTop: 0, marginBottom: '6px' }}>
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {sub.cancelAtPeriodEnd && <Pill tone="amber">Avslutas vid periodens slut</Pill>}
                    </div>
                    <Kv label="Plan" value={sub.planName ? `${sub.planName}${sub.price ? ` · ${sub.price} kr` : ''}` : '—'} />
                    {sub.status === 'trialing' && <Kv label="Provperioden slutar" value={fmtDate(sub.trialEndsAt)} />}
                    {sub.currentPeriodEnd && <Kv label="Nuvarande period slutar" value={fmtDate(sub.currentPeriodEnd)} />}
                    <Kv label="Startad" value={fmtDate(sub.createdAt)} />
                  </Card>
                );
              })}

              {data.companies.length === 0 && <Card title="Företag"><div className="ix-muted">Inget företag upplagt än.</div></Card>}
              {data.companies.map(c => <CompanyBlock key={c.id || c.name} c={c} />)}

              <Card title="Senaste fel" flush>
                {data.errors.length === 0
                  ? <div className="ix-card-body"><div className="ix-muted">Inga fel loggade för kontot.</div></div>
                  : data.errors.map((e, i) => (
                    <div key={i} className="ix-event">
                      <div className="ix-event-head"><span className="ix-event-title">{EVENT_LABEL[e.kind] || e.kind}</span><span className="ix-event-time">{fmtDateTime(e.created_at)}</span></div>
                      <div className="ix-event-detail">{String(e.detail || '').split('\n').filter(l => !l.startsWith('Konto:')).slice(0, 2).join('\n')}</div>
                    </div>
                  ))}
              </Card>

              {!a.isAdmin && (
                <div className="cc-danger">
                  <button type="button" className={`ix-btn${a.suspended ? '' : ' danger'}`} onClick={toggleSuspend} disabled={busy}>
                    {a.suspended ? <RotateCcw size={13} /> : <ShieldOff size={13} />}
                    {a.suspended ? 'Återaktivera kontot' : 'Stäng av kontot'}
                  </button>
                  <span className="ix-muted">{a.suspended ? 'Kontot kan inte logga in.' : 'Kontot kan inte logga in förrän det återaktiveras. Bokföringen sparas.'}</span>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

