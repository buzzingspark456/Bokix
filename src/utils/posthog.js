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
        // Bara sidvisningar (PageviewTracker), inget annat — och det är
        // exakt det cookiepolicyn/integritetspolicyn lovar. PostHogs
        // standard är annars autocapture PÅ (loggar varje klick med
        // elementets text/attribut) och den här init:en körs även inne i
        // den inloggade bokföringsappen, där ett klick kan vara på ett
        // kundnamn eller ett belopp. Sessionsinspelning, enkäter och
        // feature flags används inte alls, så de laddas inte heller
        // (enkät-scriptet hämtades tidigare ändå, se nätverksloggen).
        // Samma sak för det PostHog annars slår på via projektets
        // fjärrkonfiguration (config.js): dead-click-fångst, web vitals,
        // "conversations"-widgeten och produktturer hämtades ändå efter
        // att autocapture stängts av (verifierat i nätverksloggen).
        autocapture: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        rageclick: false,
        capture_exceptions: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_conversations: true,
        disable_product_tours: true,
        advanced_disable_feature_flags: true,
        opt_out_capturing_by_default: !granted,
        // opt_out_capturing_by_default stoppar bara SÄNDNINGEN av händelser,
        // inte lagringen: utan den här raden satte PostHog ändå sin
        // besökar-id-cookie (ph_<nyckel>_posthog, 1 år) och ett localStorage-
        // id direkt vid uppstart, även för den som just valt "Endast
        // nödvändiga" (verifierat i webbläsare). Ett id lagrat före
        // samtycke är exakt det ePrivacy förbjuder och det cookiepolicyn
        // säger inte händer. opt_in_capturing() (consent.js) slår på
        // lagringen igen först när besökaren faktiskt accepterat.
        opt_out_persistence_by_default: !granted,
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

// Demot på marknadssidorna (DemoWorkspace.jsx) använder samma komponenter
// som appen; där ska inga händelser räknas som riktiga kunders.
let demoActive = 0;
export function setPosthogDemoActive(active) {
  demoActive = Math.max(0, demoActive + (active ? 1 : -1));
}

/**
 * Egna händelser i appen (kundönskemål 2026-10-24): konto_skapat,
 * onboarding_klar, kvitto_uppladdat, faktura_skickad,
 * deklaration_inlamnad, prenumeration_startad. Bara att något hände plus
 * en grov egenskap (bolagsform, filtyp, deklarationstyp), aldrig belopp,
 * namn eller annat om kunden. Som sidvisningarna: inget skickas utan
 * samtycke, eftersom PostHog bara startas efter "Acceptera alla".
 */
export function captureEvent(name, properties = {}) {
  if (demoActive > 0) return;
  // Startar PostHog strax efter (schedulePosthogInit) skickas händelsen då.
  const ready = posthog ? Promise.resolve(posthog) : initPromise;
  ready?.then(ph => ph?.capture(name, properties)).catch(() => {
    // Mätningen får aldrig störa appen.
  });
}
