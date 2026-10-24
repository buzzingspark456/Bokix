import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  LogIn, UserPlus, Mail, Lock,
  ArrowRight, ArrowLeft, ShieldCheck, User,
  RefreshCw, GraduationCap,
} from './icons';
import { supabase } from '../supabaseClient';
import { sendSignupCode, verifySignupCode, confirmSignupEmail } from '../utils/signupVerification';
import { translateSupabaseAuthError } from '../utils/translateAuthError';
import { passkeyLoginOffered, rememberPasskeyOnDevice, isPasskeyCancel, setAppLock } from '../utils/sessionPolicy';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark } from './marketing/MarketingLayout';
import { createStripeSubscriptionCheckout } from '../stripeApi';
import { planFromId } from '../utils/plans';
import { UF_FREE_MONTHS } from '../utils/ufMode';
import Turnstile from './Turnstile';
import Recaptcha from './Recaptcha';
import { TERMS_VERSION } from '../utils/legalVersion';
import { t, useForcedLanguage } from '../i18n';

// ── Litet Stripe-märke — se motsvarande kommentar i PaymentRequiredGate.jsx
// (samma lokala-kopia-mönster). ──
function StripeBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: 4, background: '#635BFF', color: 'white', fontSize: '10px', fontWeight: 800, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
        {t('ui.s')}
      </span>
      <span style={{ fontWeight: 700, color: '#425466' }}>{t('ui.stripe')}</span>
    </span>
  );
}

const inputStyle = {
  width: '100%', padding: '16px 18px', border: '1px solid var(--border)', borderRadius: '11px',
  fontSize: '17px', color: 'var(--text-main)', background: 'var(--bg-muted)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', transition: 'all 0.2s',
};

const labelStyle = {
  display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)',
  marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.04em',
};

// Nycklar, inte färdiga texter: översätts när sidan ritas, så att det
// tvingade svenska språket (useForcedLanguage nedan) gäller även här.
// Registreringen är bara kontot (2026-10-24): e-post, kod, lösenord.
// Företaget, räkenskapsåret, momsen och F-skatten frågas en gång, i
// onboardingen inne i appen (OnboardingFlow.jsx). Bara UF har kvar ett eget
// företagssteg, eftersom UF-kontot ska veta att det är UF redan när det skapas.
const STEP_LABELS = { personal: 'ui.personlig_info', verify: 'ui.bekrafta_e_post', company: 'ui.foretag', password: 'ui.losenord' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Säkerhetsgranskningen: bara en längdgräns (8 tecken) fanns tidigare,
// ingen som helst indikation till användaren om hur starkt lösenordet
// faktiskt är. Modern vägledning (NIST 800-63B) säger längd > påtvingade
// teckenklasser — så det här BLOCKERAR inget extra utöver 8-tecknersgränsen,
// bara visar en mätare som uppmuntrar längre/mer varierade lösenord.
// Det egentliga läckage-skyddet (kolla mot kända läckta lösenord via
// HaveIBeenPwned) är istället en inställning i Supabase Dashboard →
// Authentication → Policies → "Leaked password protection" — går inte att
// koda fram här, måste slås på där (verifierar server-side vid signup,
// mer robust än något klienten skulle kunna göra ändå).
function passwordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: t('ui.svagt_lagg_till_fler_tecken'), color: '#ef4444', pct: 25 };
  if (score === 2) return { label: t('ui.okej'), color: '#f59e0b', pct: 50 };
  if (score <= 3) return { label: t('ui.bra'), color: '#84cc16', pct: 75 };
  return { label: t('ui.starkt'), color: '#0b6329', pct: 100 };
}

// Sessionstoken satt av InviteRedeem.jsx när någon öppnar en inbjudningslänk
// — samma nyckel som App.jsx:s redeemPendingInvite läser vid nästa lyckade
// inloggning/registrering. sessionStorage (inte localStorage): tokenet ska
// inte överleva längre än den här enskilda flikens session, och rensas
// ändå bort explicit av redeemPendingInvite oavsett utfall.
const PENDING_INVITE_KEY = 'bokix_pending_invite_token';

// Ber webbläsaren spara inloggningen i Google-/Microsoft-kontots
// lösenordshanterare (Chrome, Edge). Appen loggar in utan sidbyte och
// registreringen tar e-post och lösenord i olika steg, så webbläsarens egen
// "Spara lösenord?"-ruta kom inte alltid. Safari saknar API:t men läser
// autocomplete-attributen på fälten. Ett fel här får aldrig stoppa inloggningen.
function offerToSavePassword(email, password, name) {
  try {
    if (!email || !password || typeof window === 'undefined' || !window.PasswordCredential || !navigator.credentials?.store) return;
    navigator.credentials.store(new window.PasswordCredential({ id: email, password, name: name || email })).catch(() => {});
  } catch { /* ignoreras */ }
}

// Kundönskemål ("skapa konto gratis ska gå till registrering, inte
// inloggning") — vilken flik som visas när formuläret öppnas styrs av
// VILKEN knapp som togs hit (Prova gratis/Kom igång/Skapa konto → 'signup',
// Logga in → 'login'), inte alltid samma hårdkodade förval.
/** `plan` är det abonnemang besökaren valde på prissidan
 * ("employer_yearly"). Förvalet är den nivå som gällde innan valen
 * fanns, så en registrering som startar någon annanstans än prissidan
 * fungerar oförändrat. Servern validerar värdet igen — det här är ett
 * val, inte ett löfte om vad som debiteras. */
