import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { BRAND } from '../utils/brandColors';

// ── Landningssidan efter Google-inloggningen (/koppla-mejl) ─────────────
// Google skickar tillbaka användaren hit med ?code=…&state=… i adressen.
// Sidan har ett enda jobb: lämna över koden till servern, som växlar in
// den mot en refresh-token, krypterar den och sparar den.
//
// VARFÖR EN VY I APPEN OCH INTE EN SERVERLÖS FUNKTION:
//   1. Google tillåter ingen frågesträng i den REGISTRERADE callback-
//      adressen, så den måste vara en ren sökväg.
//   2. Projektet ligger på Vercels 12-funktionsgräns (Hobby). En
//      trettonde fil under api/** fäller hela deployen.
// En vanlig route i SPA:n löser båda: adressen är ren, och inväxlingen
// sker via ett POST till en endpoint som redan finns.
//
// Koden i adressfältet är en engångskod och byts in direkt. Den ligger
// kvar i webbläsarhistoriken tills navigeringen nedan ersätter posten —
// därför `replace: true`.
export default function GmailConnectCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('working');
  const [message, setMessage] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    // React kör effekter två gånger i utvecklingsläge (StrictMode). En
    // engångskod går bara att växla in EN gång — andra försöket hade
    // svarat "invalid_grant" och visat ett fel för en koppling som
    // faktiskt lyckades.
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMessage(error === 'access_denied'
        ? 'Du avbröt kopplingen. Ingenting sparades.'
        : `Google avbröt kopplingen (${error}).`);
      return;
    }
    if (!code || !state) {
      setStatus('error');
      setMessage('Adressen saknar det Google skulle skicka med. Börja om från Inställningar.');
      return;
    }

    (async () => {
      try {
        const { data: { session } = {} } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setStatus('error');
          setMessage('Du är utloggad. Logga in och försök igen — ingenting sparades.');
          return;
        }
        const res = await fetch('/api/email/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ resource: 'sender', action: 'oauth-exchange', code, state }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || `Kunde inte slutföra kopplingen (${res.status}).`);
        setStatus('done');
        setMessage(payload?.sender?.fromEmail || '');
        // Tillbaka in i appen efter en kort bekräftelse, så man inte blir
        // stående på en sida som inte går att göra något på.
        setTimeout(() => navigate('/', { replace: true, state: { enterApp: true } }), 1800);
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Kunde inte slutföra kopplingen.');
      }
    })();
  }, [navigate]);

  const icon = status === 'done'
    ? <CheckCircle2 size={30} color={BRAND.green} />
    : status === 'error'
      ? <AlertTriangle size={30} color="var(--status-red-text)" />
      : <Loader2 size={30} color={BRAND.green} className="gc-spin" />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-page)' }}>
      <style>{`
        @keyframes gc-spin { to { transform: rotate(360deg); } }
        .gc-spin { animation: gc-spin 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .gc-spin { animation: none; } }
      `}</style>
      <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '38px 32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>{icon}</div>
        <h1 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px' }}>
          {status === 'done' ? 'Adressen är kopplad' : status === 'error' ? 'Kopplingen gick inte igenom' : 'Kopplar din adress…'}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {status === 'done'
            ? `Fakturor och offerter skickas nu från ${message || 'din adress'}.`
            : status === 'error'
              ? message
              : 'Ett ögonblick, vi hämtar behörigheten från Google.'}
        </p>
        {status === 'error' && (
          <button
            onClick={() => navigate('/', { replace: true, state: { enterApp: true } })}
            style={{ marginTop: '20px', padding: '10px 18px', borderRadius: '9px', border: 'none', background: BRAND.green, color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Tillbaka till Bokix
          </button>
        )}
      </div>
    </div>
  );
}
