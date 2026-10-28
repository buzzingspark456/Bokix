// Kvittoläsning med Google Cloud Vision. Appen läser foton och PDF:er bara
// här, så länge månadens kvot räcker (MONTHLY_LIMIT); därefter kan kvittot
// inte läsas (se src/utils/ocrCloud.js och ocrCache.js). Själva anropet till
// Google ligger i _vision.js, delat med gratisverktyget (ocr-free.js).
import { applySecurityHeaders } from './_security.js';
import { checkRateLimit, hitShared } from './_rateLimit.js';
import { requireAuthedUser, requireActiveSubscription, payingAccountFor } from './_auth.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { documentFromBody, readWithVision, MONTHLY_LIMIT, monthQuotaKey, MONTH_WINDOW_MS, ACCOUNT_MONTHLY_LIMIT, UF_MONTHLY_LIMIT, accountQuotaKey } from './_vision.js';
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
