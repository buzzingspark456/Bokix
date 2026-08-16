// Sida 37: säkerhetshärdning för de riktiga produktions-serverless-
// funktionerna (Vercel kör de här, INTE server.js — se server.js:s egen
// kommentar om `helmet()`, samma resonemang gäller omvänt här). Motsvarar
// ett litet urval av vad `helmet()` skulle satt, applicerat manuellt eftersom
// varje fil här är en fristående funktion utan delad Express-middleware-kedja.
//
// Ingen rate-limiting här — det kräver en delad datastore mellan anrop
// (Upstash Redis, eller Vercels egen Firewall-produkt), vilket en enskild
// serverless-funktion inte har tillgång till på egen hand. Flaggat som
// medveten uppföljning, inte löst i den här omgången.
export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
