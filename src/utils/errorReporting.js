// Skickar appens krascher och ohanterade fel till /api/client-error, som
// loggar dem i Systemstatus och mejlar ett larm (högst ett i timmen).
// Högst fem rapporter per sidladdning och aldrig samma fel två gånger, så
// en felande loop inte översvämmar något.
import { isReloadingForNewBuild } from './staleBuild.js';
import { initSentry, captureToSentry } from './sentry.js';

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
    // Samma fel till Sentry (sentry.js), med detaljer och spår.
    captureToSentry(error, source);
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

/**
 * Kvittoläsningen misslyckades eller Vision svarade med fel. Syns som
 * Kvittoläsning i /internal → Systemstatus (inget larmmejl). Skickar aldrig
 * filen, texten eller adressen, bara feltexten, filtypen och kontots id så
 * att felet går att koppla till kunden.
 */
export async function reportOcrError(error, { fileType = '', cloud = '' } = {}) {
  try {
    if (!import.meta.env.PROD || isReloadingForNewBuild()) return;
    const message = String(error?.message || error || '').slice(0, 200);
    const key = `ocr:${message}:${fileType}:${cloud}`;
    if (!message || count >= 5 || sent.has(key)) return;
    sent.add(key);
    count += 1;
    let userId = '';
    try {
      const { supabase } = await import('../supabaseClient');
      const { data: { session } = {} } = await supabase.auth.getSession();
      userId = session?.user?.id || '';
    } catch { /* utan konto-id */ }
    const body = JSON.stringify({ message, stack: String(error?.stack || '').slice(0, 1000), path: window.location.pathname, source: 'ocr', fileType, cloud, userId });
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
  // Sentry laddas när sidan är klar; fel före dess köas i sentry.js.
  const start = () => initSentry();
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 2000);
}
