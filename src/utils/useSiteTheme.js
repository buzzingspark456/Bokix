import { useEffect, useState } from 'react';

// Sajtens tema ('light' eller 'dark'): <html data-theme> om det är satt,
// annars systemets inställning. Förrenderingen (det Google läser) får alltid
// 'light'; mörkt byts in efter montering. Används av videoguiderna, som har
// en ljus och en mörk film och omslagsbild.
export default function useSiteTheme() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const read = () => {
      const attr = root.getAttribute('data-theme');
      setTheme((attr ? attr === 'dark' : !!mq?.matches) ? 'dark' : 'light');
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    mq?.addEventListener?.('change', read);
    return () => { obs.disconnect(); mq?.removeEventListener?.('change', read); };
  }, []);
  return theme;
}
