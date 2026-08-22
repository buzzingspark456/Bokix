// Bästa möjliga rate limiting UTAN extern delad datastore. `server.js`
// (bara lokal utveckling) har `express-rate-limit`, men de riktiga
// produktions-endpointsen under api/** körs som fristående Vercel
// serverless-funktioner utan delat minne mellan instanser — en RIKTIG
// distribuerad limiter kräver en extern datastore (Upstash Redis, eller
// Vercels egen Firewall-produkt), se _security.js för samma resonemang.
//
// Det här är ett medvetet sämre-än-perfekt mellanläge: räknar per
// (endpoint, IP) i ett minne som bara lever så länge just DEN serverless-
// instansen är varm — inte delat mellan instanser/regioner, och en
// angripare som sprider anropen över flera IP:n eller träffar flera kalla
// instanser kommer runt det. Stoppar ändå den vanliga enkla missbruks-
// vågen (samma klient som spammar samma varma instans) bättre än inget
// skydd alls. Om missbruk blir ett faktiskt problem: byt ut mot en riktig
// delad limiter (Upstash), inte den här.
const buckets = new Map();

/** Returnerar true om anropet får fortsätta. Skriver själv ett 429-svar
 * och returnerar false annars — anropande kod ska bara göra
 * `if (!checkRateLimit(req, res, { key: '...' })) return;` direkt efter
 * applySecurityHeaders(res). */
export function checkRateLimit(req, res, { key, windowMs = 15 * 60 * 1000, max = 20 }) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();

  // Enkel städning så minnet inte växer obegränsat under en lång varm
  // instans — körs bara ibland, inte på varje anrop.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }

  const bucket = buckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count += 1;
  if (bucket.count > max) {
    res.status(429).json({ error: 'För många försök. Vänta en stund och försök igen.' });
    return false;
  }
  return true;
}
