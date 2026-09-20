import React, { useLayoutEffect, useRef, useState } from 'react';

// A4 vid 96 dpi, samma mått som .a4-paper i index.css (210 mm).
const PAPER_WIDTH = 794;

// Visar ett A4-dokument (faktura/offert) som en riktig sida även på en telefon:
// dokumentet ritas alltid i sin fulla bredd och skalas ned så att hela sidans
// bredd ryms, som i en PDF-läsare. Då ser förhandsgranskningen ut exakt som
// PDF:en, i stället för att tabellen klipps eller staplas om. Ett tryck på
// sidan zoomar till full storlek (då går det att dra i sidled), ett till går
// tillbaka. På bredare skärmar (skalan 1) är det vanligt, oskalat innehåll.
export default function PaperFit({ children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: null });
  const [zoomed, setZoomed] = useState(false);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;
    const measure = () => {
      const width = outer.clientWidth;
      const scale = width > 0 && width < PAPER_WIDTH ? width / PAPER_WIDTH : 1;
      const height = scale < 1 ? Math.ceil(inner.offsetHeight * scale) : null;
      setFit(prev => (prev.scale === scale && prev.height === height ? prev : { scale, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const narrow = fit.scale < 1;
  const scaled = narrow && !zoomed;
  return (
    <div>
      <div
        ref={outerRef}
        onClick={narrow ? () => setZoomed(z => !z) : undefined}
        style={narrow
          ? { width: '100%', height: scaled ? fit.height ?? undefined : undefined, overflowX: scaled ? 'hidden' : 'auto', overflowY: 'hidden', cursor: 'zoom-in' }
          : undefined}
      >
        <div
          ref={innerRef}
          style={narrow ? { width: `${PAPER_WIDTH}px`, ...(scaled ? { transform: `scale(${fit.scale})`, transformOrigin: 'top left' } : {}) } : undefined}
        >
          {children}
        </div>
      </div>
      {narrow && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', padding: '10px 0 0' }}>
          {zoomed ? 'Tryck på sidan för att se hela' : 'Tryck på sidan för att zooma in'}
        </div>
      )}
    </div>
  );
}
