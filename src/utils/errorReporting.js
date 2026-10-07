// Skickar appens krascher och ohanterade fel till /api/client-error, som
// loggar dem i Systemstatus och mejlar ett larm (högst ett i timmen).
// Högst fem rapporter per sidladdning och aldrig samma fel två gånger, så
// en felande loop inte översvämmar något.
import { isReloadingForNewBuild } from './staleBuild.js';

const sent = new Set();
let count = 0;

export function reportClientError(error, source = 'global') {
  try {
    // Sidan laddas redan om för en ny version, felet är en följd av det.
    if (isReloadingForNewBuild()) return;
    const message = String(error?.message || error || '').slice(0, 300);
    if (!message || count >= 5 || sent.has(message)) return;
    sent.add(message);
    count += 1;
    const body = JSON.stringify({
      message,
      stack: String(error?.stack || '').slice(0, 2000),
      path: window.location.pathname,
      source,
    });
    fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    // Rapporteringen får aldrig själv orsaka ett fel.
  }
}

export function installGlobalErrorHandlers() {
  // Bara i produktion: lokalt syns felen ändå i konsolen.
  if (!import.meta.env.PROD) return;
  window.addEventListener('error', (event) => reportClientError(event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => reportClientError(event.reason));
}
