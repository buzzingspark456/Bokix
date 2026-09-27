import React, { useLayoutEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from '../icons';
import { t } from '../../i18n';

// A4 vid 96 dpi, samma mått som .a4-paper i index.css (210 mm).
const PAPER_WIDTH = 794;
const MAX_SCALE = 1.5;
const SCALE_STEP = 0.1;

// Visar ett A4-dokument (faktura/offert) som en riktig sida även på en telefon:
// dokumentet ritas alltid i sin fulla bredd och skalas ned så att hela sidans
// bredd ryms, som i en PDF-läsare. Då ser förhandsgranskningen ut exakt som
// PDF:en, i stället för att tabellen klipps eller staplas om. Under sidan
// finns zoomknappar som går i steg om 10 procentenheter av den verkliga
// storleken (tidigare hoppade ett tryck direkt till 100 %, långt mer än man
// ville); när man zoomat in går det att dra i sidled. På bredare skärmar
// (skalan 1) är det vanligt, oskalat innehåll.
export default function PaperFit({ children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: null });
  // null = hela sidans bredd. Annars önskad skala; aldrig lägre än passa-skalan.
  const [wanted, setWanted] = useState(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;
    const measure = () => {
      const width = outer.clientWidth;
      const scale = width > 0 && width < PAPER_WIDTH ? width / PAPER_WIDTH : 1;
      const height = scale < 1 ? Math.ceil(inner.offsetHeight) : null;
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
  const scale = narrow ? Math.min(MAX_SCALE, Math.max(fit.scale, wanted ?? fit.scale)) : 1;
  const zoomedIn = narrow && scale > fit.scale + 0.001;
  const round2 = (n) => Math.round(n * 100) / 100;
  const zoomBy = (dir) => setWanted(round2(Math.min(MAX_SCALE, Math.max(fit.scale, scale + dir * SCALE_STEP))));

  const btn = (disabled) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px',
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
    color: disabled ? 'var(--text-muted)' : 'var(--text-main)', opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'default' : 'pointer', padding: 0,
  });

  return (
    <div>
      <div
        ref={outerRef}
        style={narrow
          ? { width: '100%', height: fit.height != null ? Math.ceil(fit.height * scale) : undefined, overflowX: zoomedIn ? 'auto' : 'hidden', overflowY: 'hidden' }
          : undefined}
      >
        <div
          ref={innerRef}
          style={narrow ? { width: `${PAPER_WIDTH}px`, transform: `scale(${scale})`, transformOrigin: 'top left' } : undefined}
        >
          {children}
        </div>
      </div>
      {narrow && (
        // Ligger fast i skärmens nederkant, ovanför bottenmenyn, så att man
        // kan zooma ut igen utan att först skrolla förbi hela den förstorade
        // sidan. (Sticky gick inte: förhandsgranskningens egna
        // overflow-ytor fångar den.) Avståndet under sidan hindrar att den
        // sista raden hamnar bakom knapparna.
        <div style={{ height: '64px' }} aria-hidden="true" />
      )}
      {narrow && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(var(--mobile-nav-height, 0px) + env(safe-area-inset-bottom, 0px) + 12px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
          <button type="button" onClick={() => zoomBy(-1)} disabled={!zoomedIn} aria-label={t('ui.zooma_ut')} title={t('ui.zooma_ut')} style={btn(!zoomedIn)}>
            <ZoomOut size={16} />
          </button>
          <span style={{ minWidth: '64px', textAlign: 'center', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(scale * 100)}%
          </span>
          <button type="button" onClick={() => zoomBy(1)} disabled={scale >= MAX_SCALE} aria-label={t('ui.zooma_in')} title={t('ui.zooma_in')} style={btn(scale >= MAX_SCALE)}>
            <ZoomIn size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
