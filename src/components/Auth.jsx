import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LogIn, UserPlus, Mail, Lock,
  ArrowRight, ArrowLeft, ShieldCheck, Check, User, Hash,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { detectOrgType, formatLegalForm, formatOrgNr } from '../utils/orgType';
import { useCompanyLookup } from '../hooks/useCompanyLookup';
import { sendSignupCode, verifySignupCode } from '../utils/signupVerification';
import { translateSupabaseAuthError } from '../utils/translateAuthError';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark } from './marketing/MarketingLayout';
import { createStripeSubscriptionCheckout } from '../stripeApi';
import Turnstile from './Turnstile';

// ── Litet Stripe-märke — se motsvarande kommentar i PaymentRequiredGate.jsx
// (samma lokala-kopia-mönster). ──
function StripeBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: 4, background: '#635BFF', color: 'white', fontSize: '10px', fontWeight: 800, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
        S
      </span>
      <span style={{ fontWeight: 700, color: '#425466' }}>Stripe</span>
    </span>
  );
}

const inputStyle = {
  width: '100%', padding: '13px 16px', border: '1px solid var(--border)', borderRadius: '10px',
  fontSize: '15px', color: 'var(--text-main)', background: 'var(--bg-muted)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', transition: 'all 0.2s',
};

const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em',
};

const REGISTER_STEPS = ['Personlig info', 'Bekräfta e-post', 'Företag', 'Lösenord'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Autouppslag mot FöretagsAPI på registreringens "Ditt företag"-steg
// (useCompanyLookup, se api/company-access.js). Företagsnamnet skrivs inte
// längre in för hand här — organisationsnumret är det enda fältet, och när
// 10 siffror är ifyllda slår handleOrgNrChange upp och fyller regCompany
// automatiskt (se companyLookup nedan). lookupStatusStyle visar resultatet
// av det uppslaget under fältet. ──
const lookupStatusStyle = { fontSize: '12px', marginTop: '8px', lineHeight: 1.5, color: 'var(--text-secondary)' };

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
  if (score <= 1) return { label: 'Svagt — lägg till fler tecken', color: '#ef4444', pct: 25 };
  if (score === 2) return { label: 'Okej', color: '#f59e0b', pct: 50 };
  if (score <= 3) return { label: 'Bra', color: '#84cc16', pct: 75 };
  return { label: 'Starkt', color: '#3d7a2e', pct: 100 };
}

// Sessionstoken satt av InviteRedeem.jsx när någon öppnar en inbjudningslänk
// — samma nyckel som App.jsx:s redeemPendingInvite läser vid nästa lyckade
// inloggning/registrering. sessionStorage (inte localStorage): tokenet ska
// inte överleva längre än den här enskilda flikens session, och rensas
// ändå bort explicit av redeemPendingInvite oavsett utfall.
const PENDING_INVITE_KEY = 'bokix_pending_invite_token';

