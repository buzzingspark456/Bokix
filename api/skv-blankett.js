// Hämtar Skatteverkets ifyllnadsbara Inkomstdeklaration 2 (SKV 2002) för
// räkenskapsårets slutdag: GET /api/skv-blankett?dattom=ÅÅÅÅ-MM-DD.
// Blanketten skiljer sig något mellan perioder, så den hämtas från
// Skatteverket i stället för att ligga som en fast kopia. Deras server kräver
// en sessionskaka via omdirigeringar, vilket webbläsaren inte kan göra mot en
// annan domän, därför går det via oss. Bokix fyller sedan i den i webbläsaren
// (utils/skvBlankett.js). Ingen kunddata skickas hit.
import { applySecurityHeaders } from './_security.js';
import { checkRateLimit } from './_rateLimit.js';
import { withSentry } from './_sentry.js';

const BASE = 'https://www1.skatteverket.se/lcmp2/lc_webapp/secure/PdfServlet.do';

async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const dattom = String(req.query?.dattom || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dattom)) {
    res.status(400).json({ error: 'dattom ska vara ÅÅÅÅ-MM-DD.' });
    return;
  }
  if (!(await checkRateLimit(req, res, { key: 'skv-blankett', max: 30 }))) return;

  let url = `${BASE}?formularID=2002&sprak=sv&dattom=${dattom}&format=sform`;
  const cookies = new Map();
  try {
    for (let i = 0; i < 15; i++) {
      const r = await fetch(url, {
        redirect: 'manual',
        headers: { cookie: [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ') },
      });
      const setCookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
      for (const c of setCookies) {
        const [pair] = c.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        url = new URL(r.headers.get('location'), url).toString();
        if (!url.startsWith('https://www1.skatteverket.se/')) throw new Error('oväntad omdirigering');
        continue;
      }
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.includes('pdf')) throw new Error(`svar ${r.status} ${type}`);
      const body = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', 'application/pdf');
      // Samma blankett för samma period hela dagen; Skatteverket byter sällan.
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      res.status(200).send(body);
      return;
    }
    throw new Error('för många omdirigeringar');
  } catch (err) {
    console.warn('skv-blankett:', err.message);
    res.status(502).json({ error: 'Kunde inte hämta blanketten från Skatteverket just nu. Försök igen om en stund.' });
  }
}

export default withSentry(handler, '/api/skv-blankett');
