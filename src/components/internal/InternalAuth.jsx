import React, { useRef, useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, Fingerprint } from '../icons';
import { supabase } from '../../supabaseClient';
import Turnstile from '../Turnstile';
import { passkeysAvailable, isPasskeyCancel, rememberPasskeyOnDevice } from '../../utils/sessionPolicy';

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
// Två sätt in (2026-10-07, tvåfaktorskoden borttagen): e-post + lösenord,
// eller Face ID/fingeravtryck med en passkey som lagts till i appen under
// Inställningar → Min profil.
export default function InternalAuth({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Supabase kräver captcha på all lösenordsinloggning när Turnstile är
  // påslaget där, även här. Token gäller ett försök, `captchaRound` ger en ny.
  const captchaRef = useRef(null);
  const [captchaRound, setCaptchaRound] = useState(0);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let captchaToken = null;
      try { captchaToken = await captchaRef.current?.execute(); } catch { throw new Error('Kunde inte verifiera att du inte är en robot. Ladda om sidan och försök igen. Har du en annonsblockerare, pausa den för bokix.se.'); }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email, password,
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (signInError) throw signInError;
      onAuthenticated();
    } catch (err) {
      setError(err?.message === 'Invalid login credentials' ? 'Fel e-post eller lösenord.' : (err?.message || 'Något gick fel.'));
      setCaptchaRound(n => n + 1);
      setLoading(false);
    }
  };

  // Ingen e-post behövs: enheten visar vilka konton den har en passkey för.
  // Avbryter man Face ID-rutan visas inget fel.
  const handlePasskeyLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { error: passkeyError } = await supabase.auth.signInWithPasskey();
      if (passkeyError) throw passkeyError;
      rememberPasskeyOnDevice(true);
      onAuthenticated();
    } catch (err) {
      if (!isPasskeyCancel(err)) setError('Inloggningen med Face ID misslyckades. Har du lagt till en passkey på den här enheten?');
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '13px 14px 13px 42px', fontSize: '14.5px', fontWeight: 500,
    color: '#e8ece9', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px', fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f0c', padding: '24px' }}>
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
            <Turnstile key={captchaRound} ref={captchaRef} onDemand />
            {error && <div style={{ fontSize: '12.5px', color: '#f87171', lineHeight: 1.5 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              padding: '13px', background: '#0b6329', border: 'none', borderRadius: '10px',
              color: 'white', fontWeight: 700, fontSize: '14px', cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginTop: '4px',
            }}>
              {loading ? 'Loggar in...' : 'Logga in'} <ArrowRight size={15} />
            </button>
            {passkeysAvailable() && (
              <button type="button" onClick={handlePasskeyLogin} disabled={loading} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px',
                color: '#e8ece9', fontWeight: 600, fontSize: '14px', cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
              }}>
                <Fingerprint size={16} /> Logga in med Face ID
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
