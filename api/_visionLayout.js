// Visions svar (fullTextAnnotation) → kvittots rader med läge, i samma form
// som den egna läsningen gav: [{ text, box: { x, y, w, h } }] som andelar av
// bilden (0–1). Kvittovyn markerar med dem var leverantör, datum, belopp och
// moms stod (src/utils/ocrFieldBoxes.js). Raderna byggs av Visions ord: ett
// ord vars sista tecken har en radbrytning avslutar raden.

const LINE_ENDS = new Set(['EOL_SURE_SPACE', 'LINE_BREAK']);
const r = (v) => Math.round(v * 10000) / 10000;
const clamp = (v) => Math.min(1, Math.max(0, v));

export function visionLines(annotation) {
  const page = annotation?.pages?.[0];
  if (!page) return [];
  const width = Number(page.width) || 0;
  const height = Number(page.height) || 0;
  // Bilder har pixlar (vertices), PDF-sidor andelar (normalizedVertices).
  const pointsOf = (bb) => {
    if (bb?.normalizedVertices?.length) return bb.normalizedVertices.map(v => ({ x: Number(v.x) || 0, y: Number(v.y) || 0 }));
    if (bb?.vertices?.length && width && height) return bb.vertices.map(v => ({ x: (Number(v.x) || 0) / width, y: (Number(v.y) || 0) / height }));
    return null;
  };

  const out = [];
  let words = [];
  let points = [];
  const flush = () => {
    const text = words.join('').trim();
    if (text && points.length) {
      const xs = points.map(p => clamp(p.x)); const ys = points.map(p => clamp(p.y));
      const x0 = Math.min(...xs); const y0 = Math.min(...ys);
      const x1 = Math.max(...xs); const y1 = Math.max(...ys);
      if (x1 > x0 && y1 > y0) out.push({ text, box: { x: r(x0), y: r(y0), w: r(x1 - x0), h: r(y1 - y0) } });
    }
    words = [];
    points = [];
  };

  for (const block of page.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const word of paragraph.words || []) {
        const symbols = word.symbols || [];
        const text = symbols.map(s => s.text || '').join('');
        const last = symbols[symbols.length - 1];
        const breakType = last?.property?.detectedBreak?.type;
        const pts = pointsOf(word.boundingBox);
        if (pts) points.push(...pts);
        words.push(text + (breakType && breakType !== 'HYPHEN' ? ' ' : ''));
        if (LINE_ENDS.has(breakType)) flush();
      }
      flush();
    }
  }
  return out;
}
