// Hur lång tid inloggningen tar, steg för steg: från knapptrycket till att
// appen syns. Tar den längre än SLOW_MS skickas uppdelningen till
// /api/client-error (source 'login_timing') och syns som login_slow i
// /internal. Bara tider i millisekunder, aldrig e-post eller annat.
//
// Stegen: click (knappen), captcha (robotkontrollen klar), auth (Supabase
// svarat), shown (appen ritad). Saknas click (sessionen fanns redan) mäts
// ingenting.
import { postClientReport } from './errorReporting.js';

const SLOW_MS = 4000;
let marks = null;

export function markLoginStart(method = 'password') {
  marks = { method, click: performance.now() };
}

export function markLoginStep(step) {
  if (marks && marks[step] == null) marks[step] = performance.now();
}

/** Appen syns: räkna ihop och skicka om det var långsamt. Körs en gång per inloggning. */
export function finishLoginTiming() {
  if (!marks) return;
  const m = marks;
  marks = null;
  // Efter nästa ritning, så att tiden räknar med att appen faktiskt syns.
  requestAnimationFrame(() => setTimeout(() => {
    const shown = performance.now();
    const total = Math.round(shown - m.click);
    const step = (to, from) => (m[to] != null && m[from] != null ? Math.round(m[to] - m[from]) : null);
    const summary = {
      method: m.method,
      total,
      captcha: step('captcha', 'click'),
      auth: step('auth', m.captcha != null ? 'captcha' : 'click'),
      data: m.auth != null ? Math.round(shown - m.auth) : null,
    };
    if (import.meta.env.DEV) console.info('[inloggning]', summary);
    if (total < SLOW_MS) return;
    // Kontot tar servern ur inloggningen, inte ur rapporten (api/client-error.js).
    postClientReport({ source: 'login_timing', summary }).catch(() => {});
  }, 0));
}
