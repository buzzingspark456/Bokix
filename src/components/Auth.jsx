import React, { useState } from 'react';
import { BookOpen, LogIn, UserPlus, Building2, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regOrgNr, setRegOrgNr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isLogin) {
        if (!loginEmail || !loginPassword) throw new Error('Fyll i alla fält');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });
        if (error) throw error;
        // The onAuthStateChange in App.jsx will handle the login transition
      } else {
        if (!regEmail || !regPassword || !regCompany || !regOrgNr) throw new Error('Fyll i alla fält');
        const { data, error } = await supabase.auth.signUp({
          email: regEmail,
          password: regPassword,
          options: {
            data: {
              company_name: regCompany,
              org_nr: regOrgNr,
            }
          }
        });
        if (error) throw error;
        
        if (!data.session) {
          setErrorMsg('Konto skapat! Men du måste stänga av "Confirm email" i Supabase (Authentication -> Providers -> Email) för att automatisk inloggning ska fungera. Eller klicka på länken i mailet du just fick.');
          setLoading(false);
          return;
        }
        // User is created and auto-logged in, onAuthStateChange handles it
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '10px',
    fontSize: '14.5px', color: '#111827', background: '#f8fafc', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', transition: 'all 0.2s', marginBottom: '16px'
  };

  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg, #f8fffe 0%, #f0f7ff 100%)', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Left side: Branding */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,168,90,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-50px', right: '-50px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(58,143,193,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'auto', position: 'relative' }}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #5ba85a, #3a8fc1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={22} color="white" />
          </div>
          <span style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827' }}>Bokföring<span style={{ color: '#5ba85a' }}>.io</span></span>
        </div>

        <div style={{ position: 'relative', zIndex: 10, maxWidth: '440px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1.1, color: '#0f172a', marginBottom: '20px', letterSpacing: '-0.04em' }}>
            Bokföring ska vara {isLogin ? 'enkelt.' : 'kul (nästan).'}
          </h1>
          <p style={{ fontSize: '18px', color: '#475569', lineHeight: 1.6, marginBottom: '40px' }}>
            {isLogin 
              ? 'Logga in för att få en tydlig överblick över hur ditt företag mår, skicka fakturor och hantera utgifter.'
              : 'Skapa ditt konto på under en minut och upptäck hur enkelt det är att driva företag med rätt verktyg.'}
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {['100% Säkert', 'BankID', 'Krypterat'].map(badge => (
              <div key={badge} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                <ShieldCheck size={16} color="#5ba85a" /> {badge}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'auto', fontSize: '12px', color: '#94a3b8', position: 'relative' }}>
          © 2026 Bokföring.io. Alla rättigheter förbehållna.
        </div>
      </div>

      {/* Right side: Form */}
      <div style={{ width: '480px', background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', boxShadow: '-20px 0 40px rgba(0,0,0,0.05)', flexShrink: 0, zIndex: 20 }}>
        
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            {isLogin ? 'Välkommen tillbaka' : 'Kom igång gratis'}
          </h2>
          <p style={{ fontSize: '14.5px', color: '#64748b' }}>
            {isLogin ? 'Logga in på ditt konto nedan.' : 'Inga betalkort krävs. 30 dagars gratis provperiod.'}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '32px' }}>
          <button onClick={() => setIsLogin(true)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', background: isLogin ? 'white' : 'transparent', color: isLogin ? '#111827' : '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isLogin ? '0 2px 4px rgba(0,0,0,0.04)' : 'none', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <LogIn size={16} /> Logga in
          </button>
          <button onClick={() => setIsLogin(false)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', background: !isLogin ? 'white' : 'transparent', color: !isLogin ? '#111827' : '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: !isLogin ? '0 2px 4px rgba(0,0,0,0.04)' : 'none', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={16} /> Nytt konto
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isLogin ? (
            <>
              <label style={labelStyle}>E-postadress</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="#94a3b8" style={{ position: 'absolute', top: 13, left: 14 }} />
                <input type="email" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="din@epost.se" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
              </div>

              <label style={labelStyle}>Lösenord</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#94a3b8" style={{ position: 'absolute', top: 13, left: 14 }} />
                <input type="password" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
              </div>
            </>
          ) : (
            <>
              <label style={labelStyle}>E-postadress *</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="#94a3b8" style={{ position: 'absolute', top: 13, left: 14 }} />
                <input type="email" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="din@epost.se" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
              </div>

              <label style={labelStyle}>Lösenord *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#94a3b8" style={{ position: 'absolute', top: 13, left: 14 }} />
                <input type="password" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="Minst 8 tecken" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={8} />
              </div>

              <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0 24px' }} />

              <label style={labelStyle}>Företagsnamn *</label>
              <div style={{ position: 'relative' }}>
                <Building2 size={18} color="#94a3b8" style={{ position: 'absolute', top: 13, left: 14 }} />
                <input type="text" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="Ditt Företag AB" value={regCompany} onChange={e => setRegCompany(e.target.value)} required />
              </div>

              <label style={labelStyle}>Organisationsnummer / VAT *</label>
              <input type="text" style={inputStyle} placeholder="556XXX-XXXX" value={regOrgNr} onChange={e => setRegOrgNr(e.target.value)} required />
            </>
          )}

          {errorMsg && (
            <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #5ba85a, #4a9e49)', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: 'white', cursor: loading ? 'wait' : 'pointer', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 8px 20px -5px rgba(91,168,90,0.4)', transition: 'all 0.2s', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
            onMouseEnter={e => { if(!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { if(!loading) e.currentTarget.style.transform = 'none' }}
          >
            {loading ? 'Laddar...' : (isLogin ? 'Logga in' : 'Skapa företagskonto')} <ArrowRight size={16} />
          </button>
        </form>

      </div>
    </div>
  );
}
