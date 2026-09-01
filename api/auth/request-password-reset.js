import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../_security.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { checkRateLimit } from '../_rateLimit.js';
import { requireAuthedUser } from '../_auth.js';
import { createSignedToken, verifySignedToken, verifyReauthGrant } from '../_signedToken.js';
import { hasResendApiKey, sendWithFallback } from '../_resend.js';
import { buildSignupVerificationHtml, buildReauthCodeHtml } from '../_emailTemplates.js';
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
// Reauthentication (Settings.jsx: byt lösenord/spara företagsuppgifter,
// App.jsx: Stripe-anslutning) — se send-reauth-code/verify-reauth-code
// längst ned i den här filen. Koden själv gäller 10 min här (samma som
// signup-koden, gott om tid att hämta mejlet) — den KORTARE livslängden
// på själva reauthToken:en (5 min, kollas av verifyReauthGrant i
// _signedToken.js) är det som faktiskt skyddar de känsliga skriv-
// endpointsen, se den funktionens kommentar.
const REAUTH_CODE_MAX_AGE_MS = 10 * 60 * 1000;

async function handlePasswordReset(req, body, res) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Ogiltig e-postadress.' });
    return;
  }
  // 5/dygn, per e-postadress — se filkommentaren ovan för varför just
  // e-postadress (identifier) istället för IP.
  if (!checkRateLimit(req, res, { key: 'password-reset', windowMs: 24 * 60 * 60 * 1000, max: 5, identifier: email })) return;

  // OBS: ingen BotID-koll här längre (samma rättning, av samma anledning,
  // som api/company-access.js redan fick — se den filens kommentar). Den
  // här routen är MEDVETET INTE listad i main.jsx:s initBotId({ protect })
  // (se kommentaren där för varför — klientens BotID-inpackning failar
  // stängd om utmaningsskriptet inte laddas, fel risk att introducera i
  // just kontoåterställning/registrering). Utan en client-registrering
  // skickas x-is-human-headern aldrig, och Vercels riktiga bot-tjänst kan
  // då landa i isBot:true för vanliga användare — precis den bugg som
  // gav "Åtkomst nekad" på registreringens "Personlig info"-steg i
  // produktion (send-signup-code-grenen nedan hade samma kod, se dess
  // egen kommentar). Rate-limiten ovan är det faktiska skyddet.
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

  // OBS: ingen BotID-koll här — se kommentaren vid samma kollen i
  // handlePasswordReset ovan, den gäller ordagrant här också (samma fil,
  // samma saknade client-registrering). Det HÄR var grenen som faktiskt
  // orsakade "Åtkomst nekad" på registreringens "Personlig info"-steg i
  // produktion (Auth.jsx handleNextStep → sendCode() → send-signup-code,
  // kundrapporterat 2026-09-01) — riktiga användare klassades som bot bara
  // för att x-is-human aldrig skickades. Rate-limiten ovan (20/IP,
  // 5/e-post/timme) är det faktiska skyddet mot missbruk.
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

/** Skickar en engångskod till DEN INLOGGADE ANVÄNDARENS EGEN, av Supabase
 * verifierade e-post (user.email från requireAuthedUser) — ALDRIG till en
 * client-supplied adress i body:n, annars kunde vem som helst med en
 * kapad session skicka koden till sin egen inkorg istället. Samma
 * dubbla hastighetsbegränsning (IP + här per user.id istället för e-post,
 * eftersom anroparen redan är bevisat inloggad) som send-signup-code. */
