import { describe, it, expect } from 'vitest';
import { computeDropdownPlacement, DROPDOWN_GAP, DROPDOWN_EDGE } from './dropdownPlacement';

const viewport = { width: 1200, height: 800 };
const anchorAt = (top, left, width = 240, height = 36) => ({
  top, left, bottom: top + height, right: left + width, width,
});

describe('computeDropdownPlacement', () => {
  it('lägger listan under ankaret när det finns gott om plats', () => {
    const p = computeDropdownPlacement(anchorAt(100, 300), viewport);
    expect(p.dropUp).toBe(false);
    expect(p.top).toBe(136 + DROPDOWN_GAP);
    expect(p.bottom).toBeUndefined();
    expect(p.left).toBe(300);
  });

  it('fäller uppåt när fältet ligger nära fönstrets nederkant', () => {
    // Ankaret slutar 60 px från botten: en lista under skulle bli en remsa.
    const p = computeDropdownPlacement(anchorAt(704, 300), viewport);
    expect(p.dropUp).toBe(true);
    expect(p.bottom).toBe(viewport.height - 704 + DROPDOWN_GAP);
    expect(p.top).toBeUndefined();
  });

  it('stannar nedåt när det är trångt både över och under', () => {
    // Litet fönster: under är trångt, men över är ännu trängre.
    const p = computeDropdownPlacement(anchorAt(40, 20), { width: 400, height: 260 });
    expect(p.dropUp).toBe(false);
  });

  it('följer ankarets bredd, men aldrig under minWidth', () => {
    const narrow = computeDropdownPlacement(anchorAt(100, 300, 120), viewport, { minWidth: 280 });
    expect(narrow.width).toBe(280);
    const wide = computeDropdownPlacement(anchorAt(100, 300, 420), viewport, { minWidth: 280 });
    expect(wide.width).toBe(420);
  });

  it('linjerar mot ankarets högerkant när align är right', () => {
    const p = computeDropdownPlacement(anchorAt(100, 800, 120), viewport, { align: 'right', minWidth: 300 });
    // Högerkanten (920) minus bredden (300).
    expect(p.left).toBe(620);
  });

  it('klamrar mot fönstrets högerkant i stället för att sticka ut', () => {
    const p = computeDropdownPlacement(anchorAt(100, 1100, 80), viewport, { minWidth: 280 });
    expect(p.left).toBe(viewport.width - 280 - DROPDOWN_EDGE);
    expect(p.left + p.width).toBeLessThanOrEqual(viewport.width - DROPDOWN_EDGE);
  });

  it('klamrar mot vänsterkanten när ankaret ligger utanför den', () => {
    const p = computeDropdownPlacement(anchorAt(100, -40), viewport, { minWidth: 280 });
    expect(p.left).toBe(DROPDOWN_EDGE);
  });

  it('kortar höjden till det som får plats, men aldrig under golvet', () => {
    const roomy = computeDropdownPlacement(anchorAt(100, 300), viewport, { maxHeight: 300 });
    expect(roomy.maxHeight).toBe(300);

    // Lågt fönster: listan fälls uppåt och kortas till det som ryms där.
    const tight = computeDropdownPlacement(anchorAt(200, 300), { width: 1200, height: 400 }, { maxHeight: 300 });
    expect(tight.dropUp).toBe(true);
    expect(tight.maxHeight).toBeLessThan(300);
    expect(tight.maxHeight).toBeGreaterThanOrEqual(120);

    // Nästan ingen plats alls kvar: golvet gäller, inte ett negativt tal.
    const squeezed = computeDropdownPlacement(anchorAt(120, 300), { width: 400, height: 170 });
    expect(squeezed.maxHeight).toBeGreaterThanOrEqual(120);
  });
});
