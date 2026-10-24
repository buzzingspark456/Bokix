// Statussidan (bokix.se/status): vilka delar som visas, hur var och en
// kollas (api/cron/status-check.js, var 5:e minut) och hur resultaten blir
// sidans färger och staplar (api/status.js). Inga kunduppgifter någonstans:
// bara om något fungerar.

export const COMPONENTS = [
  { id: 'app', name: 'Appen och webbplatsen' },
  { id: 'login', name: 'Inloggning' },
  { id: 'data', name: 'Bokföring och sparande' },
  { id: 'ocr', name: 'Kvittoläsning' },
  { id: 'email', name: 'E-post (fakturor och påminnelser)' },
  { id: 'payments', name: 'Kortbetalningar' },
  { id: 'errors', name: 'Felspårning' },
];
export const COMPONENT_IDS = COMPONENTS.map(c => c.id);

const RANK = { ok: 0, maintenance: 1, degraded: 2, down: 3 };
export const worst = (list) => list.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'ok');

const SLOW_MS = 4000;
const TIMEOUT_MS = 8000;

async function timed(fn) {
  const started = Date.now();
  let timer;
  try {
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS); });
    const result = await Promise.race([fn(), timeout]);
    return { ok: true, result, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, error: String(err?.message || err), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

// Svar från en HTTP-koll → status. Långsamt men fungerande = störning.
export function httpStatus(r) {
  if (!r.ok) return { status: 'down', note: r.error === 'timeout' ? 'svarade inte inom 8 s' : 'svarade inte' };
  if (!r.result?.ok) return { status: 'down', note: `svarade ${r.result?.status}` };
  if (r.ms > SLOW_MS) return { status: 'degraded', note: `långsam (${r.ms} ms)` };
  return { status: 'ok', note: null };
}

// Riktiga fel den senaste timmen (system_events) → störning. Används där en
// egen provkoll hade kostat något (Vision) eller inte säger allt (e-post).
export function eventStatus(count, { degradedAt = 3, downAt = 10 } = {}) {
  if (count >= downAt) return 'down';
  if (count >= degradedAt) return 'degraded';
  return 'ok';
}

// Stripes egen statussida (status.stripe.com) → status.
export function stripeIndicator(indicator) {
  if (!indicator || indicator === 'none') return 'ok';
  if (indicator === 'minor') return 'degraded';
  return 'down';
}

/**
 * Kör alla kontroller. `deps` gör det testbart: { fetch, env, countEvents(kindPattern, minutes) }.
 * Returnerar [{ component, status, ms, note }].
 */
export async function runChecks({ fetch: doFetch = fetch, env = process.env, countEvents }) {
  const site = env.STATUS_SITE_URL || 'https://www.bokix.se';
  const supa = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = env.VITE_SUPABASE_ANON_KEY;
  const get = (url, headers = {}) => () => doFetch(url, { headers, cache: 'no-store' });

  const [app, login, data, stripe, resend, ocrErrors, emailErrors, sentry] = await Promise.all([
    timed(get(`${site}/robots.txt`)),
    supa && anon ? timed(get(`${supa}/auth/v1/health`, { apikey: anon })) : Promise.resolve({ ok: false, error: 'inte inställt' }),
    supa && anon ? timed(get(`${supa}/rest/v1/contact_messages?select=id&limit=1`, { apikey: anon, Authorization: `Bearer ${anon}` })) : Promise.resolve({ ok: false, error: 'inte inställt' }),
    timed(async () => (await doFetch('https://status.stripe.com/api/v2/status.json', { cache: 'no-store' })).json()),
    // Domänlistan kräver en nyckel med full åtkomst (RESEND_ADMIN_API_KEY);
    // den vanliga nyckeln får bara skicka och svarar 401 här.
    (env.RESEND_ADMIN_API_KEY || env.RESEND_API_KEY) ? timed(get('https://api.resend.com/domains', { Authorization: `Bearer ${env.RESEND_ADMIN_API_KEY || env.RESEND_API_KEY}` })) : Promise.resolve(null),
    countEvents ? countEvents('ocr_error', 60, ['Vision svarade 5', 'Vision tog för lång tid', 'Vision-anropet misslyckades']) : 0,
    countEvents ? countEvents('email_failed', 60) : 0,
    timed(async () => (await doFetch('https://status.sentry.io/api/v2/status.json', { cache: 'no-store' })).json()),
  ]);

  const out = [];
  const push = (component, s, ms) => out.push({ component, status: s.status, ms: ms ?? null, note: s.note || null });

  push('app', httpStatus(app), app.ms);
  push('login', httpStatus(login), login.ms);
  push('data', httpStatus(data), data.ms);

  // Kvittoläsning: utan nyckel fungerar den inte alls; annars efter riktiga fel.
  if (!env.GOOGLE_VISION_API_KEY) push('ocr', { status: 'down', note: 'inte inställd' });
  else { const s = eventStatus(ocrErrors); push('ocr', { status: s, note: s === 'ok' ? null : `${ocrErrors} misslyckade läsningar senaste timmen` }); }

  // E-post: tjänsten svarar och inga utskick har misslyckats i mängd.
  const resendState = resend === null ? { status: 'down', note: 'inte inställd' } : httpStatus(resend);
  const mailEvents = eventStatus(emailErrors);
  push('email', { status: worst([resendState.status, mailEvents]), note: resendState.note || (mailEvents === 'ok' ? null : `${emailErrors} misslyckade utskick senaste timmen`) }, resend?.ms);

  // Kortbetalningar: Stripes egen status. Svarar inte statussidan räknas det
  // inte som ett fel hos Stripe (det är deras statussida, inte betalningarna).
  const ind = stripe.ok ? stripe.result?.status?.indicator : 'none';
  push('payments', { status: stripeIndicator(ind), note: stripe.ok && ind !== 'none' ? stripe.result?.status?.description || null : null }, stripe.ms);

  // Felspårning: Sentrys egen status (samma statussidetjänst som Stripe), som
  // tar emot appens och serverns felrapporter. Påverkar inte kunderna direkt,
  // men visar att fel som uppstår faktiskt når oss.
  const sentryInd = sentry.ok ? sentry.result?.status?.indicator : 'none';
  push('errors', { status: stripeIndicator(sentryInd), note: sentry.ok && sentryInd !== 'none' ? sentry.result?.status?.description || null : null }, sentry.ms);

  return out;
}

/** En dags summa → dagens färg. Ett enstaka nedslag (en kontroll) räknas som störning, inte avbrott. */
export function dayStatus(row) {
  if (!row || row.ok + row.degraded + row.down === 0) return 'nodata';
  if (row.down >= 2) return 'down';
  if (row.down > 0 || row.degraded > 0) return 'degraded';
  return 'ok';
}

/** Andel av kontrollerna då delen fungerade (störning räknas som uppe). */
export function uptime(rows) {
  const total = rows.reduce((s, r) => s + r.ok + r.degraded + r.down, 0);
  if (!total) return null;
  const up = rows.reduce((s, r) => s + r.ok + r.degraded, 0);
  return Math.floor((up / total) * 10000) / 100;
}

const isoDay = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

/**
 * Sidans innehåll av senaste kontrollerna, dagssummorna och meddelandena.
 * `latest`: { component: { status, checked_at } }, `daily`: rader ur status_daily,
 * `incidents`: rader ur status_incidents.
 */
export function buildStatus({ latest = {}, daily = [], incidents = [], now = new Date(), days = 90 }) {
  const dayList = Array.from({ length: days }, (_, i) => isoDay(new Date(now.getTime() - (days - 1 - i) * 86400000)));
  const active = incidents.filter(i => i.status !== 'resolved' && new Date(i.starts_at) <= now);
  const upcoming = incidents.filter(i => i.status === 'maintenance' && new Date(i.starts_at) > now);
  const staleAfter = now.getTime() - 20 * 60000;

  const components = COMPONENTS.map(c => {
    const last = latest[c.id];
    const measured = last && new Date(last.checked_at).getTime() >= staleAfter ? last.status : null;
    const manual = active.filter(i => (i.components || []).includes(c.id)).map(i => i.impact);
    const status = worst([measured || 'ok', ...manual]);
    const rows = daily.filter(r => r.component === c.id);
    const byDay = Object.fromEntries(rows.map(r => [String(r.day).slice(0, 10), r]));
    return {
      id: c.id,
      name: c.name,
      status,
      checkedAt: last?.checked_at || null,
      uptime: uptime(rows),
      days: dayList.map(d => ({ date: d, status: dayStatus(byDay[d]) })),
    };
  });

  const recentCutoff = now.getTime() - 30 * 86400000;
  const shape = (i) => ({
    id: i.id, title: i.title, body: i.body || '', status: i.status, impact: i.impact,
    components: (i.components || []).map(id => COMPONENTS.find(c => c.id === id)?.name).filter(Boolean),
    startsAt: i.starts_at, resolvedAt: i.resolved_at, updatedAt: i.updated_at,
  });

  return {
    overall: worst(components.map(c => c.status)),
    checkedAt: Object.values(latest).map(l => l.checked_at).sort().at(-1) || null,
    components,
    active: active.map(shape),
    upcoming: upcoming.map(shape),
    past: incidents
      .filter(i => i.status === 'resolved' && new Date(i.resolved_at || i.starts_at).getTime() >= recentCutoff)
      .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))
      .map(shape),
  };
}
