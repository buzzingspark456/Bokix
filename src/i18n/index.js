import { useEffect, useState } from 'react';
import sv from './sv.json';

// Minimal i18n-motor — MEDVETET utan Context/Provider (skulle kräva att
// hela App.jsx-trädet lindas in) — ett externt, delat store-mönster
// istället (samma grundidé som Reacts egen useSyncExternalStore): en modul-
// nivå-variabel + en lista med lyssnare som `useTranslation()` prenumererar
// på. Vilken komponent som helst kan importera `t()`/`useTranslation()` rakt
// av, utan trådning genom komponentträdet.
//
// TÄCKNING: bara nycklarna under "settings" finns i sv.json/en.json just
// nu (flikraden + den nya Utseende-fliken, se Settings.jsx) — resten av
// appen är fortfarande hårdkodad svenska. Det är motorn och mönstret som är
// fullt byggt, inte varje sträng i appen ännu; nya `t('område.nyckel')`-
// nycklar läggs till i BÅDA språkfilerna i takt med att fler delar av
// appen görs om, komponent för komponent.
//
// Engelskan (ca 250 kB) laddas bara för den som valt engelska, inte för
// varje besökare på webbplatsen. languageReady väntas in innan appen visas
// (AppRouter.jsx), så att ingen ser svenska i en blinkning.
const DICTS = { sv };
const STORAGE_KEY = 'bokix_language';
const listeners = new Set();

let enPromise = null;
function loadEnglish() {
  if (!enPromise) {
    enPromise = import('./en.json')
      .then((m) => { DICTS.en = m.default || m; listeners.forEach(fn => fn()); })
      .catch((err) => { enPromise = null; console.error('Kunde inte ladda engelskan:', err); });
  }
  return enPromise;
}

let language = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'sv' || stored === 'en') return stored;
  } catch { /* privat läge/blockerad storage — kör vidare med svenska */ }
  return 'sv';
})();

export const languageReady = language === 'en' ? loadEnglish() : Promise.resolve();

// Tvingat språk för vyer som alltid ska vara på ett visst språk oavsett
// sparat val: inloggning och registrering visas på svenska, precis som resten
// av webbplatsen (bara svenska sedan 2026-10-02). Det sparade valet rörs
// inte, så appen är på engelska igen efter inloggning för den som valt det.
let forced = null;
const current = () => forced || language;

export function getLanguage() {
  return current();
}

/** Tvingar `lang` medan komponenten är monterad. Sätts redan under första
 * renderingen (useState-initieraren), så inget hinner visas på fel språk. */
export function useForcedLanguage(lang) {
  useState(() => { forced = lang; });
  useEffect(() => {
    forced = lang;
    listeners.forEach(fn => fn());
    return () => { forced = null; listeners.forEach(fn => fn()); };
  }, [lang]);
}

export function setLanguage(lang) {
  if (lang !== 'sv' && lang !== 'en') return;
  language = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* samma reservläge som ovan */ }
  if (lang === 'en' && !DICTS.en) loadEnglish();
  listeners.forEach(fn => fn());
}

function readPath(dict, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
}

// Pekskärm (telefon, surfplatta): en text kan ha en variant med suffixet
// "__touch" som används i stället, t.ex. "Tryck för att välja fil" där
// datorn säger "Dra och släpp … eller klicka". Ingen kan dra en fil till en
// telefon.
const TOUCH = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export function t(key, vars) {
  const dict = DICTS[current()] || DICTS.sv;
  let str = (TOUCH ? readPath(dict, `${key}__touch`) : undefined)
    ?? readPath(dict, key) ?? readPath(DICTS.sv, key) ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => { str = str.replaceAll(`{{${k}}}`, v); });
  }
  return str;
}

// Prenumererar komponenten på språkbyten, så den renderar om när någon
// annanstans i appen (t.ex. Inställningar → Utseende → Språk) byter språk.
export function useTranslation() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick(n => n + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  return { t, language: current(), setLanguage };
}

// Språkinställning för datum med månads- och veckodagsnamn (Intl). Belopp
// formateras fortfarande med sv-SE, eftersom kronor skrivs likadant.
export function dateLocale() {
  return current() === 'en' ? 'en-GB' : 'sv-SE';
}
