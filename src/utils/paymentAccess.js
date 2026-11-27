// Vad ett konto får göra när betalningen inte går igenom (2026-11-27).
// EN regel som appen (App.jsx), servern (api/_auth.js) och påminnelserna
// (api/_dunning.js) läser, och som databasen speglar i public.has_paid_access
// (supabase-2026-11-27-betalning-lasläge.sql). Ändras något här ska det
// ändras där också.
//
//  full   Allt fungerar. past_due de första 14 dagarna: Stripe försöker dra
//         kortet igen och kunden ser en banner med Försök igen / Byt kort.
//  read   Läsläge: kunden ser och laddar ner allt, men kan inte bokföra nytt.
//         Från dag 14 till dag 30 efter första misslyckade dragningen.
//  locked Betalsidan. Bokföringen finns kvar (läsrätten i databasen tas
//         aldrig bort) och går att ladda ner och återaktivera.
//
// Ren data utan beroenden, med .js-ändelse: importeras både av Vite och av
// rå Node (api/**).

export const READ_ONLY_AFTER_DAYS = 14;
export const LOCK_AFTER_DAYS = 30;
const DAY_MS = 86400000;

const time = (v) => {
  if (!v) return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/**
 * @param {{ status?: string, payment_failed_at?: string|null }} sub  rad ur public.subscriptions
 * @param {number} [now]
 * @returns {{ level: 'full'|'read'|'locked', failing: boolean, failedAt: number|null, readOnlyAt: number|null, lockAt: number|null }}
 */
export function subscriptionAccess(sub, now = Date.now()) {
  const status = sub?.status || null;
  const failedAt = time(sub?.payment_failed_at);
  const readOnlyAt = failedAt ? failedAt + READ_ONLY_AFTER_DAYS * DAY_MS : null;
  const lockAt = failedAt ? failedAt + LOCK_AFTER_DAYS * DAY_MS : null;
  const out = (level, failing) => ({ level, failing, failedAt, readOnlyAt, lockAt });

  if (status === 'trialing' || status === 'active') return out('full', false);
  if (status === 'past_due') {
    // Utan tidpunkt (rader från före 2026-11-27) gäller det gamla: full åtkomst.
    if (!failedAt || now < readOnlyAt) return out('full', true);
    return out(now < lockAt ? 'read' : 'locked', true);
  }
  if (status === 'unpaid') {
    if (!failedAt) return out('read', true);
    return out(now < lockAt ? 'read' : 'locked', true);
  }
  if (status === 'canceled' && failedAt) {
    // Avslutad efter misslyckade dragningar (Stripe gav upp): läsläge till dag 30.
    return out(now < lockAt ? 'read' : 'locked', true);
  }
  return out('locked', false);
}

/** Bästa nivån av flera rader (ett konto kan ha flera företag med egna abonnemang). */
export function bestAccess(subs, now = Date.now()) {
  const rank = { full: 2, read: 1, locked: 0 };
  let best = subscriptionAccess(null, now);
  for (const s of subs || []) {
    const a = subscriptionAccess(s, now);
    if (rank[a.level] > rank[best.level] || (rank[a.level] === rank[best.level] && best.failing && !a.failing)) best = a;
  }
  return best;
}

/** Dagar sedan första misslyckade dragningen (0 samma dag). */
export function daysSinceFailure(sub, now = Date.now()) {
  const failedAt = time(sub?.payment_failed_at);
  return failedAt ? Math.floor((now - failedAt) / DAY_MS) : null;
}
