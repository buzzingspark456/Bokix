// Google Analytics via Consent Mode v2 (Sida 37). Bugkritiskt: consent
// 'default' med samtliga kategorier 'denied' MÅSTE köras innan 'config'
// — annars sätter gtag.js _ga/_gid-cookies och skickar mätdata redan
// vid sidladdning, innan besökaren hunnit svara i cookiebannern
// (src/components/CookieBanner.jsx), vilket bryter mot GDPR/ePrivacy.
// Bannern anropar gtag('consent','update',...) via src/utils/consent.js
// när besökaren faktiskt väljer.
//
// Egen fil istället för inline <script> i index.html (säkerhetsgranskningen,
// Content-Security-Policy) — en strikt CSP kan då kräva `script-src 'self'`
// utan `'unsafe-inline'`/skriptnycklar, vilket faktiskt skyddar mot XSS
// istället för att vara verkningslöst. En hash-baserad CSP-regel för en
// inline-tagg hade fungerat teknisk också, men går sönder tyst varje gång
// någon redigerar scriptet utan att räkna om hashen — en egen fil under
// `script-src 'self'` behöver aldrig underhållas på det sättet.
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});
gtag('js', new Date());
gtag('config', 'G-9KXP9XW3MW');

// Lighthouse (Prestanda): gtag.js självt (163.8 KiB, ~66 KiB komprimerat)
// var den enskilt största "oanvänd JavaScript"-posten i rapporten, laddad
// direkt i <head> (index.html hade tidigare en egen <script async
// src="…gtag/js…"> där). Flyttad hit och FÖRDRÖJD — laddas vid FÖRSTA av:
// användarinteraktion (pekare/tangent/skroll/touch, dvs besökaren stannar
// kvar och gör något) eller ett kort idle-/timeout-fönster (~3.5s), vilket
// som kommer först. En besökare som studsar snabbare än det räknas inte i
// statistiken — samma avvägning som web.dev själva rekommenderar för just
// GTM/gtag.js, och en medveten kompromiss (prestanda vs. fullständig
// besöksstatistik), inte en bugg.
//
// Rubbar INTE ordningskravet ovan ("consent 'default' MÅSTE köras innan
// 'config'"): gtag('consent','default',...) och gtag('config',...) är bara
// dataLayer.push()-anrop — de körs redan, oavsett NÄR själva gtag.js-
// scriptet nedan råkar laddas. gtag.js läser igenom hela dataLayer-kön
// (i ordning) första gången DET initieras, så konsent-defaulten är
// garanterat redan där oavsett fördröjningen.
(function loadGtagScript() {
  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    window.removeEventListener('pointerdown', load);
    window.removeEventListener('keydown', load);
    window.removeEventListener('touchstart', load);
    window.removeEventListener('scroll', load);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-9KXP9XW3MW';
    document.head.appendChild(s);
  }
  window.addEventListener('pointerdown', load, { once: true, passive: true });
  window.addEventListener('keydown', load, { once: true });
  window.addEventListener('touchstart', load, { once: true, passive: true });
  window.addEventListener('scroll', load, { once: true, passive: true });
  // MEDVETET en fast setTimeout, INTE requestIdleCallback: testat i en
  // riktig webbläsare (Playwright) och requestIdleCallback triggade inom
  // ~1.5s ändå — webbläsaren ansåg sig "idle" gott och väl inom Lighthouse
  // egna FCP/LCP/TBT-mätfönster, vilket hade gjort hela fördröjningen
  // verkningslös. En fast timeout GARANTERAR att den inaktiva besökaren
  // (ingen interaktion alls) inte drar in gtag.js förrän efter den kritiska
  // mätperioden, oavsett hur snabbt sidan i övrigt hinner bli klar.
  setTimeout(load, 4000);
})();
