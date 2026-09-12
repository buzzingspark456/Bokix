import React, { useEffect, useState } from 'react';
import { FileText, BarChart3, CreditCard, ShieldAlert, Users, LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import InternalAuth from './InternalAuth';
import BlogAdmin from './BlogAdmin';
import { adminGet } from './adminApi';

// ── /internal — den dolda admin-panelen ─────────────────────────────────
// Ingen länk hit någonstans i den publika navigeringen (MarketingLayout.jsx/
// AppRouter.jsx har bara routen, inget nav-item) — hittas genom att veta
// att den finns, samma "security by not advertising it" som vilken
// intern verktygssida som helst, ALDRIG den enda spärren i sig (den
// riktiga spärren är api/admin/index.js:s ADMIN_EMAILS, se den filens
// kommentar). Bygger ut med fler `resource`-flikar i samma mönster när
// nästa admin-delsystem byggs (betalningar, säkerhetslogg, användare) —
// se roadmap-flikarna nedan, medvetet gråmarkerade i stället för dolda,
// så det är tydligt vad som är på gång och vad som redan fungerar.
export default function InternalApp() {
  const [status, setStatus] = useState('checking'); // checking | needs-login | unauthorized | authorized | error
  const [errorMsg, setErrorMsg] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const checkAccess = async () => {
    setStatus('checking');
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session) { setStatus('needs-login'); return; }
    setAdminEmail(session.user?.email || '');
    try {
      // Samma anrop UI:t ändå behöver göra för att fylla bloggsidan —
      // dubbelt syfte, inte ett extra "får jag vara här?"-anrop.
      await adminGet({ resource: 'blog' });
      setStatus('authorized');
    } catch (err) {
      if (String(err.message || '').includes('behörighet')) setStatus('unauthorized');
      else { setErrorMsg(err.message); setStatus('error'); }
    }
  };

  useEffect(() => { checkAccess(); }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setStatus('needs-login');
  };

  if (status === 'checking') {
    return <div style={{ minHeight: '100vh', background: '#0a0f0c' }} />;
  }

  if (status === 'needs-login') {
    return <InternalAuth onAuthenticated={checkAccess} />;
  }

  if (status === 'unauthorized') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f0c', padding: '24px', textAlign: 'center' }}>
        <div>
          <ShieldAlert size={32} color="#f87171" style={{ marginBottom: '14px' }} />
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#e8ece9', marginBottom: '8px' }}>Ingen åtkomst</div>
          <div style={{ fontSize: '13.5px', color: 'rgba(232,236,233,0.55)', marginBottom: '20px' }}>
            {adminEmail} har inte behörighet till admin-panelen.
          </div>
          <button onClick={handleSignOut} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(232,236,233,0.8)', borderRadius: '9px', padding: '9px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Logga ut
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f0c', color: '#f87171', fontSize: '14px', padding: '24px', textAlign: 'center' }}>
        {errorMsg || 'Något gick fel.'}
      </div>
    );
  }

  const navItems = [
    { id: 'blog', label: 'Blogg', icon: FileText, live: true },
    { id: 'analytics', label: 'Analys', icon: BarChart3, live: false },
    { id: 'payments', label: 'Betalningar', icon: CreditCard, live: false },
    { id: 'security', label: 'Säkerhet', icon: ShieldAlert, live: false },
    { id: 'users', label: 'Användare', icon: Users, live: false },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0a0f0c', color: '#e8ece9', fontFamily: "'Inter', sans-serif" }}>
      <aside style={{ width: 220, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)', padding: '20px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '0 8px', marginBottom: '28px' }}>
          <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'rgba(11,99,41,0.25)', border: '1px solid rgba(132,204,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={14} color="#84cc16" />
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Bokix Internal</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {navItems.map(item => (
            <div
              key={item.id}
              title={item.live ? undefined : 'Kommer snart'}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px',
                fontSize: '13.5px', fontWeight: 600,
                background: item.live ? 'rgba(132,204,22,0.12)' : 'transparent',
                color: item.live ? '#e8ece9' : 'rgba(232,236,233,0.32)',
                cursor: item.live ? 'default' : 'not-allowed',
              }}
            >
              <item.icon size={15} />
              {item.label}
              {!item.live && <span style={{ marginLeft: 'auto', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(232,236,233,0.3)' }}>Snart</span>}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', marginTop: '14px' }}>
          <div style={{ fontSize: '11.5px', color: 'rgba(232,236,233,0.4)', marginBottom: '10px', wordBreak: 'break-all' }}>{adminEmail}</div>
          <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'rgba(232,236,233,0.5)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            <LogOut size={14} /> Logga ut
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <BlogAdmin />
      </main>
    </div>
  );
}
