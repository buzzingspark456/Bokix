import { describe, it, expect } from 'vitest';
import { visionLines } from './_visionLayout.js';

const word = (text, x0, y0, x1, y1, breakType) => ({
  boundingBox: { vertices: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] },
  symbols: text.split('').map((c, i, a) => ({ text: c, ...(i === a.length - 1 && breakType ? { property: { detectedBreak: { type: breakType } } } : {}) })),
});

describe('visionLines', () => {
  it('bygger rader av orden med läge som andelar av bilden', () => {
    const annotation = { pages: [{ width: 1000, height: 2000, blocks: [{ paragraphs: [{ words: [
      word('ICA', 100, 100, 300, 160, 'SPACE'),
      word('Maxi', 320, 100, 500, 160, 'LINE_BREAK'),
      word('Totalt', 100, 1500, 300, 1560, 'SPACE'),
      word('125,00', 700, 1500, 900, 1560, 'EOL_SURE_SPACE'),
    ] }] }] }] };
    expect(visionLines(annotation)).toEqual([
      { text: 'ICA Maxi', box: { x: 0.1, y: 0.05, w: 0.4, h: 0.03 } },
      { text: 'Totalt 125,00', box: { x: 0.1, y: 0.75, w: 0.8, h: 0.03 } },
    ]);
  });

  it('läser PDF-sidors andelar direkt', () => {
    const annotation = { pages: [{ blocks: [{ paragraphs: [{ words: [
      { boundingBox: { normalizedVertices: [{ x: 0.2, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.12 }, { x: 0.2, y: 0.12 }] }, symbols: [{ text: 'Moms' }] },
    ] }] }] }] };
    expect(visionLines(annotation)).toEqual([{ text: 'Moms', box: { x: 0.2, y: 0.1, w: 0.2, h: 0.02 } }]);
  });

  it('ger en tom lista utan sidor', () => {
    expect(visionLines(null)).toEqual([]);
    expect(visionLines({ pages: [] })).toEqual([]);
  });
});
