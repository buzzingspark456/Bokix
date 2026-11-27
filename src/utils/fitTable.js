import { useLayoutEffect } from 'react';

// Listor ryms i bredden (2026-11-27). Tre steg, bara så långt som behövs:
//  1. lt-nowrap: ingen radbrytning i cellerna (inget "Stockh-olm").
//  2. lt-tight:  kolumnerna får mindre luft (rubrikerna stannar på en rad).
//  3. lt-fit:    textkolumnerna (namn, e-post, kontaktperson, ort …) krymps i
//                proportion till hur mycket de kan ge, och lång text får "…".
// Nummer, datum och belopp krymps aldrig. Ryms tabellen inte ens då rullar
// den i sidled hellre än att klippa siffror. Används av ListTable och de
// egna tabellerna (Artiklar, Order, Underlag).

const KEEP = 100; // kolumner smalare än så krymps aldrig
const MIN = 72;   // ingen textkolumn krymps under så här
const NUMERIC = /^[-–+\d\s.,:%kr]+$/i;

export function fitTable(table, wrap, hide = 0) {
  if (!table || !wrap) return;
  table.classList.remove('lt-nowrap', 'lt-tight', 'lt-fit');
  table.querySelectorAll('[data-fit-hide]').forEach(el => { el.style.display = ''; el.removeAttribute('data-fit-hide'); });
  table.style.tableLayout = '';
  table.style.width = '100%';
  const old = table.querySelector('colgroup[data-fit]');
  if (old) old.remove();
  if (getComputedStyle(table).display !== 'table') return; // telefonens kortlista
  const head = table.tHead?.rows?.[0];
  const avail = wrap.clientWidth;
  if (!head || !avail) return;
  const fits = () => table.scrollWidth <= avail + 1;
  // Steg 4 (bara om inget annat räckte): dölj kolumner längst till höger.
  const hideable = hideOrder(table);
  if (hide > 0) {
    hideable.slice(0, hide).forEach(i => {
      [...table.rows].forEach(r => { const c = r.cells[i]; if (c && r.cells.length === head.cells.length) { c.style.display = 'none'; c.setAttribute('data-fit-hide', ''); } });
    });
  }

  table.classList.add('lt-nowrap');
  if (fits()) { spread(table, avail); return; }
  table.classList.add('lt-tight');
  if (fits()) return;

  const cells = [...head.cells].filter(c => !c.hasAttribute('data-fit-hide'));
  if (cells.some(c => c.colSpan > 1)) return;
  // offsetWidth, inte getBoundingClientRect: appen är zoomad till 90 % på dator,
  // och kolumnbredderna sätts i samma (ozoomade) enhet som clientWidth.
  const raw = cells.map(c => c.offsetWidth);
  const body = table.tBodies?.[0]?.rows?.[0];
  // cellIndex: samma kolumn i raderna även när kolumner till vänster är dolda.
  const numeric = cells.map(c => { const txt = (body?.cells?.[c.cellIndex]?.textContent || '').trim(); return txt.length > 0 && NUMERIC.test(txt); });
  const shrinkable = raw.map((x, i) => x > KEEP && !numeric[i]);
  // Kolumner som inte krymps får 4 px marginal: zoomen ger avrundning i
  // bråkdelar av pixlar, och text som precis rymdes klipptes annars.
  const w = raw.map((x, i) => (shrinkable[i] ? x : x + 4));
  const need = w.reduce((a, b) => a + b, 0) - avail;
  // En textkolumn krymps aldrig smalare än sin rubrik (rubriken kortas inte).
  const zoom = (cells[0].getBoundingClientRect().width / (cells[0].offsetWidth || 1)) || 1;
  const headMin = cells.map(c => {
    const r = document.createRange(); r.selectNodeContents(c);
    const cs = getComputedStyle(c);
    return Math.ceil(r.getBoundingClientRect().width / zoom + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2);
  });
  const cap = w.map((x, i) => (shrinkable[i] ? Math.max(0, x - Math.max(MIN, headMin[i])) : 0));
  const sumCap = cap.reduce((a, b) => a + b, 0);
  if (need <= 0 || sumCap <= 0) return;
  // Namnet (första textkolumnen) krymps sist: de andra textkolumnerna ger
  // plats först, och bara det som fattas tas från namnet.
  const primary = shrinkable.indexOf(true);
  const otherCap = sumCap - (primary >= 0 ? cap[primary] : 0);
  const fromOthers = Math.min(need, otherCap);
  const fromPrimary = Math.min(Math.max(0, need - fromOthers), primary >= 0 ? cap[primary] : 0);
  const next = w.map((x, i) => {
    if (!cap[i]) return Math.floor(x);
    if (i === primary) return Math.floor(x - fromPrimary);
    return Math.floor(x - (otherCap ? fromOthers * (cap[i] / otherCap) : 0));
  });
  const sum = next.reduce((a, b) => a + b, 0);
  if (sum > avail + 1 && hide < hideable.length) { fitTable(table, wrap, hide + 1); return; }
  const cg = document.createElement('colgroup');
  cg.setAttribute('data-fit', '');
  next.forEach(px => { const col = document.createElement('col'); col.style.width = `${px}px`; cg.appendChild(col); });
  table.insertBefore(cg, table.firstChild);
  table.style.tableLayout = 'fixed';
  table.style.width = sum > avail + 1 ? `${sum}px` : '100%';
  table.classList.add('lt-fit');
}

