import { useEffect, useLayoutEffect, useState } from 'react';

// Mäter en lista som ska rymmas utan att skrolla (sidomenyn) och ger tillbaka en täthetsnivå,
// 0 (luftigast) till `max`. Så länge innehållet inte ryms går nivån ett steg upp, och CSS eller
// inline-stilar gör raderna tätare för varje nivå. Vid ändrad fönsterstorlek (också zoom, som
// ändrar fönstrets CSS-storlek) börjar mätningen om från 0. Mäter efter varje rendering, så en
// rad som tillkommer (t.ex. Granskning) också tas om hand.
//
// Ingen ResizeObserver med flit: att göra raderna tätare ändrar listans egen höjd, och en
// observatör som nollställer nivån då skulle ge en pendling mellan två nivåer.
export default function useFitLevel(ref, max = 3) {
  const [level, setLevel] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || level >= max) return;
    // Absolut nivå (level + 1), inte l => l + 1: flera renderingar i rad ska aldrig räkna upp två steg.
    if (el.scrollHeight > el.clientHeight) setLevel(level + 1);
  });

  useEffect(() => {
    let timer = null;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => setLevel(0), 150); };
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', onResize); };
  }, []);

  return level;
}
