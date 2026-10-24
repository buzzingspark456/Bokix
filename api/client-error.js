// Felrapporter från webbläsaren: src/utils/errorReporting.js skickar hit när
// appen kraschar (ErrorBoundary) eller ett ohanterat fel inträffar. Loggas
// som client_error i system_events, och larmmejlet (_systemEvents.js) går
// högst en gång i timmen. Ingen inloggning krävs eftersom felet kan
// inträffa före inloggningen, därför strikt rate limit och hård trunkering.
import { applySecurityHeaders } from './_security.js';
import { checkRateLimit } from './_rateLimit.js';
import { parseJsonBody } from './stripe/_parseBody.js';
import { logSystemEvent } from './_systemEvents.js';
import { withSentry } from './_sentry.js';

// Brus som inte är våra fel: webbläsartillägg, avbrutna nätverksanrop,
// korsdomänsskript utan detaljer och ResizeObserver-varningen.
const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /(chrome|moz|safari(-web)?)-extension:\/\//i,
  // Safari döljer tilläggens källkod bakom webkit-masked-url (t.ex.
  // "Cannot destructure property 'tabId'" i setupExtension på iPhone).
  /webkit-masked-url:\/\//i,
  /Failed to fetch|NetworkError|Load failed|The network connection was lost/i,
  /AbortError/i,
];

const clip = (value, max) => String(value ?? '').replace(/\s+\n/g, '\n').slice(0, max);

async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await checkRateLimit(req, res, { key: 'client-error', max: 10 }))) return;

  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    res.status(400).json({ error: 'Ogiltig JSON.' });
    return;
  }

  const message = clip(body?.message, 300).trim();
  if (!message) {
    res.status(400).json({ error: 'message krävs.' });
    return;
  }
  const stack = clip(body?.stack, 2000);
  if (NOISE.some(re => re.test(message) || re.test(stack))) {
    res.status(204).end();
    return;
  }

  // Bara sökvägen, aldrig query-strängen eller hash (kan innehålla tokens).
  const path = clip(body?.path, 200).split(/[?#]/)[0];

  // Kvittoläsningen (reportOcrError i src/utils/errorReporting.js): egen
  // sort i Systemstatus, inget larmmejl. Konto-id:t kommer från webbläsaren
  // och är bara en ledtråd, inget som går att lita på.
  if (body?.source === 'ocr') {
    const fileType = body?.fileType === 'pdf' ? 'PDF' : 'bild';
    const cloud = clip(body?.cloud, 80).replace(/\s+/g, ' ').trim();
    const userId = /^[0-9a-f-]{36}$/i.test(String(body?.userId || '')) ? body.userId : 'okänt';
    await logSystemEvent('ocr_error', `${fileType}: ${message}\nVision: ${cloud || '-'}\nKonto: ${userId}\n${clip(req.headers['user-agent'], 160)}`);
    res.status(204).end();
    return;
  }
  const source = body?.source === 'boundary' ? 'krasch (vit sida)' : 'ohanterat fel';
  const ua = clip(req.headers['user-agent'], 160);
  const stackTop = stack.split('\n').slice(0, 6).join('\n');

  await logSystemEvent('client_error', `${source} på ${path || '?'}: ${message}\n${stackTop}\n${ua}`);
  res.status(204).end();
}

export default withSentry(handler, '/api/client-error');
