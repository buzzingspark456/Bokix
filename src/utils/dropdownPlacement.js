// ── Var ska en förankrad lista hamna? ───────────────────────────────────
// Ren räkning, utan DOM: in kommer ankarets rektangel och fönstrets mått,
// ut kommer koordinaterna listan ska ritas på. Ligger i utils/ i stället
// för i komponenten just för att kunna testas — det var den här logiken som
// saknades när listorna klipptes eller hamnade utanför skärmkanten.
//
// Används av components/shared/AnchoredDropdown.jsx.

/** Avstånd mellan ankaret och listan. */
export const DROPDOWN_GAP = 4;
/** Minsta luft mot fönstrets kanter. */
export const DROPDOWN_EDGE = 8;
/** Under så här många pixlar under ankaret är det värt att överväga att
 * fälla uppåt i stället. */
const TIGHT_BELOW = 180;
/** Listan görs aldrig lägre än så här — en lista på 40 px är inte en lista. */
const MIN_HEIGHT = 120;

/**
 * @param {{top: number, bottom: number, left: number, right: number, width: number}} anchor
 *   Ankarets rektangel i fönsterkoordinater (getBoundingClientRect).
 * @param {{width: number, height: number}} viewport
 * @param {{align?: 'left'|'right', minWidth?: number, maxHeight?: number}} [opts]
 * @returns {{left: number, width: number, maxHeight: number, dropUp: boolean, top?: number, bottom?: number}}
 *   `top` sätts när listan fälls nedåt, `bottom` när den fälls uppåt — båda
 *   avsedda för `position: fixed`.
 */
export function computeDropdownPlacement(anchor, viewport, opts = {}) {
  const { align = 'left', minWidth = 0, maxHeight = 300 } = opts;

  const width = Math.max(anchor.width || 0, minWidth);
  const spaceBelow = viewport.height - anchor.bottom - DROPDOWN_GAP - DROPDOWN_EDGE;
  const spaceAbove = anchor.top - DROPDOWN_GAP - DROPDOWN_EDGE;

  // Fäll uppåt bara när det både är trångt under OCH rymligare över. Utan
  // det andra villkoret hoppar listan upp och ner av små ändringar i
  // fönsterhöjden, vilket är värre än en lite kortare lista.
  const dropUp = spaceBelow < TIGHT_BELOW && spaceAbove > spaceBelow;
  const available = dropUp ? spaceAbove : spaceBelow;
  const height = Math.max(MIN_HEIGHT, Math.min(maxHeight, available));

  // Höger kant först när align === 'right' (menyer i ett högerställt
  // verktygsfält), annars vänster — och sedan klamrat mot fönstret så
  // listan aldrig hamnar utanför skärmen på en smal skärm.
  const rawLeft = align === 'right' ? anchor.right - width : anchor.left;
  const left = Math.max(DROPDOWN_EDGE, Math.min(rawLeft, viewport.width - width - DROPDOWN_EDGE));

  return dropUp
    ? { left, width, maxHeight: height, dropUp, bottom: viewport.height - anchor.top + DROPDOWN_GAP }
    : { left, width, maxHeight: height, dropUp, top: anchor.bottom + DROPDOWN_GAP };
}

// ── Sidans zoom ─────────────────────────────────────────────────────────
// På dator är hela appen utzoomad med `html { zoom }` (index.css,
// --app-zoom). getBoundingClientRect och window.innerWidth/innerHeight är då
// i skärmpixlar, men `position: fixed` placeras i sidans egna (ozoomade)
// pixlar och skalas sedan av zoomen. Utan omräkning hamnade en radmeny
// 40 px för högt vid 90 %. Allt som placerar en flytande lista från ett
// ankares rektangel ska därför gå via de två funktionerna nedan.

/** Zoomen på <html>, 1 när ingen är satt. */
export function pageZoom() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return 1;
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return z > 0 ? z : 1;
}

/** Elementets rektangel i sidans pixlar, redo för `position: fixed`.
 * Skalan mäts på elementet självt (skärmbredd / layoutbredd) i stället för
 * att antas, så det blir rätt även i en webbläsare som redan räknar om. */
export function layoutRect(el) {
  const r = el.getBoundingClientRect();
  const s = el.offsetWidth > 0 ? r.width / el.offsetWidth : pageZoom();
  const k = s > 0 ? s : 1;
  return { left: r.left / k, right: r.right / k, top: r.top / k, bottom: r.bottom / k, width: r.width / k, height: r.height / k };
}

/** Fönstrets mått i sidans pixlar. */
export function layoutViewport() {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  const z = pageZoom();
  return { width: window.innerWidth / z, height: window.innerHeight / z };
}
