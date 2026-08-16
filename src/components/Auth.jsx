import React, { useState } from 'react';
import {
  BookOpen, LogIn, UserPlus, Building2, Mail, Lock,
  ArrowRight, ArrowLeft, ShieldCheck, Check, User, Hash,
  Zap, ScanLine, RefreshCw, Bell,
  FileText, BarChart3, Receipt, Users, Shield, Briefcase,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { detectOrgType, formatOrgNr } from '../utils/orgType';
import { BRAND } from '../utils/brandColors';

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '10px',
  fontSize: '14.5px', color: '#111827', background: '#f8fafc', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', transition: 'all 0.2s',
};

const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em',
};

const REGISTER_STEPS = ['Personlig info', 'Bekräfta e-post', 'Företag'];

// ── Översikt över appens faktiska huvudsektioner (samma sex som den
// riktiga inloggade sidomenyn i App.jsx), visad på sista registrerings-
// steget — en snabb "karta" över vad som väntar innan man ens loggat in
// första gången, inte en påhittad funktionslista. ──
const APP_SECTIONS_OVERVIEW = [
  { icon: FileText, label: 'Fakturering' },
  { icon: BarChart3, label: 'Bokföring' },
  { icon: Receipt, label: 'Utgifter' },
  { icon: Briefcase, label: 'Projekt' },
  { icon: Users, label: 'Anställda och lön' },
  { icon: Shield, label: 'Skatt och bokslut' },
];

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [regStep, setRegStep] = useState(0); // 0=personal, 1=email-confirm, 2=company

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Step 0 – Personal info
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');

  // Step 2 – Company
  const [regCompany, setRegCompany] = useState('');
  const [regOrgNr, setRegOrgNr] = useState('');

  const orgType = detectOrgType(regOrgNr);

  // Switch between login/register and reset step
  const switchMode = (login) => {
    setIsLogin(login);
    setRegStep(0);
    setErrorMsg('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      if (!loginEmail || !loginPassword) throw new Error('Fyll i alla fält');
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) throw error;
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (regStep === 0) {
      if (!regFirstName.trim()) { setErrorMsg('Ange ditt förnamn'); return; }
      if (!regEmail.trim()) { setErrorMsg('Ange din e-postadress'); return; }
      if (regPassword.length < 8) { setErrorMsg('Lösenordet måste vara minst 8 tecken'); return; }
      if (regPassword !== regPassword2) { setErrorMsg('Lösenorden matchar inte'); return; }
      setRegStep(1);
      return;
    }

    if (regStep === 1) {
      // Email step – just a placeholder, user confirms and moves to company
      setRegStep(2);
      return;
    }

    if (regStep === 2) {
      if (!regCompany.trim()) { setErrorMsg('Ange företagsnamn'); return; }
      if (!regOrgNr.trim() || regOrgNr.replace(/\D/g, '').length < 10) {
        setErrorMsg('Ange ett giltigt organisationsnummer (10 siffror)');
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: regEmail,
          password: regPassword,
          options: {
            data: {
              first_name: regFirstName,
              last_name: regLastName,
              company_name: regCompany,
              org_nr: regOrgNr,
            }
          }
        });
        if (error) throw error;
        if (!data.session) {
          setErrorMsg('Konto skapat! Kontrollera din e-post och klicka på bekräftelselänken, logga sedan in.');
        }
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div id="auth-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.greenLight, fontFamily: "'Inter', sans-serif", padding: '32px 20px' }}>
      <style>{`
        #auth-root, #auth-root *, #auth-root *::before, #auth-root *::after { box-sizing: border-box; }
        #auth-root button { -webkit-appearance: none; appearance: none; -webkit-tap-highlight-color: transparent; }
        .auth-card { display: flex; width: 100%; max-width: 960px; }
        .auth-brand { display: flex; }
        .auth-feature-row { transition: transform 0.2s ease; }
        .auth-feature-row:hover { transform: translateX(3px); }
        @media (max-width: 760px) {
          .auth-card { flex-direction: column; }
          .auth-brand { padding: 28px 24px !important; }
          .auth-brand-features, .auth-brand-badges { display: none !important; }
          .auth-form-panel { width: 100% !important; padding: 28px 22px !important; }
        }
      `}</style>

      {/* Bunden i ett enda rundat kort med begränsad maxbredd istället för att
          varumärkespanelen sträcker sig flex:1 över hela viewporten — det var
          det som gjorde sidan kännas tom och överdimensionerad på en bred skärm. */}
      <div className="auth-card" style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(15,23,42,0.10)' }}>

        {/* Vänster: varumärke — solid mörkgrön panel plus en
            automations-fokuserad funktionslista (inte bara "vad appen har"
            utan "vad den gör åt dig automatiskt"). */}
        <div className="auth-brand" style={{ width: '360px', flexShrink: 0, flexDirection: 'column', padding: '44px 36px', position: 'relative', overflow: 'hidden', background: BRAND.greenDark }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
            <div style={{ width: 52, height: 52, borderRadius: '14px', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={26} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '23px', fontWeight: 800, letterSpacing: '-0.02em', color: 'white', margin: 0 }}>Bokix</h1>
              <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.65)', margin: '2px 0 0' }}>Bokföring på autopilot.</p>
            </div>
          </div>

          {/* Funktionslista — automation i fokus, med skilda ikoner istället
              för samma bock tre gånger, så det inte känns som en generisk mall. */}
          <div className="auth-brand-features" style={{ marginTop: '38px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
            {[
              { icon: Zap, title: 'Automatisk bokföring', desc: 'Fakturor och kvitton bokförs automatiskt — inget manuellt kontering.' },
              { icon: ScanLine, title: 'Smart kvittoscanning', desc: 'Fota kvittot, resten (belopp, moms, konto) läses av automatiskt.' },
              { icon: RefreshCw, title: 'Moms & AGI utan krångel', desc: 'Sammanställningar räknas fram löpande, redo när det är dags.' },
              { icon: Bell, title: 'Automatiska påminnelser', desc: 'Förfallna fakturor och uppgifter flaggas innan de blir ett problem.' },
            ].map(f => (
              <div key={f.title} className="auth-feature-row" style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <f.icon size={14} color="#c8f7bd" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'white', fontSize: '13.5px' }}>{f.title}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '28px', color: '#c8f7bd' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700 }}>Mindre admin, mer tid för verksamheten.</span>
          </div>

          <div className="auth-brand-badges" style={{ marginTop: '14px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {['100% Säkert', 'GDPR', 'Krypterat'].map(badge => (
              <div key={badge} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                <ShieldCheck size={12} /> {badge}
              </div>
            ))}
          </div>
        </div>

        {/* Höger: formulär */}
        <div className="auth-form-panel" style={{ flex: 1, minWidth: 0, background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '44px 48px' }}>

        {/* Mode tabs */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '32px' }}>
          <button onClick={() => switchMode(true)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', background: isLogin ? 'white' : 'transparent', color: isLogin ? '#111827' : '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isLogin ? '0 2px 4px rgba(0,0,0,0.04)' : 'none', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <LogIn size={16} /> Logga in
          </button>
          <button onClick={() => switchMode(false)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', background: !isLogin ? 'white' : 'transparent', color: !isLogin ? '#111827' : '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: !isLogin ? '0 2px 4px rgba(0,0,0,0.04)' : 'none', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={16} /> Nytt konto
          </button>
        </div>

        {/* LOGIN */}
        {isLogin ? (
          <>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', marginBottom: '6px', letterSpacing: '-0.02em' }}>Välkommen tillbaka</h2>
              <p style={{ fontSize: '14px', color: '#64748b' }}>Logga in på ditt konto nedan.</p>
            </div>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>E-postadress</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} color="#94a3b8" style={{ position: 'absolute', top: 13, left: 14, pointerEvents: 'none' }} />
                  <input type="email" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="din@epost.se" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Lösenord</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#94a3b8" style={{ position: 'absolute', top: 13, left: 14, pointerEvents: 'none' }} />
                  <input type="password" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                </div>
              </div>
              {errorMsg && <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>}
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: 'white', cursor: loading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(61,122,46,0.25)', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Loggar in...' : 'Logga in'} <ArrowRight size={16} />
              </button>
            </form>
          </>
        ) : (
          /* REGISTER - Multi-step */
          <>
            {/* Step indicator */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {REGISTER_STEPS.map((s, i) => (
                  <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ height: '4px', borderRadius: '2px', background: i <= regStep ? BRAND.green : '#e2e8f0', transition: 'background 0.3s' }} />
                    <span style={{ fontSize: '11px', fontWeight: i === regStep ? 700 : 500, color: i <= regStep ? BRAND.green : '#94a3b8' }}>{s}</span>
                  </div>
                ))}
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '4px', letterSpacing: '-0.02em' }}>
                {regStep === 0 && 'Personlig info'}
                {regStep === 1 && 'Bekräfta e-post'}
                {regStep === 2 && 'Ditt företag'}
              </h2>
              <p style={{ fontSize: '13.5px', color: '#64748b' }}>
                {regStep === 0 && 'Fyll i dina uppgifter för att skapa ett konto.'}
                {regStep === 1 && `Vi skickar ett bekräftelsemail till ${regEmail}.`}
                {regStep === 2 && 'Ange ditt företag – det här är obligatoriskt.'}
              </p>
            </div>

            <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* STEP 0 – Personal info */}
              {regStep === 0 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Förnamn *</label>
                      <div style={{ position: 'relative' }}>
                        <User size={16} color="#94a3b8" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                        <input type="text" style={{ ...inputStyle, paddingLeft: '38px' }} placeholder="Anna" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} required />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Efternamn</label>
                      <input type="text" style={inputStyle} placeholder="Svensson" value={regLastName} onChange={e => setRegLastName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>E-postadress *</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} color="#94a3b8" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input type="email" style={{ ...inputStyle, paddingLeft: '38px' }} placeholder="anna@foretag.se" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Lösenord *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="#94a3b8" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input type="password" style={{ ...inputStyle, paddingLeft: '38px' }} placeholder="Minst 8 tecken" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={8} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Bekräfta lösenord *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="#94a3b8" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input type="password" style={{ ...inputStyle, paddingLeft: '38px', borderColor: regPassword2 && regPassword2 !== regPassword ? '#f43f5e' : undefined }} placeholder="Upprepa lösenord" value={regPassword2} onChange={e => setRegPassword2(e.target.value)} required />
                    </div>
                  </div>
                </>
              )}

              {/* STEP 1 – Confirm email */}
              {regStep === 1 && (
                <div style={{ padding: '24px', background: '#f0fdf4', borderRadius: '14px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Mail size={24} color="white" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#111827', marginBottom: '8px' }}>Kontrollera din inkorg</div>
                  <div style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.6 }}>
                    Vi kommer att skicka ett bekräftelsemail till<br />
                    <strong>{regEmail}</strong><br />
                    efter att kontot skapats. Klicka på länken i mailet för att aktivera ditt konto.
                  </div>
                  <div style={{ marginTop: '16px', padding: '10px 14px', background: BRAND.greenLight, borderRadius: '8px', fontSize: '12.5px', color: BRAND.greenDark, fontWeight: 600 }}>
                    💡 Du kan fortfarande använda appen direkt – bekräftelsen aktiverar alla funktioner.
                  </div>
                </div>
              )}

              {/* STEP 2 – Company */}
              {regStep === 2 && (
                <>
                  <div>
                    <label style={labelStyle}>Företagsnamn *</label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={16} color="#94a3b8" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input type="text" style={{ ...inputStyle, paddingLeft: '38px' }} placeholder="Ditt Företag AB" value={regCompany} onChange={e => setRegCompany(e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Organisationsnummer * <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(10 siffror)</span></label>
                    <div style={{ position: 'relative' }}>
                      <Hash size={16} color="#94a3b8" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input
                        type="text"
                        inputMode="numeric"
                        style={{ ...inputStyle, paddingLeft: '38px' }}
                        placeholder="556123-4567"
                        value={regOrgNr}
                        onChange={e => setRegOrgNr(formatOrgNr(e.target.value))}
                        required
                      />
                    </div>
                    {orgType && (
                      <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: BRAND.greenLight, borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: BRAND.greenDark }}>
                        <Check size={12} /> Identifierad som: {orgType}
                      </div>
                    )}
                  </div>

                  {/* Översikt — vad som väntar direkt efter att kontot är
                      skapat, så det sista steget inte känns som ett svart
                      hål innan man loggat in första gången. */}
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '9px' }}>
                      Det här väntar direkt
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px' }}>
                      {APP_SECTIONS_OVERVIEW.map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '9px' }}>
                          <s.icon size={13} color={BRAND.greenDark} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {errorMsg && (
                <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                {regStep > 0 && (
                  <button type="button" onClick={() => { setRegStep(s => s - 1); setErrorMsg(''); }} style={{ padding: '12px 20px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#475569', cursor: 'pointer', background: 'white', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                    <ArrowLeft size={14} /> Tillbaka
                  </button>
                )}
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, color: 'white', cursor: loading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(61,122,46,0.25)', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Skapar konto...' : regStep === REGISTER_STEPS.length - 1 ? 'Skapa konto' : 'Fortsätt'} <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
