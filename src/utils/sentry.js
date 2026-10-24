// Felspårning i webbläsaren med Sentry (användarens beslut 2026-10-24).
// Bara i produktionsbygget, lokalt gör filen ingenting. Laddas efter sidan
// (eget paket), så första visningen inte blir långsammare.
//
// Ingen prestandamätning, ingen skärminspelning, inga cookies, headers,
// frågeparametrar eller kroppar, ingen användare. Personnummer/org.nr,
// e-postadresser och långa nummer tas bort ur texterna innan något skickas.
// Felen kommer från errorReporting.js (samma ställe som /api/client-error),
// så Sentrys egna globala felfångare är avstängda för att inte dubbla.

// VITE_SENTRY_DSN i Vercel går före Bokix eget projekt (sentryScrub.js).
import { BOKIX_SENTRY_DSN, SENTRY_DATA_COLLECTION, scrubEvent, scrubBreadcrumb } from './sentryScrub.js';

const DSN = import.meta.env.VITE_SENTRY_DSN || BOKIX_SENTRY_DSN;
const ENABLED = Boolean(import.meta.env.PROD && DSN);

let sentry = null;
let loading = null;
const queue = [];

export function initSentry() {
  if (!ENABLED || loading) return loading;
  loading = import('@sentry/browser')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: 'production',
        tracesSampleRate: 0,
        dataCollection: SENTRY_DATA_COLLECTION,
        integrations: (defaults) => defaults.filter(i => i.name !== 'GlobalHandlers'),
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      });
      sentry = Sentry;
      for (const [error, source] of queue.splice(0)) Sentry.captureException(error, { tags: { source } });
    })
    .catch(() => { /* Sentry gick inte att ladda (blockerare): appen fungerar ändå */ });
  return loading;
}

export function captureToSentry(error, source = 'global') {
  if (!ENABLED) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error?.message || error || 'Okänt fel'));
    if (sentry) sentry.captureException(err, { tags: { source } });
    else if (queue.length < 5) queue.push([err, source]);
  } catch {
    // Rapporteringen får aldrig själv orsaka ett fel.
  }
}
