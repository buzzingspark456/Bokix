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
    return () => {
      openForms = Math.max(0, openForms - 1);
      if (openForms === 0) root.removeAttribute('data-form');
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
