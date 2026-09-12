// Sätter data-theme/data-hide-scrollbar/data-sidebar-style på <html> INNAN
// webbläsaren målar något alls — annars visas sidan i ljust läge en kort
// stund (webbläsarens standard tills React hinner montera och köra sin
// egen useEffect i App.jsx) och blinkar sedan över till mörkt läge vid
// varje omladdning (kundrapporterad bugg: "control r ... it's in the
// light, and then it turns dark").
//
// Måste vara ett externt <script src="..."> utan defer/async, inte ett
// inline <script>, av samma CSP-skäl som font-swap.js/consent-init.js
// (vercel.json script-src har ingen 'unsafe-inline') — ett vanligt,
// oblockerat script-element BLOCKERAR ändå HTML-parsningen tills det körts
// klart, precis som ett inline-script hade gjort, så effekten (ingen
// blink) är identisk.
//
// Nycklarna/fallback-logiken här måste hållas i EXAKT synk med App.jsx:s
// egna useState-initierare (theme/hideScrollbar/sidebarStyle) — det här
// scriptet räknar bara ut samma värde en gång till, tidigare.
(function () {
  try {
    var storedTheme = localStorage.getItem('bokix_theme');
    var theme = (storedTheme === 'light' || storedTheme === 'dark')
      ? storedTheme
      : ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // Privat läge/blockerad storage — CSS:s egen ljusa standard gäller,
    // precis som App.jsx:s try/catch redan faller tillbaka på.
  }

  try {
    document.documentElement.setAttribute('data-hide-scrollbar', localStorage.getItem('bokix_hide_scrollbar') === 'true' ? 'true' : 'false');
  } catch (e) { /* samma reservläge som ovan */ }

  try {
    var storedSidebar = localStorage.getItem('bokix_sidebar_style');
    document.documentElement.setAttribute('data-sidebar-style', (storedSidebar === 'green' || storedSidebar === 'dark') ? storedSidebar : 'green');
  } catch (e) { /* samma reservläge som ovan */ }
})();
