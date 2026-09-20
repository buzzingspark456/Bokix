// ── PostHog — produktanalys ──────────────────────────────────────────
// Samma samtyckesmönster som gtag/Clarity (se public/consent-init.js/
// utils/consent.js): fångar ingenting förrän besökaren aktivt godkänt.
// Läser ALDRIG samtycket själv — det skickas alltid in som parameter av
// anroparen (main.jsx vid uppstart, updatePosthogConsent i consent.js vid
// ett nytt val i CookieBanner.jsx), som redan äger den logiken; annars
// hade den här filen och consent.js importerat av varandra i en cirkel.
//
// Det tunga `posthog-js`-paketet hämtas inte alls förrän uppstarten
// faktiskt sker (dynamisk import) — samma prestandaskäl som gtag.js/
// Clarity redan fördröjs på, se loadDeferredScripts i
// public/consent-init.js. Ingen SSR-hänsyn behövs: den här filen
// importeras bara från main.jsx (webbläsarens riktiga startpunkt) och
// AppRouter.jsx, aldrig från entry-server.jsx (SSR-förrenderingen körs i
// Node vid build-tid, inget window/document finns där).
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

export let posthog = null;
let initPromise = null;

/** Hämtar och initierar posthog-js, en gång — efterföljande anrop
 * (oavsett `granted`-värde) returnerar samma promise orört. `granted`
 * avgör bara STARTLÄGET (opt in/out); ett senare val går via
 * updatePosthogConsent (consent.js), som sätter opt_in/opt_out_capturing()
 * direkt på den redan initierade instansen. */
export function ensurePosthogInit(granted) {
  if (!POSTHOG_KEY) return null;
  if (!initPromise) {
    initPromise = import('posthog-js').then(({ default: ph }) => {
      posthog = ph;
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // Pinnar PostHog:s egna defaultbeteenden till versionen deras
        // dashboards installationssnutt själv gav (Project settings →
        // General → SDK setup) när det här skrevs — annars kan PostHog
        // tysta ändra vad "default" betyder i en senare posthog-js-
        // version, utan att den här filen någonsin ändrades.
        defaults: '2026-05-30',
        person_profiles: 'identified_only',
        // PageviewTracker (AppRouter.jsx) skickar egna $pageview-event vid
        // routebyten — en SPA byter aldrig sida genom en riktig
        // sidladdning, så PostHog:s inbyggda autocapture (bara vid
        // scriptets EGEN uppstart) hade bara räknat den allra första sidan
        // varje besök.
        capture_pageview: false,
        opt_out_capturing_by_default: !granted,
        // PostHogs eget verktygsfält (Toolbar — klicka dig till Actions/
        // Heatmaps direkt på den riktiga sidan, från PostHog-dashboarden)
        // letar efter `window.posthog` och varnar annars rakt i konsolen
        // ("PostHog must be added to the window object..."). npm-
        // installationen (den här filen) sätter INTE det globalt av sig
        // själv — bara HTML-snuttens variant gör det automatiskt — så det
        // görs här, i `loaded`-callbacken (samma ställe PostHogs egen
        // varning pekar mot), efter att klienten faktiskt är klar.
        loaded: (ph) => { window.posthog = ph; },
      });
      return posthog;
    });
  }
  return initPromise;
}

/** Fördröjd uppstart — första interaktion (pekare/tangent/touch/skroll)
 * ELLER en kort idle-timeout, det som kommer först. Exakt samma mönster
 * som gtag.js/Clarity (public/consent-init.js): en besökare som studsar
 * snabbare än det räknas inte in, en medveten kompromiss, inte en bugg.
 * Anropas en gång från main.jsx. */
export function schedulePosthogInit(granted) {
  if (!POSTHOG_KEY) return;
  let started = false;
  function start() {
    if (started) return;
    started = true;
    window.removeEventListener('pointerdown', start);
    window.removeEventListener('keydown', start);
    window.removeEventListener('touchstart', start);
    window.removeEventListener('scroll', start);
    ensurePosthogInit(granted);
  }
  window.addEventListener('pointerdown', start, { once: true, passive: true });
  window.addEventListener('keydown', start, { once: true });
  window.addEventListener('touchstart', start, { once: true, passive: true });
  window.addEventListener('scroll', start, { once: true, passive: true });
  setTimeout(start, 4000);
}

/** Skickar ett sidvisningsevent — bara om PostHog redan är igång (annars
 * finns inget att skicka till; en besökare som aldrig interagerat räknas
 * inte, se schedulePosthogInit). Anropad från AppRouter.jsx vid varje
 * routebyte. */
export function capturePosthogPageview() {
  if (posthog) posthog.capture('$pageview');
}
