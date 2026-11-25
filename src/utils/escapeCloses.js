// Esc stänger den översta dialogrutan (2026-11-17, användarönskemål):
// samma sak som att klicka på rutans stängknapp (.modal-close), så inget
// stängs på ett annat sätt än med musen. Rutor som själva hanterar Esc och
// anropar preventDefault lämnas ifred, liksom en öppen lista i ett sökfält.
function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

export function topModalCloseButton(doc = document) {
  const overlays = [...doc.querySelectorAll('.modal-overlay')].filter(visible);
  const top = overlays.at(-1);
  if (!top) return null;
  const buttons = [...top.querySelectorAll('.modal-close')].filter(visible);
  return buttons.at(-1) || null;
}

export function installEscapeCloses(win = window) {
  const onKey = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
    const active = win.document.activeElement;
    if (active && active.getAttribute?.('aria-expanded') === 'true') return;
    const btn = topModalCloseButton(win.document);
    if (btn) { e.preventDefault(); btn.click(); }
  };
  win.addEventListener('keydown', onKey);
  return () => win.removeEventListener('keydown', onKey);
}
