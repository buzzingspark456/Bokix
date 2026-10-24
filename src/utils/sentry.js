// Felspårning i webbläsaren med Sentry (användarens beslut 2026-10-24).
// Bara i produktionsbygget, lokalt gör filen ingenting. Laddas efter sidan
// (eget paket), så första visningen inte blir långsammare.
//
// Ingen prestandamätning, ingen skärminspelning, inga cookies, headers,
// frågeparametrar eller kroppar, ingen användare. Personnummer/org.nr,
// e-postadresser och långa nummer tas bort ur texterna innan något skickas.
// Felen kommer från errorReporting.js (samma ställe som /api/client-error),
// så Sentrys egna globala felfångare är avstängda för att inte dubbla.

// DSN är inte hemlig (den hamnar alltid i webbläsarkoden). Projektet ligger i
// Sentrys EU-region (ingest.de). VITE_SENTRY_DSN i Vercel går före.
const DSN = import.meta.env.VITE_SENTRY_DSN || 'https://c58d6a251e48a33b7940c59e92dbef75@o4508412011806720.ingest.de.sentry.io/4508412025831504';
const ENABLED = Boolean(import.meta.env.PROD && DSN);

let sentry = null;
let loading = null;
const queue = [];

const SCRUB = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-post]'],
  // Personnummer och org.nr (ÅÅMMDD-XXXX, ÅÅÅÅMMDDXXXX, 556123-4567)
  [/\b(?:19|20)?\d{6}[-+]?\d{4}\b/g, '[nummer]'],
  // Konto-, bankgiro-, OCR- och kortnummer
  [/\b\d{7,}\b/g, '[nummer]'],
];

export function scrubText(value) {
  if (typeof value !== 'string') return value;
  return SCRUB.reduce((s, [re, to]) => s.replace(re, to), value);
}

function stripQuery(url) {
  if (typeof url !== 'string') return url;
  const i = url.search(/[?#]/);
  return i === -1 ? url : url.slice(0, i);
}

export function scrubEvent(event) {
  if (!event) return event;
  delete event.user;
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values || []) ex.value = scrubText(ex.value);
  if (event.request) {
    event.request = { url: stripQuery(event.request.url) };
  }
  if (Array.isArray(event.breadcrumbs)) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter(Boolean);
  return event;
}

function scrubBreadcrumb(crumb) {
  if (!crumb) return crumb;
  // Konsolutskrifter kan innehålla vad som helst, de skickas inte.
  if (crumb.category === 'console') return null;
  const out = { ...crumb, message: scrubText(crumb.message) };
  if (crumb.data) {
    out.data = { ...crumb.data };
    for (const k of ['url', 'from', 'to']) if (out.data[k]) out.data[k] = stripQuery(out.data[k]);
  }
  return out;
}

export function initSentry() {
  if (!ENABLED || loading) return loading;
  loading = import('@sentry/browser')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: 'production',
        tracesSampleRate: 0,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          databaseQueryData: false,
        },
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
