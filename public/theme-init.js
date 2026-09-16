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
//
// BUGGEN kundrapporten faktiskt berodde på: App.jsx döpte om nyckeln från
// 'bokix_theme' till 'bokix_theme_pref' (för att kunna lagra ett tredje
// värde, 'system', inte bara light/dark) och migrerar/raderar den gamla
// nyckeln i sin egen useEffect vid mount — men DEN HÄR filen fortsatte
// bara läsa den gamla 'bokix_theme'. Resultatet: så fort App.jsx:s
// migrering väl kört en gång (nästan alltid, för alla utom en helt ny
// besökare) fanns inget kvar under 'bokix_theme' att läsa här, scriptet
// föll tillbaka på system-preferensen, och sidan blinkade förbi i FEL
// tema innan React:s useEffect hann rätta till det — exakt "control r …
// it's in the light, and then it turns dark"-buggen. Läser nu
// 'bokix_theme_pref' först (med den gamla nyckeln kvar som fallback för
// den korta stund innan App.jsx hunnit migrera en enda gång).
(function () {
  try {
    var storedTheme = localStorage.getItem('bokix_theme_pref') || localStorage.getItem('bokix_theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', storedTheme);
    } else if (storedTheme === 'system') {
      // Sätt INGET data-theme-attribut — exakt som App.jsx:s egen
      // useEffect gör för themePreference==='system' (removeAttribute).
      // index.css:s egen prefers-color-scheme-medieförfrågan tar då över
      // direkt, utan att det här scriptet behöver duplicera webbläsarens
      // matchMedia-logik.
    } else {
      // Inget sparat värde alls (första besöket): App.jsx:s egen
      // useState-initierare defaultar till 'dark', INTE till OS-
      // preferensen — appen är byggd för och ska se bäst ut i mörkt läge.
      // Måste matchas exakt här, annars blinkar en förstagångsbesökare
      // med ljust OS-tema förbi i ljust läge innan React hinner rätta
      // till det till det avsedda mörka standardläget.
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    // Privat läge/blockerad storage — samma 'dark'-standard som App.jsx:s
    // try/catch faller tillbaka på (inte CSS:s egen ljusa bas-standard).
    try { document.documentElement.setAttribute('data-theme', 'dark'); } catch (e2) { /* inget mer att göra */ }
  }

  try {
    document.documentElement.setAttribute('data-hide-scrollbar', localStorage.getItem('bokix_hide_scrollbar') === 'true' ? 'true' : 'false');
  } catch (e) { /* samma reservläge som ovan */ }

  try {
    var storedSidebar = localStorage.getItem('bokix_sidebar_style');
    document.documentElement.setAttribute('data-sidebar-style', (storedSidebar === 'green' || storedSidebar === 'dark') ? storedSidebar : 'green');
  } catch (e) { /* samma reservläge som ovan */ }
})();
