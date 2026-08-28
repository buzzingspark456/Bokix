import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react';

// Bot-/captcha-spärr på kontaktformuläret (ContactPage.jsx) — Google
// reCAPTCHA v2 Invisible, inte Cloudflare Turnstile (som redan skyddar
// inloggning/registrering/lösenordsåterställning i Auth.jsx, se
// Turnstile.jsx). Två olika formulär, två olika verktyg med avsikt: inget
// byte av det som redan fungerar, bara ett skydd för den enda yta i appen
// som helt saknade captcha (kontaktformuläret kräver ingen inloggning
// alls, det mest utsatta anonyma formuläret i hela appen).
//
// "Invisible" betyder inget synligt kryssrutewidget — den körs istället
// programmatiskt precis innan formuläret faktiskt skickas (se
// ContactPage.jsx: recaptchaRef.current.execute()), och visar bara en
// riktig utmaning om Google bedömer besökaren som misstänkt.
//
// Renderar INGET alls om ingen site key är satt (VITE_RECAPTCHA_SITE_KEY)
// — samma "fungera ändå utan konfiguration"-princip som Turnstile.jsx,
// så lokal utveckling/Playwright-tester (e2e/contact.spec.js) inte går
// sönder innan man skaffat reCAPTCHA-nycklar. execute() löser i så fall
// bara direkt till `null` istället för att hänga och vänta på en widget
// som aldrig renderades.
//
// AKTIVERING (utanför koden): sätt VITE_RECAPTCHA_SITE_KEY (publik,
// VITE_-prefixad är okej) OCH RECAPTCHA_SECRET_KEY (HEMLIG, ALDRIG
// VITE_-prefixad — se api/_recaptcha.js som faktiskt verifierar token:en
// server-side mot Google).
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

let scriptLoadPromise = null;
function loadRecaptchaScript() {
  if (window.grecaptcha?.render) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      // render=explicit: låter OSS avgöra när/var widgeten renderas
      // (grecaptcha.render nedan) istället för att biblioteket självt
      // letar efter en <div class="g-recaptcha"> och auto-renderar den —
      // samma princip som Turnstile.jsx:s manuella render()-anrop.
      window.__bokixRecaptchaOnLoad = () => resolve();
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?onload=__bokixRecaptchaOnLoad&render=explicit';
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Kunde inte ladda reCAPTCHA.'));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

const Recaptcha = forwardRef(function Recaptcha({ onExpire }, ref) {
  const containerId = useId().replace(/:/g, '');
  const widgetIdRef = useRef(null);
  // Den EN pågående execute()-anropets resolve/reject — invisible v2 har
  // bara en utmaning åt gången, precis som fältet här antar.
  const pendingRef = useRef(null);

  useEffect(() => {
    if (!siteKey) return; // inte konfigurerat — se filkommentaren ovan
    let cancelled = false;

    loadRecaptchaScript()
      .then(() => {
        if (cancelled || !window.grecaptcha) return;
        window.grecaptcha.ready(() => {
          if (cancelled) return;
          widgetIdRef.current = window.grecaptcha.render(containerId, {
            sitekey: siteKey,
            size: 'invisible',
            callback: (token) => {
              pendingRef.current?.resolve(token);
              pendingRef.current = null;
            },
            'expired-callback': () => {
              pendingRef.current?.reject(new Error('reCAPTCHA-verifieringen gick ut. Försök igen.'));
              pendingRef.current = null;
              onExpire?.();
            },
            'error-callback': () => {
              pendingRef.current?.reject(new Error('reCAPTCHA kunde inte verifieras. Försök igen.'));
              pendingRef.current = null;
            },
          });
        });
      })
      .catch((err) => console.error('reCAPTCHA kunde inte laddas:', err));

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  useImperativeHandle(ref, () => ({
    /** Kör utmaningen och returnerar token:en (eller `null` om reCAPTCHA
     * inte är konfigurerat — se filkommentaren). Avvisas om utmaningen
     * går ut eller misslyckas; anropande formulär (ContactPage.jsx) fångar
     * det som vilket annat inskickningsfel som helst. */
    execute: () => {
      if (!siteKey) return Promise.resolve(null);
      if (widgetIdRef.current == null || !window.grecaptcha) {
        return Promise.reject(new Error('reCAPTCHA är inte klart än. Försök igen om en stund.'));
      }
      return new Promise((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        window.grecaptcha.execute(widgetIdRef.current);
      });
    },
    /** Måste anropas efter VARJE execute() (lyckad eller ej) innan nästa
     * försök — en reCAPTCHA-token är engångsbruk, precis som Turnstiles. */
    reset: () => {
      if (widgetIdRef.current != null && window.grecaptcha) {
        try { window.grecaptcha.reset(widgetIdRef.current); } catch { /* redan borttagen */ }
      }
    },
  }));

  if (!siteKey) return null;
  return <div id={containerId} />;
});

export default Recaptcha;
