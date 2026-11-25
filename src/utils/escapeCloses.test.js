import { describe, it, expect, vi } from 'vitest';
import { installEscapeCloses } from './escapeCloses';

// Enkla låtsasobjekt i stället för en riktig DOM (jsdom finns inte i projektet).
const el = (onClick) => ({ getBoundingClientRect: () => ({ width: 10, height: 10 }), click: onClick || (() => {}), getAttribute: () => null });
function fakeWindow(overlays) {
  const listeners = [];
  const document = {
    activeElement: null,
    querySelectorAll: (sel) => (sel === '.modal-overlay' ? overlays.map(o => ({ ...el(), querySelectorAll: () => [o.close] })) : []),
  };
  return {
    document,
    addEventListener: (_, fn) => listeners.push(fn),
    removeEventListener: () => {},
    press: (ev) => listeners.forEach(fn => fn(ev)),
  };
}
globalThis.getComputedStyle = () => ({ visibility: 'visible' });

describe('Esc stänger översta dialogrutan', () => {
  it('klickar på stängknappen i den översta rutan', () => {
    const a = vi.fn(); const b = vi.fn();
    const win = fakeWindow([{ close: el(a) }, { close: el(b) }]);
    installEscapeCloses(win);
    win.press({ key: 'Escape', defaultPrevented: false, preventDefault: () => {} });
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });
  it('rör inget när någon redan hanterat Esc, eller vid andra tangenter', () => {
    const c = vi.fn();
    const win = fakeWindow([{ close: el(c) }]);
    installEscapeCloses(win);
    win.press({ key: 'Escape', defaultPrevented: true, preventDefault: () => {} });
    win.press({ key: 'Enter', defaultPrevented: false, preventDefault: () => {} });
    expect(c).not.toHaveBeenCalled();
  });
});
