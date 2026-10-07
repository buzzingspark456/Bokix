// Efter en ny deploy finns de gamla sidfilerna (/assets/*-<hash>.js) inte
// kvar. En flik som öppnades före deployen kraschar då första gången den
// byter sida ("Något gick fel", sågs live 2026-10-04). Lösningen är att
// ladda om sidan en gång så den nya versionen hämtas. Spärren i
// sessionStorage hindrar en omladdningsloop om filen verkligen saknas.

const KEY = 'bokix_stale_build_reload';

// När main.jsx stoppar Vites preloadError (preventDefault) kastar importen
// inget fel, den lyckas i stället med undefined. En lazy()-sida kraschar då
// på "reading 'default'" under de millisekunder omladdningen tar (sågs live
// 2026-10-07). Flaggan låter ErrorBoundary och felrapporteringen tiga då.
let reloading = false;

export function isReloadingForNewBuild() {
  return reloading;
}

export function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk .* failed/i.test(msg);
}

// Returnerar true om sidan laddas om (anroparen ska då inte visa något fel).
export function reloadOnceForNewBuild() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  reloading = true;
  window.location.reload();
  return true;
}
