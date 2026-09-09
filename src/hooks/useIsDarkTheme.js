import { useState, useEffect } from 'react';

// Är appen mörk just nu?
//
// Nästan all färgsättning i Bokix går genom CSS-variabler (--bg-card,
// --status-red-text …) som skriver om sig själva i :root[data-theme="dark"]
// — då behövs INTE den här hooken. Den finns för det enda fall där CSS
// inte räcker: färger som skickas till Recharts (fill/stroke) hamnar som
// SVG-ATTRIBUT, och ett attribut kan inte innehålla var(--x) — webbläsaren
// löser aldrig upp variabeln där, utan hoppar över färgen helt.
//
// Kundfeedback som gjorde den nödvändig: rapporternas mörkgröna
// vinstmarginal-linje (#1c5c28) och den nästan vita rosa "spårfärgen"
// bakom kostnadsstaplarna var valda för ett ljust ark. På mörk botten blev
// den ena osynlig och den andra ett lysande band.
//
// Lyssnar på BÅDA sätten temat kan ändras: attributet på <html> (appens och
// marknadssidans egna växlar, App.jsx/MarketingLayout.jsx) och OS-
// inställningen för den som aldrig valt själv (då finns inget attribut alls,
// se index.css prefers-color-scheme-blocket).
export function useIsDarkTheme() {
  const [isDark, setIsDark] = useState(() => read());

  useEffect(() => {
    const update = () => setIsDark(read());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', update);
    return () => {
      observer.disconnect();
      mq?.removeEventListener?.('change', update);
    };
  }, []);

  return isDark;
}

function read() {
  if (typeof document === 'undefined') return false;
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export default useIsDarkTheme;