export default function Auth({ onBackToLanding, initialMode = 'login', plan = 'employer_monthly', initialUf = false }) {
  // Inloggning och registrering är alltid på svenska, som resten av
  // webbplatsen. Ett sparat språkval (engelska) gäller igen inne i appen.
  useForcedLanguage('sv');
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  // Priset i rutan ovanför "Skapa konto"-knappen ska vara det besökaren
  // just valde på prissidan, inte 179 kr för alla (som det stod innan
  // nivåerna fanns). Samma uppslagning som checkouten själv gör på
  // servern, så texten och beloppet aldrig kan säga olika saker.
  const selectedPlan = planFromId(plan);
  // En inbjuden person ska aldrig behöva ange ett eget företagsnamn/orgnr
  // eller betala för en egen prenumeration — de ska bara skapa ett lösenord
  // och komma in. Läses en gång vid mount (inte varje render) eftersom
  // sessionStorage inte kan ändras av något ANNAT än InviteRedeem.jsx medan
  // det här formuläret är öppet.
  const [hasPendingInvite] = useState(() => typeof window !== 'undefined' && Boolean(sessionStorage.getItem(PENDING_INVITE_KEY)));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [regStep, setRegStep] = useState(0); // index i regSteps nedan
  // Kontot är skapat och vi väntar på Stripe Checkout-URL:en innan sidan
  // navigerar bort — egen flagga (inte bara `loading`) så steg 2 kan visa en
  // tydlig "skickar dig vidare"-vy istället för företagsformuläret igen.
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // "Glömt lösenord?" — egen liten vy ovanpå inloggningsformuläret, inte ett
  // eget steg i regSteps (det är bara för nytt-konto-flödet). Visar
  // ALLTID samma bekräftelse oavsett om e-postadressen faktiskt finns eller
  // ej (se handleForgotPassword) — att svara olika hade läckt vilka
  // e-postadresser som är registrerade i Bokix.
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Bot-/captcha-spärr (Turnstile.jsx, onDemand): ingen ruta i formulären,
  // kollen körs när man trycker på knappen och rutan visas bara om
  // Cloudflare vill att man kryssar. En token gäller ETT anrop, så
  // `captchaRound` byter `key` på widgetarna efter varje försök.
  const loginCaptchaRef = useRef(null);
  const regCaptchaRef = useRef(null);
  const forgotCaptchaRef = useRef(null);
  const [captchaRound, setCaptchaRound] = useState(0);
  const newCaptchaRound = () => setCaptchaRound(n => n + 1);
  const runCaptcha = async (ref) => {
    try {
      return await ref.current?.execute();
    } catch (e) {
      if (e?.message === 'blocked') throw new Error(t('ui.robotkontroll_blockerad'));
      // Orsaken i parentes ("timeout" = Cloudflare gav aldrig någon token),
      // så att ett fel går att felsöka utifrån en skärmbild.
      throw new Error(`${translateSupabaseAuthError('captcha verification process failed')} (cloudflare: ${e?.message || 'okänt'})`);
    }
  };
  const signupRecaptchaRef = useRef(null);

  // Step 0 – Personal info
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState(() => (typeof window !== 'undefined' && sessionStorage.getItem(PENDING_INVITE_KEY) && sessionStorage.getItem('bokix_pending_invite_email')) || '');
  const [invitedEmailLocked] = useState(() => Boolean(typeof window !== 'undefined' && sessionStorage.getItem(PENDING_INVITE_KEY) && sessionStorage.getItem('bokix_pending_invite_email')));
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  // Användarvillkoren och personuppgiftsbiträdesavtalet måste godkännas
  // uttryckligen. Tidpunkt och version sparas på kontot (user_metadata), så
  // att det går att visa vad kunden godkände och när.
  const [regAcceptTerms, setRegAcceptTerms] = useState(false);

  // Step 1 – Bekräfta e-post. Kundfeedback: föregående version lät VILKEN
  // e-postadress som helst passera det här steget obekräftad, ända till
  // betalning — se filkommentaren i api/auth/request-password-reset.js
  // för varför verifieringen görs där (send-signup-code/verify-signup-code)
  // istället för en riktig supabase.auth.signInWithOtp/verifyOtp. `otpToken`
  // är den signerade token:en från send-signup-code — måste skickas med
  // OFÖRÄNDRAD till verify-signup-code, håller koden+e-posten den gällde
  // för inbakade så servern inte behöver spara något mellan de två anropen.
  // `emailVerified` är den faktiska spärren: handleNextStep vägrar lämna
  // steg 1 förrän den är sann, oavsett vad som står i kodfältet.
  const [regVerifyCode, setRegVerifyCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  // Bara ett litet UI-tillstånd för knapparna (spinner/"Skickar…" text) —
  // det FAKTISKA felmeddelandet visas i formulärets vanliga errorMsg-banner
  // (samma ställe som alla andra fel i det här formuläret), inte här.
  const [otpStatus, setOtpStatus] = useState('idle'); // idle|sending|verifying
  // Egen nedräkning (inte bara ett `disabled`-flagg) så "Skicka koden igen"
  // visar HUR LÄNGE kvar istället för att bara vara gråad utan förklaring —
  // ren UX-artighet, den riktiga spärren mot missbruk är server-sidans
  // hastighetsbegränsning (se _rateLimit.js-anropen i send-signup-code).
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  // Nollställer hela kod-verifieringen — anropas både när man byter
  // e-postadress på steg 0 (en redan verifierad kod för den GAMLA adressen
  // ska aldrig kunna godkänna en NY) och när man växlar bort från
  // registreringsflödet helt (switchMode nedan).
  const resetEmailVerification = () => {
    setRegVerifyCode('');
    setOtpToken('');
    setEmailVerified(false);
    setOtpStatus('idle');
    setResendCooldown(0);
  };

  /** Skickar (eller skickar OM) koden. Returnerar ett läsbart felmeddelande
   * vid fel, annars null — anropande kod (handleNextStep/resend-knappen)
   * bestämmer själv vad som ska hända med det (visa i errorMsg, stanna kvar
   * på steget). */
  const sendCode = async () => {
    setOtpStatus('sending');
    try {
      let recaptchaToken = null;
      try {
        recaptchaToken = await signupRecaptchaRef.current?.execute();
      } finally {
        signupRecaptchaRef.current?.reset();
      }
      const token = await sendSignupCode(regEmail, recaptchaToken);
      setOtpToken(token);
      setRegVerifyCode('');
      setResendCooldown(30);
      return null;
    } catch (err) {
      return err?.message || t('ui.kunde_inte_skicka_koden_just_nu_forsok_igen_om_e');
    } finally {
      setOtpStatus('idle');
    }
  };

  // ── UF-registrering (utils/ufMode.js) ──
  // Ett UF-företag har oftast inget organisationsnummer att slå upp, inga
  // uppgifter i bolagsregistret och ingen prenumeration att teckna. Det får
  // därför ett eget steg med företagsnamn + skola, och lösenordssteget
  // skapar kontot UTAN att skicka någon vidare till Stripe. Förvalet kommer
  // från /uf-sidans knappar (initialUf).
  const [isUfSignup, setIsUfSignup] = useState(Boolean(initialUf));
  const [regCompany, setRegCompany] = useState('');
  const [regUfSchool, setRegUfSchool] = useState('');

  const regSteps = isUfSignup && !hasPendingInvite ? ['personal', 'verify', 'company', 'password'] : ['personal', 'verify', 'password'];
  const curStep = regSteps[Math.min(regStep, regSteps.length - 1)];

  // Switch between login/register and reset step
  const switchMode = (login) => {
    setIsLogin(login);
    setRegStep(0);
    setErrorMsg('');
    setShowForgotPassword(false);
    setForgotSent(false);
    resetEmailVerification();
  };

  // Skickar återställningslänken via EGEN server-rutt (api/auth/
  // request-password-reset.js) istället för direkt mot Supabase — den
  // rutten är den enda platsen som faktiskt kan hålla koll på "max 5
  // återställningsmejl/dygn per e-postadress" (kundönskemål), eftersom en
  // klient aldrig kan lita på sig själv för en gräns (öppna DevTools, kör
  // om anropet). Se den filen för redirectTo/felresonemanget som tidigare
  // låg här (bugkritiskt: window.location.origin vs Supabases
  // Redirect URLs-allowlist) — samma logik, bara flyttad server-side.
  // App.jsx (onAuthStateChange, PASSWORD_RECOVERY-eventet) är oförändrad.
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (forgotLoading) return;
    setErrorMsg('');
    setForgotLoading(true);
    try {
      if (!forgotEmail.trim()) throw new Error(t('ui.ange_din_e_postadress'));
      const forgotCaptchaToken = await runCaptcha(forgotCaptchaRef);
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), captchaToken: forgotCaptchaToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      // Samma "alltid samma svar" som innan — servern svarar med fel bara
      // för sådant som captcha/nätverk/hastighetsbegränsning (inklusive
      // vår EGEN 5/dygn-gräns, 429), ALDRIG för att adressen saknar konto.
      if (!res.ok) throw new Error(data?.error || t('ui.kunde_inte_skicka_aterstallningslanken'));
      setForgotSent(true);
    } catch (err) {
      // Bugkritiskt (kundfeedback): en trasig/oväntad felrespons från
      // Supabase (t.ex. serverfel utan strukturerad body, sett efter att
      // custom SMTP kopplades in) gav ett `error`-objekt UTAN läsbart
      // `.message` — `setErrorMsg(err.message)` satte då bokstavligen
      // "undefined" eller (om något längre upp i kedjan redan gjort
      // `JSON.stringify` på en tom felkropp) den tomma strängen "{}",
      // rakt av som text i rutan. Ett äkta, läsbart meddelande visas
      // fortfarande om det finns — annars en generisk text istället för
      // att någonsin visa den råa felrepresentationen för användaren.
      const readable = typeof err?.message === 'string' && err.message.trim() && err.message.trim() !== '{}'
        ? err.message
        : t('ui.nagot_gick_fel_forsok_igen_om_en_stund_eller_kon');
      setErrorMsg(readable);
    } finally {
      newCaptchaRound();
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      if (!loginEmail || !loginPassword) throw new Error(t('ui.fyll_i_alla_falt'));
      const loginCaptchaToken = await runCaptcha(loginCaptchaRef);
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
        options: loginCaptchaToken ? { captchaToken: loginCaptchaToken } : undefined,
      });
      if (error) throw error;
      offerToSavePassword(loginEmail, loginPassword);
    } catch (err) {
      setErrorMsg(translateSupabaseAuthError(err.message));
      newCaptchaRound();
    } finally {
      setLoading(false);
    }
  };

  // Inloggning med passkey. Ingen e-post behövs: telefonen visar vilka
  // konton den har en passkey för. Avbryter man Face ID-rutan visas inget fel.
  const handlePasskeyLogin = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      // Supabase kräver captcha även för passkey-inloggning när Turnstile är på.
      let captchaToken;
      try { captchaToken = await runCaptcha(loginCaptchaRef); } catch (captchaErr) { setErrorMsg(captchaErr.message); newCaptchaRound(); return; }
      const { data, error } = await supabase.auth.signInWithPasskey(captchaToken ? { options: { captchaToken } } : undefined);
      if (error) throw error;
      // Face ID används på den här enheten: appen spärras med det framöver.
      setAppLock(data?.user?.id || data?.session?.user?.id || null);
      rememberPasskeyOnDevice(true);
    } catch (err) {
      if (!isPasskeyCancel(err)) {
        console.error('signInWithPasskey:', err?.code || err?.name, err?.message);
        setErrorMsg(t('ui.passkey_inloggning_misslyckades'));
      }
      newCaptchaRound();
    } finally {
      setLoading(false);
    }
  };

  // Kundfeedback: det här steget släppte tidigare igenom VILKEN
  // e-postadress som helst obekräftad — se filkommentaren vid
  // emailVerified/otpToken ovan. Körs av sig själv när sjätte siffran är
  // ifylld (effekten nedan), och av Bekräfta-knappen.
  const verifyCode = async (code) => {
    if (!/^\d{6}$/.test(code)) { setErrorMsg(t('ui.ange_den_sexsiffriga_koden_fran_mejlet')); return; }
    setErrorMsg('');
    setOtpStatus('verifying');
    try {
      await verifySignupCode({ email: regEmail, code, token: otpToken });
      setEmailVerified(true);
      setRegStep(s => s + 1);
    } catch (err) {
      setErrorMsg(err?.message || t('ui.fel_kod_forsok_igen'));
    } finally {
      setOtpStatus('idle');
    }
  };
  const lastAutoVerified = useRef('');
  useEffect(() => {
    if (curStep !== 'verify' || emailVerified || otpStatus !== 'idle' || regVerifyCode.length !== 6) return;
    if (lastAutoVerified.current === regVerifyCode) return; // samma felaktiga kod skickas inte igen
    lastAutoVerified.current = regVerifyCode;
    verifyCode(regVerifyCode);
  }, [regVerifyCode, curStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNextStep = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (curStep === 'personal') {
      if (!regFirstName.trim()) { setErrorMsg(t('ui.ange_ditt_fornamn')); return; }
      if (!regEmail.trim() || !EMAIL_RE.test(regEmail.trim())) { setErrorMsg(t('ui.ange_en_giltig_e_postadress')); return; }
      setLoading(true);
      const error = await sendCode();
      setLoading(false);
      if (error) { setErrorMsg(error); return; }
      lastAutoVerified.current = '';
      setRegStep(1);
      return;
    }

    if (curStep === 'verify') {
      await verifyCode(regVerifyCode);
      return;
    }

    if (curStep === 'company') {
      // UF-företag: bara namnet är obligatoriskt. Inget org.nummer krävs
      // (de flesta UF-företag har inget), och skolan är frivillig.
      if (!regCompany.trim()) {
        setErrorMsg(t('ui.ange_vad_ert_uf_foretag_heter'));
        return;
      }
      setRegStep(s => s + 1);
      return;
    }

    if (curStep === 'password') {
      if (regPassword.length < 8) { setErrorMsg(t('ui.losenordet_maste_vara_minst_8_tecken_2')); return; }
      if (regPassword !== regPassword2) { setErrorMsg(t('ui.losenorden_matchar_inte_2')); return; }
      if (!regAcceptTerms) { setErrorMsg(t('ui.du_behover_godkanna_anvandarvillkoren_och_person')); return; }
      setLoading(true);
      // Egen flagga (inte bara "kom vi förbi signUp") — annars skulle ett
      // fel i själva Stripe-anropet felaktigt visa "kontot skapades" när
      // det egentligen var signUp() som aldrig lyckades.
      let accountCreated = false;
      let captchaMissing = false;
      try {
        // Ger Cloudflare ingen token inom 5 s (t.ex. stoppad av ett
        // webbläsartillägg) skickas registreringen ändå. Supabase avgör: är
        // captchan påslagen där avvisas anropet som förut, så inget skydd
        // försvinner. Är den avstängd går registreringen igenom.
        let regCaptchaToken = null;
        try {
          regCaptchaToken = await Promise.race([
            runCaptcha(regCaptchaRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
          ]);
        } catch (captchaErr) {
          captchaMissing = true;
          console.warn('Ingen Cloudflare-token, försöker utan:', captchaErr?.message);
        }
        const doSignUp = (captchaToken) => supabase.auth.signUp({
          email: regEmail,
          password: regPassword,
          options: {
            data: {
              first_name: regFirstName,
              last_name: regLastName,
              // Tomt utom för UF. En inbjuden person får inget eget företag
              // (App.jsx:s fetchUserData hoppar över "skapa tomt
              // företag"-grenen när delad åtkomst finns). Alla andra får ett
              // platshållarföretag som onboardingen (OnboardingFlow.jsx)
              // fyller i med org.nr, räkenskapsår, moms och F-skatt.
              company_name: (isUfSignup && !hasPendingInvite) ? regCompany : '',
              // UF-läget. Läses av App.jsx på två ställen: betalspärren
              // (uf + uf_started_at = släpps in på gratisperioden) och
              // skapandet av det första företaget (isUf/ufSchool på
              // företagsposten). uf_started_at sätts HÄR, vid
              // registreringen — det är den enda tidpunkt gratisperioden
              // räknas från, inte "när företaget skapades" eller "första
              // inloggningen", som båda kan glida.
              ...((isUfSignup && !hasPendingInvite) ? { uf: true, uf_school: regUfSchool, uf_started_at: new Date().toISOString() } : {}),
              org_nr: '',
              terms_accepted_at: new Date().toISOString(),
              terms_version: TERMS_VERSION,
            },
            ...(captchaToken ? { captchaToken } : {}),
          }
        });
        let { data, error } = await doSignUp(regCaptchaToken);
        // Avvisad Cloudflare-token (gått ut eller redan använd): ett nytt
        // försök med en färsk token innan användaren får se ett fel.
        // Om det nya försöket också fallerar visas Supabases FÖRSTA svar, inte
        // en väntetid på Cloudflare som döljer den verkliga orsaken.
        if (error && regCaptchaToken && /captcha/i.test(error.message || '') && regCaptchaRef.current?.reset) {
          console.error('Supabase avvisade registreringen:', error);
          const firstError = error;
          regCaptchaRef.current.reset();
          try {
            const retryToken = await Promise.race([
              runCaptcha(regCaptchaRef),
              new Promise((_, reject) => setTimeout(() => reject(new Error('retry-timeout')), 5000)),
            ]);
            ({ data, error } = await doSignUp(retryToken));
          } catch {
            error = firstError;
          }
          if (error && /captcha/i.test(error.message || '')) error = firstError;
        }
        if (error) throw error;
        accountCreated = true;
        offerToSavePassword(regEmail, regPassword, [regFirstName, regLastName].filter(Boolean).join(' '));

        // Inbjuden person: inget eget företag, ingen egen prenumeration att
        // betala för — de rider på ägarens (se supabase-setup.sql:
        // company_members, App.jsx: fetchUserData/hasSharedAccess). Själva
        // inlösningen av inbjudan sker i App.jsx (redeemPendingInvite) så
        // fort en riktig session finns — här är det klart, invänta bara att
        // onAuthStateChange (App.jsx) tar över (kräver bekräftad e-post
        // beroende på projektets Supabase-inställningar, precis som annars).
        if (hasPendingInvite) {
          // Utan session (Supabase kräver bekräftad e-post) stod sidan tidigare
          // bara still. Logga in direkt i stället, eller visa varför det inte gick.
          if (!data?.session) {
            // Supabase kräver bekräftad e-post. Adressen är redan bevisad med
            // koden i steg 2, så servern bekräftar den och personen loggas in.
            if (data?.user?.id) {
              try {
                await confirmSignupEmail({ email: regEmail, code: regVerifyCode, token: otpToken, userId: data.user.id });
              } catch (confirmErr) {
                console.error('Kunde inte bekräfta e-posten:', confirmErr);
              }
            }
            // Ny Cloudflare-token (den förra gick åt till signUp), om captchan är på.
            let signInCaptcha = null;
            try {
              regCaptchaRef.current?.reset?.();
              signInCaptcha = await Promise.race([
                runCaptcha(regCaptchaRef),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
              ]);
            } catch { /* utan token; Supabase avgör */ }
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: regEmail,
              password: regPassword,
              ...(signInCaptcha ? { options: { captchaToken: signInCaptcha } } : {}),
            });
            if (signInError) {
              console.error('Inloggning efter registrering misslyckades:', signInError);
              setErrorMsg(`${t('ui.kontot_skapat_logga_in')} (${translateSupabaseAuthError(signInError.message)})`);
            }
          }
          setLoading(false);
          return;
        }

        // UF-konton har ingen prenumeration att teckna — gratis i
        // UF_FREE_MONTHS månader, sedan samma val som alla andra. Samma väg
        // ut som en inbjuden person: kontot finns, onAuthStateChange
        // (App.jsx) tar över så fort sessionen är klar. Ingen Stripe
        // Checkout, ingen betalningssida.
        if (isUfSignup) {
          setLoading(false);
          return;
        }

        // Kontot finns nu (oavsett om data.session är satt — det kräver
        // bekräftad e-post beroende på Supabase-projektets inställningar,
        // men data.user.id finns redan). Skickas direkt vidare till Stripe
        // för betalningsuppgifter: 30 dagars gratis provperiod, sedan priset
        // för den valda planen (src/utils/plans.js) — email-bekräftelsen
        // sköts parallellt via länken i mejlet, blockerar inte det här.
        setRedirectingToPayment(true);
        const { session } = await createStripeSubscriptionCheckout({
          user_id: data.user.id,
          customer_email: regEmail,
          plan,
        });
        if (!session?.url) throw new Error(t('ui.ingen_betalningslank_mottogs_fran_stripe'));
        window.location.href = session.url;
        return; // Lämnar sidan — inget mer att göra här.
      } catch (err) {
        setRedirectingToPayment(false);
        // requestStripeApi (stripeApi.js) har redan försökt tre gånger
        // innan den ger upp — ett kvarstående "Stripe API error (xxx)" är
        // troligen infrastrukturellt (Vercels edge/bot-skydd), inte något
        // fel i det användaren skrev in.
        const stripeIssue = /^Stripe API error \(\d+\)$/.test(err.message)
          ? t('ui.kunde_inte_na_betalningstjansten_just_nu')
          : err.message;
        setErrorMsg(
          accountCreated
            ? t('ui.kontot_skapades_men_vi_kunde_inte_skicka_dig_vid', { stripeIssue })
            : captchaMissing && /captcha/i.test(err.message || '')
              // Ingen token kom alls (blockerad eller för långsam): säg varför.
              ? t('ui.robotkontroll_blockerad')
              : (/captcha/i.test(err.message || '') && !/\(cloudflare:/.test(err.message || '')
                // Supabase avvisade token:en: visa Supabases egna ord också.
                ? `${translateSupabaseAuthError(err.message)} (supabase: ${err.message})`
                : translateSupabaseAuthError(err.message))
        );
        console.error('Registreringen misslyckades:', err);
        if (!accountCreated) newCaptchaRound();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div id="auth-root" style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: '48px 20px', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;0,600;0,700;1,500&display=swap');
        #auth-root, #auth-root *, #auth-root *::before, #auth-root *::after { box-sizing: border-box; }
        #auth-root button { -webkit-appearance: none; appearance: none; -webkit-tap-highlight-color: transparent; }
        /* Kundfeedback (samma skärmdump som flik-fixet ovan): webbläsarens
           egen ifyllningsfärg (Chrome/Edge autofill) målar över inputens
           background: var(--bg-muted) med sin egen ljusblå/gula ton via
           en UA-stilregel som vanlig CSS-specificitet inte kommer åt — syns
           tydligt som en ljus ruta mitt i det mörka kortet i mörkt läge.
           webkit-box-shadow inset "målar över" den tvingade bakgrunden med
           samma temafärg som inputen redan har; den orimligt långa
           transitionen stoppar Chromes gula infärgnings-animation vid
           autofill. */
        #auth-root input:-webkit-autofill,
        #auth-root input:-webkit-autofill:hover,
        #auth-root input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--text-main);
          -webkit-box-shadow: 0 0 0 1000px var(--bg-muted) inset;
          box-shadow: 0 0 0 1000px var(--bg-muted) inset;
          transition: background-color 5000s ease-in-out 0s;
        }
        .auth-logo-link { display: inline-flex; text-decoration: none; transition: transform 0.2s ease; }
        .auth-logo-link:hover { transform: translateY(-1px); }
        /* Kundfeedback (skärmdump): en fast MÖRK vinjett (tidigare försök
           här) gjorde loggan grumlig/svårläst i mörkt läge, där himlen redan
           är mörk — dubbelt mörkt istället för kontrast. Samma frostade-
           glas-teknik som navheadern redan använder för EXAKT samma problem
           (logga/text ovanpå en levande himmel, se MarketingHeader-
           kommentaren om "garanterad kontrast mot VILKEN bakgrund som
           helst"): en halvgenomskinlig chip i --mkt-header-bg (vit i ljust
           läge, nästan svart i mörkt läge) + blur, ISTÄLLET FÖR en hårdkodad
           färg — vänder sig alltså rätt automatiskt i båda lägena, och ger
           loggans egna klara blå/turkos/limegröna gradient en lugn, neutral
           yta att synas mot ("bright", inte grumlig). */
        @keyframes authSpin { to { transform: rotate(360deg); } }
        .auth-spin { animation: authSpin 1s linear infinite; }

        /* ── Atmosfären bakom kortet — kundönskemål: samma levande
           molnhimmel som Startsidans Hero (CloudShaderBackground.jsx,
           samma port av Aceternitys shader), inte den tidigare mörkgröna
           ledger-linje-bakgrunden. Rendras som absolut positionerad
           bakgrund direkt i #auth-root:s markup nedan (bakom .auth-column
           via position:relative/z-index:1 där), tema-medveten precis som
           på Startsidan. ── */
        .auth-column { position: relative; z-index: 1; width: 100%; max-width: 640px; display: flex; flex-direction: column; align-items: center; }
        @keyframes authRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .auth-brandblock { animation: authRise 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .auth-card { animation: authRise 0.5s cubic-bezier(0.16,1,0.3,1) 0.08s both; }

        /* Signaturdetaljen: en tunn gradient-linje längs kortets ÖVERKANT i
           precis samma två toner som loggans gradient börjar/slutar med —
           en "saldorad", inte en generisk dekorstrimma. Enda djärva detaljen
           på sidan; allt annat runt den hålls medvetet lugnt. */
        .auth-card { position: relative; }

        .auth-input { transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
        .auth-input:hover { border-color: var(--text-muted); }
        .auth-input:focus { border-color: #0b6329; box-shadow: 0 0 0 3px rgba(11,99,41,0.16); background: var(--bg-card); }

        .auth-btn-primary { transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
        .auth-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(11,99,41,0.32); }
        .auth-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .auth-btn-ghost { transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
        .auth-btn-ghost:hover { background: var(--bg-muted); color: var(--text-main); }
        #auth-root button:focus-visible, #auth-root input:focus-visible, #auth-root a:focus-visible {
          outline: 2px solid #0b6329; outline-offset: 2px;
        }

        /* Solida ytor i appens gröna ton (kundönskemål 2026-09-27: inloggningen
           ska se bra ut i mörkt läge; startsidans blå himmel bakom ett grönt
           kort krockade). Ljust: ljus grågrön sida, vitt kort. Mörkt: samma
           djupgröna som appen, kortet ett steg ljusare. */
        #auth-root { background: #f4f7f5; }
        #auth-root .auth-card { border: 1px solid #e3e8e4; box-shadow: 0 24px 60px -30px rgba(15, 40, 25, 0.28); }
        :root[data-theme="dark"] #auth-root { background: #0f1a13; }
        :root[data-theme="dark"] #auth-root .auth-card { border-color: #243a2a; box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.7); }

        .auth-tabs { background: #eef2ef; }
        .auth-tab { background: transparent; color: var(--text-secondary); transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
        .auth-tab:hover { color: var(--text-main); }
        .auth-tab.on { background: #ffffff; color: var(--text-main); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1); }
        :root[data-theme="dark"] .auth-tabs { background: #0f1a13; }
        :root[data-theme="dark"] .auth-tab.on { background: #243a2a; color: #eef3ea; box-shadow: none; }

        .auth-link { color: #0b6329; }
        :root[data-theme="dark"] .auth-link { color: #8fd67a; }
        :root[data-theme="dark"] .auth-input:focus { border-color: #8fd67a; box-shadow: 0 0 0 3px rgba(143, 214, 122, 0.18); }
        :root[data-theme="dark"] .auth-btn-primary { background: #16803a !important; }

        @keyframes authStepIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .auth-step-fade { animation: authStepIn 0.28s ease both; }

        @keyframes authPulseRing { 0% { box-shadow: 0 0 0 0 rgba(11,99,41,0.35); } 100% { box-shadow: 0 0 0 14px rgba(11,99,41,0); } }
        .auth-pulse { animation: authPulseRing 1.8s ease-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .auth-spin, .auth-brandblock, .auth-card, .auth-step-fade, .auth-pulse { animation: none !important; }
          .auth-btn-primary:hover:not(:disabled) { transform: none; }
        }
        @media (max-width: 560px) {
          .auth-form-panel { padding: 40px 26px !important; }
        }
      `}</style>

      <div className="auth-column">
      {/* Kundfeedback: den tidigare tvåkolumns-layouten (varumärkespanel med
          funktionslista + "100% Säkert/GDPR/Krypterat"-märken bredvid
          formuläret) var säljande text som inte hör hemma på en inloggnings-
          sida — det är inte här man övertygar någon om att köpa Bokix, det
          är här en redan övertygad besökare snabbt ska komma in. Fortfarande
          ETT enda centrerat kort (ingen andra kolumn återinförd) — bara
          loggan flyttad UT ovanför kortet, på atmosfären, så den känns som
          en riktig ankomst istället för en logotyp inklämd överst i ett
          formulär.
          Kundfeedback (uppföljning): kortet kändes för litet på desktop —
          maxbredden och innerpaddingen höjda (se .auth-column/.auth-form-panel
          nedan) för att kännas som en riktig, rejäl destination istället för
          ett hopklämt formulär, samma taggline under loggan togs bort (den
          tillförde inget en besökare som redan klickat "Logga in" behövde
          läsa).
          Kundfeedback (ännu en uppföljning, "gör den mycket större"): kortet,
          loggan, flikarna, stegrubriken, fältetiketterna och Fortsätt-knappen
          skalade upp ytterligare ett steg (se maxWidth/height/fontSize/padding
          nedan) — samma mönster, bara en tydligare skala rakt igenom.
          Kundfeedback (ännu en uppföljning): loggan uppskalad EN gång till
          (56 → 88). Ett första försök med en fast MÖRK vinjett bakom den
          gjorde loggan grumlig i mörkt läge (redan mörk himmel + ännu en
          mörk yta = sämre kontrast, inte bättre) — ersatt med samma
          frostade-glas-chip som navheadern (.auth-logo-chip, se dess egen
          kommentar för hela resonemanget), som vänder rätt automatiskt i
          båda lägena istället för att gissa en färg. */}
      <div className="auth-brandblock" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '36px' }}>
        {/* Bugkritiskt: LandingPage/Auth växlar via lokalt state
            (App.jsx: showLanding), inte skilda routes — en vanlig
            <Link to="/"> är ett no-op när man redan står på "/", vilket
            gjorde loggan verkningslös här. onBackToLanding (App.jsx)
            nollställer det state:t direkt; e.preventDefault() stoppar
            Link:ens egen (verkningslösa) navigeringsförsök så de två
            aldrig krockar. */}
        <Link
          to="/"
          className="auth-logo-link"
          aria-label={t('ui.till_startsidan')}
          onClick={(e) => { if (onBackToLanding) { e.preventDefault(); onBackToLanding(); } }}
        >
          <BokixWordmark height={88} />
        </Link>
      </div>

      <div style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '22px', overflow: 'hidden' }} className="auth-card">
        <div className="auth-form-panel" style={{ padding: '64px 64px 60px' }}>

        {/* Mode tabs — bugkritiskt (kundfeedback, med skärmdump): den aktiva
            fliken hade en HÅRDKODAD `background: 'white'` medan texten
            använde den tema-medvetna `var(--text-main)` — i mörkt läge blir
            den ljus/vit, så vit text på vit bakgrund gjorde "Logga in"-
            fliken praktiskt taget osynlig så fort appens tema (satt
            tidigare, t.ex. innan utloggning) var mörkt. `var(--bg-card)`
            istället: vit i ljust läge (ingen synlig skillnad där) men
            korrekt mörk i mörkt läge, matchar texten igen. */}
        <div className="auth-tabs" style={{ display: 'flex', borderRadius: '14px', padding: '5px', marginBottom: '36px' }}>
          <button className={`auth-tab${isLogin ? ' on' : ''}`} onClick={() => switchMode(true)} style={{ flex: 1, padding: '14px 0', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '9px' }}>
            <LogIn size={19} /> {t('ui.logga_in')}
          </button>
          <button className={`auth-tab${!isLogin ? ' on' : ''}`} onClick={() => switchMode(false)} style={{ flex: 1, padding: '14px 0', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '9px' }}>
            <UserPlus size={19} /> {t('ui.nytt_konto')}
          </button>
        </div>

        {/* LOGIN */}
        {isLogin ? (
          showForgotPassword ? (
            /* "Glömt lösenord?" — se handleForgotPassword för varför samma
               bekräftelse alltid visas, oavsett om kontot faktiskt finns. */
            <>
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 'clamp(26px, 8vw, 34px)', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.01em' }}>{t('ui.glomt_losenord')}</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{t('ui.ange_din_e_postadress_sa_skickar_vi_en_aterstall')}</p>
              </div>
              {forgotSent ? (
                <div style={{ padding: '32px 28px', background: 'var(--status-green-bg)', borderRadius: '16px', border: '1px solid var(--status-green-bg)', textAlign: 'center' }}>
                  <div className="auth-pulse" style={{ width: 64, height: 64, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                    <Mail size={26} color="white" />
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 600, fontSize: '21px', color: 'var(--text-main)', marginBottom: '10px' }}>{t('ui.kolla_din_inkorg')}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    {t('ui.om_det_finns_ett_konto_med_den_adressen_har_vi_s')}
                  </div>
                  <button className="auth-btn-ghost auth-link" type="button" onClick={() => { setShowForgotPassword(false); setForgotSent(false); }} style={{ marginTop: '20px', background: 'none', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 8px' }}>
                    <ArrowLeft size={14} /> {t('ui.tillbaka_till_inloggning')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>{t('ui.e_postadress')}</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', top: 15, left: 16, pointerEvents: 'none' }} />
                      <input className="auth-input" type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} style={{ ...inputStyle, paddingLeft: '48px' }} placeholder={t('ui.din_epost_se')} value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus />
                    </div>
                  </div>
                  <Turnstile key={`f${captchaRound}`} ref={forgotCaptchaRef} onDemand />
                  {errorMsg && <div style={{ padding: '12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>}
                  <button className="auth-btn-primary" type="submit" disabled={forgotLoading} style={{ width: '100%', padding: '20px 22px', background: BRAND.green, border: 'none', borderRadius: '13px', fontSize: '18px', fontWeight: 700, color: 'white', cursor: forgotLoading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(11,99,41,0.25)', fontFamily: 'inherit', opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? t('ui.skickar') : t('ui.skicka_aterstallningslank')} <ArrowRight size={18} />
                  </button>
                  <button className="auth-btn-ghost" type="button" onClick={() => { setShowForgotPassword(false); setErrorMsg(''); }} style={{ background: 'none', border: 'none', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}>
                    <ArrowLeft size={14} /> {t('ui.tillbaka_till_inloggning')}
                  </button>
                </form>
              )}
            </>
          ) : (
          <>
            <div style={{ marginBottom: '28px' }}>
              {/* Krymper med skärmen och bryts aldrig: på telefon hamnade
                  "tillbaka" annars på en egen rad under "Välkommen". */}
              <h2 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 'clamp(26px, 8vw, 36px)', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.01em' }}>{t('ui.valkommen_tillbaka')}</h2>
            </div>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>{t('ui.e_postadress')}</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', top: 15, left: 16, pointerEvents: 'none' }} />
                  <input className="auth-input" type="email" id="login-email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} style={{ ...inputStyle, paddingLeft: '48px' }} placeholder={t('ui.din_epost_se')} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={labelStyle}>{t('ui.losenord')}</label>
                  <button type="button" onClick={() => { setShowForgotPassword(true); setErrorMsg(''); setForgotEmail(loginEmail); }} className="auth-link" style={{ background: 'none', border: 'none', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '6px' }}>
                    {t('ui.glomt_losenord')}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', top: 15, left: 16, pointerEvents: 'none' }} />
                  <input className="auth-input" type="password" id="login-password" name="password" autoComplete="current-password" style={{ ...inputStyle, paddingLeft: '48px' }} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                </div>
              </div>
              <Turnstile key={`l${captchaRound}`} ref={loginCaptchaRef} onDemand />
              {errorMsg && <div style={{ padding: '12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>}
              <button className="auth-btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '20px 22px', background: BRAND.green, border: 'none', borderRadius: '13px', fontSize: '18px', fontWeight: 700, color: 'white', cursor: loading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(11,99,41,0.25)', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                {loading ? t('ui.loggar_in') : t('ui.logga_in')} <ArrowRight size={18} />
              </button>
            </form>
            {/* Passkey: Face ID, fingeravtryck eller Windows Hello i stället
                för lösenordet. Syns bara när någon har slagit på det på den
                här enheten (utils/sessionPolicy.js: passkeyLoginOffered). */}
            {passkeyLoginOffered() && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />{t('ui.eller')}<span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <button type="button" onClick={handlePasskeyLogin} disabled={loading} style={{ width: '100%', padding: '16px 22px', background: 'transparent', border: '1.5px solid var(--border)', borderRadius: '13px', fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                  {t('ui.logga_in_med_face_id')}
                </button>
              </>
            )}
          </>
          )
        ) : (
          /* REGISTER - Multi-step */
          <>
            {/* Step indicator */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                {regSteps.map((s, i) => (
                  <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <div style={{ position: 'relative', height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, borderRadius: '2px', background: '#0b6329', transform: `scaleX(${i <= regStep ? 1 : 0})`, transformOrigin: 'left', transition: 'transform 0.35s ease' }} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: i === regStep ? 700 : 500, color: i <= regStep ? BRAND.greenDark : 'var(--text-muted)' }}>{t(STEP_LABELS[s])}</span>
                  </div>
                ))}
              </div>
              <h2 key={regStep} className="auth-step-fade" style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 'clamp(26px, 8vw, 34px)', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', letterSpacing: '-0.01em' }}>
                {curStep === 'personal' && t('ui.personlig_info')}
                {curStep === 'verify' && t('ui.bekrafta_e_post')}
                {curStep === 'company' && t('ui.ert_uf_foretag')}
                {curStep === 'password' && t('ui.skapa_losenord')}
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                {curStep === 'verify' && t('ui.skriv_in_koden_vi_skickade_till', { regEmail })}
                {/* Bugkritiskt (kundrapport: "det säger betalning/organisationsnummer
                    fast det är ett UF-konto"): den här raden sa "Sedan skickas
                    du vidare till betalning" OAVSETT isUfSignup — men UF-konton
                    skickas ALDRIG till Stripe (se handleNextStep, regStep===3:
                    isUfSignup-grenen returnerar direkt, ingen
                    createStripeSubscriptionCheckout). Texten ljög alltså för
                    exakt den kontotyp den handlar minst om. */}
                {curStep === 'password' && hasPendingInvite && t('ui.inbjuden_sedan')}
                {curStep === 'password' && !isUfSignup && !hasPendingInvite && t('ui.sedan_skickas_du_vidare_till_betalning')}
              </p>
              {hasPendingInvite && curStep === 'personal' && (
                <div style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{t('ui.inbjuden_rubrik')}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('ui.inbjuden_text')} {t('ui.inbjuden_epost_tips')}</div>
                </div>
              )}
            </div>

            <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Osynlig reCAPTCHA för "Skicka kod" (steg 0) och "Skicka igen"
                  (steg 1): ett skript ska inte kunna begära koder och skapa
                  konton i mängd. Renderar inget utan nyckel. */}
              <Recaptcha ref={signupRecaptchaRef} />
              {/* STEP 0 – Personal info */}
              {curStep === 'personal' && (
                <div key="step0" className="auth-step-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-row-2" style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>{t('ui.fornamn')}</label>
                      <div style={{ position: 'relative' }}>
                        <User size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 16, left: 14, pointerEvents: 'none' }} />
                        <input className="auth-input" type="text" name="given-name" autoComplete="given-name" style={{ ...inputStyle, paddingLeft: '42px' }} placeholder={t('ui.anna')} value={regFirstName} onChange={e => setRegFirstName(e.target.value)} required />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>{t('ui.efternamn')}</label>
                      <input className="auth-input" type="text" name="family-name" autoComplete="family-name" style={inputStyle} placeholder={t('ui.svensson')} value={regLastName} onChange={e => setRegLastName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>{t('ui.e_postadress')}</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 16, left: 14, pointerEvents: 'none' }} />
                      <input
                        className="auth-input"
                        type="email"
                        name="email"
                        autoComplete="username"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        style={{ ...inputStyle, paddingLeft: '42px' }}
                        placeholder={t('ui.anna_foretag_se')}
                        value={regEmail}
                        // Inbjudan går bara att lösa in med adressen den
                        // skickades till, så den går inte att ändra här.
                        readOnly={invitedEmailLocked}
                        // En redan verifierad kod/token hörde till den GAMLA
                        // adressen — måste nollställas så en ändrad adress
                        // aldrig kan glida igenom på gårdagens verifiering.
                        onChange={e => { setRegEmail(e.target.value); resetEmailVerification(); }}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1 – Bekräfta e-post med en riktig sexsiffrig kod (se
                  emailVerified/otpToken-kommentaren vid state:t ovan för
                  varför) — Fortsätt-knappen i foten nedan blir en
                  "Bekräfta"-knapp för det här steget, avstängd tills 6
                  siffror är ifyllda (se dess disabled-villkor). */}
              {curStep === 'verify' && (
                <div key="step1" className="auth-step-fade" style={{ padding: '32px 28px', background: 'var(--status-green-bg)', borderRadius: '16px', border: '1px solid var(--status-green-bg)', textAlign: 'center' }}>
                  <div className="auth-pulse" style={{ width: 64, height: 64, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                    <Mail size={26} color="white" />
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 600, fontSize: '21px', color: 'var(--text-main)', marginBottom: '10px' }}>{t('ui.kolla_din_inkorg')}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                    {t('ui.vi_skickade_en_sexsiffrig_kod_till')}<br />
                    <strong style={{ color: 'var(--text-main)' }}>{regEmail}</strong>
                  </div>
                  <input
                    className="auth-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={regVerifyCode}
                    onChange={e => setRegVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '26px', fontWeight: 700, letterSpacing: '10px', padding: '14px', fontFamily: "'Inter', monospace" }}
                  />
                  <button
                    type="button"
                    className="auth-btn-ghost"
                    onClick={async () => { setErrorMsg(''); lastAutoVerified.current = ''; const error = await sendCode(); if (error) setErrorMsg(error); }}
                    disabled={resendCooldown > 0 || otpStatus === 'sending'}
                    style={{ marginTop: '14px', background: 'none', border: 'none', borderRadius: '8px', padding: '6px 10px', color: resendCooldown > 0 ? 'var(--text-muted)' : BRAND.green, fontWeight: 700, fontSize: '13px', cursor: resendCooldown > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
                  >
                    {otpStatus === 'sending' ? t('ui.skickar_2') : resendCooldown > 0 ? t('ui.skicka_koden_igen_s', { resendCooldown }) : t('ui.fick_du_ingen_kod_skicka_igen')}
                  </button>
                </div>
              )}

              {/* UF-företagets namn och skola (bara UF, se regSteps). Inget
                  organisationsnummer och inget registeruppslag: det finns
                  ingenting att slå upp för ett UF-företag. */}
              {curStep === 'company' && (
                <div key="step2" className="auth-step-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '13px 14px', background: BRAND.greenLight, borderRadius: '10px' }}>
                    <GraduationCap size={16} color={BRAND.greenDark} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: '12.5px', color: BRAND.greenDark, lineHeight: 1.6, fontWeight: 600 }}>
                      {t('ui.ni_registrerar_ett_uf_foretag_gratis_i')} {UF_FREE_MONTHS} {t('ui.manader_inget_organisationsnummer_och_inga_betal')}
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>{t('ui.uf_foretagets_namn')}</label>
                    <input
                      className="auth-input"
                      type="text"
                      style={inputStyle}
                      placeholder={t('ui.ex_solkraft_uf')}
                      value={regCompany}
                      onChange={e => setRegCompany(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>{t('ui.skola')} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t('ui.frivilligt')}</span></label>
                    <input
                      className="auth-input"
                      type="text"
                      style={inputStyle}
                      placeholder={t('ui.ex_katedralskolan')}
                      value={regUfSchool}
                      onChange={e => setRegUfSchool(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsUfSignup(false)}
                    style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
                  >
                    {t('ui.vi_ar_inte_ett_uf_foretag')}
                  </button>
                </div>
              )}

              {/* Lösenord, sedan konto + betalning */}
              {curStep === 'password' && redirectingToPayment && (
                <div className="auth-step-fade" style={{ padding: '32px 28px', background: 'var(--status-green-bg)', borderRadius: '16px', border: '1px solid var(--status-green-bg)', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                    <RefreshCw size={26} color="white" className="auth-spin" />
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 600, fontSize: '21px', color: 'var(--text-main)', marginBottom: '10px' }}>{t('ui.kontot_ar_skapat')}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    {t('ui.skickar_dig_vidare_till_stripe_for_betalningsupp')}
                  </div>
                </div>
              )}
              {curStep === 'password' && !redirectingToPayment && (
                <div key="step3" className="auth-step-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>{t('ui.losenord')}</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 16, left: 14, pointerEvents: 'none' }} />
                      <input className="auth-input" type="password" name="new-password" autoComplete="new-password" style={{ ...inputStyle, paddingLeft: '42px' }} placeholder={t('ui.minst_8_tecken')} value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={8} />
                    </div>
                    {passwordStrength(regPassword) && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${passwordStrength(regPassword).pct}%`, background: passwordStrength(regPassword).color, transition: 'all 0.2s' }} />
                        </div>
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: passwordStrength(regPassword).color }}>{passwordStrength(regPassword).label}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>{t('ui.bekrafta_losenord')}</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 16, left: 14, pointerEvents: 'none' }} />
                      <input className="auth-input" type="password" name="confirm-password" autoComplete="new-password" style={{ ...inputStyle, paddingLeft: '42px', borderColor: regPassword2 && regPassword2 !== regPassword ? '#f43f5e' : undefined }} placeholder={t('ui.upprepa_losenord')} value={regPassword2} onChange={e => setRegPassword2(e.target.value)} required />
                    </div>
                  </div>

                  {/* Ärligt om vad som händer efter "Skapa konto och lägg
                      till betalning" — nästa steg är Stripes egen
                      betalningssida, inte direkt in i appen. */}
                  <div style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', padding: '10px 12px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '9px' }}>
                    <ShieldCheck size={15} color={BRAND.greenDark} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {hasPendingInvite
                        ? t('ui.inbjuden_ruta')
                        : isUfSignup
                        ? t('ui.nasta_steg_ar_appen_uf_kontot_ar_gratis_i_manade', { UF_FREE_MONTHS })
                        : <>{t('ui.nast_skickas_du_till')} <StripeBadge /> {t('ui.for_att_lagga_in_betalningsuppgifter_30_dagar_gr')} {selectedPlan ? selectedPlan.price : 179} {t('ui.kr_man_avsluta_innan_dess_sa_kostar_det_ingentin')}</>}
                    </span>
                  </div>
                  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={regAcceptTerms} onChange={e => setRegAcceptTerms(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: BRAND.green }} />
                    <span>
                      {t('ui.jag_godkanner')} <Link to="/terms" target="_blank" style={{ color: BRAND.greenDark, fontWeight: 600 }}>{t('ui.anvandarvillkoren')}</Link> {t('ui.och')} <Link to="/pub" target="_blank" style={{ color: BRAND.greenDark, fontWeight: 600 }}>{t('ui.personuppgiftsbitradesavtalet')}</Link>{t('ui.och_har_last')} <Link to="/privacy" target="_blank" style={{ color: BRAND.greenDark, fontWeight: 600 }}>{t('ui.integritetspolicyn')}</Link>.
                    </span>
                  </label>
                  <Turnstile key={`r${captchaRound}`} ref={regCaptchaRef} onDemand />
                </div>
              )}

              {errorMsg && (
                <div style={{ padding: '12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>
              )}

              {!redirectingToPayment && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  {regStep > 0 && (
                    <button className="auth-btn-ghost" type="button" onClick={() => { setRegStep(s => s - 1); setErrorMsg(''); }} style={{ padding: '20px 26px', border: '1px solid var(--border)', borderRadius: '13px', fontSize: '17px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'inherit' }}>
                      <ArrowLeft size={16} /> {t('ui.tillbaka_2')}
                    </button>
                  )}
                  {(() => {
                    const verifying = curStep === 'verify' && otpStatus === 'verifying';
                    const codeIncomplete = curStep === 'verify' && regVerifyCode.length !== 6;
                    const busy = loading || verifying;
                    const isDisabled = busy || codeIncomplete;
                    let label;
                    if (curStep === 'password') label = busy ? t('ui.skapar_konto') : (hasPendingInvite ? t('ui.inbjuden_skapa_konto') : isUfSignup ? t('ui.skapa_uf_konto') : t('ui.skapa_konto_och_betalning'));
                    else if (curStep === 'personal') label = busy ? t('ui.skickar_kod') : t('ui.fortsatt');
                    else if (curStep === 'verify') label = verifying ? t('ui.bekraftar') : t('ui.bekrafta');
                    else label = busy ? t('ui.fortsatter') : t('ui.fortsatt');
                    return (
                      <button className="auth-btn-primary" type="submit" disabled={isDisabled} style={{ flex: 1, padding: '20px 22px', background: BRAND.green, border: 'none', borderRadius: '13px', fontSize: '18px', fontWeight: 700, color: 'white', cursor: isDisabled ? (busy ? 'wait' : 'not-allowed') : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(11,99,41,0.25)', fontFamily: 'inherit', opacity: isDisabled ? 0.6 : 1 }}>
                        {label} <ArrowRight size={18} />
                      </button>
                    );
                  })()}
                </div>
              )}
            </form>
          </>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
