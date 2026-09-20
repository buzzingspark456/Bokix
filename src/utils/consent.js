// ── Sida 37: cookiesamtycke för Google Analytics (Consent Mode v2) ──
// index.html sätter redan gtag('consent','default',{...alla 'denied'})
// innan mätscriptet konfigureras — den här filen är den enda platsen som
// får ändra det efteråt, och bara som en direkt reaktion på ett explicit
// val i CookieBanner.jsx, aldrig automatiskt.
import { ensurePosthogInit } from './posthog';

export const CONSENT_COOKIE_NAME = 'bokix_cookie_consent';
const CONSENT_COOKIE_MAX_AGE_DAYS = 365; // ~12 månader, enligt spec

function readCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function writeCookie(name, value, maxAgeDays) {
  const maxAgeSeconds = maxAgeDays * 24 * 60 * 60;
  // SameSite=Lax + Secure: skickas inte över okrypterad http, men fungerar
  // fortfarande på localhost under utveckling (webbläsare undantar
  // "secure" för localhost). Ingen tredjepartskontext här (bara vår egen
  // första part), så Lax räcker.
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax; Secure`;
}

/** 'granted' | 'denied' | null (inget val gjort än — bannern ska visas). */
export function getStoredConsent() {
  const value = readCookie(CONSENT_COOKIE_NAME);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function storeConsent(status) {
  writeCookie(CONSENT_COOKIE_NAME, status, CONSENT_COOKIE_MAX_AGE_DAYS);
}

/** Uppdaterar Googles samtyckessignal. Bara analytics_storage rörs — Bokix
 * har ingen annonsintegration, så ad_storage/ad_user_data/ad_personalization
 * förblir 'denied' oavsett vad besökaren väljer (inget att bevilja där). */
export function updateGtagConsent(granted) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
  });
}

/** Samma sak för Microsoft Clarity (consentv2, se public/consent-init.js:s
 * kommentar för varför just den API-versionen). ad_Storage hålls 'denied'
 * av samma "ingen annonsintegration"-skäl som updateGtagConsent ovan. */
export function updateClarityConsent(granted) {
  if (typeof window.clarity !== 'function') return;
  window.clarity('consentv2', {
    ad_Storage: 'denied',
    analytics_Storage: granted ? 'granted' : 'denied',
  });
}

/** Samma sak för PostHog (utils/posthog.js). ensurePosthogInit(granted)
 * initierar PostHog vid behov — om besökaren svarar i bannern innan den
 * fördröjda uppstarten (schedulePosthogInit, main.jsx) annars hunnit
 * ske, med RÄTT startläge direkt (ingen kort "denied trots granted"-
 * lucka). Redan igång sedan tidigare? Samma anrop är då en no-op, och
 * opt_in/opt_out_capturing() nedan sätter det nya valet direkt istället. */
export function updatePosthogConsent(granted) {
  const initializing = ensurePosthogInit(granted);
  if (!initializing) return; // ingen VITE_POSTHOG_KEY satt i den här miljön
  initializing.then((posthog) => {
    if (granted) posthog.opt_in_capturing();
    else posthog.opt_out_capturing();
  });
}
