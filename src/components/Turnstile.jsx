import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react';

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

// `onDemand`: kollen körs först när formuläret skickas (ref.execute(),
// som löser till en token), och rutan syns bara om Cloudflare behöver att
// besökaren klickar. Utan den körs kollen direkt och rutan syns alltid.
// Varje token gäller ett anrop, så anroparen byter `key` efter varje försök.
const Turnstile = forwardRef(function Turnstile({ onVerify, onExpire, onDemand = false }, ref) {
  const containerId = useId().replace(/:/g, '');
  const widgetIdRef = useRef(null);
  const readyRef = useRef(null);
  const pendingRef = useRef(null);

  useImperativeHandle(ref, () => ({
    execute() {
      if (!siteKey) return Promise.resolve(null);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pendingRef.current = null; reject(new Error('timeout')); }, 60000);
        pendingRef.current = {
          resolve: (t) => { clearTimeout(timer); resolve(t); },
          reject: (e) => { clearTimeout(timer); reject(e); },
        };
        (readyRef.current || Promise.reject(new Error('not_loaded')))
          .then(() => window.turnstile.execute(`#${containerId}`))
          .catch((e) => { pendingRef.current?.reject(e); pendingRef.current = null; });
      });
    },
  }));

  useEffect(() => {
    if (!siteKey) return; // inte konfigurerat — se filkommentaren ovan
    let cancelled = false;

    readyRef.current = loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile) throw new Error('not_loaded');
        widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
          sitekey: siteKey,
          ...(onDemand ? { execution: 'execute', appearance: 'interaction-only' } : {}),
          callback: (token) => {
            onVerify?.(token);
            pendingRef.current?.resolve(token);
            pendingRef.current = null;
          },
          'expired-callback': () => onExpire?.(),
          'error-callback': () => {
            onExpire?.();
            pendingRef.current?.reject(new Error('turnstile_error'));
            pendingRef.current = null;
          },
        });
      });
    readyRef.current.catch((err) => console.error('Turnstile kunde inte laddas:', err));

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
});

export default Turnstile;
