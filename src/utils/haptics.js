// ── Haptik: en kort vibration när något händer, som i en app ─────────────
// Android: navigator.vibrate. iPhone har inget vibrations-API i Safari, men
// sedan iOS 18 ger en <input type="checkbox" switch> ett litet "tick" när
// den slås om, även om den är osynlig. Det fungerar bara i direkt anslutning
// till ett tryck (samma regel som allt annat Safari tillåter), så anropa
// haptic() från en klick- eller touchhanterare. Saknas stöd händer inget.

let iosSwitchLabel = null;

function iosTick() {
  if (typeof document === 'undefined') return;
  if (!iosSwitchLabel) {
    const id = 'bokix-haptic-switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.setAttribute('switch', '');
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.setAttribute('aria-hidden', 'true');
    for (const el of [input, label]) {
      el.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px;';
    }
    document.body.append(input, label);
    iosSwitchLabel = label;
  }
  iosSwitchLabel.click();
}

const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches;

/** 'light' för vanliga tryck (flikbyte), 'success' när något sparats. */
export function haptic(kind = 'light') {
  if (!isPhone()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'success' ? [12, 60, 12] : 8);
      return;
    }
    if (/iPhone|iPad|iPod/.test(navigator.userAgent || '')) iosTick();
  } catch { /* stöds inte, inget att göra */ }
}
