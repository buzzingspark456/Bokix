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
// I Vercel heter nyckeln VITE_RECAPTCHA_SITE (utan _KEY), så båda läses.
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || import.meta.env.VITE_RECAPTCHA_SITE;

let scriptLoadPromise = null;
const BLOCKED_MESSAGE = 'Googles robotkontroll kunde inte laddas. Det beror oftast på en annonsblockerare eller ett webbläsartillägg. Pausa det för bokix.se, eller prova en annan webbläsare, och försök igen.';
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
      script.onerror = () => { scriptLoadPromise = null; reject(new Error(BLOCKED_MESSAGE)); };
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
    // Trycker man innan Google hunnit ladda väntar den in det (högst 10 s)
    // i stället för att be användaren försöka igen. En utmaning som stängs
    // utan svar ger ett fel efter två minuter, så knappen inte snurrar för
    // alltid.
    execute: async () => {
      if (!siteKey) return null;
      const loadedBy = Date.now() + 10_000;
      while (widgetIdRef.current == null || !window.grecaptcha) {
        if (!scriptLoadPromise && !window.grecaptcha) throw new Error(BLOCKED_MESSAGE);
        if (Date.now() > loadedBy) throw new Error(BLOCKED_MESSAGE);
        await new Promise(r => setTimeout(r, 200));
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (pendingRef.current?.resolve === done) pendingRef.current = null;
          reject(new Error('Robotkontrollen blev inte klar. Försök igen.'));
        }, 120_000);
        const done = (token) => { clearTimeout(timer); resolve(token); };
        pendingRef.current = { resolve: done, reject: (err) => { clearTimeout(timer); reject(err); } };
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
