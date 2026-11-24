// Nytt som bara admin ser än (2026-11-24). App.jsx sätter klassen ws-v2 på
// <html> för admin (isNewUnderlagUser), så komponenter som inte får en egen
// prop kan fråga här. Tas bort när förändringen släpps till alla.
export function isAdminPreview() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('ws-v2');
}
