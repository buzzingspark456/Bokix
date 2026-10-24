// Det som webbläsaren (src/utils/sentry.js) och servern (api/_sentry.js)
// delar: Bokix Sentry-projekt och rensningen av personuppgifter. Ren
// JavaScript utan import.meta, så att den går att läsa på servern också.

// DSN är inte hemlig (den hamnar alltid i webbläsarkoden). Projektet ligger i
// Sentrys EU-region (ingest.de).
export const BOKIX_SENTRY_DSN = 'https://c58d6a251e48a33b7940c59e92dbef75@o4508412011806720.ingest.de.sentry.io/4508412025831504';

// Vad Sentry själv får samla in: inget om användaren, inga cookies, headers,
// frågeparametrar, kroppar eller databasdata.
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
};

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

export function stripQuery(url) {
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

export function scrubBreadcrumb(crumb) {
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