// Kolumner som får döljas när inget annat räcker, längst till höger först:
// inte kryssrutan, inte ⋮ (tom rubrik) och inte första textkolumnen (namnet).
function hideOrder(table) {
  const head = table.tHead?.rows?.[0];
  const body = table.tBodies?.[0]?.rows?.[0];
  if (!head || !body) return [];
  const cells = [...head.cells];
  const isText = (i) => { const txt = (body.cells[i]?.textContent || '').trim(); return txt.length > 0 && !NUMERIC.test(txt); };
  const labelled = cells.map((c, i) => (c.textContent || '').trim().length > 0 && !c.querySelector('input'));
  const primary = cells.findIndex((c, i) => labelled[i] && isText(i));
  const out = [];
  for (let i = cells.length - 1; i >= 0; i--) if (labelled[i] && i !== primary) out.push(i);
  return out;
}

// Ryms tabellen: nummer, datum och belopp får exakt sin bredd, och den
// överblivna platsen går till textkolumnerna (namn, e-post, ort …), så att
// kolumnerna ligger jämnt oavsett hur många som visas.
function spread(table, avail) {
  const head = table.tHead?.rows?.[0];
  const cells = head ? [...head.cells] : [];
  if (!cells.length || cells.some(c => c.colSpan > 1)) return;
  table.style.width = 'auto';
  const raw = cells.map(c => c.offsetWidth);
  table.style.width = '100%';
  const body = table.tBodies?.[0]?.rows?.[0];
  if (!body || body.cells.length !== cells.length) return;
  const text = cells.map((c, i) => { const txt = (body.cells[i]?.textContent || '').trim(); return raw[i] > 60 && txt.length > 0 && !NUMERIC.test(txt); });
  const base = raw.map((x, i) => (text[i] ? x : x + 2)); // 2 px marginal mot avrundning
  const extra = avail - base.reduce((a, b) => a + b, 0) - 2;
  const textSum = raw.reduce((a, x, i) => a + (text[i] ? x : 0), 0);
  if (extra <= 0 || textSum <= 0) return;
  const next = base.map((x, i) => Math.floor(text[i] ? x + extra * (x / textSum) : x));
  const cg = document.createElement('colgroup');
  cg.setAttribute('data-fit', '');
  next.forEach(px => { const col = document.createElement('col'); col.style.width = `${px}px`; cg.appendChild(col); });
  table.insertBefore(cg, table.firstChild);
  table.style.tableLayout = 'fixed';
  table.style.width = '100%';
}

/** Kör fitTable när innehållet ändras och när ytan byter bredd. */
export function useFitTable(tableRef, wrapRef, deps = []) {
  useLayoutEffect(() => {
    const table = tableRef.current;
    const wrap = wrapRef.current;
    if (!table || !wrap) return undefined;
    let raf = 0;
    let lastW = -1;
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { lastW = wrap.clientWidth; fitTable(table, wrap); }); };
    fitTable(table, wrap);
    lastW = wrap.clientWidth;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (wrap.clientWidth !== lastW) run(); }) : null;
    ro?.observe(wrap);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * De egna tabellerna (Artiklar, Order, Underlag: table.ar-table, table.ut-table)
 * anpassas automatiskt: körs när sidan ritas om och när fönstret byter storlek.
 * Installeras en gång i App.
 */
export function installFitTables(root = document.body, selector = 'table.ar-table, table.ut-table') {
  if (typeof window === 'undefined' || !root) return () => {};
  let raf = 0;
  let busy = false;
  const runAll = () => {
    busy = true;
    root.querySelectorAll(selector).forEach(t => { if (t.parentElement) fitTable(t, t.parentElement); });
    requestAnimationFrame(() => { busy = false; });
  };
  const schedule = () => { if (busy) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(runAll); };
  const mo = new MutationObserver(schedule);
  mo.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  schedule();
  return () => { cancelAnimationFrame(raf); mo.disconnect(); window.removeEventListener('resize', schedule); };
}
