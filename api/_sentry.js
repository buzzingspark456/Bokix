// Fel i serverfunktionerna till Sentry, samma projekt som webbläsaren
// (src/utils/sentry.js). Varje funktion i api/ exporteras genom withSentry:
// ett kastat fel och varje svar med status 500 eller högre skickas, med
// adressen som tagg. @sentry/node laddas först när ett fel ska skickas, så
// vanliga anrop inte blir långsammare, och bara i Vercels produktion.
//
// Samma regler som i webbläsaren: ingen användare, inga cookies, headers,
// frågeparametrar eller kroppar, och e-post, personnummer, org.nr och långa
// nummer tas bort ur texterna (src/utils/sentryScrub.js).
import { BOKIX_SENTRY_DSN, SENTRY_DATA_COLLECTION, scrubEvent, scrubText } from '../src/utils/sentryScrub.js';

let ready = null;

function enabled() {
  return process.env.VERCEL_ENV === 'production' && process.env.SENTRY_DISABLED !== '1';
}

async function sentryClient() {
  if (!ready) {
    ready = import('@sentry/node').then((Sentry) => {
      Sentry.init({
        dsn: process.env.SENTRY_DSN || BOKIX_SENTRY_DSN,
        environment: 'production',
        // Bara felrapporter: ingen mätning och ingen automatisk
        // instrumentering av anrop och databas.
        defaultIntegrations: false,
        tracesSampleRate: 0,
        dataCollection: SENTRY_DATA_COLLECTION,
        beforeSend: scrubEvent,
      });
      return Sentry;
    }).catch(() => null);
  }
  return ready;
}

/** Skickar ett serverfel till Sentry. Kastar aldrig, och väntar högst 2 s. */
export async function captureServerError(error, route, extra = {}) {
  if (!enabled()) return;
  try {
    const Sentry = await sentryClient();
    if (!Sentry) return;
    const err = error instanceof Error ? error : new Error(scrubText(String(error?.message || error || 'Okänt serverfel')));
    Sentry.withScope((scope) => {
      scope.setTag('source', 'server');
      scope.setTag('route', route);
      if (extra.status) scope.setTag('status', String(extra.status));
      if (extra.method) scope.setTag('method', extra.method);
      Sentry.captureException(err);
    });
    await Sentry.flush(2000);
  } catch {
    // Rapporteringen får aldrig själv fälla ett anrop.
  }
}

/** Lägger felrapporteringen runt en Vercel-funktion. */
export function withSentry(handler, route) {
  return async function sentryHandler(req, res) {
    let status = 200;
    let body;
    if (res && typeof res.status === 'function') {
      const originalStatus = res.status.bind(res);
      res.status = (code) => { status = code; return originalStatus(code); };
    }
    if (res && typeof res.json === 'function') {
      const originalJson = res.json.bind(res);
      res.json = (value) => { if (status >= 500) body = value; return originalJson(value); };
    }
    try {
      const result = await handler(req, res);
      if (status >= 500) {
        const detail = typeof body?.error === 'string' ? body.error : '';
        await captureServerError(new Error(scrubText(`${route} svarade ${status}${detail ? `: ${detail}` : ''}`)), route, { status, method: req?.method });
      }
      return result;
    } catch (error) {
      await captureServerError(error, route, { status: 500, method: req?.method });
      if (res && !res.headersSent && typeof res.status === 'function') {
        res.status(500).json({ error: 'Något gick fel på servern. Försök igen om en stund.' });
        return undefined;
      }
      throw error;
    }
  };
}
