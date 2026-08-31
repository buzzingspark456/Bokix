import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';
import { createSignedToken, verifySignedToken } from '../_signedToken.js';
import { hasResendApiKey, sendWithFallback } from '../_resend.js';
import { buildSignupVerificationHtml } from '../_emailTemplates.js';
import { translateSupabaseAuthError } from '../../src/utils/translateAuthError.js';

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
//
// Kundfeedback (registreringens "Bekräfta e-post"-steg kändes overkligt —
// man kunde skriva VILKEN e-postadress som helst och ändå klicka sig vidare
// genom hela registreringen och till betalning, utan att något någonsin
// faktiskt kontrollerade att adressen var äkta): två nya `action`-grenar
// nedan, send-signup-code/verify-signup-code, klämda in i SAMMA fil av
// exakt samma skäl som FöretagsAPI-uppslaget i company-access.js — Vercels
// 12-funktionsgräns (Hobby-plan) var redan fylld (se den filens kommentar),
// en egen api/auth/verify-email.js hade inte gått att deploya. I grunden
// orelaterat till lösenordsåterställning, men en egen sexsiffrig
// engångskod (signerad, se _signedToken.js — ALDRIG en riktig Supabase-
// session, medvetet: ett äkta supabase.auth.signInWithOtp/verifyOtp hade
// loggat in personen mitt i registreringsguiden, vilket App.jsx:s
// onAuthStateChange då hade tolkat som en RIKTIG inloggning och dragit in
// användaren i själva appen innan företagsuppgifter/lösenord ens fyllts i)
// som mejlas ut och måste skrivas in korrekt innan Auth.jsx släpper vidare
// till nästa steg. Det avslutande kontot skapas fortfarande med ETT enda
// supabase.auth.signUp()-anrop i Auth.jsx, helt oförändrat — den här koden
// är bara en spärr FÖRE det anropet, inte en ny kontoskapande-väg.
const SITE_URL = 'https://www.bokix.se';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_CODE_MAX_AGE_MS = 10 * 60 * 1000;

async function handlePasswordReset(req, body, res) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Ogiltig e-postadress.' });
    return;
  }
  // 5/dygn, per e-postadress — se filkommentaren ovan för varför just
  // e-postadress (identifier) istället för IP.
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
      // Supabase svarar alltid på engelska (se translateAuthError.js) —
      // kundfeedback: "For security purposes, you can only request this
      // after 6 seconds." visades rakt av, i klar kontrast mot resten av
      // det svenska formuläret.
      res.status(error.status && error.status < 500 ? error.status : 502).json({ error: translateSupabaseAuthError(error.message) || 'Kunde inte skicka återställningslänken. Försök igen om en stund.' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('request-password-reset unexpected error:', err);
    res.status(500).json({ error: 'Något gick fel. Försök igen om en stund.' });
  }
}

/** Genererar en sexsiffrig kod, mejlar den, och returnerar en signerad
 * token (kod + e-post inbakat, se _signedToken.js) som klienten skickar
 * tillbaka i verify-signup-code — servern behöver inte spara något alls
 * mellan de två anropen (stateless, samma princip som Stripe Connects
 * OAuth-state). Dubbel hastighetsbegränsning: per IP (en enskild klient
 * ska inte kunna spamma sig fram till gratis e-postutskick) OCH per
 * e-postadress (ingen ska kunna trakassera en FRÄMMANDE inkorg med koder). */
async function handleSendSignupCode(req, body, res) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Ogiltig e-postadress.' });
    return;
  }
  if (!checkRateLimit(req, res, { key: 'signup-code-ip', max: 20 })) return;
  if (!checkRateLimit(req, res, { key: 'signup-code-email', windowMs: 60 * 60 * 1000, max: 5, identifier: email })) return;

  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  if (!hasResendApiKey()) {
    res.status(503).json({ error: 'E-postutskick är inte konfigurerat just nu.' });
    return;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  let token;
  try {
    token = createSignedToken({ email, code });
  } catch (err) {
    console.error('createSignedToken (signup code) misslyckades:', err.message);
    res.status(503).json({ error: 'E-postverifiering är inte konfigurerad just nu.' });
    return;
  }

  try {
    const result = await sendWithFallback({
      to: [email],
      subject: 'Din kod för att bekräfta e-postadressen',
      html: buildSignupVerificationHtml({ code }),
    });
    if (!result.ok) {
      console.error('Kunde inte skicka signup-kod:', result.data);
      res.status(502).json({ error: 'Kunde inte skicka koden just nu. Försök igen om en stund.' });
      return;
    }
    res.status(200).json({ ok: true, token });
  } catch (err) {
    console.error('handleSendSignupCode unexpected error:', err);
    res.status(500).json({ error: 'Något gick fel. Försök igen om en stund.' });
  }
}

/** Kollar den inskrivna koden mot token:en från send-signup-code ovan.
 * Skriver aldrig till Supabase alls — se filkommentaren högst upp för
 * varför (ingen riktig session/inloggning ska skapas här). */
async function handleVerifySignupCode(body, res) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!email || !code || !token) {
    res.status(400).json({ error: 'E-post, kod och token krävs.' });
    return;
  }

  const payload = verifySignedToken(token, SIGNUP_CODE_MAX_AGE_MS);
  if (!payload || payload.email !== email || payload.code !== code) {
    res.status(400).json({ error: 'Fel kod, eller så har den gått ut. Kontrollera koden eller skicka en ny.' });
    return;
  }
  res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = await parseJsonBody(req);

  if (body?.action === 'send-signup-code') {
    await handleSendSignupCode(req, body, res);
    return;
  }
  if (body?.action === 'verify-signup-code') {
    await handleVerifySignupCode(body, res);
    return;
  }
  await handlePasswordReset(req, body, res);
}
