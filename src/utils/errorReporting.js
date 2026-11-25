// Skickar appens krascher och ohanterade fel till /api/client-error, som
// loggar dem i Systemstatus och mejlar ett larm (högst ett i timmen).
// Högst fem rapporter per sidladdning och aldrig samma fel två gånger, så
// en felande loop inte översvämmar något.
import { isReloadingForNewBuild } from './staleBuild.js';
import { captureToSentry } from './sentry.js';

const sent = new Set();
let count = 0;

/**
 * Skickar en rapport till /api/client-error, med inloggningen om det finns
 * en. Servern godtar bara ett konto-id från en verifierad inloggning (se
 * api/client-error.js), så konto-id skickas aldrig i själva rapporten.
 */
export async function postClientReport(payload) {
  let headers = { 'Content-Type': 'application/json' };
  try {
    const { supabase } = await import('../supabaseClient');
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (session?.access_token) headers = { ...headers, Authorization: `Bearer ${session.access_token}` };
  } catch { /* utan inloggning */ }
  fetch('/api/client-error', { method: 'POST', headers, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
}

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
    postClientReport({
      message,
      stack: String(error?.stack || '').slice(0, 2000),
      path: window.location.pathname,
      source,
    }).catch(() => {});
  } catch {
    // Rapporteringen får aldrig själv orsaka ett fel.
  }
}

/**
 * Kvittoläsningen misslyckades eller Vision svarade med fel. Syns som
 * Kvittoläsning i /internal → Systemstatus (inget larmmejl). Skickar aldrig
 * filen, texten eller adressen, bara feltexten och filtypen; kontot får
 * servern ur inloggningen så att felet går att koppla till kunden.
 */
export async function reportOcrError(error, { fileType = '', cloud = '' } = {}) {
  try {
    if (!import.meta.env.PROD || isReloadingForNewBuild()) return;
    const message = String(error?.message || error || '').slice(0, 200);
    const key = `ocr:${message}:${fileType}:${cloud}`;
    if (!message || count >= 5 || sent.has(key)) return;
    sent.add(key);
    count += 1;
    await postClientReport({ message, stack: String(error?.stack || '').slice(0, 1000), path: window.location.pathname, source: 'ocr', fileType, cloud });
  } catch {
    // Rapporteringen får aldrig själv orsaka ett fel.
  }
}

export function installGlobalErrorHandlers() {
  // Bara i produktion: lokalt syns felen ändå i konsolen.
  if (!import.meta.env.PROD) return;
  window.addEventListener('error', (event) => reportClientError(event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => reportClientError(event.reason));
  // Sentry (140 kB) laddas först när ett fel faktiskt inträffar, inte för
  // varje besökare: på en mobil kostade den över en sekund på startsidan
  // (Lighthouse 2026-11-07). Felet köas i sentry.js och skickas när paketet
  // har laddats; /api/client-error får det ändå direkt.
}