async function handleSendReauthCode(req, res) {
  const user = await requireAuthedUser(req, res);
  if (!user) return;
  if (!checkRateLimit(req, res, { key: 'reauth-code-ip', max: 20 })) return;
  if (!checkRateLimit(req, res, { key: 'reauth-code-user', windowMs: 60 * 60 * 1000, max: 10, identifier: user.id })) return;

  if (!hasResendApiKey()) {
    res.status(503).json({ error: 'E-postutskick är inte konfigurerat just nu.' });
    return;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  let token;
  try {
    token = createSignedToken({ uid: user.id, code, purpose: 'reauth' });
  } catch (err) {
    console.error('createSignedToken (reauth code) misslyckades:', err.message);
    res.status(503).json({ error: 'Reauthentication är inte konfigurerad just nu.' });
    return;
  }

  try {
    const result = await sendWithFallback({
      to: [user.email],
      subject: 'Din kod för att bekräfta ändringen',
      html: buildReauthCodeHtml({ code }),
    });
    if (!result.ok) {
      console.error('Kunde inte skicka reauth-kod:', result.data);
      res.status(502).json({ error: 'Kunde inte skicka koden just nu. Försök igen om en stund.' });
      return;
    }
    res.status(200).json({ ok: true, token });
  } catch (err) {
    console.error('handleSendReauthCode unexpected error:', err);
    res.status(500).json({ error: 'Något gick fel. Försök igen om en stund.' });
  }
}

/** Kollar den inskrivna koden mot token:en från send-reauth-code, precis
 * som handleVerifySignupCode — men lämnar (om koden stämmer) ut ett NYTT,
 * kortlivat `reauthToken` (se verifyReauthGrant i _signedToken.js) istället
 * för att bara svara ok:true. De faktiska känsliga skriv-endpointsen
 * (change-password nedan, api/company-access.js, api/stripe/connect.js)
 * kräver DEN här token:en, inte koden själv — de har ingen anledning att
 * känna till/verifiera en sexsiffrig kod, bara att en nyligen genomförd
 * reauthentication för RÄTT uid finns. */
async function handleVerifyReauthCode(req, body, res) {
  const user = await requireAuthedUser(req, res);
  if (!user) return;

  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!code || !token) {
    res.status(400).json({ error: 'Kod och token krävs.' });
    return;
  }

  const payload = verifySignedToken(token, REAUTH_CODE_MAX_AGE_MS);
  if (!payload || payload.purpose !== 'reauth' || payload.uid !== user.id || payload.code !== code) {
    res.status(400).json({ error: 'Fel kod, eller så har den gått ut. Kontrollera koden eller skicka en ny.' });
    return;
  }

  const reauthToken = createSignedToken({ uid: user.id, purpose: 'reauth-grant' });
  res.status(200).json({ ok: true, reauthToken });
}

/** Byter lösenord server-side, via service-role (auth.admin.updateUserById)
 * istället för klientens direkta supabase.auth.updateUser — kräver ett
 * färskt reauthToken (se verifyReauthGrant), så en kapad browser-session
 * ensam inte längre räcker för att byta lösenord (Settings.jsx:s egen
 * "nuvarande lösenord"-koll är fortfarande kvar OCKSÅ, oförändrad, som ett
 * första steg — det här är ett andra, oberoende bevis). */
async function handleChangePassword(req, body, res) {
  const user = await requireAuthedUser(req, res);
  if (!user) return;
  if (!checkRateLimit(req, res, { key: 'change-password', windowMs: 60 * 60 * 1000, max: 10, identifier: user.id })) return;

  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  const reauthToken = typeof body?.reauthToken === 'string' ? body.reauthToken : '';
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Nytt lösenord måste vara minst 8 tecken.' });
    return;
  }
  if (!verifyReauthGrant(reauthToken, user.id)) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(503).json({ error: 'Supabase är inte konfigurerat.' });
    return;
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
    user_metadata: { ...(user.user_metadata || {}), password_changed_at: new Date().toISOString() },
  });
  if (error) {
    console.error('handleChangePassword updateUserById error:', error.message);
    res.status(500).json({ error: 'Kunde inte byta lösenord. Försök igen om en stund.' });
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
  if (body?.action === 'send-reauth-code') {
    await handleSendReauthCode(req, res);
    return;
  }
  if (body?.action === 'verify-reauth-code') {
    await handleVerifyReauthCode(req, body, res);
    return;
  }
  if (body?.action === 'change-password') {
    await handleChangePassword(req, body, res);
    return;
  }
  await handlePasswordReset(req, body, res);
}
