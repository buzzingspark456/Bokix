// Externt script (inte ett inline onload="..."-attribut) av samma skäl som
// consent-init.js: Content-Security-Policy (vercel.json, script-src) tillåter
// bara 'self' — ingen 'unsafe-inline' — så ett inline onload-attribut på
// <link> flaggas som en CSP-överträdelse i Chromes Issues-panel (syns i
// Lighthouse "Bästa metoder", Report-Only-läget stoppar det inte ÄNNU men
// skulle sluta fungera helt tyst om policyn någonsin sätts i enforce-läge).
// Byter Google Fonts-länken (index.html) från media="print" (laddas
// parallellt, blockerar aldrig rendering) till media="all" (faktiskt
// tillämpad) så fort typsnittet är hämtat.
document.querySelectorAll('link[data-font-async]').forEach(function (link) {
  link.addEventListener('load', function () { link.media = 'all'; });
});
