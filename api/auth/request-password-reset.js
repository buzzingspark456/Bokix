import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';

// "Glömt lösenord?" (Auth.jsx) gick tidigare direkt mot
// supabase.auth.resetPasswordForEmail() från klienten, som ALDRIG lämnade
// den här filen — samma väg som signUp/signInWithPassword fortfarande går
// (se main.jsx). Det gick fint för själva flödet, men gjorde det omöjligt
// att begränsa HUR MÅNGA återställningsmejl som kan begäras för ett konto:
// en klient kan aldrig lita på sig själv för det (öppna DevTools, kör om
// anropet hur många gånger som helst). Kundönskemål: max 5/dygn PER
// E-POSTADRESS (inte bara per IP, se identifier-kommentaren i
// _rateLimit.js — annars går gränsen runt genom att bara byta nätverk,
// vilket är precis den verkliga risken: att trakassera EN persons inkorg
// med återställningsmejl, inte att en enskild klient spammar endpointen).
//
// Byter alltså till EN Vercel-function som gränsen faktiskt kan räknas i,
// och som anropar Supabase server-side åt klienten istället — allt annat
// (mejlets utseende/avsändare/redirect) är oförändrat, det är fortfarande
// samma resetPasswordForEmail-anrop, bara flyttat hit.
const SITE_URL = 'https://www.bokix.se';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 5/dygn, per e-postadress — se filkommentaren ovan för varför just
  // e-postadress (identifier) istället för IP.
  const body = await parseJsonBody(req);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Ogiltig e-postadress.' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'password-reset', windowMs: 24 * 60 * 60 * 1000, max: 5, identifier: email })) return;

  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(503).json({ error: 'Supabase är inte konfigurerat.' });
    return;
  }
  // Anon-nyckeln (inte service-role) med avsikt — det här är EXAKT samma
  // anrop klienten själv gjorde innan, bara vidarebefordrat via servern.
  // Ingen anledning att kringgå RLS eller ge det här flödet mer makt än
  // en anonym besökare redan hade.
  const supabase = createClient(supabaseUrl, anonKey);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/`,
      ...(typeof body?.captchaToken === 'string' && body.captchaToken ? { captchaToken: body.captchaToken } : {}),
    });
    // Samma "alltid samma svar" som klienten själv upprätthöll innan
    // (Auth.jsx) — Supabase svarar aldrig med fel bara för att adressen
    // saknar konto (det hade läckt vilka e-postadresser som är
    // registrerade i Bokix), så ett äkta fel här är alltid något annat
    // (captcha/nätverk/Supabases EGEN hastighetsbegränsning) och visas
    // ärligt — men läcker aldrig kontoexistens.
    if (error) {
      console.error('resetPasswordForEmail error:', error.message);
      res.status(error.status && error.status < 500 ? error.status : 502).json({ error: error.message || 'Kunde inte skicka återställningslänken. Försök igen om en stund.' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('request-password-reset unexpected error:', err);
    res.status(500).json({ error: 'Något gick fel. Försök igen om en stund.' });
  }
}
