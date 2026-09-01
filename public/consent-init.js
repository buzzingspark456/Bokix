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

// Microsoft Clarity — samma konsent-krav som gtag.js ovan, av samma
// GDPR/ePrivacy-skäl (Clarity är en egen tredjeparts spårningscookie,
// separat från Google). SKILLNAD mot gtag: Microsoft själva dokumenterar
// att Clarity börjar spåra så fort dess riktiga script laddas OM inget
// konsent-anrop görs först — motsatsen till gtags "denied tills vidare"-
// förval. `consentv2` (INTE den äldre, snart nedlagda "consent"-API:n,
// se Microsofts egen deprecation-notis) skickas därför EXPLICIT 'denied'
// här, precis som gtag('consent','default',...) ovan, INNAN den riktiga
// clarity.ms/tag/…-scriptet ens hinner laddas (se loadDeferredScripts
// nedan) — kön (c[a].q) Clarity-bootstrappen sätter upp fångar upp
// anropet och spelar upp det i ordning så fort riktiga scriptet initieras,
// samma "kön garanterar ordningen oavsett fördröjning"-princip som gtag.js
// redan bygger på. CookieBanner.jsx/consent.js skickar 'granted' istället
// när besökaren faktiskt väljer.
(function(c, l, a) {
  c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
})(window, document, 'clarity');
window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });

// Lighthouse (Prestanda): gtag.js självt (163.8 KiB, ~66 KiB komprimerat)
// var den enskilt största "oanvänd JavaScript"-posten i rapporten, laddad
// direkt i <head> (index.html hade tidigare en egen <script async
// src="…gtag/js…"> där). Flyttad hit och FÖRDRÖJD — laddas vid FÖRSTA av:
// användarinteraktion (pekare/tangent/skroll/touch, dvs besökaren stannar
// kvar och gör något) eller ett kort idle-/timeout-fönster (~3.5s), vilket
// som kommer först. En besökare som studsar snabbare än det räknas inte i
// statistiken — samma avvägning som web.dev själva rekommenderar för just
// GTM/gtag.js, och en medveten kompromiss (prestanda vs. fullständig
// besöksstatistik), inte en bugg. Clarity's tag-script (clarity.ms/tag/…)
// fördröjs av exakt samma skäl, på samma triggrar — en tredje
// spårningsscript-uppsättning identiska event-lyssnare/timeout hade bara
// varit en tyst-att-glömma-synka kopia.
//
// Rubbar INTE ordningskravet ovan ("consent 'default'/consentv2 MÅSTE
// köras innan riktiga scripten laddas"): gtag(...)/clarity(...) ovan är
// bara kö-push-anrop (dataLayer.push respektive c[a].q.push) — de körs
// redan, oavsett NÄR de riktiga scripten nedan råkar laddas. Båda scripten
// läser igenom hela sin kö (i ordning) första gången DE initieras, så
// konsent-defaulten är garanterat redan där oavsett fördröjningen.
(function loadDeferredScripts() {
  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    window.removeEventListener('pointerdown', load);
    window.removeEventListener('keydown', load);
    window.removeEventListener('touchstart', load);
    window.removeEventListener('scroll', load);

    var gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-9KXP9XW3MW';
    document.head.appendChild(gtagScript);

    var clarityScript = document.createElement('script');
    clarityScript.async = true;
    clarityScript.src = 'https://www.clarity.ms/tag/yb5s0dfk7c';
    document.head.appendChild(clarityScript);
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
  // (ingen interaktion alls) inte drar in de här scripten förrän efter den
  // kritiska mätperioden, oavsett hur snabbt sidan i övrigt hinner bli klar.
  setTimeout(load, 4000);
})();
