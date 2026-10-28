import React, { useCallback, useEffect, useState } from 'react';
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
import { useAdminData } from './useAdminData';
import { INTERNAL_CSS } from './internalStyles';

// ── /internal — den dolda admin-panelen ─────────────────────────────────
// Ingen länk hit någonstans i den publika navigeringen (MarketingLayout.jsx/
// AppRouter.jsx har bara routen, inget nav-item) — hittas genom att veta
// att den finns, samma "security by not advertising it" som vilken
// intern verktygssida som helst, ALDRIG den enda spärren i sig (den
// riktiga spärren är api/admin/index.js:s ADMIN_EMAILS, se den filens
// kommentar).
//
// Sidorna byggs av samma delar (ui.jsx) med en gemensam stil
// (internalStyles.js). Fliken står i adressen (#betalningar), så att en
// omladdning eller en delad länk hamnar rätt och bakåtknappen fungerar.

const NAV_GROUPS = [
  {
    label: 'Överblick',
    items: [
      { id: 'overview', slug: 'oversikt', label: 'Översikt', icon: LayoutDashboard },
      { id: 'analytics', slug: 'analys', label: 'Analys', icon: BarChart3 },
    ],
  },
  {
    label: 'Kunder',
    items: [
      { id: 'users', slug: 'anvandare', label: 'Användare', icon: Users },
      { id: 'payments', slug: 'betalningar', label: 'Betalningar', icon: CreditCard },
      { id: 'inbox', slug: 'inkorg', label: 'Inkorg', icon: Inbox },
    ],
  },
  {
    label: 'Drift',
    items: [
      { id: 'system', slug: 'system', label: 'Systemstatus', icon: Server },
      { id: 'status', slug: 'statussidan', label: 'Statussidan', icon: CheckCircle2 },
      { id: 'security', slug: 'sakerhet', label: 'Säkerhet', icon: ShieldAlert },
    ],
  },
];
const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);
const tabFromHash = () => NAV_ITEMS.find(i => `#${i.slug}` === window.location.hash)?.id || 'overview';

export default function InternalApp() {
  const [status, setStatus] = useState('checking'); // checking | needs-login | unauthorized | authorized | error
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
      // Ett lätt anrop som bara admins får svar på.
      await adminGet({ resource: 'overview' });
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
    return <div className="ix"><style>{INTERNAL_CSS}</style></div>;
  }

  if (status === 'needs-login') {
    return <InternalAuth onAuthenticated={checkAccess} notice={loginNotice} />;
  }

  if (status === 'unauthorized' || status === 'error') {
    return (
      <div className="ix" style={{ alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <style>{INTERNAL_CSS}</style>
        <div>
          <ShieldAlert size={30} color="var(--status-red-text)" />
          <h1 className="ix-title" style={{ fontSize: '17px', marginTop: '12px' }}>{status === 'unauthorized' ? 'Ingen åtkomst' : 'Något gick fel'}</h1>
          <p className="ix-desc" style={{ marginBottom: '18px' }}>
            {status === 'unauthorized' ? `${adminEmail} har inte behörighet till admin-panelen.` : (errorMsg || 'Försök igen om en stund.')}
          </p>
          <button type="button" className="ix-btn" onClick={status === 'unauthorized' ? handleSignOut : checkAccess}>
            {status === 'unauthorized' ? 'Logga ut' : 'Försök igen'}
          </button>
        </div>
      </div>
    );
  }

  return <Shell adminEmail={adminEmail} onSignOut={handleSignOut} />;
}

// Panelen när inloggningen är klar. Översiktens siffror hämtas här så att
// menyn kan visa antal (olästa meddelanden, fel, betalningar att följa upp),
// och samma svar används av Översikten.
function Shell({ adminEmail, onSignOut }) {
  const [activeTab, setActiveTab] = useState(tabFromHash);
  const overview = useAdminData({ resource: 'overview' });
  const o = overview.data?.accounts ? overview.data : null;

  useEffect(() => {
    const onHash = () => setActiveTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openTab = useCallback((id) => {
    const item = NAV_ITEMS.find(i => i.id === id);
    if (!item) return;
    if (window.location.hash !== `#${item.slug}`) window.location.hash = item.slug;
    setActiveTab(id);
    window.scrollTo(0, 0);
  }, []);

  // [antal, larm?] per flik.
  const counts = {
    inbox: o ? [o.unhandledMessages, o.unhandledMessages > 0] : null,
    payments: o?.subscriptions.atRisk ? [o.subscriptions.atRisk, true] : null,
    system: o?.errorsLastDay.total ? [o.errorsLastDay.total, true] : null,
  };

  const navButton = (item, iconSize) => {
    const [n, alert] = counts[item.id] || [];
    return (
      <button
        key={item.id}
        type="button"
        className={`ix-nav-item${activeTab === item.id ? ' on' : ''}`}
        aria-current={activeTab === item.id ? 'page' : undefined}
        onClick={() => openTab(item.id)}
      >
        <item.icon size={iconSize} />
        <span className="ix-nav-text">{item.label}</span>
        {n > 0 && <span className={`ix-count${alert ? ' alert' : ''}`} aria-label={`${n} att hantera`}>{n}</span>}
      </button>
    );
  };

  return (
    <div className="ix">
      <style>{INTERNAL_CSS}</style>

      <aside className="ix-side">
        <div className="ix-brand">
          <BokixWordmark height={28} />
          <span className="ix-brand-tag">Internt</span>
        </div>
        <nav className="ix-nav" aria-label="Admin">
          {NAV_GROUPS.map(group => (
            <div className="ix-nav-group" key={group.label}>
              <div className="ix-nav-label">{group.label}</div>
              {group.items.map(item => navButton(item, 17))}
            </div>
          ))}
        </nav>
        <div className="ix-foot">
          <div className="ix-email">{adminEmail}</div>
          <button type="button" className="ix-out" onClick={onSignOut}><LogOut size={15} /> Logga ut</button>
        </div>
      </aside>

      {/* Telefon: loggan och utloggning överst, flikarna som en rad att svepa i. */}
      <header className="ix-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BokixWordmark height={24} />
          <span className="ix-brand-tag">Internt</span>
        </div>
        <button type="button" className="ix-out" onClick={onSignOut}><LogOut size={16} /> Logga ut</button>
      </header>
      <nav className="ix-tabs" aria-label="Admin">
        {NAV_ITEMS.map(item => navButton(item, 15))}
      </nav>

      <main className="ix-main">
        {activeTab === 'overview' && <OverviewAdmin overview={overview} onOpenTab={openTab} />}
        {activeTab === 'analytics' && <AnalyticsAdmin />}
        {activeTab === 'payments' && <PaymentsAdmin />}
        {activeTab === 'security' && <SecurityAdmin />}
        {activeTab === 'users' && <UsersAdmin />}
        {activeTab === 'inbox' && <InboxAdmin />}
        {activeTab === 'system' && <SystemAdmin onOpenTab={openTab} />}
        {activeTab === 'status' && <StatusAdmin />}
      </main>
    </div>
  );
}
