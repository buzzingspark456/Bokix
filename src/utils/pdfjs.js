// pdf.js för hela appen (kvittoavläsning, lönebesked). Laddas först när den
// behövs.
//
// "legacy"-bygget, inte det vanliga: pdfjs-dist 6 använder bland annat
// Map.prototype.getOrInsertComputed och Math.sumPrecise utan att lägga till
// dem själv, och de finns bara i de allra nyaste webbläsarna. På en lite
// äldre iPhone eller dator kraschade pdf.js direkt, och en PDF gick inte att
// läsa alls (felrapport 2026-10-23, "Ert program verkar inte kunna läsa av
// pdf"). Legacy-bygget har med sig det som saknas.
//
// Workern serveras från bokix.se själv (Vite lägger den bland assets), inte
// från cdn.jsdelivr.net: CSP:n i vercel.json tillåter bara workers från
// 'self' och blob:, och en egen fil kan aldrig hamna i otakt med biblioteket.
let pdfjsPromise = null;

export function loadPdfjs() {
  pdfjsPromise ||= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjsLib, worker]) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjsLib;
  }).catch((err) => {
    // Ett tillfälligt nätfel ska inte låsa PDF-läsningen resten av besöket.
    pdfjsPromise = null;
    throw err;
  });
  return pdfjsPromise;
}
