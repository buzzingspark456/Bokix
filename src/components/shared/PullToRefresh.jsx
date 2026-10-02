import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from '../icons';
import { haptic } from '../../utils/haptics';

// Dra ned för att uppdatera, som i alla appar. Bara på telefon, bara när
// sidan redan står högst upp och ingen panel eller ruta är öppen. Ersätter
// webbläsarens uppdatera-knapp, som inte finns när Bokix körs från
// hemskärmen.
//
// Lyssnar på hela dokumentet i stället för på .main-wrapper: den byggs om
// vid varje sidbyte (key={activeTab} i App.jsx).
const THRESHOLD = 72;
const MAX_PULL = 120;

// Något ligger öppet ovanpå sidan. Telefonens Meny-panel finns alltid i
// DOM:en (role="dialog" även stängd), så bara det som faktiskt syns räknas.
function blocked() {
  const html = document.documentElement;
  if (html.hasAttribute('data-sheet') || html.getAttribute('data-keyboard') === 'open') return true;
  return [...document.querySelectorAll('.modal-overlay, [role="dialog"], .profile-dropdown')].some((el) => {
    if (el.classList.contains('mobile-sheet') && !el.classList.contains('open')) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
      && r.bottom > 0 && r.top < window.innerHeight;
  });
}

export default function PullToRefresh({ onRefresh }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullRef = useRef(0);
  const armed = useRef(false);

  useEffect(() => {
    if (!window.matchMedia?.('(max-width: 768px)').matches) return undefined;
    const scrollerOf = (target) => target?.closest?.('.main-wrapper');

    const onStart = (e) => {
      if (refreshing || e.touches.length !== 1) return;
      const scroller = scrollerOf(e.target);
      if (!scroller || scroller.scrollTop > 0 || blocked()) return;
      startY.current = e.touches[0].clientY;
      armed.current = false;
    };
    const onMove = (e) => {
      if (startY.current == null) return;
      const scroller = scrollerOf(e.target);
      const dy = e.touches[0].clientY - startY.current;
      if (!scroller || scroller.scrollTop > 0 || dy <= 0) {
        if (pullRef.current) { pullRef.current = 0; setPull(0); }
        return;
      }
      const next = Math.min(MAX_PULL, dy * 0.5);
      if (next >= THRESHOLD && !armed.current) { armed.current = true; haptic(); }
      if (next < THRESHOLD) armed.current = false;
      pullRef.current = next;
      setPull(next);
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      const reached = pullRef.current >= THRESHOLD;
      pullRef.current = 0;
      if (!reached) { setPull(0); return; }
      setRefreshing(true);
      setPull(THRESHOLD);
      // Laddas sidan om syns inget av återställningen; gör den inte det
      // (t.ex. utan nät) går indikatorn tillbaka.
      try { await onRefresh(); } finally { setRefreshing(false); setPull(0); }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [onRefresh, refreshing]);

  if (!pull && !refreshing) return null;
  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <div className="ptr-indicator" aria-hidden="true" style={{ transform: `translate(-50%, ${pull - 44}px)`, opacity: progress }}>
      <RefreshCw size={20} className={refreshing ? 'ptr-spin' : undefined} style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }} />
    </div>
  );
}
