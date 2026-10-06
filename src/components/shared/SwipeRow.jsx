import React, { useEffect, useRef, useState } from 'react';
import { haptic } from '../../utils/haptics';

// Svep åt vänster på en listrad för att få fram dess åtgärder, som i iPhones
// Mail (Ta bort, Skapa faktura …). Ersätter knappar som annars låg på varje
// rad och gjorde listan tät. Bara en rad står öppen åt gången; ett tryck på
// en öppen rad stänger den i stället för att öppna posten.
//
// actions: [{ key, label, icon?, tone?: 'danger' | 'accent', onClick }]
const ACTION_W = 84;
let closeOpenRow = null;

export default function SwipeRow({ actions, children, className, ...rest }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const g = useRef(null);
  const max = actions.length * ACTION_W;
  const open = offset !== 0;

  // Stabil funktion: används som identitet för "den rad som står öppen".
  const close = useRef(() => setOffset(0)).current;
  useEffect(() => () => { if (closeOpenRow === close) closeOpenRow = null; }, [close]);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    g.current = { x: t.clientX, y: t.clientY, base: offset, locked: null };
  };
  const onTouchMove = (e) => {
    const s = g.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.locked == null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (s.locked === 'x') {
        setDragging(true);
        if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
      }
    }
    if (s.locked !== 'x') return;
    // Lite motstånd förbi kanten, som i iOS.
    let next = s.base + dx;
    if (next > 0) next = 0;
    if (next < -max) next = -max - (-max - next) * 0.25;
    setOffset(next);
  };
  const onTouchEnd = () => {
    const s = g.current;
    g.current = null;
    if (!s || s.locked !== 'x') return;
    setDragging(false);
    const shouldOpen = offset < -max / 2;
    setOffset(shouldOpen ? -max : 0);
    if (shouldOpen) {
      if (s.base === 0) haptic();
      closeOpenRow = close;
    }
  };

  // Ett tryck på en öppen rad stänger den; capture så radens egen onClick
  // (öppna posten) aldrig körs.
  const onClickCapture = (e) => {
    if (open) { e.stopPropagation(); e.preventDefault(); close(); }
  };

  return (
    <div className={'swipe-row' + (open ? ' swipe-row--open' : '')}>
      <div className="swipe-row-actions" style={{ width: max }} aria-hidden={!open}>
        {actions.map(a => (
          <button
            key={a.key ?? a.label}
            type="button"
            tabIndex={open ? 0 : -1}
            className={'swipe-row-action' + (a.tone ? ` swipe-row-action--${a.tone}` : '')}
            onClick={(e) => { e.stopPropagation(); close(); a.onClick?.(e); }}
          >
            {a.icon && <a.icon size={20} />}
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      <div
        {...rest}
        className={className}
        onTouchStart={(e) => { onTouchStart(e); rest.onTouchStart?.(e); }}
        onTouchMove={(e) => { onTouchMove(e); rest.onTouchMove?.(e); }}
        onTouchEnd={(e) => { onTouchEnd(e); rest.onTouchEnd?.(e); }}
        onTouchCancel={(e) => { onTouchEnd(e); rest.onTouchCancel?.(e); }}
        onClickCapture={onClickCapture}
        style={{
          ...rest.style,
          transform: offset ? `translateX(${offset}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