export default function Auth({ onLogin, onBackToLanding }) {
  const [isLogin, setIsLogin] = useState(true);
  // En inbjuden person ska aldrig behöva ange ett eget företagsnamn/orgnr
  // eller betala för en egen prenumeration — de ska bara skapa ett lösenord
  // och komma in. Läses en gång vid mount (inte varje render) eftersom
  // sessionStorage inte kan ändras av något ANNAT än InviteRedeem.jsx medan
  // det här formuläret är öppet.
  const [hasPendingInvite] = useState(() => typeof window !== 'undefined' && Boolean(sessionStorage.getItem(PENDING_INVITE_KEY)));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [regStep, setRegStep] = useState(0); // 0=personal, 1=email-confirm, 2=company, 3=password
  // Kontot är skapat och vi väntar på Stripe Checkout-URL:en innan sidan
  // navigerar bort — egen flagga (inte bara `loading`) så steg 2 kan visa en
  // tydlig "skickar dig vidare"-vy istället för företagsformuläret igen.
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // "Glömt lösenord?" — egen liten vy ovanpå inloggningsformuläret, inte ett
  // eget steg i REGISTER_STEPS (det är bara för nytt-konto-flödet). Visar
  // ALLTID samma bekräftelse oavsett om e-postadressen faktiskt finns eller
  // ej (se handleForgotPassword) — att svara olika hade läckt vilka
  // e-postadresser som är registrerade i Bokix.
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotCaptchaToken, setForgotCaptchaToken] = useState('');

  // Bot-/captcha-spärr (säkerhetsgranskningen) — se Turnstile.jsx för
  // aktivering. Egna tokens per formulär eftersom det är separata
  // widget-instanser (olika steg/vyer).
  const [loginCaptchaToken, setLoginCaptchaToken] = useState('');
  const [regCaptchaToken, setRegCaptchaToken] = useState('');

  // Step 0 – Personal info
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');

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
      const token = await sendSignupCode(regEmail);
      setOtpToken(token);
      setRegVerifyCode('');
      setResendCooldown(30);
      return null;
    } catch (err) {
      return err?.message || 'Kunde inte skicka koden just nu. Försök igen om en stund.';
    } finally {
      setOtpStatus('idle');
    }
  };

  // Step 2 – Company
  const [regCompany, setRegCompany] = useState('');
  const [regOrgNr, setRegOrgNr] = useState('');
  // Register's own answer for the legal form (FöretagsAPI's `legalForm`,
  // via applyCompany) — authoritative, unlike the digit-position guess
  // below. Empty until a lookup actually resolves.
  const [regLegalForm, setRegLegalForm] = useState('');
  // "Jag har inget företag än" — se knappen i steg 2 och handleNextStep:s
  // regStep===2-gren för hela resonemanget.
  const [skipCompany, setSkipCompany] = useState(false);

  // Fallback only: a local heuristic from the org number's own digits, used
  // when a real lookup hasn't resolved a legal form yet (or failed) so the
  // step still shows *something*. Can be wrong — see orgType.js's own
  // caveat — so regLegalForm below is always preferred once present.
  const orgType = detectOrgType(regOrgNr);
  const displayedOrgType = (regLegalForm && formatLegalForm(regLegalForm)) || orgType;

  // Autouppslag mot FöretagsAPI — det här steget har bara namn + org.nummer
  // (till skillnad från Contacts.jsx finns ingen adress/postnr/ort-fält
  // här ännu, det fylls i senare i OnboardingFlow.jsx efter inloggning),
  // så adaptern nedan ignorerar de flesta fälten från useCompanyLookup —
  // utom 'legalForm' (se regLegalForm ovan), som ersätter den lokala
  // gissningen i orgType.js med registrets faktiska svar så fort ett
  // uppslag lyckas. org.nummer formateras via SAMMA formatOrgNr som
  // fältets egen onChange använder, så en ifylld post-lookup-siffersträng
  // ser likadan ut (556123-4567) som en manuellt inskriven.
  const handleLookupField = (key, value) => {
    if (key === 'name') setRegCompany(value);
    else if (key === 'orgNr') setRegOrgNr(formatOrgNr(value));
    else if (key === 'legalForm') setRegLegalForm(value);
  };
  const companyLookup = useCompanyLookup(handleLookupField);

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
      if (!forgotEmail.trim()) throw new Error('Ange din e-postadress');
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), captchaToken: forgotCaptchaToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      // Samma "alltid samma svar" som innan — servern svarar med fel bara
      // för sådant som captcha/nätverk/hastighetsbegränsning (inklusive
      // vår EGEN 5/dygn-gräns, 429), ALDRIG för att adressen saknar konto.
      if (!res.ok) throw new Error(data?.error || 'Kunde inte skicka återställningslänken.');
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
        : 'Något gick fel. Försök igen om en stund, eller kontakta support@bokix.se om det upprepas.';
      setErrorMsg(readable);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      if (!loginEmail || !loginPassword) throw new Error('Fyll i alla fält');
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
        options: loginCaptchaToken ? { captchaToken: loginCaptchaToken } : undefined,
      });
      if (error) throw error;
    } catch (err) {
      setErrorMsg(translateSupabaseAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (regStep === 0) {
      if (!regFirstName.trim()) { setErrorMsg('Ange ditt förnamn'); return; }
      if (!regEmail.trim() || !EMAIL_RE.test(regEmail.trim())) { setErrorMsg('Ange en giltig e-postadress'); return; }
      setLoading(true);
      const error = await sendCode();
      setLoading(false);
      if (error) { setErrorMsg(error); return; }
      setRegStep(1);
      return;
    }

    if (regStep === 1) {
      // Kundfeedback: det här steget släppte tidigare igenom VILKEN
      // e-postadress som helst obekräftad — se filkommentaren vid
      // emailVerified/otpToken ovan. Fortsätt är nu en riktig kod-kontroll,
      // inte bara ett nästa-klick.
      if (!/^\d{6}$/.test(regVerifyCode)) { setErrorMsg('Ange den sexsiffriga koden från mejlet.'); return; }
      setOtpStatus('verifying');
      try {
        await verifySignupCode({ email: regEmail, code: regVerifyCode, token: otpToken });
        setEmailVerified(true);
        // En inbjuden person hoppar rakt förbi företagssteget (3) — de ska
        // aldrig ombes namnge ett eget företag för att gå med i någon
        // ANNANS.
        setRegStep(hasPendingInvite ? 3 : 2);
      } catch (err) {
        setErrorMsg(err?.message || 'Fel kod. Försök igen.');
      } finally {
        setOtpStatus('idle');
      }
      return;
    }

    if (regStep === 2) {
      // "Jag har inget företag än" (se knappen nedan) — hoppar över hela
      // valideringen precis som hasPendingInvite redan gör (fast den hoppar
      // över SJÄLVA STEGET, den här bara fälten inuti det, användaren har
      // fortfarande sett/kunnat fylla i steget). signUp()-anropet nedan
      // skickar tomma company_name/org_nr precis som för en inbjuden
      // person — App.jsx:s fetchUserData skapar då ett tomt platshållar-
      // företag ('Mitt Företag AB', orgNr: '') som Settings.jsx:s
      // Företag-flik känner igen (via ett tomt orgNr) och visar en riktig
      // "slutför registreringen"-vy för, med samma org.nummer-uppslag som
      // här — se Settings.jsx:s kommentar vid Grunduppgifter.
      if (!skipCompany) {
        if (!regOrgNr.trim() || regOrgNr.replace(/\D/g, '').length < 10) {
          setErrorMsg('Ange ett giltigt organisationsnummer (10 siffror)');
          return;
        }
        // Företagsnamnet fylls i automatiskt av ett lyckat FöretagsAPI-uppslag
        // (regCompany sätts då av companyLookup.applyCompany via
        // handleLookupField), men fältet nedan är ALLTID redigerbart för
        // hand — se motiveringen vid namnfältet: en enskild firma har inget
        // eget bolagsregister att slå upp (bara ägarens personnummer, se
        // orgType.js), och ett FöretagsAPI-avbrott/slut kredit-kvot (402)
        // ska aldrig kunna blockera en registrering helt. Så den här
        // kontrollen är bara ett vanligt obligatoriskt-fält-krav numera,
        // inte ett bevis på ett lyckat uppslag.
        if (!regCompany.trim()) {
          setErrorMsg('Ange företagsnamnet.');
          return;
        }
      }
      setRegStep(3);
      return;
    }

    if (regStep === 3) {
      if (regPassword.length < 8) { setErrorMsg('Lösenordet måste vara minst 8 tecken'); return; }
      if (regPassword !== regPassword2) { setErrorMsg('Lösenorden matchar inte'); return; }
      setLoading(true);
      // Egen flagga (inte bara "kom vi förbi signUp") — annars skulle ett
      // fel i själva Stripe-anropet felaktigt visa "kontot skapades" när
      // det egentligen var signUp() som aldrig lyckades.
      let accountCreated = false;
      try {
        const { data, error } = await supabase.auth.signUp({
          email: regEmail,
          password: regPassword,
          options: {
            data: {
              first_name: regFirstName,
              last_name: regLastName,
              // Tomma för en inbjuden person (se hasPendingInvite ovan —
              // App.jsx:s fetchUserData hoppar då över "skapa tomt
              // företag"-grenen helt, eftersom den bara körs när varken
              // egen data eller delad åtkomst finns) ELLER för "Jag har
              // inget företag än" (skipCompany, steg 2) — då körs samma
              // gren, men skapar ETT tomt platshållarföretag istället för
              // att hoppas över, se kommentaren vid skipCompany-deklarationen.
              company_name: (hasPendingInvite || skipCompany) ? '' : regCompany,
              org_nr: (hasPendingInvite || skipCompany) ? '' : regOrgNr,
            },
            ...(regCaptchaToken ? { captchaToken: regCaptchaToken } : {}),
          }
        });
        if (error) throw error;
        accountCreated = true;

        // Inbjuden person: inget eget företag, ingen egen prenumeration att
        // betala för — de rider på ägarens (se supabase-setup.sql:
        // company_members, App.jsx: fetchUserData/hasSharedAccess). Själva
        // inlösningen av inbjudan sker i App.jsx (redeemPendingInvite) så
        // fort en riktig session finns — här är det klart, invänta bara att
        // onAuthStateChange (App.jsx) tar över (kräver bekräftad e-post
        // beroende på projektets Supabase-inställningar, precis som annars).
        if (hasPendingInvite) {
          setLoading(false);
          return;
        }

        // Kontot finns nu (oavsett om data.session är satt — det kräver
        // bekräftad e-post beroende på Supabase-projektets inställningar,
        // men data.user.id finns redan). Skickas direkt vidare till Stripe
        // för betalningsuppgifter: 30 dagars gratis provperiod, sedan 99
        // kr/mån (create-subscription-checkout.js) — email-bekräftelsen
        // sköts parallellt via länken i mejlet, blockerar inte det här.
        setRedirectingToPayment(true);
        const { session } = await createStripeSubscriptionCheckout({
          user_id: data.user.id,
          customer_email: regEmail,
        });
        if (!session?.url) throw new Error('Ingen betalningslänk mottogs från Stripe.');
        window.location.href = session.url;
        return; // Lämnar sidan — inget mer att göra här.
      } catch (err) {
        setRedirectingToPayment(false);
        // requestStripeApi (stripeApi.js) har redan försökt tre gånger
        // innan den ger upp — ett kvarstående "Stripe API error (xxx)" är
        // troligen infrastrukturellt (Vercels edge/bot-skydd), inte något
        // fel i det användaren skrev in.
        const stripeIssue = /^Stripe API error \(\d+\)$/.test(err.message)
          ? 'kunde inte nå betalningstjänsten just nu'
          : err.message;
        setErrorMsg(
          accountCreated
            ? `Kontot skapades, men vi kunde inte skicka dig vidare till betalning (${stripeIssue}). Kontakta support@bokix.se så hjälper vi dig igång.`
            : translateSupabaseAuthError(err.message)
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div id="auth-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: '48px 20px', position: 'relative', overflow: 'hidden', background: '#0b1710' }}>
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
        @keyframes authSpin { to { transform: rotate(360deg); } }
        .auth-spin { animation: authSpin 1s linear infinite; }

        /* ── Atmosfären bakom kortet — ledger-linjer (papperslinjer som ett
           kassabok/verifikat) plus två långsamt drivande glöd-klot i exakt
           samma gröna/limegula toner som loggans egen gradient (BokixWordmark)
           och knapparnas BRAND.green. Rent dekorativt lager, aria-hidden,
           bakom allt annat (z-index -1 relativt #auth-root:s children). Ren
           CSS, ingen bildfil — håller sidan snabb och skarp på alla skärmar. */
        .auth-atmosphere { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .auth-atmosphere::before {
          content: ''; position: absolute; inset: 0;
          background-image: repeating-linear-gradient(rgba(238,243,234,0.05) 0 1px, transparent 1px 44px);
          -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, #000 0%, transparent 75%);
                  mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, #000 0%, transparent 75%);
        }
        .auth-glow { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.5; }
        .auth-glow-a { width: 480px; height: 480px; top: -160px; left: -120px; background: #3d7a2e; animation: authDriftA 22s ease-in-out infinite; }
        .auth-glow-b { width: 420px; height: 420px; bottom: -180px; right: -100px; background: #84cc16; opacity: 0.28; animation: authDriftB 26s ease-in-out infinite; }
        @keyframes authDriftA { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(40px, 30px); } }
        @keyframes authDriftB { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, -35px); } }

        .auth-column { position: relative; z-index: 1; width: 100%; max-width: 512px; display: flex; flex-direction: column; align-items: center; }
        @keyframes authRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .auth-brandblock { animation: authRise 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .auth-card { animation: authRise 0.5s cubic-bezier(0.16,1,0.3,1) 0.08s both; }

        /* Signaturdetaljen: en tunn gradient-linje längs kortets ÖVERKANT i
           precis samma två toner som loggans gradient börjar/slutar med —
           en "saldorad", inte en generisk dekorstrimma. Enda djärva detaljen
           på sidan; allt annat runt den hålls medvetet lugnt. */
        .auth-card { position: relative; }
        .auth-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16);
        }

        .auth-input { transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
        .auth-input:hover { border-color: var(--text-muted); }
        .auth-input:focus { border-color: #3d7a2e; box-shadow: 0 0 0 3px rgba(61,122,46,0.16); background: var(--bg-card); }

        .auth-btn-primary { transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
        .auth-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(61,122,46,0.32); }
        .auth-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .auth-btn-ghost { transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
        .auth-btn-ghost:hover { background: var(--bg-muted); color: var(--text-main); }
        #auth-root button:focus-visible, #auth-root input:focus-visible, #auth-root a:focus-visible {
          outline: 2px solid #3d7a2e; outline-offset: 2px;
        }

        .auth-tab { transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }

        @keyframes authStepIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .auth-step-fade { animation: authStepIn 0.28s ease both; }

        @keyframes authPulseRing { 0% { box-shadow: 0 0 0 0 rgba(61,122,46,0.35); } 100% { box-shadow: 0 0 0 14px rgba(61,122,46,0); } }
        .auth-pulse { animation: authPulseRing 1.8s ease-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .auth-spin, .auth-glow-a, .auth-glow-b, .auth-brandblock, .auth-card, .auth-step-fade, .auth-pulse { animation: none !important; }
          .auth-btn-primary:hover:not(:disabled) { transform: none; }
        }
        @media (max-width: 560px) {
          .auth-form-panel { padding: 34px 24px !important; }
        }
      `}</style>

      <div className="auth-atmosphere" aria-hidden="true">
        <div className="auth-glow auth-glow-a" />
        <div className="auth-glow auth-glow-b" />
      </div>

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
          läsa). */}
      <div className="auth-brandblock" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
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
          aria-label="Till startsidan"
          onClick={(e) => { if (onBackToLanding) { e.preventDefault(); onBackToLanding(); } }}
        >
          <BokixWordmark height={40} />
        </Link>
      </div>

      <div style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '22px', overflow: 'hidden', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(238,243,234,0.06)' }} className="auth-card">
        <div className="auth-form-panel" style={{ padding: '52px 52px 48px' }}>

        {/* Mode tabs — bugkritiskt (kundfeedback, med skärmdump): den aktiva
            fliken hade en HÅRDKODAD `background: 'white'` medan texten
            använde den tema-medvetna `var(--text-main)` — i mörkt läge blir
            den ljus/vit, så vit text på vit bakgrund gjorde "Logga in"-
            fliken praktiskt taget osynlig så fort appens tema (satt
            tidigare, t.ex. innan utloggning) var mörkt. `var(--bg-card)`
            istället: vit i ljust läge (ingen synlig skillnad där) men
            korrekt mörk i mörkt läge, matchar texten igen. */}
        <div style={{ display: 'flex', background: 'var(--border-light)', borderRadius: '12px', padding: '4px', marginBottom: '32px' }}>
          <button className="auth-tab" onClick={() => switchMode(true)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', background: isLogin ? 'var(--bg-card)' : 'transparent', color: isLogin ? 'var(--text-main)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: isLogin ? '0 2px 4px rgba(0,0,0,0.04)' : 'none', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <LogIn size={16} /> Logga in
          </button>
          <button className="auth-tab" onClick={() => switchMode(false)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px', background: !isLogin ? 'var(--bg-card)' : 'transparent', color: !isLogin ? 'var(--text-main)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: !isLogin ? '0 2px 4px rgba(0,0,0,0.04)' : 'none', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={16} /> Nytt konto
          </button>
        </div>

        {/* LOGIN */}
        {isLogin ? (
          showForgotPassword ? (
            /* "Glömt lösenord?" — se handleForgotPassword för varför samma
               bekräftelse alltid visas, oavsett om kontot faktiskt finns. */
            <>
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '31px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '7px', letterSpacing: '-0.01em' }}>Glömt lösenord?</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ange din e-postadress så skickar vi en återställningslänk.</p>
              </div>
              {forgotSent ? (
                <div style={{ padding: '32px 28px', background: 'var(--status-green-bg)', borderRadius: '16px', border: '1px solid var(--status-green-bg)', textAlign: 'center' }}>
                  <div className="auth-pulse" style={{ width: 64, height: 64, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                    <Mail size={26} color="white" />
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 600, fontSize: '21px', color: 'var(--text-main)', marginBottom: '10px' }}>Kolla din inkorg</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    Om det finns ett konto med den adressen har vi skickat en återställningslänk dit.
                  </div>
                  <button className="auth-btn-ghost" type="button" onClick={() => { setShowForgotPassword(false); setForgotSent(false); }} style={{ marginTop: '20px', background: 'none', border: 'none', borderRadius: '8px', color: BRAND.green, fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 8px' }}>
                    <ArrowLeft size={14} /> Tillbaka till inloggning
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>E-postadress</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', top: 13, left: 14, pointerEvents: 'none' }} />
                      <input className="auth-input" type="email" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="din@epost.se" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus />
                    </div>
                  </div>
                  <Turnstile onVerify={setForgotCaptchaToken} onExpire={() => setForgotCaptchaToken('')} />
                  {errorMsg && <div style={{ padding: '12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>}
                  <button className="auth-btn-primary" type="submit" disabled={forgotLoading} style={{ width: '100%', padding: '17px 18px', background: BRAND.green, border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, color: 'white', cursor: forgotLoading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(61,122,46,0.25)', fontFamily: 'inherit', opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? 'Skickar...' : 'Skicka återställningslänk'} <ArrowRight size={16} />
                  </button>
                  <button className="auth-btn-ghost" type="button" onClick={() => { setShowForgotPassword(false); setErrorMsg(''); }} style={{ background: 'none', border: 'none', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}>
                    <ArrowLeft size={14} /> Tillbaka till inloggning
                  </button>
                </form>
              )}
            </>
          ) : (
          <>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '33px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '7px', letterSpacing: '-0.01em' }}>Välkommen tillbaka</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Logga in på ditt konto nedan.</p>
            </div>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>E-postadress</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', top: 13, left: 14, pointerEvents: 'none' }} />
                  <input className="auth-input" type="email" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="din@epost.se" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={labelStyle}>Lösenord</label>
                  <button type="button" onClick={() => { setShowForgotPassword(true); setErrorMsg(''); setForgotEmail(loginEmail); }} style={{ background: 'none', border: 'none', color: BRAND.green, fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '6px' }}>
                    Glömt lösenord?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', top: 13, left: 14, pointerEvents: 'none' }} />
                  <input className="auth-input" type="password" style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                </div>
              </div>
              <Turnstile onVerify={setLoginCaptchaToken} onExpire={() => setLoginCaptchaToken('')} />
              {errorMsg && <div style={{ padding: '12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>}
              <button className="auth-btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '17px 18px', background: BRAND.green, border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, color: 'white', cursor: loading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(61,122,46,0.25)', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Loggar in...' : 'Logga in'} <ArrowRight size={16} />
              </button>
            </form>
          </>
          )
        ) : (
          /* REGISTER - Multi-step */
          <>
            {/* Step indicator */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                {REGISTER_STEPS.map((s, i) => (
                  <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <div style={{ position: 'relative', height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, borderRadius: '2px', background: 'linear-gradient(90deg, #3d7a2e, #84cc16)', transform: `scaleX(${i <= regStep ? 1 : 0})`, transformOrigin: 'left', transition: 'transform 0.35s ease' }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: i === regStep ? 700 : 500, color: i <= regStep ? BRAND.greenDark : 'var(--text-muted)' }}>{s}</span>
                  </div>
                ))}
              </div>
              <h2 key={regStep} className="auth-step-fade" style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '28px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px', letterSpacing: '-0.01em' }}>
                {regStep === 0 && 'Personlig info'}
                {regStep === 1 && 'Bekräfta e-post'}
                {regStep === 2 && 'Ditt företag'}
                {regStep === 3 && 'Skapa lösenord'}
              </h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                {regStep === 0 && 'Fyll i dina uppgifter för att skapa ett konto.'}
                {regStep === 1 && `Skriv in koden vi skickade till ${regEmail}.`}
                {regStep === 2 && 'Ange ditt företag – det här är obligatoriskt.'}
                {regStep === 3 && 'Sista steget — sedan skickas du vidare till betalning.'}
              </p>
            </div>

            <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* STEP 0 – Personal info */}
              {regStep === 0 && (
                <div key="step0" className="auth-step-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-row-2" style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Förnamn *</label>
                      <div style={{ position: 'relative' }}>
                        <User size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                        <input className="auth-input" type="text" style={{ ...inputStyle, paddingLeft: '38px' }} placeholder="Anna" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} required />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Efternamn</label>
                      <input className="auth-input" type="text" style={inputStyle} placeholder="Svensson" value={regLastName} onChange={e => setRegLastName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>E-postadress *</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input
                        className="auth-input"
                        type="email"
                        style={{ ...inputStyle, paddingLeft: '38px' }}
                        placeholder="anna@foretag.se"
                        value={regEmail}
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
              {regStep === 1 && (
                <div key="step1" className="auth-step-fade" style={{ padding: '32px 28px', background: 'var(--status-green-bg)', borderRadius: '16px', border: '1px solid var(--status-green-bg)', textAlign: 'center' }}>
                  <div className="auth-pulse" style={{ width: 64, height: 64, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                    <Mail size={26} color="white" />
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 600, fontSize: '21px', color: 'var(--text-main)', marginBottom: '10px' }}>Kolla din inkorg</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                    Vi skickade en sexsiffrig kod till<br />
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
                    onClick={async () => { setErrorMsg(''); const error = await sendCode(); if (error) setErrorMsg(error); }}
                    disabled={resendCooldown > 0 || otpStatus === 'sending'}
                    style={{ marginTop: '14px', background: 'none', border: 'none', borderRadius: '8px', padding: '6px 10px', color: resendCooldown > 0 ? 'var(--text-muted)' : BRAND.green, fontWeight: 700, fontSize: '13px', cursor: resendCooldown > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
                  >
                    {otpStatus === 'sending' ? 'Skickar…' : resendCooldown > 0 ? `Skicka koden igen (${resendCooldown}s)` : 'Fick du ingen kod? Skicka igen'}
                  </button>
                </div>
              )}

              {/* STEP 2 – Company. handleOrgNrChange slår upp mot
                  FöretagsAPI så fort 10 siffror är ifyllda och fyller
                  regCompany automatiskt (se companyLookup ovan) — men
                  namnfältet nedan är ALLTID ett vanligt redigerbart fält,
                  aldrig bara en bekräftelsetext. Tre fall där uppslaget
                  aldrig ger ett namn och manuell inmatning är den ENDA
                  vägen framåt: (1) enskild firma — inget eget
                  bolagsregister att slå upp (personnumret ÄR numret, se
                  orgType.js/useCompanyLookup.js), (2) FöretagsAPI:s
                  månadskvot slut (402), (3) registret helt otillgängligt
                  (502/nätverksfel). Innan den här ändringen fanns inget
                  namnfält alls här — vilket blockerade registrering HELT
                  i alla tre fallen (se git-historiken för den borttagna
                  varianten). */}
              {regStep === 2 && (
                <div key="step2" className="auth-step-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {emailVerified && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: BRAND.greenDark, marginTop: '-4px' }}>
                      <Check size={13} /> E-postadressen är verifierad
                    </div>
                  )}
                  {skipCompany ? (
                    // "Jag har inget företag än" valt — se knappen och
                    // handleNextStep:s regStep===2-gren för hela resonemanget.
                    // Ångra-knappen nollställer INTE regOrgNr/regCompany (om
                    // man redan hunnit skriva något innan man klickade skip,
                    // ingen anledning att slänga det).
                    <div style={{ padding: '16px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Inget företag registrerat än — inga problem.</div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Du kan lägga till organisationsnummer och företagsnamn senare, under Inställningar → Företag.
                      </div>
                      <button
                        type="button"
                        onClick={() => setSkipCompany(false)}
                        style={{ alignSelf: 'flex-start', marginTop: '4px', background: 'none', border: 'none', padding: 0, color: BRAND.green, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Jag har ett företag ändå
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label style={labelStyle}>Organisationsnummer * <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(10 siffror)</span></label>
                        <div style={{ position: 'relative' }}>
                          <Hash size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                          <input
                            className="auth-input"
                            type="text"
                            inputMode="numeric"
                            style={{ ...inputStyle, paddingLeft: '38px' }}
                            placeholder="556123-4567"
                            value={regOrgNr}
                            onChange={e => { const formatted = formatOrgNr(e.target.value); setRegOrgNr(formatted); setRegCompany(''); setRegLegalForm(''); companyLookup.handleOrgNrChange(formatted); }}
                            required
                          />
                        </div>
                        {companyLookup.orgLookup.status === 'loading' && <div style={lookupStatusStyle}>Hämtar företagsuppgifter…</div>}
                        {companyLookup.orgLookup.status === 'error' && <div style={lookupStatusStyle}>{companyLookup.orgLookup.message}</div>}
                        {/* Enskild firma är FÖRVÄNTAT, inte ett misslyckat uppslag
                            (se useCompanyLookup.js:s kommentar) — egen, positiv
                            stil (samma gröna Check-mönster som "Hämtat från
                            bolagsregistret" nedan) istället för att dela
                            lookupStatusStyles neutrala "nåt gick kanske fel"-ton. */}
                        {companyLookup.orgLookup.status === 'firma' && (
                          <div style={{ ...lookupStatusStyle, display: 'flex', alignItems: 'flex-start', gap: '6px', color: BRAND.greenDark, fontWeight: 600 }}>
                            <Check size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{companyLookup.orgLookup.message}</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={labelStyle}>Företagsnamn *</label>
                        <input
                          className="auth-input"
                          type="text"
                          style={inputStyle}
                          placeholder="Ex. Mitt Företag AB"
                          value={regCompany}
                          onChange={e => setRegCompany(e.target.value)}
                          required
                        />
                        {/* Kort, flyktig bekräftelse direkt efter ett lyckat
                            uppslag — fältet ovan är annars identiskt oavsett om
                            namnet kom från registret eller skrevs in för hand;
                            det ena är inte "mer rätt" eller mer låst än det andra. */}
                        {companyLookup.orgLookup.status === 'done' && regCompany && (
                          <div style={{ marginTop: '9px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: BRAND.greenDark }}>
                            <Check size={13} /> Hämtat från bolagsregistret — ändra gärna om något stämmer bättre.
                          </div>
                        )}
                        {displayedOrgType && (
                          <div style={{ marginTop: '9px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: BRAND.greenLight, borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark }}>
                            <Check size={13} /> Identifierad som: {displayedOrgType}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSkipCompany(true)}
                        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
                      >
                        Jag har inget företag än
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* STEP 3 – Password, sedan konto + betalning */}
              {regStep === 3 && redirectingToPayment && (
                <div className="auth-step-fade" style={{ padding: '32px 28px', background: 'var(--status-green-bg)', borderRadius: '16px', border: '1px solid var(--status-green-bg)', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                    <RefreshCw size={26} color="white" className="auth-spin" />
                  </div>
                  <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 600, fontSize: '21px', color: 'var(--text-main)', marginBottom: '10px' }}>Kontot är skapat</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    Skickar dig vidare till Stripe för betalningsuppgifter...
                  </div>
                </div>
              )}
              {regStep === 3 && !redirectingToPayment && (
                <div key="step3" className="auth-step-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Lösenord *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input className="auth-input" type="password" style={{ ...inputStyle, paddingLeft: '38px' }} placeholder="Minst 8 tecken" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={8} />
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
                    <label style={labelStyle}>Bekräfta lösenord *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', top: 14, left: 12, pointerEvents: 'none' }} />
                      <input className="auth-input" type="password" style={{ ...inputStyle, paddingLeft: '38px', borderColor: regPassword2 && regPassword2 !== regPassword ? '#f43f5e' : undefined }} placeholder="Upprepa lösenord" value={regPassword2} onChange={e => setRegPassword2(e.target.value)} required />
                    </div>
                  </div>

                  {/* Ärligt om vad som händer efter "Skapa konto och lägg
                      till betalning" — nästa steg är Stripes egen
                      betalningssida, inte direkt in i appen. */}
                  <div style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', padding: '10px 12px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '9px' }}>
                    <ShieldCheck size={15} color={BRAND.greenDark} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Näst skickas du till <StripeBadge /> för att lägga in betalningsuppgifter. 30 dagar gratis, sedan 99 kr/mån — avsluta innan dess så kostar det ingenting.
                    </span>
                  </div>
                  <Turnstile onVerify={setRegCaptchaToken} onExpire={() => setRegCaptchaToken('')} />
                </div>
              )}

              {errorMsg && (
                <div style={{ padding: '12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{errorMsg}</div>
              )}

              {!redirectingToPayment && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  {regStep > 0 && (
                    <button className="auth-btn-ghost" type="button" onClick={() => { setRegStep(s => s - 1); setErrorMsg(''); }} style={{ padding: '17px 22px', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                      <ArrowLeft size={14} /> Tillbaka
                    </button>
                  )}
                  {(() => {
                    const verifying = regStep === 1 && otpStatus === 'verifying';
                    const codeIncomplete = regStep === 1 && regVerifyCode.length !== 6;
                    const busy = loading || verifying;
                    const isDisabled = busy || codeIncomplete;
                    let label;
                    if (regStep === REGISTER_STEPS.length - 1) label = busy ? 'Skapar konto...' : 'Skapa konto och lägg till betalning';
                    else if (regStep === 0) label = busy ? 'Skickar kod...' : 'Fortsätt';
                    else if (regStep === 1) label = verifying ? 'Bekräftar...' : 'Bekräfta';
                    else label = busy ? 'Fortsätt...' : 'Fortsätt';
                    return (
                      <button className="auth-btn-primary" type="submit" disabled={isDisabled} style={{ flex: 1, padding: '17px 18px', background: BRAND.green, border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, color: 'white', cursor: isDisabled ? (busy ? 'wait' : 'not-allowed') : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(61,122,46,0.25)', fontFamily: 'inherit', opacity: isDisabled ? 0.6 : 1 }}>
                        {label} <ArrowRight size={16} />
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
