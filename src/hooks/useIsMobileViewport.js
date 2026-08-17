import { useState, useEffect } from 'react';

// Sida 38, punkt 7 (och Rapport och analys-uppföljningen): färre etiketter
// i diagram på mobil (var tredje/var N:e istället för alla) kräver ett tal
// satt vid RENDER — CSS kan inte styra hur många <XAxis>-ticks Recharts
// ritar, eller vilka <span>-etiketter en egen SVG-graf väljer att visa.
// Spårat med en riktig resize-lyssnare, inte bara en engångsavläsning vid
// mount, så en ändrad fönsterbredd (eller mobilens rotation) uppdaterar
// diagrammen utan en omladdning. Delad mellan Dashboard.jsx och
// Reports.jsx istället för att dupliceras i båda.
export function useIsMobileViewport(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}
