import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { computeDropdownPlacement } from '../../utils/dropdownPlacement';

// ── En förankrad lista som aldrig kan klippas ───────────────────────────
// Kundrapport: sökrutan i tidrapporteringen ("Sök projekt…") visade bara en
// millimeter av första träffen — resten var bortklippt.
//
// Orsaken är alltid densamma, och den har dykt upp på flera ställen i appen:
// listan ligger `position: absolute` inuti ett formulär, och någon förälder
// har `overflow: auto/hidden` (rutnätet i tidrapporten, modalernas
// scrollande body, tabellernas sidledsscroll). Allt som sticker utanför den
// föräldern klipps bort. Det spelar ingen roll hur högt z-index listan har:
// z-index kan inte ta sig ur en overflow-klippning.
//
// Enda pålitliga lösningen är att flytta listan UT ur den klippande
// föräldern — en portal till <body> med `position: fixed` och koordinater
// räknade ur ankarets läge på skärmen. Den här komponenten gör det en gång,
// åt alla, i stället för att varje sökfält uppfinner sin egen variant:
//
//  - följer ankaret vid scroll och fönsterändring (capture-fasen fångar
//    även scroll i inre behållare, inte bara i fönstret),
//  - fäller uppåt i stället för nedåt när det inte får plats under,
//  - klamras mot fönstrets kanter så den aldrig hamnar utanför skärmen,
//  - lämnar ut sitt eget DOM-element via `panelRef`, så anropande kod kan
//    skilja "klick i listan" från "klick utanför" (listan är ju inte längre
//    ett barn till fältet i DOM:en).
//
// Se även RowActionMenu.jsx, som löser samma sak för radmenyerna.

export function useAnchorRect(open, anchorRef) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (!open) { setRect(null); return undefined; }
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, anchorRef]);

  return rect;
}

/**
 * @param {object} props
 * @param {React.RefObject} props.anchorRef  Elementet listan ska sitta under.
 * @param {boolean} props.open
 * @param {'left'|'right'} [props.align]     Kant att linjera mot (höger för menyer i ett högerställt verktygsfält).
 * @param {number} [props.minWidth]          Minsta bredd; annars ankarets bredd.
 * @param {number} [props.maxHeight]         Tak för höjden, klamras dessutom mot det som får plats.
 * @param {React.RefObject} [props.panelRef]  Får panelens DOM-element, för "klickade jag utanför?"-kontroller.
 */
export default function AnchoredDropdown({
  anchorRef, open, align = 'left', minWidth, maxHeight = 300, zIndex = 1090,
  panelRef, style, children, ...rest
}) {
  const rect = useAnchorRect(open, anchorRef);
  const innerRef = useRef();
  const setRefs = (node) => {
    innerRef.current = node;
    if (panelRef) panelRef.current = node;
  };

  if (!open || !rect) return null;

  // All placeringsmatte — sida, riktning, höjd, klamring mot fönsterkanten —
  // ligger i utils/dropdownPlacement.js och är testad där.
  const { left, width, maxHeight: height, dropUp, top, bottom } = computeDropdownPlacement(
    rect,
    { width: window.innerWidth, height: window.innerHeight },
    { align, minWidth, maxHeight },
  );

  return createPortal(
    <div
      ref={setRefs}
      style={{
        position: 'fixed', zIndex, left, width,
        ...(dropUp ? { bottom } : { top }),
        maxHeight: height, overflowY: 'auto',
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
        boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * "Klickade användaren utanför både fältet och den portalade listan?"
 *
 * Listan ligger i <body>, alltså utanför fältets DOM-träd — en vanlig
 * `wrapper.contains(e.target)` räknar därför ett klick i listan som ett
 * klick utanför och stänger den innan valet hinner registreras.
 */
export function useDismissOnOutsideClick(open, onDismiss, ...refs) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (refs.some(r => r?.current?.contains(e.target))) return;
      onDismiss();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onDismiss, ...refs]);
}
