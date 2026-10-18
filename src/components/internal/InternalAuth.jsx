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
// Två sätt in: Face ID/fingeravtryck med en passkey (lagts till i appen under
// Inställningar → Min profil), eller e-post + lösenord + kod från en
// autentiseringsapp. Bara lösenord räcker inte (2026-10-18, se
// api/admin/index.js sessionStrength); servern är den riktiga spärren.
export default function InternalAuth({ onAuthenticated, notice = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(notice);
  // Efter lösenordet, för konton med tvåfaktor: { factorId } tills koden är rätt.
  const [totp, setTotp] = useState(null);
  const [code, setCode] = useState('');
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
      // Har kontot tvåfaktor: fråga efter koden innan panelen öppnas.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp?.find(f => f.status === 'verified');
        if (factor) { setTotp({ factorId: factor.id }); setLoading(false); return; }
      }
      onAuthenticated();
    } catch (err) {
      setError(err?.message === 'Invalid login credentials' ? 'Fel e-post eller lösenord.' : (err?.message || 'Något gick fel.'));
      setCaptchaRound(n => n + 1);
      setLoading(false);
    }
  };

  const handleCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.factorId, code: code.trim() });
      if (verifyError) throw verifyError;
      onAuthenticated();
    } catch {
      setError('Fel kod. Försök igen med koden som visas i appen just nu.');
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
    color: 'var(--text-main)', background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: '10px', fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'var(--status-green-bg)', border: '1px solid var(--status-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} color="var(--accent-text)" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Bokix Internal</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Endast behörig personal</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px' }}>
          {totp ? (
            <form onSubmit={handleCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Kod från autentiseringsappen</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 14 }} />
                  <input inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} style={inputStyle} />
                </div>
              </div>
              {error && <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', lineHeight: 1.5 }}>{error}</div>}
              <button type="submit" disabled={loading || code.length < 6} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                padding: '13px', background: 'var(--accent)', border: 'none', borderRadius: '10px',
                color: 'white', fontWeight: 700, fontSize: '14px', cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit', opacity: loading || code.length < 6 ? 0.7 : 1, marginTop: '4px',
              }}>
                {loading ? 'Kontrollerar...' : 'Fortsätt'} <ArrowRight size={15} />
              </button>
            </form>
          ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>E-post</label>
              <div style={{ position: 'relative' }}>
                <ShieldCheck size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} autoComplete="username" />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Lösenord</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} autoComplete="current-password" />
              </div>
            </div>
            <Turnstile key={captchaRound} ref={captchaRef} onDemand />
            {error && <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', lineHeight: 1.5 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              padding: '13px', background: 'var(--accent)', border: 'none', borderRadius: '10px',
              color: 'white', fontWeight: 700, fontSize: '14px', cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginTop: '4px',
            }}>
              {loading ? 'Loggar in...' : 'Logga in'} <ArrowRight size={15} />
            </button>
            {passkeysAvailable() && (
              <button type="button" onClick={handlePasskeyLogin} disabled={loading} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px',
                color: 'var(--text-main)', fontWeight: 600, fontSize: '14px', cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
              }}>
                <Fingerprint size={16} /> Logga in med Face ID
              </button>
            )}
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
