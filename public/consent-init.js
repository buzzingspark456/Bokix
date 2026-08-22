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
