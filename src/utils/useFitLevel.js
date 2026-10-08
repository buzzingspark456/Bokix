import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Mäter en lista som ska rymmas utan att skrolla (sidomenyn) och ger tillbaka en täthetsnivå,
// 0 (luftigast) till `max`. Så länge innehållet inte ryms går nivån ett steg upp, och CSS eller
// inline-stilar gör raderna tätare för varje nivå. Vid ändrad fönsterstorlek (också zoom, som
// ändrar fönstrets CSS-storlek) börjar mätningen om från 0. En rad som tillkommer (t.ex.
// Granskning) tas också om hand.
//
// Mäter bara när något som kan påverka har ändrats: listans innehåll, menyns klass (öppen på
// telefon), nivån eller fönsterstorleken. Att läsa scrollHeight tvingar webbläsaren att räkna
// om hela sidans layout, och förut gjordes det efter VARJE rendering av appen: på en
// mellanklass-telefon ca 0,2 s bara under inloggningen.
//
// Ingen ResizeObserver med flit: att göra raderna tätare ändrar listans egen höjd, och en
// observatör som nollställer nivån då skulle ge en pendling mellan två nivåer.
export default function useFitLevel(ref, max = 3) {
  const [level, setLevel] = useState(0);
  const [resizeTick, setResizeTick] = useState(0);
  const lastRef = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || level >= max) return;
    // Innehållets längd och klasser läses utan att layouten räknas om.
    const sig = `${el.innerHTML.length}|${el.parentElement?.className || ''}|${level}|${resizeTick}`;
    if (lastRef.current === sig) return;
    lastRef.current = sig;
    // Absolut nivå (level + 1), inte l => l + 1: flera renderingar i rad ska aldrig räkna upp två steg.
    if (el.scrollHeight > el.clientHeight) setLevel(level + 1);
  });

  useEffect(() => {
    let timer = null;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => { setLevel(0); setResizeTick(t => t + 1); }, 150); };
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', onResize); };
  }, []);

  return level;
}
