import { useEffect, useState } from 'react';
import sv from './sv.json';
import en from './en.json';

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
const DICTS = { sv, en };
const STORAGE_KEY = 'bokix_language';
const listeners = new Set();

let language = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'sv' || stored === 'en') return stored;
  } catch { /* privat läge/blockerad storage — kör vidare med svenska */ }
  return 'sv';
})();

export function getLanguage() {
  return language;
}

export function setLanguage(lang) {
  if (lang !== 'sv' && lang !== 'en') return;
  language = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* samma reservläge som ovan */ }
  listeners.forEach(fn => fn());
}

function readPath(dict, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
}

export function t(key, vars) {
  let str = readPath(DICTS[language], key) ?? readPath(DICTS.sv, key) ?? key;
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
  return { t, language, setLanguage };
}
