// Kvittoläsning med Google Cloud Vision. Appen läser foton och PDF:er bara
// här, så länge månadens kvot räcker (MONTHLY_LIMIT); därefter kan kvittot
// inte läsas (se src/utils/ocrCloud.js och ocrCache.js). Själva anropet till
// Google ligger i _vision.js, delat med gratisverktyget (ocr-free.js).
import { applySecurityHeaders } from './_security.js';
import { checkRateLimit, hitShared } from './_rateLimit.js';
import { requireAuthedUser, requireActiveSubscription, payingAccountFor } from './_auth.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { documentFromBody, readWithVision, MONTHLY_LIMIT, monthQuotaKey, MONTH_WINDOW_MS, ACCOUNT_MONTHLY_LIMIT, UF_MONTHLY_LIMIT, accountQuotaKey, companyQuotaKey } from './_vision.js';
import { createClient } from '@supabase/supabase-js';
import { planFromId, PLAN_LIMITS } from '../src/utils/plans.js';
import Stripe from 'stripe';
import { OCR_TOPUP, topupsThisMonth } from './stripe/_ocrTopups.js';

// Planen för företaget kvittot gäller: företagets egen prenumeration, annars
// kontots (company_id ''). plan null = ingen plan sparad (äldre konto).
async function planForCompany(accountId, companyId) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { plan: null, customerId: null };
  try {
    const { data } = await createClient(url, key).from('subscriptions').select('company_id, plan, stripe_customer_id').eq('user_id', accountId);
    const rows = data || [];
    const own = companyId ? rows.find(r => r.company_id === companyId) : null;
    const row = own || rows.find(r => (r.company_id || '') === '');
    return { plan: planFromId(row?.plan) || null, customerId: row?.stripe_customer_id || null };
  } catch {
    return { plan: null, customerId: null };
  }
}

// Köpta extra avläsningar den här månaden (api/stripe/_ocrTopups.js).
async function purchasedReads(customerId, companyId) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || secret.startsWith('pk_') || !customerId) return 0;
  try {
    return (await topupsThisMonth(new Stripe(secret), customerId, companyId)) * OCR_TOPUP.reads;
  } catch {
    return 0;
  }
}
import { withSentry } from './_sentry.js';
import { logSystemEvent } from './_systemEvents.js';

async function handler(req, res) {
  applySecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Reservläsningen är inte påslagen.' });
    return;
  }

  const user = await requireAuthedUser(req, res);
  if (!user) return;
  // Varje läsning kostar pengar: gränsen per konto skyddar mot en klient som
  // skickar samma bild om och om igen.
  if (!(await checkRateLimit(req, res, { key: 'ocr-vision', windowMs: 60 * 60 * 1000, max: 60, identifier: user.id }))) return;
  if (!(await requireActiveSubscription(user, res))) return;

  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    res.status(400).json({ error: 'Ogiltig JSON.' });
    return;
  }
  const doc = documentFromBody(body);
  if (!doc) {
    res.status(400).json({ error: 'Filen saknas eller är för stor.' });
    return;
  }
  // Kundens eget tak först, så att ett konto som nått sitt inte äter av den
  // gemensamma kvoten. Inbjudna räknas mot ägaren som betalar (_auth.js).
  // Går räknaren inte att nå avgör den gemensamma kontrollen nedan.
  const account = await payingAccountFor(user);
  const withinAccount = await hitShared(accountQuotaKey(account.id), MONTH_WINDOW_MS, account.uf ? UF_MONTHLY_LIMIT : ACCOUNT_MONTHLY_LIMIT);
  if (withinAccount === false) {
    res.status(429).json({ error: 'Månadens kvot för kvittoläsning är slut för ert konto.', code: 'quota' });
    return;
  }
  // Planens gräns för företaget (Solo 100, Team 300, Handel 1 000 per månad).
  // Kvittot sparas ändå; bara den automatiska avläsningen hoppas över.
  const companyId = typeof body.company_id === 'string' ? body.company_id.slice(0, 100) : '';
  const { plan, customerId } = account.uf ? { plan: null, customerId: null } : await planForCompany(account.id, companyId);
  const planLimit = plan ? PLAN_LIMITS[plan.tierId]?.ocrPerMonth : null;
  if (planLimit) {
    const withinPlan = await hitShared(companyQuotaKey(account.id, companyId), MONTH_WINDOW_MS, planLimit);
    if (withinPlan === false) {
      // Planens del är slut: köpta avläsningar räknas i en egen räknare.
      const extra = await purchasedReads(customerId, companyId);
      const withinExtra = extra > 0 ? await hitShared(`${companyQuotaKey(account.id, companyId)}:extra`, MONTH_WINDOW_MS, extra) : false;
      if (withinExtra === false) {
        res.status(429).json({ error: `Månadens ${(planLimit + extra).toLocaleString('sv-SE')} kvittoavläsningar i ${plan.name} är använda.`, code: 'plan_quota', limit: planLimit, extra, plan: plan.tierId });
        return;
      }
    }
  }
  // Månadens kvot, räknad i databasen så att alla serverinstanser delar den.
  // Nyckeln har månaden i sig, så räknaren börjar om den 1:a. Går räknaren
  // inte att nå används inte Vision alls: hellre den egna läsningen en
  // stund än en räkning från Google.
  const withinQuota = await hitShared(monthQuotaKey(), MONTH_WINDOW_MS, MONTHLY_LIMIT);
  if (withinQuota !== true) {
    if (withinQuota === null) console.warn('[ocr-vision] Kvoträknaren (hit_rate_limit) gick inte att nå, Vision används inte.');
    res.status(429).json({ error: 'Månadens kvot är slut, appens egen läsning används.', code: 'quota' });
    return;
  }

  const read = await readWithVision(doc, apiKey);
  if (!read.ok) {
    // Statussidan räknar bara de här (api/_status.js), aldrig felrapporter
    // från webbläsaren: dem kan vem som helst skicka (granskningen 2026-10-28).
    await logSystemEvent('vision_error', `${doc.isPdf ? 'PDF' : 'bild'}: ${read.error} (${read.status})\nKonto: ${user.id}`);
    res.status(read.status).json({ error: read.error });
    return;
  }
  res.status(200).json({ text: read.text, lines: read.lines });
}

export default withSentry(handler, '/api/ocr-vision');
