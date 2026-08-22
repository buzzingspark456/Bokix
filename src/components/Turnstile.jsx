import React, { useEffect, useId, useRef } from 'react';

// Bot-/captcha-spärr på registrering och inloggning (säkerhetsgranskningen,
// punkt "Add bot protection") — Cloudflare Turnstile, inte Google
// reCAPTCHA: gratis, inget cookie-baserat spårande, och kräver sällan att
// användaren faktiskt löser något (osynlig i de flesta fall).
//
// Renderar INGET alls om ingen site key är satt (VITE_TURNSTILE_SITE_KEY)
// — samma "fungera ändå utan konfiguration" -princip som mockClient i
// supabaseClient.js, så lokal utveckling/en ny installation inte går
// sönder innan man skaffat Turnstile-nycklar. `onVerify(token)` anropas när
// utmaningen klarats; `onExpire()` när token:en löper ut (Turnstile-tokens
// är kortlivade, ~5 min) så anropande formulär vet att be om en ny.
//
// AKTIVERING (två manuella steg utanför koden, kan inte göras härifrån):
//   1. Skapa en gratis Turnstile-widget på https://dash.cloudflare.com/
//      (Turnstile) — site key är publik (VITE_-prefixad är okej), secret
//      key är hemlig.
//   2. Supabase Dashboard → Authentication → Settings → "Enable Captcha
//      protection" → Turnstile → klistra in secret key. OBS: när den
//      knappen slås på krävs en giltig captchaToken på BÅDE registrering
//      OCH inloggning (Supabase avvisar annars anropet) — därför finns
//      widgeten på båda ställena i Auth.jsx, inte bara registrering.
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

let scriptLoadPromise = null;
function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Kunde inte ladda Turnstile.'));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

export default function Turnstile({ onVerify, onExpire }) {
  const containerId = useId().replace(/:/g, '');
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!siteKey) return; // inte konfigurerat — se filkommentaren ovan
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
          sitekey: siteKey,
          callback: (token) => onVerify?.(token),
          'expired-callback': () => onExpire?.(),
          'error-callback': () => onExpire?.(),
        });
      })
      .catch((err) => console.error('Turnstile kunde inte laddas:', err));

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* redan borttagen */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  if (!siteKey) return null;
  return <div id={containerId} style={{ margin: '4px 0' }} />;
}
