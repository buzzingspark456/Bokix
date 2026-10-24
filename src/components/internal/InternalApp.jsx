import React, { useEffect, useState } from 'react';
import { BarChart3, CreditCard, ShieldAlert, Users, LogOut, Server, Inbox, LayoutDashboard, CheckCircle2 } from '../icons';
import BokixWordmark from '../shared/BokixWordmark';
import { supabase } from '../../supabaseClient';
import InternalAuth from './InternalAuth';
import AnalyticsAdmin from './AnalyticsAdmin';
import OverviewAdmin from './OverviewAdmin';
import StatusAdmin from './StatusAdmin';
import PaymentsAdmin from './PaymentsAdmin';
import SecurityAdmin from './SecurityAdmin';
import UsersAdmin from './UsersAdmin';
import SystemAdmin from './SystemAdmin';
import InboxAdmin from './InboxAdmin';
import { adminGet } from './adminApi';

// ── /internal — den dolda admin-panelen ─────────────────────────────────
// Ingen länk hit någonstans i den publika navigeringen (MarketingLayout.jsx/
// AppRouter.jsx har bara routen, inget nav-item) — hittas genom att veta
// att den finns, samma "security by not advertising it" som vilken
// intern verktygssida som helst, ALDRIG den enda spärren i sig (den
// riktiga spärren är api/admin/index.js:s ADMIN_EMAILS, se den filens
// kommentar). Sex flikar: Analys, Betalningar, Säkerhet, Användare,
// Inkorg (kontaktformulären) och Systemstatus (2026-09-27) — Blogg (admin-CMS) togs bort 2026-09-13, se
// api/admin/index.js:s kommentar för varför.
export default function InternalApp() {
  const [status, setStatus] = useState('checking'); // checking | needs-login | unauthorized | authorized | error
  const [activeTab, setActiveTab] = useState('overview');
  const [errorMsg, setErrorMsg] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  // Inloggad med bara lösenord: panelen kräver Face ID eller tvåfaktor
  // (api/admin/index.js sessionStrength). Visas på inloggningssidan.
  const [loginNotice, setLoginNotice] = useState('');

  const checkAccess = async () => {
    setStatus('checking');
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session) { setStatus('needs-login'); return; }
    setAdminEmail(session.user?.email || '');
    try {
      // Samma anrop UI:t ändå behöver göra för att fylla Analys-fliken —
      // dubbelt syfte, inte ett extra "får jag vara här?"-anrop.
      await adminGet({ resource: 'analytics' });
      setStatus('authorized');
    } catch (err) {
      const message = String(err.message || '');
      if (message.includes('kräver Face ID')) {
        // Ingen utloggning: signOut() loggar som standard ut överallt, även
        // appen på telefonen. Face ID-inloggningen ersätter sessionen ändå.
        setLoginNotice(message);
        setStatus('needs-login');
      } else if (message.includes('behörighet')) setStatus('unauthorized');
      else { setErrorMsg(err.message); setStatus('error'); }
    }
  };

  useEffect(() => { checkAccess(); }, []);

  // Samma tema som appen (Inställningar → Utseende): ljust, mörkt eller
  // systemets. Panelen använder appens färgvariabler, så det räcker att
  // sätta attributet på <html>.
  useEffect(() => {
    let pref = null;
    try { pref = localStorage.getItem('bokix_theme_pref'); } catch { /* privat läge */ }
    if (pref === 'light' || pref === 'dark') document.documentElement.setAttribute('data-theme', pref);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setStatus('needs-login');
  };

  if (status === 'checking') {
    return <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', background: 'var(--bg-page)' }} />;
  }

  if (status === 'needs-login') {
    return <InternalAuth onAuthenticated={checkAccess} notice={loginNotice} />;
  }

  if (status === 'unauthorized') {
    return (
      <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', padding: '24px', textAlign: 'center' }}>
        <div>
          <ShieldAlert size={32} color="var(--status-red-text)" style={{ marginBottom: '14px' }} />
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Ingen åtkomst</div>
          <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            {adminEmail} har inte behörighet till admin-panelen.
          </div>
          <button onClick={handleSignOut} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '9px', padding: '9px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Logga ut
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--status-red-text)', fontSize: '14px', padding: '24px', textAlign: 'center' }}>
        {errorMsg || 'Något gick fel.'}
      </div>
    );
  }

  const navItems = [
    { id: 'overview', label: 'Översikt', icon: LayoutDashboard, live: true },
    { id: 'analytics', label: 'Analys', icon: BarChart3, live: true },
    { id: 'payments', label: 'Betalningar', icon: CreditCard, live: true },
    { id: 'security', label: 'Säkerhet', icon: ShieldAlert, live: true },
    { id: 'users', label: 'Användare', icon: Users, live: true },
    { id: 'inbox', label: 'Inkorg', icon: Inbox, live: true },
    { id: 'system', label: 'Systemstatus', icon: Server, live: true },
    { id: 'status', label: 'Statussidan', icon: CheckCircle2, live: true },
  ];

  // Dator: grön sidomeny som i appen. Telefon: loggan och utloggning
  // överst, flikarna som en rad att svepa i, och sidornas luft minskad.
  const css = `
    .ix { min-height: calc(100vh / var(--app-zoom, 1)); display: flex; background: var(--bg-page); color: var(--text-main); font-family: 'Inter', sans-serif; }
    .ix-side { width: 236px; flex-shrink: 0; padding: 22px 12px 18px; display: flex; flex-direction: column; position: sticky; top: 0; height: calc(100vh / var(--app-zoom, 1)); box-sizing: border-box;
      background: linear-gradient(rgba(0,0,0,0.22), rgba(0,0,0,0.22)), #0b6329; color: #fff; }
    .ix-brand { display: flex; align-items: baseline; gap: 8px; padding: 0 10px 18px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.14); }
    .ix-brand-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
    .ix-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .ix-nav button { display: flex; align-items: center; gap: 11px; padding: 9px 12px; border-radius: 8px; font-size: 14px; font-weight: 600; border: none; width: 100%; text-align: left; font-family: inherit; cursor: pointer; background: transparent; color: rgba(255,255,255,0.82); position: relative; }
    .ix-nav button:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .ix-nav button.on { background: rgba(255,255,255,0.2); color: #fff; }
    .ix-nav button.on::before { content: ''; position: absolute; left: -12px; top: 6px; bottom: 6px; width: 3px; border-radius: 0 3px 3px 0; background: #ffd23f; }
    .ix-nav button.on svg { color: #ffd23f; }
    .ix-foot { border-top: 1px solid rgba(255,255,255,0.14); padding-top: 14px; margin-top: 14px; }
    .ix-email { font-size: 11.5px; color: rgba(255,255,255,0.6); margin: 0 10px 10px; word-break: break-all; }
    .ix-out { display: flex; align-items: center; gap: 8px; background: none; border: none; color: #ffb4a8; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; padding: 4px 10px; }
    .ix-top, .ix-tabs { display: none; }
    .ix-main { flex: 1; min-width: 0; }
    @media (max-width: 760px) {
      .ix { flex-direction: column; }
      .ix-side { display: none; }
      .ix-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 16px 10px; background: var(--bg-card); }
      .ix-top .ix-brand-tag { color: var(--text-muted); }
      .ix-top .ix-out { color: var(--status-red-text); padding: 6px 0; }
      .ix-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 4px 16px 12px; background: var(--bg-card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 5; scrollbar-width: none; }
      .ix-tabs::-webkit-scrollbar { display: none; }
      .ix-tabs button { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); font-size: 13.5px; font-weight: 600; font-family: inherit; cursor: pointer; }
      .ix-tabs button.on { background: var(--accent); border-color: var(--accent); color: #fff; }
      /* Sidorna har 32px 36px luft för dator; på telefon räcker 16px. */
      .ix-main > div { padding: 18px 16px calc(env(safe-area-inset-bottom, 0px) + 32px) !important; max-width: none !important; }
      .ix-main [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
      .ix-main [style*="minmax(190px"], .ix-main [style*="minmax(180px"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
      .ix-main [style*="border-radius: 16px"] { border-radius: 14px !important; }
      .ix-main [style*="font-size: 26px"] { font-size: 22px !important; }
    }
  `;

  return (
    <div className="ix">
      <style>{css}</style>
      <aside className="ix-side">
        <div className="ix-brand">
          <BokixWordmark height={30} />
          <span className="ix-brand-tag">Internt</span>
        </div>
        <nav className="ix-nav">
          {navItems.map(item => (
            <button key={item.id} type="button" className={activeTab === item.id ? 'on' : undefined} onClick={() => setActiveTab(item.id)}>
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="ix-foot">
          <div className="ix-email">{adminEmail}</div>
          <button className="ix-out" onClick={handleSignOut}><LogOut size={15} /> Logga ut</button>
        </div>
      </aside>

      <header className="ix-top">
        <div className="ix-brand" style={{ padding: 0, margin: 0, border: 'none' }}>
          <BokixWordmark height={26} />
          <span className="ix-brand-tag">Internt</span>
        </div>
        <button className="ix-out" onClick={handleSignOut} aria-label="Logga ut"><LogOut size={16} /> Logga ut</button>
      </header>
      <nav className="ix-tabs">
        {navItems.map(item => (
          <button key={item.id} type="button" className={activeTab === item.id ? 'on' : undefined} onClick={() => { setActiveTab(item.id); window.scrollTo(0, 0); }}>
            <item.icon size={15} />
            {item.label}
          </button>
        ))}
      </nav>

      <main className="ix-main">
        {activeTab === 'overview' && <OverviewAdmin onOpenTab={(t) => { setActiveTab(t); window.scrollTo(0, 0); }} />}
        {activeTab === 'analytics' && <AnalyticsAdmin />}
        {activeTab === 'payments' && <PaymentsAdmin />}
        {activeTab === 'security' && <SecurityAdmin />}
        {activeTab === 'users' && <UsersAdmin />}
        {activeTab === 'inbox' && <InboxAdmin />}
        {activeTab === 'system' && <SystemAdmin onOpenTab={setActiveTab} />}
        {activeTab === 'status' && <StatusAdmin />}
      </main>
    </div>
  );
}
