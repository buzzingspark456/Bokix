import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, KeyRound } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// ── Inloggningen till /internal ─────────────────────────────────────────
// Medvetet ett HELT annat utseende än den vanliga kund-inloggningen
// (Auth.jsx) — mörk, sparsam, "det här är något annat"-känsla i stället
// för Bokix egna varumärkesfärger, precis som kundönskemålet bad om.
// Samma Supabase-konto/lösenord som en vanlig kund (ingen egen andra
// auth-databas att hålla säker) — den RIKTIGA spärren är att bara EN
// hårdkodad e-postadress någonsin får ett godkänt svar från
// api/admin/index.js (ADMIN_EMAILS där), oavsett vem som lyckas logga in
// här. Den här skärmen är alltså bara vägen in, inte behörighetsgränsen.
//
// Hanterar samma tvåstegsverifiering (TOTP) som kontot kan ha aktiverat
// under Inställningar → Min profil — utan den här grenen hade ett konto
// med 2FA påslaget fastnat efter rätt lösenord, exakt samma mfaChallenge-
// mönster som App.jsx redan använder efter en vanlig inloggning.
export default function InternalAuth({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState(null); // { factorId, challengeId } | null
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const factor = factorsData?.totp?.[0];
        if (factor) {
          const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
          if (challengeError) throw challengeError;
          setMfaChallenge({ factorId: factor.id, challengeId: challenge.id });
          setLoading(false);
          return;
        }
      }
      onAuthenticated();
    } catch (err) {
      setError(err?.message === 'Invalid login credentials' ? 'Fel e-post eller lösenord.' : (err?.message || 'Något gick fel.'));
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaChallenge.factorId, challengeId: mfaChallenge.challengeId, code });
    if (verifyError) {
      setError('Fel kod. Försök igen.');
      setLoading(false);
      return;
    }
    onAuthenticated();
  };

  const inputStyle = {
    width: '100%', padding: '13px 14px 13px 42px', fontSize: '14.5px', fontWeight: 500,
    color: '#e8ece9', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px', fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f0c', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'rgba(11,99,41,0.25)', border: '1px solid rgba(132,204,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} color="#84cc16" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#e8ece9', letterSpacing: '-0.01em' }}>Bokix Internal</div>
            <div style={{ fontSize: '11px', color: 'rgba(232,236,233,0.45)' }}>Endast behörig personal</div>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px' }}>
          {!mfaChallenge ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(232,236,233,0.6)', marginBottom: '6px' }}>E-post</label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck size={15} color="rgba(232,236,233,0.35)" style={{ position: 'absolute', left: 14, top: 14 }} />
                  <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} autoComplete="username" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(232,236,233,0.6)', marginBottom: '6px' }}>Lösenord</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="rgba(232,236,233,0.35)" style={{ position: 'absolute', left: 14, top: 14 }} />
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} autoComplete="current-password" />
                </div>
              </div>
              {error && <div style={{ fontSize: '12.5px', color: '#f87171', lineHeight: 1.5 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                padding: '13px', background: '#0b6329', border: 'none', borderRadius: '10px',
                color: 'white', fontWeight: 700, fontSize: '14px', cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginTop: '4px',
              }}>
                {loading ? 'Loggar in...' : 'Logga in'} <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyMfa} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(232,236,233,0.8)', fontSize: '13.5px', fontWeight: 600 }}>
                <KeyRound size={15} /> Engångskod
              </div>
              <input
                type="text" inputMode="numeric" autoFocus maxLength={6} placeholder="123456"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ ...inputStyle, padding: '13px 14px', textAlign: 'center', fontSize: '20px', fontWeight: 700, letterSpacing: '6px' }}
              />
              {error && <div style={{ fontSize: '12.5px', color: '#f87171' }}>{error}</div>}
              <button type="submit" disabled={loading || code.length !== 6} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                padding: '13px', background: '#0b6329', border: 'none', borderRadius: '10px',
                color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
                opacity: (loading || code.length !== 6) ? 0.6 : 1,
              }}>
                {loading ? 'Bekräftar...' : 'Bekräfta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
