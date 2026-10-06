import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Formulär som helskärm på telefon (Ny faktura, Ny verifikation m.fl.).
// I en app tar ett formulär hela skärmen: Avbryt uppe till vänster, namnet i
// mitten och spara-knapparna fast längst ned där tummen når. Bottenmenyn,
// klockan och profilbilden hör till listorna, inte till formuläret.
//
// useMobileForm() sätter html[data-form] så länge formuläret är öppet;
// index.css (sök "data-form") gömmer då appens toppfält och bottenmeny under
// 768 px. Räknare i stället för en flagga: ett formulär kan öppnas ovanpå
// ett annat (t.ex. Ny kund inifrån Ny faktura) och det första som stängs får
// inte ta tillbaka bottenmenyn medan det andra fortfarande är öppet.
let openForms = 0;

export function useMobileForm(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    openForms += 1;
    root.setAttribute('data-form', 'open');
    if (openForms === 1) startEdgeSwipe();
    return () => {
      openForms = Math.max(0, openForms - 1);
      if (openForms === 0) {
        root.removeAttribute('data-form');
        stopEdgeSwipe();
      }
    };
  }, [active]);
}

// Samma sak som komponent, för formulär som visas med en tidig return i
// en större komponent (där en hook inte får anropas villkorligt).
export function MobileFormMode() {
  useMobileForm();
  return null;
}

// Spara-raden längst ned på telefon. Ligger i body (portal) så att den står
// fast mot skärmen oavsett vad formuläret ligger inuti; på datorn döljs den
// helt och formulärets egna knappar gäller som förut.
export function MobileFormBar({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="mform-bar">{children}</div>, document.body);
}

// ── Svep från vänsterkanten = Tillbaka/Avbryt ────────────────────────────
// Som i en iPhone-app: dra från skärmens vänsterkant, skärmen följer fingret,
// släpp en bit in så stängs den (samma knapp som Avbryt). Släpp tidigt så
// glider den tillbaka. Bara på telefon och bara när ett formulär är öppet.
const EDGE = 24;
let drag = null;

function topForm() {
  const heads = document.querySelectorAll('.mform-head');
  const head = heads[heads.length - 1];
  return head ? { el: head.parentElement, back: head.querySelector('.mform-back') } : null;
}

function onStart(e) {
  if (e.touches.length !== 1 || !window.matchMedia('(max-width: 768px)').matches) return;
  const t = e.touches[0];
  if (t.clientX > EDGE) return;
  const form = topForm();
  if (!form?.el || !form.back) return;
  drag = { ...form, x: t.clientX, y: t.clientY, dx: 0, t: Date.now(), locked: false };
}

function onMove(e) {
  if (!drag) return;
  const t = e.touches[0];
  const dx = t.clientX - drag.x;
  const dy = t.clientY - drag.y;
  if (!drag.locked) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
    if (dx < 8) return;
    drag.locked = true;
    drag.el.style.transition = 'none';
    drag.el.classList.add('mform-dragging');
  }
  e.preventDefault();
  drag.dx = Math.max(0, dx);
  drag.el.style.transform = `translateX(${drag.dx}px)`;
}

function onEnd() {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.locked) return;
  const width = window.innerWidth;
  const fast = d.dx / Math.max(1, Date.now() - d.t) > 0.5;
  const close = d.dx > width * 0.35 || (fast && d.dx > 40);
  d.el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
  d.el.style.transform = close ? `translateX(${width}px)` : 'translateX(0)';
  setTimeout(() => {
    // Stäng först, återställ sedan: annars syns formuläret en bildruta
    // innan det försvinner. Stannar det kvar (en fråga om osparade
    // ändringar) glider det tillbaka på plats.
    if (close) d.back.click();
    requestAnimationFrame(() => {
      d.el.classList.remove('mform-dragging');
      d.el.style.transition = '';
      d.el.style.transform = '';
    });
  }, 220);
}

function startEdgeSwipe() {
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onEnd);
}

function stopEdgeSwipe() {
  drag = null;
  document.removeEventListener('touchstart', onStart);
  document.removeEventListener('touchmove', onMove);
  document.removeEventListener('touchend', onEnd);
  document.removeEventListener('touchcancel', onEnd);
}
