// Ångra i stället för "Är du säker?" (Enklare Bokix punkt 11): det som inte
// är bokfört tas bort direkt, och notisen har en Ångra-knapp en stund.
//
// Anropas imperativt, som confirmDialog: showUndo({ message, onUndo,
// onCommit }). App.jsx registrerar visningen (registerUndo) och visar den i
// sin vanliga Toast. `onCommit` körs när ångra-tiden gått ut utan ångra (t.ex.
// för att radera en kvittobild i lagringen först då), eller direkt om en ny
// ångra-notis tar över platsen.
//
// Gäller bara sådant lagen tillåter att ta bort: utkast, offerter, kontakter,
// artiklar och kvitton som inte bokförts. Bokfört rättas, det raderas aldrig.
let show = null;

export function registerUndo(fn) {
  show = fn;
  return () => { if (show === fn) show = null; };
}

export function showUndo(options) {
  if (show) show(options);
  else options.onCommit?.();
}

/** Lägger tillbaka `item` på sin gamla plats i listan (om den inte redan finns). */
export function restoreAt(list, item, index) {
  const current = list || [];
  if (current.some(x => x === item || (item?.id != null && x?.id === item.id))) return current;
  const next = [...current];
  next.splice(Math.max(0, Math.min(index ?? next.length, next.length)), 0, item);
  return next;
}
